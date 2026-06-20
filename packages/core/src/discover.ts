/**
 * Filesystem discovery of agent-config files.
 *
 * Walks a directory and finds the files agentlint understands, classifying
 * each into a {@link FileKind}. Security-critical constraints:
 *  - Never follows symlinks that point outside the root directory.
 *  - Skips `node_modules`, `.git`, and `dist`.
 *  - Never reads files larger than {@link MAX_FILE_BYTES} (returns them with a
 *    flag so the engine can emit a graceful "too large" finding if desired;
 *    here we simply skip oversized files to avoid memory blowups).
 *  - Never executes anything.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FileKind, InputFile } from './types.js';

/** Hard cap on per-file size we are willing to read (1 MiB). */
export const MAX_FILE_BYTES = 1024 * 1024;

/** Directory names we never descend into. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'coverage']);

/**
 * Classify a path (relative or absolute) into a {@link FileKind}. Pure: this
 * does not touch the filesystem, so it is reused by `lintFiles` for pasted
 * content. Returns `'unknown'` for unrecognized paths.
 */
export function classifyPath(filePath: string): FileKind {
  // Normalize to POSIX separators for matching.
  const norm = filePath.replace(/\\/g, '/');
  const base = norm.split('/').pop() ?? norm;

  if (base === '.mcp.json') return 'mcp';
  if (base === 'settings.json' || base === 'settings.local.json') {
    if (norm.includes('.claude/')) return 'settings';
    // A bare settings.json outside .claude is not ours.
    return 'unknown';
  }
  if (base === 'CLAUDE.md') return 'claudemd';

  if (norm.includes('.claude/agents/') && base.endsWith('.md')) return 'agent';
  if (norm.includes('.claude/commands/') && base.endsWith('.md')) return 'command';

  // Agent Skills: `.claude/skills/<name>/SKILL.md`. We match any case-variant of
  // `skill.md` (e.g. `skill.md`, `Skill.md`) so the `skill/filename-not-canonical`
  // rule can flag the silent-failure case where Claude Code won't load a skill
  // whose file is not the exact, case-sensitive `SKILL.md`.
  // ReDoS-safe: anchored, fixed literal with a bounded class — no quantifier nesting.
  if (norm.includes('.claude/skills/') && /^skill\.md$/i.test(base)) return 'skill';

  // Cross-tool agent instruction files (broadens agentlint beyond Claude Code):
  // AGENTS.md (the emerging cross-tool standard), Cursor, Copilot, Windsurf, Cline.
  if (base === 'AGENTS.md') return 'instructions';
  if (base === '.cursorrules' || base === '.windsurfrules' || base === '.clinerules') return 'instructions';
  if (norm.includes('.cursor/rules/') && base.endsWith('.mdc')) return 'instructions';
  if (norm.includes('.github/') && base === 'copilot-instructions.md') return 'instructions';

  return 'unknown';
}

/**
 * Discover and read all agentlint-relevant files under `dir`.
 *
 * @param dir Root directory to scan (must be an existing directory).
 * @param ignore Optional gitignore-style patterns; matched paths are skipped.
 * @returns Array of {@link InputFile} with `content` and resolved `kind`.
 */
export async function discoverFiles(dir: string, ignore: string[] = []): Promise<InputFile[]> {
  const root = path.resolve(dir);
  const results: InputFile[] = [];
  const ignoreMatchers = ignore.map(compileIgnore);

  // Resolve the real root once so we can reject symlinks escaping it.
  let realRoot: string;
  try {
    realRoot = await fs.realpath(root);
  } catch {
    return results;
  }

  await walk(root);
  // Deterministic ordering for stable output.
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;

  async function walk(currentDir: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // unreadable directory: skip gracefully
    }

    for (const entry of entries) {
      const abs = path.join(currentDir, entry.name);
      const rel = path.relative(root, abs);
      const relPosix = rel.replace(/\\/g, '/');

      if (ignoreMatchers.some((m) => m(relPosix))) continue;

      if (entry.isSymbolicLink()) {
        // Resolve the link target; only follow if it stays within the root.
        let target: string;
        try {
          target = await fs.realpath(abs);
        } catch {
          continue; // dangling symlink
        }
        if (!isInside(realRoot, target)) continue; // escapes root: never follow
        let stat: import('node:fs').Stats;
        try {
          stat = await fs.stat(abs);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) await walk(abs);
        } else if (stat.isFile()) {
          await maybeRead(abs, rel);
        }
        continue;
      }

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(abs);
      } else if (entry.isFile()) {
        await maybeRead(abs, rel);
      }
    }
  }

  async function maybeRead(abs: string, rel: string): Promise<void> {
    const kind = classifyPath(rel);
    if (kind === 'unknown') return;
    try {
      const stat = await fs.stat(abs);
      if (stat.size > MAX_FILE_BYTES) return; // skip oversized files
      const content = await fs.readFile(abs, 'utf8');
      results.push({ path: rel.replace(/\\/g, '/'), content, kind });
    } catch {
      // Unreadable file: skip gracefully.
    }
  }
}

/** True if `child` is the same as or nested under `parent` (path-wise). */
function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Compile a single gitignore-ish pattern into a matcher. Supports `*` (any
 * run of non-slash chars) and `**` (any run including slashes), plus a leading
 * `/` to anchor and a trailing `/` to match directories. This is intentionally
 * small; the CLI layer can add full gitignore semantics if needed.
 *
 * ReDoS-safety: we translate globs into a regex composed solely of bounded
 * character classes (`[^/]*`, `.*`) with no nested quantifiers, so there is no
 * catastrophic backtracking. We also anchor with `^...$`.
 */
export function compileIgnore(pattern: string): (relPath: string) => boolean {
  let p = pattern.trim();
  if (p === '' || p.startsWith('#')) return () => false;

  const anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);

  // Escape regex metachars except our glob chars.
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '*') {
      if (p[i + 1] === '*') {
        re += '.*';
        i++;
        // Consume an immediately following slash so `**/` matches zero dirs.
        if (p[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(ch as string)) {
      re += '\\' + ch;
    } else {
      re += ch;
    }
  }

  // Unanchored patterns may match at any path segment boundary.
  const prefix = anchored ? '^' : '^(?:.*/)?';
  // A trailing `/` (dirOnly) and a plain pattern both match the directory and
  // anything beneath it, so the suffix is the same in both cases.
  const suffix = '(?:/.*)?$';
  const regex = new RegExp(prefix + re + suffix);
  return (relPath: string) => regex.test(relPath);
}

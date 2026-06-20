/**
 * Security rules (`security/*`) — SPEC §3. The product differentiator.
 *
 * These detect hardcoded secrets, dangerous shell, remote-code-execution
 * patterns, unauthenticated remote MCP, overly broad permissions, and
 * unpinned supply-chain packages.
 *
 * False-positive discipline (CRITICAL): `${ENV}` placeholders and obvious
 * example/dummy values must NOT be flagged. All regexes are ReDoS-safe (see
 * inline proofs and `util.ts`).
 */
import type { Rule, RuleContext, Finding } from '../types.js';
import {
  BEARER_LITERAL_RE,
  findSecrets,
  isDummySecret,
  isEnvPlaceholder,
  isSecretKeyName,
  makeFinding,
  redactSecret,
  shannonEntropy,
} from './util.js';

const DOCS_BASE = 'security';

/** Walk a JSON value, invoking `visit` for every string leaf with its path. */
function walkStrings(
  value: unknown,
  path: Array<string | number>,
  visit: (str: string, path: Array<string | number>) => void,
): void {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkStrings(v, [...path, i], visit));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(v, [...path, k], visit);
    }
  }
}

/** Resolve a {line,column} for a JSON path, else undefined. */
function jsonLoc(ctx: RuleContext, path: Array<string | number>): { line: number; column: number } | undefined {
  return ctx.file.json?.locate(path);
}

/* ------------------------------------------------------------------ */
/* Dangerous-command detection                                         */
/* ------------------------------------------------------------------ */

/**
 * Dangerous shell fragments. Each entry uses literal substrings or a single
 * bounded character class — NO nested quantifiers — so all are ReDoS-safe.
 */
const DANGEROUS_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  // `rm -rf` with any flag ordering, case-insensitive so uppercase aliases
  // (`rm -Rf`, `rm -rF`, `rm -R -f`) are caught too — `-R` is the documented
  // recursive flag on BSD/macOS. Bounded `\s+` between tokens + bounded optional
  // flag class; anchored to word boundary. No nested repetition → ReDoS-safe.
  { label: 'rm -rf', re: /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r|\brm\s+-r\s+-f|\brm\s+-rf\b/i },
  // GNU long-form: `rm --recursive --force` / `rm --force --recursive` (either
  // ordering). Bounded `[^\n]{0,200}` window between the two flags; single
  // bounded class run, no nested quantifiers — ReDoS-safe.
  {
    label: 'rm --recursive --force',
    re: /\brm\s+(?:--recursive[^\n]{0,200}--force|--force[^\n]{0,200}--recursive)\b/,
  },
  // Fork bomb.
  { label: 'fork bomb :(){', re: /:\s*\(\s*\)\s*\{/ },
  // Filesystem creation / raw disk writes.
  { label: 'mkfs', re: /\bmkfs(\.[a-z0-9]+)?\b/ },
  { label: 'dd if=', re: /\bdd\s+if=/ },
  { label: 'chmod 777', re: /\bchmod\s+(-[a-zA-Z]+\s+)?0?777\b/ },
  { label: 'write to raw device', re: />\s*\/dev\/sd[a-z]/ },
  // Privilege escalation.
  { label: 'sudo', re: /\bsudo\b/ },
  // Shell eval of (potentially untrusted) input.
  { label: 'eval', re: /\beval\b/ },
];

/** RCE: piping a remote download straight into a shell, or PowerShell IEX. */
const RCE_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  // `curl ... | sh|bash|zsh` — single bounded class run `[^|]{0,400}` (no
  // newline exclusion, so a `\`-continued multi-line command still matches);
  // the pipe + shell tail is fixed. No nested quantifier ambiguity → linear.
  { label: 'curl | sh', re: /\bcurl\b[^|]{0,400}\|\s*(sudo\s+)?(ba|z|da)?sh\b/ },
  { label: 'wget | sh', re: /\bwget\b[^|]{0,400}\|\s*(sudo\s+)?(ba|z|da)?sh\b/ },
  { label: 'fetch | sh', re: /\bfetch\b[^|]{0,400}\|\s*(sudo\s+)?(ba|z|da)?sh\b/ },
  // PowerShell Invoke-Expression of a download.
  { label: 'iex(...)', re: /\b(iex|Invoke-Expression)\s*\(/i },
  // `bash -c "$(curl ...)"` / `sh -c "$(wget ...)"`.
  { label: 'shell -c $(remote)', re: /\b(ba|z|da)?sh\s+-c\s+["']?\$\((curl|wget|fetch)\b/ },
];

/**
 * Prompt-injection / data-exfiltration directive phrases. A SKILL.md (or any
 * agent-instruction file) that tells the agent to ignore its instructions, hide
 * actions from the user, or exfiltrate secrets is the #1 way a malicious skill
 * subverts an agent — the injection lives in natural-language Markdown, not code.
 *
 * Each pattern is high-signal and ReDoS-safe: a fixed sequence of literals
 * separated by `\s+`, with bounded literal alternations and NO nested quantifiers.
 */
const PROMPT_INJECTION_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  {
    label: 'ignore previous instructions',
    re: /\bignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions|prompts?|rules|messages?|directions?)\b/i,
  },
  {
    label: 'disregard previous instructions',
    re: /\bdisregard\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier|preceding)\s+(?:instructions|prompts?|rules|messages?)\b/i,
  },
  {
    label: 'hide actions from the user',
    re: /\b(?:do not|don'?t|never|without)\s+(?:ever\s+)?(?:tell|telling|inform|informing|notify|notifying|alert|alerting|reveal\w*|disclos\w*|mention\w*)\s+(?:this\s+|it\s+|anything\s+)?(?:to\s+)?the\s+user\b/i,
  },
  { label: 'exfiltrate', re: /\bexfiltrat(?:e|es|ed|ing|ion)\b/i },
  {
    label: 'send secrets/credentials',
    re: /\bsend\s+(?:the\s+|all\s+|your\s+|my\s+)?(?:secrets?|credentials?|api[ _-]?keys?|access[ _-]?tokens?|passwords?|env(?:ironment)?\s+(?:variables?|vars?))\b/i,
  },
];

/** Collect all hook command strings from a settings root, with their paths. */
function collectHookCommands(root: Record<string, unknown>): Array<{ cmd: string; path: Array<string | number> }> {
  const out: Array<{ cmd: string; path: Array<string | number> }> = [];
  const hooks = root['hooks'];
  if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) return out;
  for (const [event, groups] of Object.entries(hooks as Record<string, unknown>)) {
    if (!Array.isArray(groups)) continue;
    groups.forEach((group, gi) => {
      if (group === null || typeof group !== 'object') return;
      const handlers = (group as Record<string, unknown>)['hooks'];
      if (!Array.isArray(handlers)) return;
      handlers.forEach((handler, hi) => {
        if (handler === null || typeof handler !== 'object') return;
        const cmd = (handler as Record<string, unknown>)['command'];
        if (typeof cmd === 'string') out.push({ cmd, path: ['hooks', event, gi, 'hooks', hi, 'command'] });
      });
    });
  }
  return out;
}

/** Collect MCP server arg/command strings, with their paths. */
function collectMcpCommands(root: Record<string, unknown>): Array<{ cmd: string; path: Array<string | number> }> {
  const out: Array<{ cmd: string; path: Array<string | number> }> = [];
  const servers = root['mcpServers'];
  if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return out;
  for (const [name, server] of Object.entries(servers as Record<string, unknown>)) {
    if (server === null || typeof server !== 'object' || Array.isArray(server)) continue;
    const s = server as Record<string, unknown>;
    if (typeof s['command'] === 'string') out.push({ cmd: s['command'], path: ['mcpServers', name, 'command'] });
    if (Array.isArray(s['args'])) {
      s['args'].forEach((a, i) => {
        if (typeof a === 'string') out.push({ cmd: a, path: ['mcpServers', name, 'args', i] });
      });
    }
  }
  return out;
}

export const securityRules: Rule[] = [
  {
    id: 'security/hardcoded-secret',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/hardcoded-secret`,
    appliesTo: ['mcp', 'settings', 'claudemd', 'command', 'agent', 'skill', 'instructions'],
    meta: {
      title: 'Hardcoded secret detected',
      description:
        'A literal API key/token/password was found. Use a `${ENV_VAR}` reference instead of committing the secret.',
    },
    check(ctx) {
      const findings: Finding[] = [];
      const seen = new Set<string>();
      const push = (value: string, name: string, loc?: { line: number; column: number }) => {
        const key = `${loc?.line ?? 0}:${loc?.column ?? 0}:${value}`;
        if (seen.has(key)) return;
        seen.add(key);
        findings.push(makeFinding(this, ctx, `Hardcoded ${name} detected (${redactSecret(value)}). Use a \${ENV_VAR} reference instead.`, loc));
      };

      if (ctx.file.kind === 'mcp' || ctx.file.kind === 'settings') {
        const json = ctx.file.json;
        if (!json || json.error || typeof json.value !== 'object' || json.value === null) {
          return findings;
        }
        walkStrings(json.value, [], (str, path) => {
          if (isEnvPlaceholder(str) || isDummySecret(str)) return;
          for (const hit of findSecrets(str)) {
            push(hit.value, hit.name, jsonLoc(ctx, path));
          }
        });
      } else {
        // Markdown-ish content: scan raw text.
        const text = ctx.file.content;
        for (const hit of findSecrets(text)) {
          if (isDummySecret(hit.value)) continue;
          push(hit.value, hit.name, ctx.offsetToLineColumn(hit.index));
        }
      }
      return findings;
    },
  },
  {
    id: 'security/dangerous-hook-command',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/dangerous-hook-command`,
    appliesTo: ['settings'],
    meta: {
      title: 'Hook command contains a dangerous shell operation',
      description: 'A hook runs automatically; destructive or privilege-escalating commands are flagged.',
    },
    check(ctx) {
      const json = ctx.file.json;
      if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
      const root = json.value as Record<string, unknown>;
      const findings: Finding[] = [];
      for (const { cmd, path } of collectHookCommands(root)) {
        for (const { label, re } of DANGEROUS_PATTERNS) {
          if (re.test(cmd)) {
            findings.push(makeFinding(this, ctx, `Hook command contains a dangerous operation (${label}).`, jsonLoc(ctx, path)));
            break; // one finding per command is enough
          }
        }
      }
      return findings;
    },
  },
  {
    id: 'security/remote-code-execution',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/remote-code-execution`,
    appliesTo: ['settings', 'mcp', 'command', 'agent', 'skill', 'claudemd', 'instructions'],
    meta: {
      title: 'Remote code execution pattern detected',
      description: 'Piping a downloaded script directly into a shell executes untrusted code; pin and review instead.',
    },
    check(ctx) {
      const findings: Finding[] = [];
      const scan = (text: string, loc?: { line: number; column: number }) => {
        for (const { label, re } of RCE_PATTERNS) {
          if (re.test(text)) {
            findings.push(makeFinding(this, ctx, `Remote-code-execution pattern detected (${label}).`, loc));
            return; // one per string
          }
        }
      };
      if (ctx.file.kind === 'settings') {
        const json = ctx.file.json;
        if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
        const root = json.value as Record<string, unknown>;
        for (const { cmd, path } of collectHookCommands(root)) scan(cmd, jsonLoc(ctx, path));
      } else if (ctx.file.kind === 'mcp') {
        const json = ctx.file.json;
        if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
        const root = json.value as Record<string, unknown>;
        for (const { cmd, path } of collectMcpCommands(root)) scan(cmd, jsonLoc(ctx, path));
      } else {
        // Markdown / CLAUDE.md body: scan the FULL content so multi-line
        // commands (e.g. `curl https://x \` then `| bash`) are detected. The
        // RCE regexes are bounded (no nested quantifiers) so this is ReDoS-safe.
        // Locate each match via the offset→line/column helper for precision.
        const text = ctx.file.content;
        for (const { label, re } of RCE_PATTERNS) {
          const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
          // Report EVERY occurrence, not just the first — a CLAUDE.md with two
          // separate `curl | sh` lines is two problems. Same loop guard as
          // findSecrets (util.ts) so zero-width matches can't spin.
          let m: RegExpExecArray | null;
          while ((m = g.exec(text)) !== null) {
            findings.push(
              makeFinding(this, ctx, `Remote-code-execution pattern detected (${label}).`, ctx.offsetToLineColumn(m.index)),
            );
            if (m.index === g.lastIndex) g.lastIndex++;
          }
        }
      }
      return findings;
    },
  },
  {
    id: 'security/suspicious-instruction',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/suspicious-instruction`,
    appliesTo: ['claudemd', 'agent', 'command', 'skill', 'instructions'],
    meta: {
      title: 'Possible prompt-injection / data-exfiltration instruction',
      description:
        'A directive telling the agent to ignore its instructions, hide actions from the user, or exfiltrate secrets is a hallmark of a malicious skill or instruction file. Review it.',
    },
    check(ctx) {
      const findings: Finding[] = [];
      const text = ctx.file.content;
      for (const { label, re } of PROMPT_INJECTION_PATTERNS) {
        const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        let m: RegExpExecArray | null;
        while ((m = g.exec(text)) !== null) {
          findings.push(
            makeFinding(
              this,
              ctx,
              `Possible prompt-injection / data-exfiltration instruction detected ("${label}"). If this is a skill or instruction file from someone else, treat it as untrusted.`,
              ctx.offsetToLineColumn(m.index),
            ),
          );
          if (m.index === g.lastIndex) g.lastIndex++; // guard zero-width
        }
      }
      return findings;
    },
  },
  {
    id: 'security/mcp-http-no-auth',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/mcp-http-no-auth`,
    appliesTo: ['mcp'],
    meta: {
      title: 'Remote MCP server has no authentication header',
      description: 'A remote (http/sse) MCP server without an Authorization/auth header may be unauthenticated.',
    },
    check(ctx) {
      const json = ctx.file.json;
      if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
      const root = json.value as Record<string, unknown>;
      const servers = root['mcpServers'];
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return [];
      const findings: Finding[] = [];
      for (const [name, server] of Object.entries(servers as Record<string, unknown>)) {
        if (server === null || typeof server !== 'object' || Array.isArray(server)) continue;
        const s = server as Record<string, unknown>;
        const type = s['type'];
        if (type !== 'http' && type !== 'sse') continue;
        const headers = s['headers'];
        const hasAuth =
          headers !== null &&
          typeof headers === 'object' &&
          !Array.isArray(headers) &&
          Object.keys(headers as Record<string, unknown>).some((h) => /^(authorization|x-api-key|api-key|x-auth-token)$/i.test(h));
        if (!hasAuth) {
          const loc = jsonLoc(ctx, ['mcpServers', name]);
          findings.push(makeFinding(this, ctx, `Remote MCP server "${name}" (${String(type)}) has no Authorization/auth header.`, loc));
        }
      }
      return findings;
    },
  },
  {
    id: 'security/broad-permissions',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/broad-permissions`,
    appliesTo: ['settings'],
    meta: {
      title: 'Permissions allow rule is overly broad',
      description: 'Wildcard allows like "*", "Bash(*)", or bare "Bash" grant the agent unrestricted power.',
    },
    check(ctx) {
      const json = ctx.file.json;
      if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
      const root = json.value as Record<string, unknown>;
      const perms = root['permissions'];
      if (perms === null || typeof perms !== 'object' || Array.isArray(perms)) return [];
      const allow = (perms as Record<string, unknown>)['allow'];
      if (!Array.isArray(allow)) return [];
      const findings: Finding[] = [];
      allow.forEach((entry, i) => {
        if (typeof entry !== 'string') return;
        const trimmed = entry.trim();
        // Overly broad: literal "*", "Bash", or "Bash(*)" / "Bash(:*)".
        // ReDoS-safe: anchored, fixed/bounded class, no nesting.
        const broad = trimmed === '*' || trimmed === 'Bash' || /^Bash\(\s*:?\*\s*\)$/.test(trimmed);
        if (broad) {
          const loc = jsonLoc(ctx, ['permissions', 'allow', i]);
          findings.push(makeFinding(this, ctx, `Overly broad permission "${trimmed}" in permissions.allow; scope it (e.g. Bash(git status:*)).`, loc));
        }
      });
      return findings;
    },
  },
  {
    id: 'security/unpinned-mcp-package',
    severity: 'info',
    fixable: false,
    docsSlug: `${DOCS_BASE}/unpinned-mcp-package`,
    appliesTo: ['mcp'],
    meta: {
      title: 'MCP stdio package is not version-pinned',
      description: 'Running npx/uvx without an @version pulls the latest package each run — a supply-chain risk.',
    },
    check(ctx) {
      const json = ctx.file.json;
      if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
      const root = json.value as Record<string, unknown>;
      const servers = root['mcpServers'];
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return [];
      const findings: Finding[] = [];
      for (const [name, server] of Object.entries(servers as Record<string, unknown>)) {
        if (server === null || typeof server !== 'object' || Array.isArray(server)) continue;
        const s = server as Record<string, unknown>;
        const command = typeof s['command'] === 'string' ? s['command'] : '';
        const args = Array.isArray(s['args']) ? (s['args'] as unknown[]).filter((a): a is string => typeof a === 'string') : [];
        // ReDoS-safe: anchored exact match on basename of the runner.
        const isRunner = /(^|\/)(npx|uvx)$/.test(command);
        if (!isRunner) continue;
        // Find the package spec: first arg that is not a flag.
        const pkg = args.find((a) => !a.startsWith('-'));
        if (pkg === undefined) continue;
        if (!isPinned(pkg)) {
          const idx = args.indexOf(pkg);
          const loc = jsonLoc(ctx, ['mcpServers', name, 'args', idx]);
          findings.push(makeFinding(this, ctx, `MCP server "${name}" runs "${pkg}" via ${command} without a pinned @version (supply-chain risk).`, loc));
        }
      }
      return findings;
    },
  },
  {
    id: 'security/secret-named-env-plaintext',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/secret-named-env-plaintext`,
    appliesTo: ['settings', 'mcp'],
    meta: {
      title: 'Secret-named field holds a plaintext value',
      description: 'A secret-looking key (token/api_key/password/…) has a literal value; use a `${ENV_VAR}` reference.',
    },
    check(ctx) {
      const json = ctx.file.json;
      if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
      const findings: Finding[] = [];
      const seen = new Set<string>();
      walkStrings(json.value, [], (str, path) => {
        const key = path.length > 0 ? path[path.length - 1] : undefined;
        if (typeof key !== 'string') return;
        // Fire ONLY when the value lives under an `env`/`headers` subtree AND its
        // own key is secret-named. This prevents false positives on arbitrary
        // secret-named keys elsewhere (e.g. a top-level `{"password":"..."}`).
        if (!(path.some((s) => s === 'env' || s === 'headers') && isSecretKeyName(key))) return;
        if (isEnvPlaceholder(str)) return; // ${ENV} is the recommended form
        if (str.trim() === '') return;
        if (isDummySecret(str)) return;
        // Heuristic: short or low-entropy values that are clearly not secrets
        // (e.g. "true", "1") are skipped. Real secrets are longer/high-entropy.
        if (str.length < 8) return;
        if (shannonEntropy(str) < 2.5) return;
        const locKey = `${path.join('.')}`;
        if (seen.has(locKey)) return;
        seen.add(locKey);
        const loc = jsonLoc(ctx, path);
        findings.push(makeFinding(this, ctx, `Secret-named field "${key}" has a plaintext value (${redactSecret(str)}); use a \${ENV_VAR} reference.`, loc));
      });
      return findings;
    },
  },
  {
    id: 'security/mcp-insecure-url',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/mcp-insecure-url`,
    appliesTo: ['mcp'],
    meta: {
      title: 'Remote MCP server uses an insecure http:// URL',
      description:
        'A remote MCP endpoint reached over plaintext http:// transmits any auth header in the clear. Use https:// — localhost/loopback is exempt.',
    },
    check(ctx) {
      const json = ctx.file.json;
      if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
      const root = json.value as Record<string, unknown>;
      const servers = root['mcpServers'];
      if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return [];
      const findings: Finding[] = [];
      for (const [name, server] of Object.entries(servers as Record<string, unknown>)) {
        if (server === null || typeof server !== 'object' || Array.isArray(server)) continue;
        const s = server as Record<string, unknown>;
        const url = typeof s['url'] === 'string' ? (s['url'] as string).trim() : '';
        // ReDoS-safe: anchored prefix tests, no quantifier nesting.
        if (!/^http:\/\//i.test(url)) continue;
        // Loopback over http is fine (never leaves the machine).
        if (/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(url)) continue;
        const headers = s['headers'];
        const hasAuth =
          headers !== null &&
          typeof headers === 'object' &&
          !Array.isArray(headers) &&
          Object.keys(headers as Record<string, unknown>).some((h) => /^(authorization|x-api-key|api-key|x-auth-token)$/i.test(h));
        const loc = jsonLoc(ctx, ['mcpServers', name, 'url']);
        const msg = hasAuth
          ? `MCP server "${name}" sends an auth header over plaintext http:// — credentials are exposed in transit. Use https://.`
          : `MCP server "${name}" uses a plaintext http:// URL; use https:// for remote endpoints.`;
        findings.push(makeFinding(this, ctx, msg, loc));
      }
      return findings;
    },
  },
  {
    id: 'security/permission-allow-deny-conflict',
    severity: 'warning',
    fixable: false,
    docsSlug: `${DOCS_BASE}/permission-allow-deny-conflict`,
    appliesTo: ['settings'],
    meta: {
      title: 'Permission appears in both allow and deny',
      description:
        'A rule listed in both permissions.allow and permissions.deny is contradictory; deny always wins, so the allow entry is dead and misleading.',
    },
    check(ctx) {
      const json = ctx.file.json;
      if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
      const root = json.value as Record<string, unknown>;
      const perms = root['permissions'];
      if (perms === null || typeof perms !== 'object' || Array.isArray(perms)) return [];
      const p = perms as Record<string, unknown>;
      const allow = Array.isArray(p['allow']) ? (p['allow'] as unknown[]) : [];
      const deny = Array.isArray(p['deny']) ? (p['deny'] as unknown[]) : [];
      if (allow.length === 0 || deny.length === 0) return [];
      const denySet = new Set(deny.filter((x): x is string => typeof x === 'string').map((x) => x.trim()));
      const findings: Finding[] = [];
      allow.forEach((entry, i) => {
        if (typeof entry !== 'string') return;
        const trimmed = entry.trim();
        if (denySet.has(trimmed)) {
          const loc = jsonLoc(ctx, ['permissions', 'allow', i]);
          findings.push(makeFinding(this, ctx, `Permission "${trimmed}" is in both allow and deny; deny wins, so this allow entry is dead. Remove one.`, loc));
        }
      });
      return findings;
    },
  },
  {
    id: 'security/permissions-bypass-mode',
    severity: 'error',
    fixable: false,
    docsSlug: `${DOCS_BASE}/permissions-bypass-mode`,
    appliesTo: ['settings'],
    meta: {
      title: 'permissions.defaultMode disables permission prompts',
      description:
        'defaultMode "bypassPermissions" lets the agent run ANY command with no confirmation — the single most dangerous setting to commit.',
    },
    check(ctx) {
      const json = ctx.file.json;
      if (!json || json.error || typeof json.value !== 'object' || json.value === null) return [];
      const root = json.value as Record<string, unknown>;
      const perms = root['permissions'];
      if (perms === null || typeof perms !== 'object' || Array.isArray(perms)) return [];
      const mode = (perms as Record<string, unknown>)['defaultMode'];
      if (mode !== 'bypassPermissions') return [];
      const loc = jsonLoc(ctx, ['permissions', 'defaultMode']);
      return [
        makeFinding(
          this,
          ctx,
          'permissions.defaultMode "bypassPermissions" disables ALL permission prompts — the agent can run any command without confirmation. Do not commit this.',
          loc,
        ),
      ];
    },
  },
];

/**
 * A package spec is "pinned" if it carries an explicit `@version` (npm) or
 * `==`/`@` version (uvx/PyPI). Scoped packages keep their leading `@scope/`.
 *
 * ReDoS-safe: only `indexOf`/`startsWith`/`includes` and bounded char tests.
 */
function isPinned(pkg: string): boolean {
  // Scoped npm package: @scope/name[@version]. Strip the leading scope `@`.
  let rest = pkg;
  if (rest.startsWith('@')) {
    const slash = rest.indexOf('/');
    if (slash === -1) return false; // malformed scope, treat as unpinned
    rest = rest.slice(slash + 1);
  }
  // Pinned ONLY if the remainder carries an `@<version>` whose version segment
  // starts with a digit (a semver like 1.2.3). Dist-tags such as `@latest`,
  // `@next`, `@alpha`, `@beta` re-resolve to the newest publish on every run —
  // that is the exact supply-chain risk this rule exists to flag, so they are
  // NOT pinned.
  const atIdx = rest.lastIndexOf('@');
  if (atIdx > 0 && /^[0-9]/.test(rest.slice(atIdx + 1))) return true;
  // PyPI exact-version specifier (e.g. `uvx pkg==1.2.3`).
  if (pkg.includes('==')) return true;
  return false;
}

export { isPinned };

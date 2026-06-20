/**
 * `.agentlintrc.json` discovery and loading (SPEC §5).
 *
 * Walks from a starting directory upward to the filesystem root, looking for a
 * `.agentlintrc.json`. The nearest one wins (we stop at the first match — this
 * is the conventional "closest config" behavior). The file is parsed as strict
 * JSON; malformed config is a usage/config error (CLI exit code 2).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LintOptions, Severity } from 'agentlint-core';

/** The on-disk shape of `.agentlintrc.json`. */
export interface AgentlintConfig {
  /** Per-rule severity overrides. */
  rules?: Record<string, 'off' | Severity>;
  /** Gitignore-style ignore patterns. */
  ignore?: string[];
}

/** Result of loading config: the parsed config plus the file it came from. */
export interface LoadedConfig {
  config: AgentlintConfig;
  /** Absolute path of the config file used, or `null` if none was found. */
  path: string | null;
}

/** The config filename agentlint looks for. */
export const CONFIG_FILENAME = '.agentlintrc.json';

/** A user-facing config error (bad JSON or wrong shape). Caller exits 2. */
export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

const VALID_SEVERITIES = new Set(['off', 'error', 'warning', 'info']);

/**
 * Find and load the nearest `.agentlintrc.json` at or above `startDir`.
 *
 * @throws {ConfigError} if a config file is found but is not valid JSON or has
 *   the wrong shape.
 */
export async function loadConfig(startDir: string): Promise<LoadedConfig> {
  let dir = path.resolve(startDir);
  // Guard against infinite loops; the loop terminates at the FS root anyway.
  for (;;) {
    const candidate = path.join(dir, CONFIG_FILENAME);
    let raw: string | undefined;
    try {
      raw = await fs.readFile(candidate, 'utf8');
    } catch {
      raw = undefined;
    }
    if (raw !== undefined) {
      return { config: parseConfig(raw, candidate), path: candidate };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return { config: {}, path: null };
}

/** Parse and validate raw config text. */
export function parseConfig(raw: string, sourcePath: string): AgentlintConfig {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Invalid JSON in ${sourcePath}: ${reason}`);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ConfigError(`Config ${sourcePath} must be a JSON object.`);
  }

  const obj = data as Record<string, unknown>;
  const config: AgentlintConfig = {};

  if (obj.rules !== undefined) {
    if (
      obj.rules === null ||
      typeof obj.rules !== 'object' ||
      Array.isArray(obj.rules)
    ) {
      throw new ConfigError(`Config ${sourcePath}: "rules" must be an object.`);
    }
    const rules: Record<string, 'off' | Severity> = {};
    for (const [ruleId, sev] of Object.entries(obj.rules as Record<string, unknown>)) {
      if (typeof sev !== 'string' || !VALID_SEVERITIES.has(sev)) {
        throw new ConfigError(
          `Config ${sourcePath}: rule "${ruleId}" has invalid severity ` +
            `"${String(sev)}". Use one of: off, error, warning, info.`,
        );
      }
      rules[ruleId] = sev as 'off' | Severity;
    }
    config.rules = rules;
  }

  if (obj.ignore !== undefined) {
    if (!Array.isArray(obj.ignore) || obj.ignore.some((x) => typeof x !== 'string')) {
      throw new ConfigError(
        `Config ${sourcePath}: "ignore" must be an array of strings.`,
      );
    }
    config.ignore = obj.ignore as string[];
  }

  return config;
}

/**
 * Merge a loaded config into the {@link LintOptions} passed to core. CLI flags
 * (e.g. `--fix`) are layered on top by the caller.
 */
export function toLintOptions(config: AgentlintConfig): LintOptions {
  const opts: LintOptions = {};
  if (config.rules) opts.rules = config.rules;
  if (config.ignore) opts.ignore = config.ignore;
  return opts;
}

/** The starter config written by `agentlint init`. */
export const STARTER_CONFIG = `${JSON.stringify(
  {
    // No `$schema` is emitted: the hosted JSON Schema is not published yet, and
    // shipping a 404 reference in the very first command a user runs is a poor
    // first impression. Add it back here once the schema is hosted.
    rules: {},
    ignore: ['node_modules', 'dist'],
  },
  null,
  2,
)}\n`;

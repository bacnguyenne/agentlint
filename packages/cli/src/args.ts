/**
 * Hand-rolled argv parser for the agentlint CLI (SPEC §5). No external deps.
 *
 * Supports the documented flags and the `init` subcommand. Parsing never throws
 * for malformed input within reach of the CLI contract: instead it returns an
 * `error` so the caller can print a usage message and exit with code 2.
 */

/** Output format for the reporter. */
export type Format = 'stylish' | 'json';

/** A successfully parsed `init` invocation. */
export interface InitCommand {
  kind: 'init';
  /** Overwrite an existing `.agentlintrc.json`. */
  force: boolean;
}

/** A successfully parsed lint invocation (the default command). */
export interface LintCommand {
  kind: 'lint';
  /** Paths to lint (defaults to `['.']` when none given). */
  paths: string[];
  fix: boolean;
  format: Format;
  quiet: boolean;
  /** Fail when warnings exceed this count; `null` disables the check. */
  maxWarnings: number | null;
  /**
   * Desired color behavior:
   * - `'never'`  → `--no-color` or `NO_COLOR` set.
   * - `'always'` → explicit `--color`.
   * - `'auto'`   → default; the runner enables color only on a TTY.
   */
  colorMode: 'auto' | 'always' | 'never';
}

/** A successfully parsed `add` invocation (install a catalog item). */
export interface AddCommand {
  kind: 'add';
  /** The catalog item id or name to install (undefined when `--list`). */
  idOrName: string | undefined;
  /** Overwrite an existing target file. */
  force: boolean;
  /** Print what would be written without touching the filesystem. */
  dryRun: boolean;
  /** List the available catalog items instead of installing. */
  list: boolean;
}

/** `--help`, `--version`, or `mcp` (run the MCP server) — short-circuits. */
export interface MetaCommand {
  kind: 'help' | 'version' | 'mcp';
}

/** A parse failure with a human-readable reason (exit code 2). */
export interface ParseError {
  kind: 'error';
  message: string;
}

export type ParsedArgs = LintCommand | InitCommand | AddCommand | MetaCommand | ParseError;

/** Known flags that take a value, so we can validate `--flag value` forms. */
const VALUE_FLAGS = new Set(['--format', '--max-warnings']);

/**
 * Parse the CLI argv (already sliced to exclude `node` and the script path).
 *
 * @param argv Raw arguments.
 * @param env  Environment, consulted for `NO_COLOR`. Defaults to `process.env`.
 */
export function parseArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): ParsedArgs {
  // `--help` / `--version` win regardless of position or other args.
  if (argv.includes('--help') || argv.includes('-h')) return { kind: 'help' };
  if (argv.includes('--version') || argv.includes('-v') || argv.includes('-V')) {
    return { kind: 'version' };
  }

  // Subcommand: `init` is only the init command when it is the FIRST token.
  // (Detecting it as merely the first NON-FLAG token mis-read `agentlint --fix
  // init` — where `init` is really a path — as the subcommand and then emitted a
  // confusing "Unknown option for 'init': --fix".)
  if (argv[0] === 'init') {
    let force = false;
    for (const arg of argv) {
      if (arg === 'init') continue;
      if (arg === '--force' || arg === '-f') {
        force = true;
        continue;
      }
      return { kind: 'error', message: `init does not accept other options or flags (got: ${arg}).` };
    }
    return { kind: 'init', force };
  }

  // Subcommand: `mcp` runs the MCP stdio server (same as the agentlint-mcp bin).
  if (argv[0] === 'mcp') return { kind: 'mcp' };

  // Subcommand: `add <id>` installs a catalog item. Only when it is the FIRST
  // token (mirrors the `init` handling above).
  if (argv[0] === 'add') {
    const add: AddCommand = { kind: 'add', idOrName: undefined, force: false, dryRun: false, list: false };
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i] as string;
      if (arg === '--force' || arg === '-f') add.force = true;
      else if (arg === '--dry-run' || arg === '-n') add.dryRun = true;
      else if (arg === '--list' || arg === '-l') add.list = true;
      else if (arg.startsWith('-') && arg !== '-') {
        return { kind: 'error', message: `Unknown option for 'add': ${arg}` };
      } else if (add.idOrName === undefined) {
        add.idOrName = arg;
      } else {
        return { kind: 'error', message: `add accepts a single item id (got extra: ${arg}).` };
      }
    }
    if (!add.list && add.idOrName === undefined) {
      return { kind: 'error', message: `add requires an item id, or use 'agentlint add --list'.` };
    }
    return add;
  }

  const cmd: LintCommand = {
    kind: 'lint',
    paths: [],
    fix: false,
    format: 'stylish',
    quiet: false,
    maxWarnings: null,
    colorMode: 'auto',
  };

  let noColor = false;
  let explicitColor = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;

    // Support `--flag=value` syntax for value flags.
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=');
      const name = arg.slice(0, eq);
      const value = arg.slice(eq + 1);
      const res = applyValueFlag(cmd, name, value);
      if (res) return res;
      continue;
    }

    switch (arg) {
      case '--fix':
        cmd.fix = true;
        break;
      case '--quiet':
      case '-q':
        cmd.quiet = true;
        break;
      case '--no-color':
        noColor = true;
        break;
      case '--color':
        // Explicit request; overrides TTY auto-detection and NO_COLOR.
        explicitColor = true;
        noColor = false;
        break;
      case '--format':
      case '--max-warnings': {
        const value = argv[i + 1];
        if (value === undefined) {
          return { kind: 'error', message: `Option ${arg} requires a value.` };
        }
        // For --format keep the leading-dash guard so a stray flag isn't
        // swallowed as a value. For --max-warnings, consume the next token even
        // when it starts with '-' (e.g. "-1") so numeric validation can report
        // a clear "Invalid --max-warnings '-1'..." error instead of the
        // misleading "requires a value".
        if (arg === '--format' && value.startsWith('-') && value !== '-') {
          return { kind: 'error', message: `Option ${arg} requires a value.` };
        }
        i++;
        const res = applyValueFlag(cmd, arg, value);
        if (res) return res;
        break;
      }
      default:
        if (arg.startsWith('-') && arg !== '-') {
          return { kind: 'error', message: `Unknown option: ${arg}` };
        }
        cmd.paths.push(arg);
        break;
    }
  }

  if (cmd.paths.length === 0) cmd.paths.push('.');

  // Resolve color mode. Explicit --color wins. Otherwise --no-color or the
  // NO_COLOR env (https://no-color.org/) force it off; the default is 'auto',
  // which the runner resolves against whether stdout is a TTY.
  if (explicitColor) {
    cmd.colorMode = 'always';
  } else if (noColor || (env.NO_COLOR !== undefined && env.NO_COLOR !== '')) {
    cmd.colorMode = 'never';
  }

  return cmd;
}

/**
 * Apply a value-bearing flag (`--format`, `--max-warnings`). Returns a
 * {@link ParseError} on invalid values, otherwise `undefined`.
 */
function applyValueFlag(
  cmd: LintCommand,
  name: string,
  value: string,
): ParseError | undefined {
  if (!VALUE_FLAGS.has(name)) {
    return { kind: 'error', message: `Unknown option: ${name}` };
  }
  if (name === '--format') {
    if (value !== 'stylish' && value !== 'json') {
      return {
        kind: 'error',
        message: `Invalid --format '${value}'. Expected 'stylish' or 'json'.`,
      };
    }
    cmd.format = value;
    return undefined;
  }
  // --max-warnings
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    return {
      kind: 'error',
      message: `Invalid --max-warnings '${value}'. Expected a non-negative integer.`,
    };
  }
  cmd.maxWarnings = n;
  return undefined;
}

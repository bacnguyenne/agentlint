/**
 * The `agentcheck mcp` subcommand runs the MCP stdio server (same as the
 * standalone `agentcheck-mcp` bin). These tests drive it over stdio.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { execa } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..');
const repoRoot = path.resolve(cliRoot, '..', '..');
const cliEntry = path.join(cliRoot, 'dist', 'index.js');
const mcpBin = path.join(cliRoot, 'dist', 'mcp.js');

beforeAll(async () => {
  await execa('npm', ['run', 'build', '-w', 'agentcheck-core'], { cwd: repoRoot });
  await execa('npm', ['run', 'build', '-w', 'agentcheck'], { cwd: repoRoot });
}, 180_000);

const initialize = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n';
const toolsList = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n';

describe('agentcheck mcp (subcommand)', () => {
  it('responds to initialize with serverInfo', async () => {
    const res = await execa('node', [cliEntry, 'mcp'], { input: initialize, reject: false });
    expect(res.stdout).toContain('"serverInfo"');
    expect(res.stdout).toContain('"agentcheck"');
  });

  it('lists its MCP tools', async () => {
    const res = await execa('node', [cliEntry, 'mcp'], { input: toolsList, reject: false });
    expect(res.stdout).toContain('lint_config');
    expect(res.stdout).toContain('lint_directory');
    expect(res.stdout).toContain('list_rules');
  });
});

describe('agentcheck-mcp (standalone bin)', () => {
  it('still works the same way', async () => {
    const res = await execa('node', [mcpBin], { input: initialize, reject: false });
    expect(res.stdout).toContain('"serverInfo"');
  });
});

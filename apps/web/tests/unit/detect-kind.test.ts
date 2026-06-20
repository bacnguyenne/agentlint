import { describe, it, expect } from 'vitest';
import { detectKind, pathForKind, SELECTABLE_KINDS } from '@/lib/detect-kind';

describe('detectKind', () => {
  it('uses a recognizable path first (.mcp.json)', () => {
    expect(detectKind('{}', '.mcp.json')).toBe('mcp');
  });

  it('classifies settings.json by path', () => {
    expect(detectKind('{}', '.claude/settings.json')).toBe('settings');
    expect(detectKind('{}', 'some/dir/.claude/settings.local.json')).toBe('settings');
  });

  it('classifies agent / command by path', () => {
    expect(detectKind('x', '.claude/agents/foo.md')).toBe('agent');
    expect(detectKind('x', '.claude/commands/bar.md')).toBe('command');
  });

  it('detects .mcp.json from content (mcpServers key)', () => {
    const json = JSON.stringify({ mcpServers: { a: { command: 'x' } } });
    expect(detectKind(json)).toBe('mcp');
  });

  it('detects settings.json from content (hooks/permissions keys)', () => {
    expect(detectKind(JSON.stringify({ hooks: {} }))).toBe('settings');
    expect(detectKind(JSON.stringify({ permissions: { allow: [] } }))).toBe('settings');
  });

  it('detects a subagent from frontmatter with name + description', () => {
    const md = `---\nname: reviewer\ndescription: reviews code\n---\nbody`;
    expect(detectKind(md)).toBe('agent');
  });

  it('detects a slash command from command-only frontmatter keys', () => {
    const md = `---\nargument-hint: [x]\nallowed-tools: Read\n---\nbody`;
    expect(detectKind(md)).toBe('command');
  });

  it('treats plain markdown (no frontmatter) as CLAUDE.md', () => {
    expect(detectKind('# My project\n\nSome notes.')).toBe('claudemd');
  });

  it('handles empty content gracefully', () => {
    expect(detectKind('')).toBe('claudemd');
  });

  it('detects mcp even from malformed JSON mentioning mcpServers', () => {
    expect(detectKind('{ "mcpServers": [ broken')).toBe('mcp');
  });

  it('pathForKind returns a canonical path for every selectable kind', () => {
    for (const k of SELECTABLE_KINDS) {
      expect(pathForKind(k)).toBeTruthy();
    }
  });
});

import { describe, it, expect } from 'vitest';
import { lintOne } from './helpers.js';
import { parseJson } from '../src/parse/json.js';
import { findSecrets, BEARER_LITERAL_RE, isValidModel, AGENT_MODEL_ALIASES } from '../src/rules/util.js';

/**
 * ReDoS guards: feed pathological inputs and assert each completes quickly.
 * If any regex had catastrophic backtracking these would hang for seconds+.
 */
const BUDGET_MS = 1000;

function timed(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('ReDoS resistance', () => {
  it('secret scanning is fast on long strings', () => {
    const evil = 'sk-' + 'a'.repeat(100_000);
    const ms = timed(() => findSecrets(evil));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('Bearer regex is fast on long pathological input', () => {
    const evil = 'Bearer ' + 'a'.repeat(100_000) + '!';
    const ms = timed(() => BEARER_LITERAL_RE.test(evil));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('model validation is fast on long input', () => {
    const evil = 'claude-' + '1'.repeat(100_000);
    const ms = timed(() => isValidModel(evil, AGENT_MODEL_ALIASES));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('JSON parsing is fast on deeply repetitive input', () => {
    const evil = '{"a":"' + 'x'.repeat(200_000) + '"}';
    const ms = timed(() => parseJson(evil));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('full lint is fast on a large CLAUDE.md with dangerous-looking tokens', () => {
    const evil = ('curl ' + 'x'.repeat(2000) + ' | not-a-shell\n').repeat(500);
    const ms = timed(() => lintOne('CLAUDE.md', evil));
    expect(ms).toBeLessThan(2000);
  });

  it('dangerous-command scanning is fast on long hook commands', () => {
    const cmd = 'rm ' + '-'.repeat(50_000) + 'x';
    const content = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: cmd }] }] } });
    const ms = timed(() => lintOne('.claude/settings.json', content));
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});

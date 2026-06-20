import { describe, it, expect } from 'vitest';
import { parseJson } from '../src/parse/json.js';

describe('parseJson', () => {
  it('parses a simple object', () => {
    const r = parseJson('{"a":1,"b":"x"}');
    expect(r.error).toBeUndefined();
    expect(r.value).toEqual({ a: 1, b: 'x' });
  });

  it('parses nested arrays and objects', () => {
    const r = parseJson('{"arr":[1,{"k":true},null]}');
    expect(r.value).toEqual({ arr: [1, { k: true }, null] });
  });

  it('parses all literal types', () => {
    expect(parseJson('true').value).toBe(true);
    expect(parseJson('false').value).toBe(false);
    expect(parseJson('null').value).toBe(null);
    expect(parseJson('-12.5e3').value).toBe(-12500);
    expect(parseJson('"hi"').value).toBe('hi');
  });

  it('decodes string escapes including unicode', () => {
    const r = parseJson('"a\\n\\t\\u0041\\"\\\\"');
    expect(r.value).toBe('a\n\tA"\\');
  });

  it('locates a nested path', () => {
    const src = '{\n  "mcpServers": {\n    "a": {\n      "url": "x"\n    }\n  }\n}';
    const r = parseJson(src);
    const loc = r.locate(['mcpServers', 'a', 'url']);
    expect(loc).toEqual({ line: 4, column: 14 });
  });

  it('locates an array element', () => {
    const src = '{\n  "list": [\n    "a",\n    "b"\n  ]\n}';
    const r = parseJson(src);
    expect(r.locate(['list', 1])).toEqual({ line: 4, column: 5 });
  });

  it('returns undefined location for an unknown path', () => {
    const r = parseJson('{"a":1}');
    expect(r.locate(['nope'])).toBeUndefined();
  });

  it('never throws on empty input', () => {
    const r = parseJson('');
    expect(r.error).toBeDefined();
    expect(r.error?.line).toBe(1);
    expect(r.value).toBeUndefined();
    expect(r.locate(['x'])).toBeUndefined();
  });

  it('reports a syntax error with location for trailing comma', () => {
    const r = parseJson('{\n  "a": 1,\n}');
    expect(r.error).toBeDefined();
    expect(r.error?.line).toBe(3);
  });

  it('reports an error for an unterminated string', () => {
    const r = parseJson('{"a": "oops}');
    expect(r.error).toBeDefined();
  });

  it('reports an error for an invalid escape', () => {
    const r = parseJson('"a\\x"');
    expect(r.error).toBeDefined();
  });

  it('reports an error for an invalid unicode escape', () => {
    const r = parseJson('"\\u00zz"');
    expect(r.error).toBeDefined();
  });

  it('reports an error for a bad literal', () => {
    const r = parseJson('{"a": tru}');
    expect(r.error).toBeDefined();
  });

  it('reports an error for trailing content after a complete value', () => {
    // After a complete top-level value, extra non-whitespace is rejected.
    const r = parseJson('true false');
    expect(r.error).toBeDefined();
    expect(r.error?.message).toMatch(/trailing/i);
  });

  it('reports an error for an unparseable trailing token', () => {
    const r = parseJson('{} junk');
    expect(r.error).toBeDefined();
  });

  it('reports an error for a control character in a string', () => {
    const r = parseJson('"ab"');
    expect(r.error).toBeDefined();
  });

  it('reports an error for a bare number that is just a minus', () => {
    const r = parseJson('-');
    expect(r.error).toBeDefined();
  });

  it('handles a BOM prefix', () => {
    const r = parseJson('﻿{"a":1}');
    expect(r.value).toEqual({ a: 1 });
  });

  it('parses an empty object and array', () => {
    expect(parseJson('{}').value).toEqual({});
    expect(parseJson('[]').value).toEqual([]);
  });

  it('errors on a non-string object key', () => {
    const r = parseJson('{1: 2}');
    expect(r.error).toBeDefined();
  });

  it('errors on missing colon', () => {
    const r = parseJson('{"a" 1}');
    expect(r.error).toBeDefined();
  });

  it('errors on missing comma between members', () => {
    const r = parseJson('{"a":1 "b":2}');
    expect(r.error).toBeDefined();
  });

  it('errors on missing comma in array', () => {
    const r = parseJson('[1 2]');
    expect(r.error).toBeDefined();
  });

  // Regression (fix 1): `__proto__`/`constructor`/`prototype` keys must become
  // OWN properties on a null-prototype object — no prototype pollution, no
  // silent content loss (matching JSON.parse semantics).
  it('treats __proto__/constructor/prototype as own keys with null prototype', () => {
    const src = '{"__proto__": 1, "constructor": 2, "prototype": 3, "ok": 4}';
    const r = parseJson(src);
    expect(r.error).toBeUndefined();
    const v = r.value as Record<string, unknown>;
    // Null prototype: no inherited Object.prototype.
    expect(Object.getPrototypeOf(v)).toBeNull();
    // All keys are present as OWN properties (nothing silently dropped).
    expect(Object.prototype.hasOwnProperty.call(v, '__proto__')).toBe(true);
    expect(Object.keys(v).sort()).toEqual(['__proto__', 'constructor', 'ok', 'prototype']);
    expect(v['__proto__']).toBe(1);
    expect(v['constructor']).toBe(2);
    expect(v['prototype']).toBe(3);
    // No prototype pollution of the global Object.prototype.
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  // Regression (fix 2): an explicit recursion depth limit yields a clean
  // invalid-json error (with a clear message) instead of a native stack
  // overflow / crash.
  it('reports a clean error for excessively deep nesting (> 200)', () => {
    const depth = 1000;
    const src = '['.repeat(depth) + ']'.repeat(depth);
    let r: ReturnType<typeof parseJson>;
    expect(() => {
      r = parseJson(src);
    }).not.toThrow();
    expect(r!.value).toBeUndefined();
    expect(r!.error).toBeDefined();
    expect(r!.error?.message).toMatch(/nesting too deep \(> 200\)/);
  });
});

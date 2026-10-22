const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize } = require('../src/lib/render.js');

test('summarize: correct / whitespace-only / wrong', () => {
  const ok = summarize({ ok: true, run: { category: 'ok' }, comparison: { correct: true, kind: 'exact' } });
  assert.deepEqual([ok.state, ok.symbol, ok.label], ['ok', '✓', 'Correct']);
  assert.match(summarize({ ok: true, run: { category: 'ok' }, comparison: { correct: true, kind: 'whitespace_only' } }).text, /trailing spaces/);
  const bad = summarize({ ok: true, run: { category: 'ok' }, comparison: { correct: false, normalizedActual: '16', diff: { line: 1, column: 2 } } });
  assert.deepEqual([bad.state, bad.symbol], ['bad', '✗']);
  assert.equal(bad.text, 'Output: 16  ·  differs at line 1, col 2');
});

test('summarize: empty actual output and long first line', () => {
  assert.match(summarize({ ok: true, run: { category: 'ok' }, comparison: { correct: false, normalizedActual: '' } }).text, /\(nothing printed\)/);
  const long = summarize({ ok: true, run: { category: 'ok' }, comparison: { correct: false, normalizedActual: 'x'.repeat(100) } }).text;
  assert.ok(long.length < 70);
});

test('summarize: errors and failures', () => {
  assert.equal(summarize({ ok: true, run: { category: 'compile_error', compileOutput: "a.c:1:1: error: unknown type name 'x'" } }).text, "Compilation error: unknown type name 'x'");
  assert.match(summarize({ ok: true, run: { category: 'runtime_error', statusDescription: 'Runtime Error (SIGSEGV)' } }).text, /memory/);
  assert.equal(summarize({ ok: true, run: { category: 'timeout' } }).symbol, '⏱');
  assert.equal(summarize({ ok: false, error: 'boom' }).text, 'boom');
  assert.equal(summarize(null).state, 'warn');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const j = require('../src/lib/judge0.js');
const W = require('../src/lib/wandbox.js');
const R = require('../src/lib/runner.js');

test('Wandbox request: compiler per language, no switches, MySQL prepared for sqlite', () => {
  const body = (l, c) => JSON.parse(W.buildRequest({}, l, c, 'in').init.body);
  assert.equal(W.buildRequest({}, 'cpp', 'x').url, 'https://wandbox.org/api/compile.json');
  assert.deepEqual(['c', 'cpp', 'java', 'python', 'sql'].map((l) => body(l, 'x').compiler),
    ['gcc-13.2.0-c', 'gcc-13.2.0', 'openjdk-jdk-22+36', 'cpython-3.12.7', 'sqlite-3.46.1']);
  assert.equal(body('cpp', 'x').options, '');
  assert.equal(body('cpp', 'x').stdin, 'in');
  assert.match(body('sql', 'CREATE DATABASE d; USE d; CREATE TABLE t (id INT AUTO_INCREMENT); SELECT 1;').code, /^\.headers on\n\.mode list[\s\S]*CREATE TABLE t \(id INT\s*\)/);
  assert.equal(W.buildRequest({ wandboxEndpoint: 'http://127.0.0.1:9/wandbox/' }, 'c', 'x').url, 'http://127.0.0.1:9/wandbox/api/compile.json');
});

test('Java for Wandbox: top-level public removed (any class name works), nested and strings untouched', () => {
  const src = '// public class X in a comment\npublic class GFG {\n  public static class Inner {}\n  public static void main(String[] a) { System.out.println("public class Y"); }\n}\npublic final class Helper {}';
  const out = W.stripTopLevelPublic(src);
  assert.match(out, /^\/\/ public class X in a comment\nclass GFG \{/);
  assert.match(out, /public static class Inner/);
  assert.match(out, /"public class Y"/);
  assert.match(out, /\nfinal class Helper/);
});

test('Wandbox results map to the Judge0 categories', () => {
  assert.equal(W.mapResult({ status: '0', program_output: '3\n' }, 'cpp').category, 'ok');
  assert.equal(W.mapResult({ status: '0', program_output: '3\n' }, 'cpp').stdout, '3\n');
  const ce = W.mapResult({ status: '1', compiler_error: "prog.cc:1: error: expected ';'" }, 'cpp');
  assert.deepEqual([ce.category, ce.compileOutput.includes('expected')], ['compile_error', true]);
  const se = W.mapResult({ status: '', signal: 'Segmentation fault', program_output: 'Before\n' }, 'cpp');
  assert.deepEqual([se.category, se.statusDescription, se.stdout], ['runtime_error', 'Runtime Error (SIGSEGV)', 'Before\n']);
  assert.equal(W.mapResult({ status: '', signal: 'Killed' }, 'cpp').category, 'timeout');
  const py = W.mapResult({ status: '1', program_output: 'start\n', program_error: 'ZeroDivisionError: division by zero' }, 'python');
  assert.deepEqual([py.category, py.stdout], ['runtime_error', 'start\n']);
  assert.equal(W.mapResult({ status: '1', program_error: 'The program compiled successfully, but main class was not found.' }, 'java').category, 'runner_error');
  assert.equal(W.mapResult({}, 'cpp').category, 'runner_error');
});

// ---- runner: race, fallback, cache, sharing ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function stub({ wb, j0 }) {
  const calls = { wb: 0, j0: 0 };
  globalThis.OutputIQ.wandbox = { run: async (...a) => { calls.wb++; return wb(...a); } };
  globalThis.OutputIQ.judge0 = Object.assign({}, j, { runCode: async (...a) => { calls.j0++; return j0(...a); } });
  return calls;
}
const OK = (out) => ({ category: 'ok', stdout: out, stderr: '', compileOutput: '' });

test('auto: Wandbox answers fast -> Judge0 is never called', async () => {
  const calls = stub({ wb: async () => OK('wb\n'), j0: async () => OK('j0\n') });
  const r = await R.run({}, 'cpp', 'fast-1', '', { noCache: true });
  assert.deepEqual([r.stdout, r.runner, calls.j0], ['wb\n', 'wandbox', 0]);
});

test('auto: Wandbox slow -> Judge0 joins after the hedge delay and wins', async () => {
  const calls = stub({ wb: async () => { await sleep(80); return OK('wb\n'); }, j0: async () => OK('j0\n') });
  const r = await R.run({}, 'cpp', 'slow-1', '', { noCache: true, hedgeMs: 10 });
  assert.deepEqual([r.stdout, r.runner, calls.wb, calls.j0], ['j0\n', 'judge0', 1, 1]);
});

test('auto: Wandbox down -> Judge0 right away; both down -> friendly error', async () => {
  let calls = stub({ wb: async () => ({ category: 'http_error', error: 'Wandbox answered HTTP 503.' }), j0: async () => OK('j0\n') });
  let r = await R.run({}, 'java', 'down-1', '', { noCache: true, hedgeMs: 5000 });
  assert.deepEqual([r.runner, calls.j0], ['judge0', 1]);
  stub({ wb: async () => ({ category: 'network_error', error: 'Could not reach Wandbox.' }), j0: async () => ({ category: 'network_error', error: 'Could not reach the code runner at ce.judge0.com' }) });
  r = await R.run({}, 'java', 'down-2', '', { noCache: true });
  assert.equal(r.category, 'network_error');
  assert.match(r.error, /judge0/);
});

test('judge0 mode skips Wandbox', async () => {
  const calls = stub({ wb: async () => OK('wb\n'), j0: async () => OK('j0\n') });
  const r = await R.run({ runner: 'judge0' }, 'c', 'mode-1', '', { noCache: true });
  assert.deepEqual([r.runner, calls.wb], ['judge0', 0]);
});

test('cache: a repeat is instant; same code started twice runs once (prerun + Check)', async () => {
  const store = {};
  global.chrome = { storage: { local: { async get(k) { return { [k]: store[k] }; }, async set(o) { Object.assign(store, JSON.parse(JSON.stringify(o))); } } } };
  const calls = stub({ wb: async () => { await sleep(30); return OK('42\n'); }, j0: async () => OK('j0\n') });
  const [a, b] = await Promise.all([R.run({}, 'python', 'print(42)', ''), R.run({}, 'python', 'print(42)', '')]);
  assert.deepEqual([a.stdout, b.stdout, calls.wb], ['42\n', '42\n', 1], 'shared in-flight run');
  const c = await R.run({}, 'python', 'print(42)', '');
  assert.deepEqual([c.runner, c.ranOn, c.stdout, calls.wb], ['cache', 'wandbox', '42\n', 1]);
  assert.ok(Object.keys(store.runCache).length === 1, 'kept in chrome.storage');
  const d = await R.run({}, 'python', 'print(42)', '5');
  assert.equal(calls.wb, 2, 'different stdin = different run');
  stub({ wb: async () => ({ category: 'timeout' }), j0: async () => OK('x') });
  await R.run({}, 'cpp', 'while(1);', '');
  assert.equal(Object.keys(store.runCache).length, 2, 'timeouts are not cached');
  delete global.chrome;
});

test('label', () => {
  assert.equal(R.label({ runner: 'wandbox', ms: 640 }), 'Ran on Wandbox · 0.6 s');
  assert.equal(R.label({ runner: 'cache' }), 'Instant · saved result');
});

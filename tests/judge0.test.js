const test = require('node:test');
const assert = require('node:assert/strict');
const j = require('../src/lib/judge0.js');

const enc = (s) => Buffer.from(s, 'utf8').toString('base64');
function response(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
}

test('base64 round-trips UTF-8', () => {
  const s = 'cout << "π ✓ 你好";\n';
  assert.equal(j.b64decode(j.b64encode(s)), s);
  assert.equal(j.b64encode(s), enc(s));
});

test('submission request: URL, body, no auth by default', () => {
  const { url, init } = j.buildSubmission({}, 'int main(){}', '5\n');
  assert.equal(url, 'https://ce.judge0.com/submissions?base64_encoded=true&wait=false');
  const body = JSON.parse(init.body);
  assert.equal(body.language_id, 54);
  assert.equal(j.b64decode(body.source_code), 'int main(){}');
  assert.equal(j.b64decode(body.stdin), '5\n');
  assert.equal(init.headers['X-RapidAPI-Key'], undefined);
  assert.equal(init.headers['X-Auth-Token'], undefined);
});

test('RapidAPI headers include key and host', () => {
  const h = j.buildHeaders({ endpoint: 'https://judge0-ce.p.rapidapi.com', authMode: 'rapidapi', apiKey: 'K' });
  assert.equal(h['X-RapidAPI-Key'], 'K');
  assert.equal(h['X-RapidAPI-Host'], 'judge0-ce.p.rapidapi.com');
});

test('X-Auth-Token header for self-hosted', () => {
  const h = j.buildHeaders({ endpoint: 'https://my.judge0', authMode: 'x-auth-token', apiKey: 'T' });
  assert.equal(h['X-Auth-Token'], 'T');
});

test('trailing slash in endpoint is handled', () => {
  assert.match(j.buildSubmission({ endpoint: 'https://x.example/' }, 'c', '').url, /^https:\/\/x\.example\/submissions\?/);
});

test('mapResult categories', () => {
  const m = (id) => j.mapResult({ status: { id, description: 'd' } }).category;
  assert.equal(m(3), 'ok');
  assert.equal(m(5), 'timeout');
  assert.equal(m(6), 'compile_error');
  for (let id = 7; id <= 12; id++) assert.equal(m(id), 'runtime_error');
  assert.equal(m(13), 'internal_error');
  assert.equal(m(1), 'pending');
});

test('runCpp: accepted program decodes stdout', async () => {
  let calls = 0;
  const fetch = async (url, init) => {
    calls++;
    assert.equal(init.method, 'POST');
    return response(201, { stdout: enc('Hello\n'), stderr: null, compile_output: null, status: { id: 3, description: 'Accepted' }, time: '0.002', memory: 900 });
  };
  const r = await j.runCpp({}, 'code', '', { fetch });
  assert.equal(calls, 1);
  assert.equal(r.category, 'ok');
  assert.equal(r.stdout, 'Hello\n');
  assert.equal(r.time, '0.002');
});

test('runCpp: compile error carries compiler message', async () => {
  const fetch = async () => response(201, { stdout: null, compile_output: enc("main.cpp:3: error: expected ';'"), status: { id: 6, description: 'Compilation Error' } });
  const r = await j.runCpp({}, 'x', '', { fetch });
  assert.equal(r.category, 'compile_error');
  assert.match(r.compileOutput, /expected ';'/);
});

test('runCpp: runtime error keeps partial stdout', async () => {
  const fetch = async () => response(201, { stdout: enc('before\n'), stderr: enc(''), message: enc('Exited with error status 136'), status: { id: 9, description: 'Runtime Error (SIGFPE)' } });
  const r = await j.runCpp({}, 'x', '', { fetch });
  assert.equal(r.category, 'runtime_error');
  assert.equal(r.stdout, 'before\n');
  assert.match(r.statusDescription, /SIGFPE/);
});

test('runCpp: polls when server returns only a token', async () => {
  const seen = [];
  let polls = 0;
  const fetch = async (url) => {
    seen.push(url);
    if (url.includes('wait=')) return response(201, { token: 'abc' });
    polls++;
    if (polls < 2) return response(200, { status: { id: 2, description: 'Processing' } });
    return response(200, { stdout: enc('42\n'), status: { id: 3, description: 'Accepted' } });
  };
  const r = await j.runCpp({}, 'x', '', { fetch, pollIntervalMs: 1 });
  assert.equal(r.category, 'ok');
  assert.equal(r.stdout, '42\n');
  assert.ok(seen[1].includes('/submissions/abc?base64_encoded=true'));
});

test('runCpp: polling gives up after maxWait', async () => {
  const fetch = async (url) => (url.includes('wait=') ? response(201, { token: 't' }) : response(200, { status: { id: 1 } }));
  const r = await j.runCpp({}, 'x', '', { fetch, pollIntervalMs: 5, maxWaitMs: 20 });
  assert.equal(r.category, 'timeout');
});

test('runCpp: HTTP errors become friendly messages', async () => {
  const r401 = await j.runCpp({}, 'x', '', { fetch: async () => response(401, 'no') });
  assert.equal(r401.category, 'http_error');
  assert.match(r401.error, /API key/);
  const r429 = await j.runCpp({}, 'x', '', { fetch: async () => response(429, '') });
  assert.match(r429.error, /Too many runs/);
});

test('runCpp: network failure never throws', async () => {
  const r = await j.runCpp({}, 'x', '', { fetch: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(r.category, 'network_error');
  assert.match(r.error, /Could not reach/);
});

test('runCpp: non-JSON response', async () => {
  const r = await j.runCpp({}, 'x', '', { fetch: async () => response(200, '<html>') });
  assert.equal(r.category, 'http_error');
});

// ---------- multi-language ----------

test('language ids per language (Judge0 CE defaults) and per-language time limits', () => {
  const body = (lang) => JSON.parse(j.buildSubmission({}, 'x', '', lang).init.body);
  assert.equal(body('c').language_id, 50);
  assert.equal(body('cpp').language_id, 54);
  assert.equal(body('java').language_id, 62);
  assert.equal(body('python').language_id, 71);
  assert.ok(body('java').cpu_time_limit > body('cpp').cpu_time_limit, 'JVM gets more time');
});

test('custom language ids from settings; v0.1 single languageId still honoured for C++', () => {
  assert.equal(j.languageIdFor({ languageIds: { python: 92 } }, 'python'), 92);
  assert.equal(j.languageIdFor({ languageIds: { python: 92 } }, 'c'), 50);
  assert.equal(j.languageIdFor({ languageId: 76 }, 'cpp'), 76);
});

test('prepareJava renames the class holding main() to Main (GfG uses GFG)', () => {
  const src = 'import java.io.*;\n\nclass Helper { int v = 1; }\n\npublic class GFG {\n  static int sq(int x) { return x * x; }\n  public static void main(String[] args) {\n    System.out.println(GFG.sq(3));\n  }\n}';
  const r = j.prepareJava(src);
  assert.match(r.code, /public class Main \{/);
  assert.match(r.code, /Main\.sq\(3\)/);
  assert.match(r.code, /class Helper/, 'other classes untouched');
  assert.match(r.note, /GFG.*Main/);
});

test('prepareJava leaves code already using Main alone', () => {
  const src = 'class Main { public static void main(String[] a) { System.out.println(1); } }';
  assert.deepEqual(j.prepareJava(src), { code: src, note: null });
});

test('runCode(java) sends renamed source and returns the note', async () => {
  let sentSrc = '';
  const fetch = async (url, init) => {
    sentSrc = j.b64decode(JSON.parse(init.body).source_code);
    return response(201, { stdout: enc('9\n'), status: { id: 3, description: 'Accepted' } });
  };
  const r = await j.runCode({}, 'java', 'public class GFG { public static void main(String[] a) { System.out.println(9); } }', '', { fetch });
  assert.match(sentSrc, /public class Main/);
  assert.equal(r.stdout, '9\n');
  assert.match(r.note, /renamed/);
});

test('MySQL: language id 82 and MySQL → SQLite preparation', () => {
  assert.equal(JSON.parse(j.buildSubmission({}, 'x', '', 'sql').init.body).language_id, 82);
  const r = j.prepareSql('CREATE DATABASE school;\nUSE school;\nCREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY, n VARCHAR(5)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\nSELECT * FROM t;');
  assert.match(r.code, /^\.headers on\n\.mode list\n/);
  assert.ok(!/AUTO_INCREMENT|ENGINE|CHARSET|CREATE DATABASE|USE school/i.test(r.code), r.code);
  assert.match(r.code, /CREATE TABLE t \(id INT\s+PRIMARY KEY, n VARCHAR\(5\)\);/);
  assert.match(r.note, /MySQL-only options removed/);
  assert.match(j.prepareSql('SELECT 1;').note, /^Ran on SQLite[^,]*\.\s/);
});
test('runCode(sql) sends the prepared script', async () => {
  let src = '';
  const fetch = async (url, init) => { src = j.b64decode(JSON.parse(init.body).source_code); return response(201, { stdout: enc('x\n1\n'), status: { id: 3, description: 'Accepted' } }); };
  const r = await j.runCode({}, 'sql', 'CREATE TABLE t (x INT);\nSELECT 1 AS x;', '', { fetch });
  assert.match(src, /^\.headers on/);
  assert.match(r.note, /SQLite/);
});

test('runCode: a slow POST is retried once; slow polls are tolerated', async () => {
  let posts = 0, polls = 0;
  const slow = () => new Promise((_, rej) => setTimeout(() => { const e = new Error('abort'); e.name = 'AbortError'; rej(e); }, 1));
  const fetch = async (url) => {
    if (url.includes('wait=')) { posts++; return posts === 1 ? slow() : response(201, { token: 'z' }); }
    polls++;
    if (polls === 1) return slow();
    return response(200, { stdout: enc('ok\n'), status: { id: 3, description: 'Accepted' } });
  };
  const r = await j.runCode({}, 'cpp', 'x', '', { fetch, pollIntervalMs: 1 });
  assert.equal(r.category, 'ok');
  assert.equal(posts, 2);
});

test('runCode: server never answers -> friendly message after one retry', async () => {
  let posts = 0;
  const fetch = async () => { posts++; const e = new Error('abort'); e.name = 'AbortError'; throw e; };
  const r = await j.runCode({}, 'cpp', 'x', '', { fetch });
  assert.equal(r.category, 'network_error');
  assert.equal(posts, 2);
  assert.match(r.error, /busy|RapidAPI/);
});

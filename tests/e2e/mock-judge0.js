/*
 * Minimal Judge0-compatible server for end-to-end tests.
 * Implements POST /submissions?base64_encoded=true&wait=true and GET /submissions/:token,
 * running C (50), C++ (54), Java (62) and Python (71) with the local toolchain.
 * TEST USE ONLY — it runs code unsandboxed on the local machine.
 *
 *   node tests/e2e/mock-judge0.js 2358
 */
const http = require('node:http');
const local = require('../local-runner.js');

const b64 = (s) => (s == null || s === '' ? null : Buffer.from(s, 'utf8').toString('base64'));
const unb64 = (s) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');
const LANG = { 50: 'c', 54: 'cpp', 62: 'java', 71: 'python', 82: 'sql' };
const STATUS = { ok: [3, 'Accepted'], compile_error: [6, 'Compilation Error'], timeout: [5, 'Time Limit Exceeded'] };
const RT = { 'Runtime Error (SIGSEGV)': 7, 'Runtime Error (SIGXFSZ)': 8, 'Runtime Error (SIGFPE)': 9, 'Runtime Error (SIGABRT)': 10, 'Runtime Error (NZEC)': 11, 'Runtime Error (Other)': 12 };

function execute(languageId, source, stdin, cpuLimit) {
  const lang = LANG[languageId];
  const r = local.run(lang, source, stdin, { timeoutMs: (cpuLimit || 2) * 1000, alreadyPrepared: true });
  const status = r.category === 'runtime_error'
    ? { id: RT[r.statusDescription] || 12, description: r.statusDescription }
    : { id: STATUS[r.category][0], description: STATUS[r.category][1] };
  return {
    status,
    stdout: b64(r.stdout), stderr: b64(r.stderr), compile_output: b64(r.compileOutput),
    message: r.category === 'runtime_error' ? b64(r.signal ? 'Exited with signal ' + r.signal : 'Exited with error status ' + r.exitCode) : null,
    time: r.time, memory: 1024
  };
}

const WB_LANG = { 'gcc-13.2.0-c': 'c', 'gcc-13.2.0': 'cpp', 'openjdk-jdk-22+36': 'java', 'cpython-3.12.7': 'python', 'sqlite-3.46.1': 'sql' };
/** Like Wandbox: Java is saved as prog.java and the compiled class that has main() is run. */
function wandboxRun(compiler, code, stdin) {
  const lang = WB_LANG[compiler];
  if (!lang) return { status: '1', compiler_error: 'unknown compiler ' + compiler };
  let r;
  if (lang === 'java') {
    const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-java-'));
    fs.writeFileSync(path.join(dir, 'prog.java'), code);
    const env = Object.assign({}, process.env); delete env.JAVA_TOOL_OPTIONS;
    const c = spawnSync('javac', ['prog.java'], { cwd: dir, encoding: 'utf8', env });
    if (c.status !== 0) return { status: '1', compiler_error: c.stderr };
    const owner = (/class\s+(\w+)[^{]*\{[\s\S]*?static\s+void\s+main/.exec(code) || [])[1];
    const x = spawnSync('java', ['-cp', dir, owner], { input: stdin, encoding: 'utf8', env, timeout: 8000 });
    if (x.error) return { status: '', signal: 'Killed', program_output: x.stdout || '' };
    return { status: String(x.status), signal: x.signal || '', program_output: x.stdout, program_error: x.stderr };
  }
  r = local.run(lang, code, stdin, { timeoutMs: 4000, alreadyPrepared: true });
  if (r.category === 'compile_error') return { status: '1', compiler_error: r.compileOutput };
  if (r.category === 'timeout') return { status: '', signal: 'Killed', program_output: r.stdout };
  if (r.category === 'runtime_error') return { status: r.signal ? '' : String(r.exitCode || 1), signal: r.signal === 'SIGSEGV' ? 'Segmentation fault' : r.signal === 'SIGFPE' ? 'Floating point exception' : (r.signal || ''), program_output: r.stdout, program_error: r.stderr };
  return { status: '0', program_output: r.stdout, program_error: r.stderr };
}

function start(port) {
  const results = {};
  let n = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
    server.requests.push({ method: req.method, path: url.pathname, query: url.search, headers: req.headers });
    if (req.method === 'POST' && url.pathname === '/submissions') {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        const j = JSON.parse(body);
        if (!LANG[j.language_id]) return send(422, { error: 'unsupported language_id ' + j.language_id });
        server.submissions.push({ language_id: j.language_id, source: unb64(j.source_code) });
        const out = execute(j.language_id, unb64(j.source_code), unb64(j.stdin), j.cpu_time_limit);
        const token = 'tok' + ++n;
        results[token] = Object.assign({ token }, out);
        if (url.searchParams.get('wait') === 'true' && !server.forcePolling) return send(201, results[token]);
        return send(201, { token });
      });
      return;
    }
    // ---- Wandbox emulation: POST /wandbox/api/compile.json ----
    if (req.method === 'POST' && url.pathname === '/wandbox/api/compile.json') {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        const j = JSON.parse(body);
        server.wandbox.push({ compiler: j.compiler, code: j.code });
        if (server.wandboxDown) return send(503, { error: 'down' });
        const reply = () => send(200, wandboxRun(j.compiler, j.code, j.stdin || ''));
        if (server.wandboxDelayMs) setTimeout(reply, server.wandboxDelayMs); else reply();
      });
      return;
    }
    const m = /^\/submissions\/([\w-]+)$/.exec(url.pathname);
    if (req.method === 'GET' && m && results[m[1]]) return send(200, results[m[1]]);
    send(404, { error: 'not found' });
  });
  server.requests = [];
  server.wandbox = [];
  server.wandboxDown = false;
  server.wandboxDelayMs = 0;
  server.submissions = [];
  server.forcePolling = false;
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

module.exports = { start };
if (require.main === module) start(Number(process.argv[2]) || 2358).then((s) => console.log('mock Judge0 on http://127.0.0.1:' + s.address().port));

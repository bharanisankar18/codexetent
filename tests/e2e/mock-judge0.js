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
    const m = /^\/submissions\/([\w-]+)$/.exec(url.pathname);
    if (req.method === 'GET' && m && results[m[1]]) return send(200, results[m[1]]);
    send(404, { error: 'not found' });
  });
  server.requests = [];
  server.submissions = [];
  server.forcePolling = false;
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

module.exports = { start };
if (require.main === module) start(Number(process.argv[2]) || 2358).then((s) => console.log('mock Judge0 on http://127.0.0.1:' + s.address().port));

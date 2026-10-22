/*
 * Codextent — Wandbox client (https://wandbox.org, free, open source, no key).
 * POST {endpoint}/api/compile.json {compiler, code, stdin, options:''} ->
 *   {status:'0', signal:'', compiler_error, program_output, program_error, ...}
 * Returns the same result shape as judge0.runCode: {category, stdout, stderr, compileOutput, statusDescription, time}.
 *
 * Java: Wandbox saves the code as prog.java and runs whichever compiled class has main(),
 * so we only drop "public" from top-level types (a public class must match the file name).
 * MySQL: Wandbox runs `cat prog.sql | sqlite3`, so the same MySQL->SQLite prep as Judge0 applies.
 */
(function (root) {
  'use strict';

  var ENDPOINT = 'https://wandbox.org';
  var COMPILERS = { c: 'gcc-13.2.0-c', cpp: 'gcc-13.2.0', java: 'openjdk-jdk-22+36', python: 'cpython-3.12.7', sql: 'sqlite-3.46.1' };

  /** Remove `public` from top-level class/interface/enum/record declarations (brace depth 0). */
  function stripTopLevelPublic(code) {
    var src = String(code);
    // blank out comments and strings (same length) so braces inside them don't count
    var masked = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, function (m) { return m.replace(/[^\n]/g, ' '); });
    var depth = 0, cuts = [];
    var re = /[{}]|\bpublic\s+(?=(?:(?:final|abstract|sealed|static|strictfp)\s+)*(?:class|interface|enum|record)\b)/g, m;
    while ((m = re.exec(masked))) {
      if (m[0] === '{') depth++;
      else if (m[0] === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0) cuts.push([m.index, m[0].length]);
    }
    for (var i = cuts.length - 1; i >= 0; i--) src = src.slice(0, cuts[i][0]) + src.slice(cuts[i][0] + cuts[i][1]);
    return src;
  }

  function prepare(language, code) {
    var J = root.OutputIQ && root.OutputIQ.judge0;
    if (language === 'java') return stripTopLevelPublic(code);
    if (language === 'sql' && J) return J.prepareSql(code).code;
    return String(code);
  }

  function buildRequest(settings, language, code, stdin) {
    var ep = String((settings && settings.wandboxEndpoint) || ENDPOINT).replace(/\/+$/, '');
    return {
      url: ep + '/api/compile.json',
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ compiler: COMPILERS[language] || COMPILERS.cpp, code: prepare(language, code), stdin: stdin || '', options: '', save: false })
      }
    };
  }

  /** Map a Wandbox response to the Judge0-style result. category 'runner_error' = not the program's fault (try another runner). */
  function mapResult(json, language) {
    json = json || {};
    var out = json.program_output || '', err = json.program_error || '', cerr = json.compiler_error || '';
    var status = String(json.status == null ? '' : json.status), signal = String(json.signal || '');
    var base = { stdout: out, stderr: err, compileOutput: cerr, time: null, memory: null };
    if (language === 'java' && /main class was not found|Could not find or load main class/i.test(err)) {
      return Object.assign(base, { category: 'runner_error', statusDescription: 'Runner could not find main()' });
    }
    if (signal) {
      if (/kill|cpu|time/i.test(signal)) return Object.assign(base, { category: 'timeout', statusDescription: 'Time Limit Exceeded' });
      // use Judge0's names so the existing tips (e.g. "SIGFPE — division by zero") apply
      var sig = /floating|SIGFPE/i.test(signal) ? 'SIGFPE' : /segment|SIGSEGV/i.test(signal) ? 'SIGSEGV' : /abort|SIGABRT/i.test(signal) ? 'SIGABRT'
        : /file size|SIGXFSZ/i.test(signal) ? 'SIGXFSZ' : signal;
      return Object.assign(base, { category: 'runtime_error', statusDescription: 'Runtime Error (' + sig + ')' });
    }
    if (status !== '0' && cerr && !out && !err) return Object.assign(base, { category: 'compile_error', statusDescription: 'Compilation Error' });
    if (status === '' && !out && !err && !cerr) return Object.assign(base, { category: 'runner_error', statusDescription: 'Empty response' });
    if (status !== '0') return Object.assign(base, { category: 'runtime_error', statusDescription: 'Runtime Error (NZEC)', exitCode: Number(status) });
    return Object.assign(base, { category: 'ok', statusDescription: 'Accepted' });
  }

  async function run(settings, language, code, stdin, opts) {
    opts = opts || {};
    var fetchImpl = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    var req = buildRequest(settings, language, code, stdin);
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 15000) : null;
    try {
      var res = await fetchImpl(req.url, Object.assign({}, req.init, ctrl ? { signal: ctrl.signal } : {}));
      var text = await res.text();
      if (!res.ok) return { category: 'http_error', httpStatus: res.status, error: 'Wandbox answered HTTP ' + res.status + '.' };
      var json;
      try { json = JSON.parse(text); } catch (e) { return { category: 'http_error', error: 'Wandbox sent a response that is not JSON.' }; }
      var r = mapResult(json, language);
      var J = root.OutputIQ && root.OutputIQ.judge0;
      if (language === 'sql' && J) { var note = J.prepareSql(code).note; if (note) r.note = note; } // e.g. "Ran on SQLite…"
      return r;
    } catch (e) {
      return { category: 'network_error', error: e && e.name === 'AbortError' ? 'Wandbox did not answer in time.' : 'Could not reach Wandbox.' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  var api = { ENDPOINT: ENDPOINT, COMPILERS: COMPILERS, stripTopLevelPublic: stripTopLevelPublic, prepare: prepare, buildRequest: buildRequest, mapResult: mapResult, run: run };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.wandbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

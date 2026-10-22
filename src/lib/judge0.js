/*
 * OutputIQ — Judge0-compatible API client.
 * Runs ONLY in the background service worker (and Node tests). The content script
 * never sees the API key.
 */
(function (root) {
  'use strict';

  // Judge0 CE language ids: C (GCC 9.2.0)=50, C++ (GCC 9.2.0)=54, Java (OpenJDK 13.0.1)=62, Python (3.8.1)=71,
  // SQL (SQLite 3.27.2)=82 — MySQL examples run on SQLite after removing MySQL-only options.
  var DEFAULT_SETTINGS = {
    endpoint: 'https://ce.judge0.com',
    authMode: 'none',            // 'none' | 'rapidapi' | 'x-auth-token'
    apiKey: '',
    languageIds: { c: 50, cpp: 54, java: 62, python: 71, sql: 82 },
    lenientTrailingSpaces: true  // used by compare, kept here so settings live in one object
  };

  // JVM start-up is slow: give Java more time
  var LIMITS = {
    c: { cpu: 2, wall: 5 },
    cpp: { cpu: 2, wall: 5 },
    java: { cpu: 5, wall: 10 },
    python: { cpu: 3, wall: 6 },
    sql: { cpu: 2, wall: 5 }
  };

  /**
   * MySQL → SQLite: drop statements/options SQLite doesn't understand and turn on header rows
   * (tutorial sites show query results with column names).
   * @returns {{code:string, note:string|null}}
   */
  function prepareSql(code) {
    var src = String(code);
    var out = src
      .replace(/^\s*(?:CREATE|DROP)\s+(?:DATABASE|SCHEMA)\b[^;]*;\s*$/gim, '')
      .replace(/^\s*USE\s+\w+\s*;\s*$/gim, '')
      .replace(/\bAUTO_INCREMENT\b(\s*=\s*\d+)?/gi, '')
      .replace(/\)\s*(?:ENGINE\s*=\s*\w+|DEFAULT\s+CHARSET\s*=\s*\w+|CHARSET\s*=\s*\w+|COLLATE\s*=?\s*\w+|\s)+;/gi, ');');
    var changed = out !== src;
    return {
      code: '.headers on\n.mode list\n' + out,
      note: 'Ran on SQLite (Judge0\u2019s SQL engine)' + (changed ? ' with MySQL-only options removed.' : '.') + ' Output shows a header row; NULL appears empty.'
    };
  }

  /** Settings saved by v0.1 had a single C++ languageId. */
  function languageIdFor(settings, language) {
    var ids = Object.assign({}, DEFAULT_SETTINGS.languageIds, (settings && settings.languageIds) || {});
    if (language === 'cpp' && settings && settings.languageId && !(settings.languageIds && settings.languageIds.cpp)) return Number(settings.languageId);
    return Number(ids[language]) || DEFAULT_SETTINGS.languageIds[language];
  }

  /**
   * Judge0 compiles Java as Main.java and runs `java Main`. If the class that holds main()
   * has another name (GeeksforGeeks uses "GFG"), rename it to Main everywhere.
   * @returns {{code:string, note:string|null}}
   */
  function prepareJava(code) {
    var src = String(code);
    var decl = /\b(?:(?:public|final|abstract)\s+)*class\s+([A-Za-z_]\w*)/g;
    var classes = [];
    var m;
    while ((m = decl.exec(src))) classes.push({ name: m[1], index: m.index });
    if (!classes.length) return { code: src, note: null };
    var mainIdx = src.search(/\bstatic\s+void\s+main\s*\(/);
    var owner = null;
    classes.forEach(function (c) { if (mainIdx !== -1 && c.index < mainIdx) owner = c.name; });
    if (!owner || owner === 'Main') return { code: src, note: null };
    if (classes.some(function (c) { return c.name === 'Main'; })) return { code: src, note: null };
    var renamed = src.replace(new RegExp('\\b' + owner + '\\b', 'g'), 'Main');
    return { code: renamed, note: 'Class "' + owner + '" was renamed to "Main" because the code runner requires it.' };
  }

  var STATUS = {
    IN_QUEUE: 1, PROCESSING: 2, ACCEPTED: 3, WRONG_ANSWER: 4, TLE: 5, COMPILE_ERROR: 6,
    RUNTIME_MIN: 7, RUNTIME_MAX: 12, INTERNAL_ERROR: 13, EXEC_FORMAT_ERROR: 14
  };

  // ---- UTF-8 safe base64 (works in Chrome and Node 18+) ----
  function b64encode(str) {
    var bytes = new TextEncoder().encode(String(str || ''));
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function b64decode(b64) {
    if (!b64) return '';
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function trimSlash(url) { return String(url || '').trim().replace(/\/+$/, ''); }

  function buildHeaders(settings) {
    var h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (settings.authMode === 'rapidapi' && settings.apiKey) {
      h['X-RapidAPI-Key'] = settings.apiKey;
      try { h['X-RapidAPI-Host'] = new URL(settings.endpoint).host; } catch (e) { /* ignore */ }
    } else if (settings.authMode === 'x-auth-token' && settings.apiKey) {
      h['X-Auth-Token'] = settings.apiKey;
    }
    return h;
  }

  function buildSubmission(settings, code, stdin, language) {
    var s = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    var lang = LIMITS[language] ? language : 'cpp';
    return {
      // wait=false: the server answers at once with a token and we poll. The public server often holds
      // wait=true requests open for a long time when it is busy, which looked like "took too long".
      url: trimSlash(s.endpoint) + '/submissions?base64_encoded=true&wait=false',
      init: {
        method: 'POST',
        headers: buildHeaders(s),
        body: JSON.stringify({
          source_code: b64encode(code),
          language_id: languageIdFor(settings, lang),
          stdin: b64encode(stdin || ''),
          cpu_time_limit: LIMITS[lang].cpu,
          wall_time_limit: LIMITS[lang].wall
        })
      }
    };
  }

  /**
   * Convert a Judge0 submission JSON (base64 fields) into a simple result.
   * category: 'ok' | 'compile_error' | 'runtime_error' | 'timeout' | 'internal_error' | 'pending'
   */
  function mapResult(json) {
    var status = (json && json.status) || {};
    var id = Number(status.id);
    var category;
    if (id === STATUS.IN_QUEUE || id === STATUS.PROCESSING) category = 'pending';
    else if (id === STATUS.ACCEPTED || id === STATUS.WRONG_ANSWER) category = 'ok';
    else if (id === STATUS.TLE) category = 'timeout';
    else if (id === STATUS.COMPILE_ERROR) category = 'compile_error';
    else if (id >= STATUS.RUNTIME_MIN && id <= STATUS.RUNTIME_MAX) category = 'runtime_error';
    else category = 'internal_error';

    return {
      category: category,
      statusId: id || null,
      statusDescription: status.description || 'Unknown status',
      stdout: b64decode(json && json.stdout),
      stderr: b64decode(json && json.stderr),
      compileOutput: b64decode(json && json.compile_output),
      message: b64decode(json && json.message),
      time: json && json.time != null ? json.time : null,
      memory: json && json.memory != null ? json.memory : null,
      token: json && json.token || null
    };
  }

  function friendlyHttpError(status, bodyText) {
    if (status === 401 || status === 403) return 'The code runner rejected the request (HTTP ' + status + '). Check the API key and authentication type in Options.';
    if (status === 429) return 'Too many runs in a short time (HTTP 429). Wait a minute, or add your own RapidAPI key in Options.';
    if (status === 422) return 'The code runner could not accept this program (HTTP 422). ' + (bodyText || '').slice(0, 200);
    if (status >= 500) return 'The code runner is having problems (HTTP ' + status + '). Try again shortly.';
    return 'Code runner returned HTTP ' + status + '. ' + (bodyText || '').slice(0, 200);
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function fetchWithTimeout(fetchImpl, url, init, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    try {
      return await fetchImpl(url, Object.assign({}, init, ctrl ? { signal: ctrl.signal } : {}));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Run a C++ program. Never throws: returns {category:'network_error'|'http_error', error} on failure.
   * @param {object} settings
   * @param {string} code
   * @param {string} stdin
   * @param {{fetch?:Function, pollIntervalMs?:number, maxWaitMs?:number, requestTimeoutMs?:number}} [opts]
   */
  /**
   * Run a program in any supported language. Same contract as runCpp; adds `note` when the
   * code was adjusted before running (e.g. Java class renamed to Main).
   */
  async function runCode(settings, language, code, stdin, opts) {
    var note = null;
    if (language === 'java' || language === 'sql') {
      var prep = language === 'java' ? prepareJava(code) : prepareSql(code);
      code = prep.code;
      note = prep.note;
    }
    var r = await runCppInternal(settings, code, stdin, opts, language);
    if (note) r.note = note;
    return r;
  }

  async function runCpp(settings, code, stdin, opts) {
    return runCppInternal(settings, code, stdin, opts, 'cpp');
  }

  async function runCppInternal(settings, code, stdin, opts, language) {
    opts = opts || {};
    var fetchImpl = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    var pollInterval = opts.pollIntervalMs != null ? opts.pollIntervalMs : 1000;
    var maxWait = opts.maxWaitMs != null ? opts.maxWaitMs : 60000;
    var reqTimeout = opts.requestTimeoutMs || 20000;
    var retries = opts.retries != null ? opts.retries : 1;
    var s = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    var sub = buildSubmission(s, code, stdin, language);

    var res;
    for (var attempt = 0; ; attempt++) {
      try {
        res = await fetchWithTimeout(fetchImpl, sub.url, sub.init, reqTimeout);
        break;
      } catch (e) {
        if (attempt < retries) { await sleep(1500); continue; } // busy public server: try once more
        return { category: 'network_error', error: e && e.name === 'AbortError'
          ? 'The code runner (' + s.endpoint + ') is not answering — the free public server may be busy. Try again in a minute, or use a RapidAPI key in Settings.'
          : 'Could not reach the code runner at ' + s.endpoint + '. Check your internet connection or the endpoint in Settings.' };
      }
    }
    var text = await res.text();
    if (!res.ok) return { category: 'http_error', httpStatus: res.status, error: friendlyHttpError(res.status, text) };

    var json;
    try { json = JSON.parse(text); } catch (e) { return { category: 'http_error', error: 'The code runner sent a response that is not JSON.' }; }

    var result = mapResult(json);
    if (result.category !== 'pending' && json.status) return result;

    // Instance ignored wait=true (or returned only a token): poll.
    var token = json.token || result.token;
    if (!token) return { category: 'http_error', error: 'The code runner did not return a result or a token.' };
    var started = Date.now();
    var pollUrl = trimSlash(s.endpoint) + '/submissions/' + encodeURIComponent(token) + '?base64_encoded=true';
    var misses = 0;
    while (Date.now() - started < maxWait) {
      await sleep(pollInterval);
      var pr, ptext;
      try {
        pr = await fetchWithTimeout(fetchImpl, pollUrl, { method: 'GET', headers: buildHeaders(s) }, reqTimeout);
        ptext = await pr.text();
      } catch (e) {
        if (++misses <= 3) continue; // a slow poll is not fatal; keep waiting
        return { category: 'network_error', error: 'Lost connection to the code runner while waiting for the result.' };
      }
      if (!pr.ok) {
        if (pr.status >= 500 && ++misses <= 3) continue;
        return { category: 'http_error', httpStatus: pr.status, error: friendlyHttpError(pr.status, ptext) };
      }
      var pjson;
      try { pjson = JSON.parse(ptext); } catch (e) { if (++misses <= 3) continue; return { category: 'http_error', error: 'The code runner sent a response that is not JSON.' }; }
      var pres = mapResult(pjson);
      if (pres.category !== 'pending') return pres;
    }
    return { category: 'timeout', statusDescription: 'Waited too long for a result', error: 'The code runner did not finish in ' + Math.round(maxWait / 1000) + ' seconds.' };
  }

  var api = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    LIMITS: LIMITS,
    languageIdFor: languageIdFor,
    prepareJava: prepareJava,
    prepareSql: prepareSql,
    runCode: runCode,
    b64encode: b64encode,
    b64decode: b64decode,
    buildHeaders: buildHeaders,
    buildSubmission: buildSubmission,
    mapResult: mapResult,
    runCpp: runCpp
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.judge0 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

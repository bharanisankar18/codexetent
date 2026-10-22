/*
 * Codextent — fast runner: picks the quickest free code runner per language and never runs the same code twice.
 *
 *   settings.runner = 'auto' (default): Wandbox first (C, C++, Java, Python, MySQL); if it has not answered after
 *                     HEDGE_MS, Judge0 starts too and the first real result wins. If one fails, the other is used.
 *                     'judge0': only the Judge0 server from Settings (old behaviour).
 *   Cache: results that depend only on the code (ok / compile error / runtime error) are kept in
 *          chrome.storage.local "runCache" (max 300) and in memory, so a repeat shows instantly.
 *   In-flight sharing: a run started early (PRERUN when the bar opens) is reused by Check.
 *
 * Every result gets: runner ('wandbox' | 'judge0' | 'cache') and ms (wall time seen by the learner).
 */
(function (root) {
  'use strict';

  var HEDGE_MS = 4000;
  var CACHE_KEY = 'runCache';
  var CACHE_MAX = 300;
  var DEFINITIVE = { ok: 1, compile_error: 1, runtime_error: 1, timeout: 1 };
  var CACHEABLE = { ok: 1, compile_error: 1, runtime_error: 1 };
  var inflight = {};
  var memo = {};

  function OQ() { return root.OutputIQ; }
  function keyOf(language, code, stdin) {
    // FNV-1a over language + code + stdin (same text -> same key)
    var s = language + '\u0000' + code + '\u0000' + (stdin || ''), h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return language + ':' + h.toString(36) + ':' + s.length.toString(36);
  }

  // ---------------- cache ----------------
  function storage() { try { return chrome.storage.local; } catch (e) { return null; } }
  async function cacheGet(key) {
    if (memo[key]) return memo[key];
    var st = storage();
    if (!st) return null;
    var d = await st.get(CACHE_KEY);
    var hit = d[CACHE_KEY] && d[CACHE_KEY][key];
    if (hit) memo[key] = hit.r;
    return hit ? hit.r : null;
  }
  async function cachePut(key, r) {
    if (!CACHEABLE[r.category]) return;
    var clean = Object.assign({}, r);
    delete clean.ms; delete clean.token;
    memo[key] = clean;
    var st = storage();
    if (!st) return;
    var d = await st.get(CACHE_KEY);
    var c = d[CACHE_KEY] || {};
    c[key] = { r: clean, t: Date.now() };
    var keys = Object.keys(c);
    if (keys.length > CACHE_MAX) keys.sort(function (a, b) { return c[a].t - c[b].t; }).slice(0, keys.length - CACHE_MAX).forEach(function (k) { delete c[k]; });
    var o = {}; o[CACHE_KEY] = c;
    await st.set(o);
  }
  async function clearCache() { memo = {}; var st = storage(); if (st) { var o = {}; o[CACHE_KEY] = {}; await st.set(o); } }

  // ---------------- runners ----------------
  function judge0(settings, language, code, stdin, opts) {
    return OQ().judge0.runCode(settings, language, code, stdin, opts && opts.judge0);
  }
  function wandbox(settings, language, code, stdin, opts) {
    return OQ().wandbox.run(settings, language, code, stdin, opts && opts.wandbox);
  }

  /** Wandbox first; Judge0 joins after HEDGE_MS or as soon as Wandbox fails. First definitive result wins. */
  function race(settings, language, code, stdin, opts) {
    var hedge = opts && opts.hedgeMs != null ? opts.hedgeMs : HEDGE_MS;
    return new Promise(function (resolve) {
      var done = false, running = 0, lastFail = null, j0 = false, timer = null;
      function finish(r, who) {
        if (done) return;
        running--;
        r = r || { category: 'network_error', error: 'No result.' };
        r.runner = who;
        if (DEFINITIVE[r.category]) { done = true; clearTimeout(timer); resolve(r); return; }
        if (!lastFail || who === 'judge0') lastFail = r; // prefer Judge0's message (it names the server in Settings)
        if (!j0) startJudge0();
        else if (running === 0) { done = true; clearTimeout(timer); resolve(lastFail); }
      }
      function guard(p, who) {
        running++;
        p.then(function (r) { finish(r, who); }, function (e) { finish({ category: 'network_error', error: String(e && e.message || e) }, who); });
      }
      function startJudge0() { if (j0 || done) return; j0 = true; guard(judge0(settings, language, code, stdin, opts), 'judge0'); }
      guard(wandbox(settings, language, code, stdin, opts), 'wandbox');
      timer = setTimeout(startJudge0, hedge);
    });
  }

  /**
   * Run code with the fastest available runner. Never throws.
   * @returns {Promise<object>} judge0-style result + {runner, ms}
   */
  async function run(settings, language, code, stdin, opts) {
    opts = opts || {};
    var t0 = Date.now();
    var key = keyOf(language, code, stdin);
    if (!opts.noCache) {
      var hit = await cacheGet(key);
      if (hit) return Object.assign({}, hit, { runner: 'cache', ranOn: hit.runner, ms: Date.now() - t0 });
    }
    if (!inflight[key]) {
      var mode = (settings && settings.runner) || 'auto';
      var p = (mode === 'judge0'
        ? judge0(settings, language, code, stdin, opts).then(function (r) { r.runner = 'judge0'; return r; })
        : race(settings, language, code, stdin, opts));
      inflight[key] = p.then(function (r) {
        delete inflight[key];
        if (!opts.noCache) return cachePut(key, r).then(function () { return r; }, function () { return r; });
        return r;
      });
    }
    var r = await inflight[key];
    return Object.assign({}, r, { ms: Date.now() - t0 });
  }

  /** Label for the UI: "Wandbox · 0.6 s", "Instant (saved)". */
  function label(r) {
    if (!r || !r.runner) return '';
    if (r.runner === 'cache') return 'Instant · saved result';
    var name = r.runner === 'wandbox' ? 'Wandbox' : 'Judge0';
    return 'Ran on ' + name + (r.ms != null ? ' · ' + (r.ms / 1000).toFixed(1) + ' s' : '');
  }

  var api = { HEDGE_MS: HEDGE_MS, keyOf: keyOf, run: run, race: race, label: label, clearCache: clearCache, _memo: function () { return memo; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.runner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

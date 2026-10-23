/*
 * Codextent — LeetCode "Solve later" marks with your idea notes.
 *
 * Synced with chrome.storage.sync, so a problem marked on the college PC shows up at the hostel
 * (same Google account signed in to Chrome, sync on). No server.
 *   sync key "lc:<slug>" -> { s, id, t, d, g:[tags], n:note, st:'todo', ca, ua }
 *   Done problems move to chrome.storage.local "lcDone" (keeps the small sync space for open ones).
 * Chrome sync limits: 100 KB total, 8 KB per item, 512 items -> notes are capped at 1500 characters.
 * For now: only problems tagged String or Hash Table (ONLY_TAGS); set it to null to allow every problem.
 */
(function (root) {
  'use strict';

  var PREFIX = 'lc:';
  var DONE_KEY = 'lcDone';
  var MAX_NOTE = 1500;
  var ONLY_TAGS = ['string', 'hash-table'];
  var SYNC_QUOTA = 102400;

  function slugFromPath(pathname) {
    var m = /^\/problems\/([a-z0-9-]+)(?:\/|$)/i.exec(pathname || '');
    return m ? m[1].toLowerCase() : null;
  }
  function tagSlug(name) { return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function allowed(tags) {
    if (!ONLY_TAGS) return true;
    var t = (tags || []).map(tagSlug);
    return ONLY_TAGS.some(function (x) { return t.indexOf(x) !== -1; });
  }
  function difficultyOf(s) { s = String(s || '').toLowerCase(); return s === 'easy' || s === 'medium' || s === 'hard' ? s : ''; }

  /** Build (or update) a mark. Only what fits Chrome sync: no problem text. */
  function makeMark(info, prev, now) {
    now = now || Date.now();
    prev = prev || {};
    return {
      s: info.slug,
      id: String(info.id || prev.id || '').slice(0, 8),
      t: String(info.title || prev.t || info.slug).slice(0, 140),
      d: difficultyOf(info.difficulty) || prev.d || '',
      g: (info.tags && info.tags.length ? info.tags : prev.g || []).map(String).slice(0, 8).map(function (x) { return x.slice(0, 30); }),
      n: String(info.note != null ? info.note : prev.n || '').slice(0, MAX_NOTE),
      st: 'todo',
      ca: prev.ca || now,
      ua: now
    };
  }
  function bytes(key, value) { return key.length + JSON.stringify(value).length; }

  /** Marks from a chrome.storage.sync dump + the local done map, newest first. */
  function listMarks(syncAll, doneMap) {
    var out = [];
    Object.keys(syncAll || {}).forEach(function (k) { if (k.indexOf(PREFIX) === 0 && syncAll[k] && syncAll[k].s) out.push(syncAll[k]); });
    Object.keys(doneMap || {}).forEach(function (k) { if (doneMap[k] && doneMap[k].s && !(syncAll || {})[PREFIX + k]) out.push(doneMap[k]); });
    return out.sort(function (a, b) { return (b.ua || 0) - (a.ua || 0); });
  }
  function filterMarks(list, f) {
    f = f || {};
    var q = String(f.q || '').trim().toLowerCase();
    return (list || []).filter(function (m) {
      if (f.status && m.st !== f.status) return false;
      if (f.difficulty && m.d !== f.difficulty) return false;
      if (f.tag && (m.g || []).map(tagSlug).indexOf(f.tag) === -1) return false;
      return !q || [m.t, m.n, m.id, (m.g || []).join(' ')].join('\n').toLowerCase().indexOf(q) !== -1;
    });
  }

  // ---------- chrome.storage helpers ----------
  function sync() { return chrome.storage.sync; }
  function local() { return chrome.storage.local; }
  async function getMark(slug) {
    var k = PREFIX + slug, d = await sync().get(k);
    if (d[k]) return d[k];
    var l = await local().get(DONE_KEY);
    return (l[DONE_KEY] || {})[slug] || null;
  }
  async function saveMark(info) {
    var k = PREFIX + info.slug;
    var prev = await getMark(info.slug);
    var m = makeMark(info, prev);
    if (bytes(k, m) > 8000) m.n = m.n.slice(0, Math.max(0, m.n.length - (bytes(k, m) - 8000)));
    var o = {}; o[k] = m;
    await sync().set(o);
    await removeDone(info.slug);
    return m;
  }
  async function markDone(slug) {
    var k = PREFIX + slug, d = await sync().get(k), m = d[k];
    if (!m) return null;
    m = Object.assign({}, m, { st: 'done', da: Date.now(), ua: Date.now() });
    var l = await local().get(DONE_KEY), done = l[DONE_KEY] || {};
    done[slug] = m;
    var o = {}; o[DONE_KEY] = done;
    await local().set(o);
    await sync().remove(k);
    return m;
  }
  async function reopen(slug) {
    var l = await local().get(DONE_KEY), m = (l[DONE_KEY] || {})[slug];
    if (!m) return null;
    return saveMark({ slug: slug, id: m.id, title: m.t, difficulty: m.d, tags: m.g, note: m.n });
  }
  async function removeDone(slug) {
    var l = await local().get(DONE_KEY), done = l[DONE_KEY] || {};
    if (!done[slug]) return;
    delete done[slug];
    var o = {}; o[DONE_KEY] = done;
    await local().set(o);
  }
  async function removeMark(slug) { await sync().remove(PREFIX + slug); await removeDone(slug); }
  async function allMarks() {
    var s = await sync().get(null), l = await local().get(DONE_KEY);
    return listMarks(s, l[DONE_KEY]);
  }
  async function usage() {
    var used = 0;
    try { used = await sync().getBytesInUse(null); } catch (e) { var s = await sync().get(null); used = JSON.stringify(s).length; }
    return { used: used, quota: SYNC_QUOTA, pct: Math.round(used / SYNC_QUOTA * 100) };
  }

  var api = {
    PREFIX: PREFIX, DONE_KEY: DONE_KEY, MAX_NOTE: MAX_NOTE, ONLY_TAGS: ONLY_TAGS, SYNC_QUOTA: SYNC_QUOTA,
    slugFromPath: slugFromPath, tagSlug: tagSlug, allowed: allowed, makeMark: makeMark, listMarks: listMarks, filterMarks: filterMarks,
    getMark: getMark, saveMark: saveMark, markDone: markDone, reopen: reopen, removeMark: removeMark, allMarks: allMarks, usage: usage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.leetcode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

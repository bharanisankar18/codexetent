/*
 * Codextent — Code Clipper + My Revision Vault (pure logic + a small chrome.storage helper).
 *
 * Storage key "vault" -> Clip[] (newest last, capped at MAX_CLIPS)
 * Clip = {
 *   id, text, kind:'code'|'text', language:'c'|'cpp'|'java'|'python'|'sql'|'text',
 *   concepts:[conceptId], concept: conceptId|'' (the main one, editable), topic,
 *   site, url, pageTitle, notes, status:'new'|'learning'|'difficult'|'mastered',
 *   createdAt, updatedAt, reviewedAt, reviewCount, nextReviewAt
 * }
 * Marking a clip Difficult on its card keeps it due now.
 * Revising: "Still difficult" -> due again in 1 day, "Learning" -> 3 days, "Mastered" -> 14 days.
 */
(function (root) {
  'use strict';

  var KEY = 'vault';
  var MAX_CLIPS = 1000;
  var MAX_TEXT = 20000;
  var MAX_NOTES = 5000;
  var DAY = 86400000;
  var LANGS = ['c', 'cpp', 'java', 'python', 'sql', 'text'];
  var STATUSES = ['new', 'learning', 'difficult', 'mastered'];
  var STATUS_LABEL = { 'new': 'New', learning: 'Learning', difficult: 'Difficult', mastered: 'Mastered' };
  var NEXT_IN = { 'new': 0, learning: 3 * DAY, difficult: 1 * DAY, mastered: 14 * DAY };

  function str(s, max) { s = String(s == null ? '' : s); return max && s.length > max ? s.slice(0, max) : s; }
  function newId(now) { return (now || Date.now()).toString(36) + Math.random().toString(36).slice(2, 8); }

  /** Normalise selected text: CRLF -> LF, non-breaking spaces -> spaces, trim blank edges, drop shared indent. */
  function cleanText(text) {
    var t = str(text).replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/[ \t]+$/gm, '');
    t = t.replace(/^\n+|\s+$/g, '');
    var lines = t.split('\n');
    var indent = Math.min.apply(null, lines.filter(function (l) { return l.trim(); }).map(function (l) { return l.match(/^[ \t]*/)[0].length; }).concat([Infinity]));
    if (indent > 0 && indent !== Infinity) t = lines.map(function (l) { return l.slice(Math.min(indent, l.match(/^[ \t]*/)[0].length)); }).join('\n');
    return t;
  }

  /** Looks like code even when too short for the detector (e.g. "x++;" or "cout << a;"). */
  function codeish(t) { return /[;{}()=<>\[\]]|^\s*(#include|def |class |import |SELECT|print)/im.test(t); }

  /**
   * Decide language + concepts for a selection.
   * @param {string} text
   * @param {string|null} hint   language from the page markup/URL (may be null)
   * @param {object} detector    OutputIQ.detector
   * @param {object} concepts    OutputIQ.concepts
   */
  function classify(text, hint, detector, concepts) {
    var t = cleanText(text);
    var h = hint && LANGS.indexOf(hint) !== -1 && hint !== 'text' ? hint : null;
    var language = 'text';
    if (detector) {
      var info = detector.classifyCode(t, h);
      // a page/URL hint is weak (e.g. a Python tab on a /cpp/ page): if the content argues against it, ask without the hint
      if (h && info.scores[h] < 0) { var free = detector.classifyCode(t, null); if (free.isCode) info = free; }
      // with a page hint the detector accepts anything; make sure the selection is really code, not prose
      if (info.isCode && info.language && (!h || info.scores[info.language] > 0 || codeish(t))) language = info.language;
      else if (h && codeish(t)) language = h;
    } else if (h) language = h;
    var tags = language !== 'text' && concepts && concepts.has(language) ? concepts.tag(t, language) : [];
    return { text: t, language: language, kind: language === 'text' ? 'text' : 'code', concepts: tags };
  }

  function topicOf(pageTitle) {
    return str(pageTitle).replace(/\s*[-|–:]\s*(GeeksforGeeks|Programiz|W3Schools|Tutorialspoint|TutorialsPoint|Javatpoint|Scaler Topics|Studytonight|Sanfoundry)\s*$/i, '').trim();
  }

  /** Build a new clip from {text, language, kind, concepts, site, url, pageTitle}. */
  function makeClip(input, now) {
    now = now || Date.now();
    var language = LANGS.indexOf(input.language) !== -1 ? input.language : 'text';
    var concepts = Array.isArray(input.concepts) ? input.concepts.slice(0, 12).map(String) : [];
    return {
      id: newId(now),
      text: str(cleanText(input.text), MAX_TEXT),
      kind: language === 'text' ? 'text' : 'code',
      language: language,
      concepts: concepts,
      concept: concepts[0] || '',
      topic: str(topicOf(input.pageTitle), 300),
      site: str(input.site, 60),
      url: /^https?:\/\//i.test(input.url || '') ? str(input.url, 2000) : '',
      pageTitle: str(input.pageTitle, 300),
      notes: '',
      status: 'new',
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
      reviewCount: 0,
      nextReviewAt: now
    };
  }

  function sameClip(a, b) { return a.text === b.text && (a.url || '').split('#')[0] === (b.url || '').split('#')[0]; }

  /** Add a clip; the same text from the same page is not saved twice. Returns {list, clip, duplicate}. */
  function addClip(list, clip) {
    list = Array.isArray(list) ? list.slice() : [];
    if (!clip.text || !clip.text.trim()) return { list: list, clip: null, duplicate: false, error: 'Nothing selected.' };
    var dup = list.filter(function (c) { return sameClip(c, clip); })[0];
    if (dup) return { list: list, clip: dup, duplicate: true };
    list.push(clip);
    if (list.length > MAX_CLIPS) list = list.slice(list.length - MAX_CLIPS);
    return { list: list, clip: clip, duplicate: false };
  }

  /** Change editable fields only. Returns {list, clip}. */
  function updateClip(list, id, patch, now) {
    now = now || Date.now();
    var out = null;
    var next = (list || []).map(function (c) {
      if (c.id !== id) return c;
      var u = Object.assign({}, c);
      if ('notes' in patch) u.notes = str(patch.notes, MAX_NOTES);
      if ('status' in patch && STATUSES.indexOf(patch.status) !== -1) {
        // marking a clip Difficult by hand keeps it due now; revising it (markReviewed) spaces it out
        if (u.status !== patch.status) u.nextReviewAt = patch.status === 'difficult' ? now : now + NEXT_IN[patch.status];
        u.status = patch.status;
      }
      if ('language' in patch && LANGS.indexOf(patch.language) !== -1) { u.language = patch.language; u.kind = patch.language === 'text' ? 'text' : 'code'; }
      if ('concept' in patch) u.concept = str(patch.concept, 60);
      if ('concepts' in patch && Array.isArray(patch.concepts)) u.concepts = patch.concepts.slice(0, 12).map(String);
      if ('topic' in patch) u.topic = str(patch.topic, 300);
      u.updatedAt = now;
      out = u;
      return u;
    });
    return { list: next, clip: out };
  }

  /** Record one revision: the learner says how it went. */
  function markReviewed(list, id, status, now) {
    now = now || Date.now();
    var r = updateClip(list, id, { status: status }, now);
    r.list = r.list.map(function (c) {
      if (c.id !== id) return c;
      var u = Object.assign({}, c, { reviewedAt: now, reviewCount: (c.reviewCount || 0) + 1, nextReviewAt: now + NEXT_IN[c.status] });
      r.clip = u;
      return u;
    });
    return r;
  }

  function removeClip(list, id) { return (list || []).filter(function (c) { return c.id !== id; }); }

  function isDue(c, now) { return c.status !== 'mastered' && (c.nextReviewAt == null || c.nextReviewAt <= (now || Date.now())); }

  /**
   * @param {Clip[]} list
   * @param {{q?, language?, status?, site?, concept?, due?:boolean, sort?:'newest'|'oldest'|'difficult'}} f
   */
  function filterClips(list, f, now) {
    f = f || {};
    var q = str(f.q).trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    var out = (list || []).filter(function (c) {
      if (f.language && c.language !== f.language) return false;
      if (f.status && c.status !== f.status) return false;
      if (f.site && c.site !== f.site) return false;
      if (f.concept && c.concept !== f.concept && (c.concepts || []).indexOf(f.concept) === -1) return false;
      if (f.due && !isDue(c, now)) return false;
      if (!words.length) return true;
      var hay = [c.text, c.notes, c.topic, c.pageTitle, c.site, c.language, c.concept].concat(f.conceptNames ? f.conceptNames(c) : []).join('\n').toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    });
    var rank = { difficult: 0, learning: 1, 'new': 2, mastered: 3 };
    out.sort(function (a, b) {
      if (f.sort === 'oldest') return a.createdAt - b.createdAt;
      if (f.sort === 'difficult') return (rank[a.status] - rank[b.status]) || (b.createdAt - a.createdAt);
      return b.createdAt - a.createdAt;
    });
    return out;
  }

  /** Clips to revise now: difficult first, then learning, then new; least recently reviewed first. */
  function reviewQueue(list, now) {
    var rank = { difficult: 0, learning: 1, 'new': 2 };
    return (list || []).filter(function (c) { return isDue(c, now); }).sort(function (a, b) {
      return (rank[a.status] - rank[b.status]) || ((a.reviewedAt || 0) - (b.reviewedAt || 0)) || (a.createdAt - b.createdAt);
    });
  }

  function vaultStats(list, now) {
    list = list || [];
    var s = { total: list.length, due: 0, byStatus: { 'new': 0, learning: 0, difficult: 0, mastered: 0 }, byLanguage: {}, difficultConcepts: [] };
    var dc = {};
    list.forEach(function (c) {
      s.byStatus[c.status] = (s.byStatus[c.status] || 0) + 1;
      s.byLanguage[c.language] = (s.byLanguage[c.language] || 0) + 1;
      if (isDue(c, now)) s.due++;
      if (c.status === 'difficult' && c.concept) {
        var k = c.language + ':' + c.concept;
        dc[k] = dc[k] || { language: c.language, concept: c.concept, count: 0 };
        dc[k].count++;
      }
    });
    s.difficultConcepts = Object.keys(dc).map(function (k) { return dc[k]; }).sort(function (a, b) { return b.count - a.count; });
    return s;
  }

  // ---------- chrome.storage helpers (extension pages + service worker) ----------
  function area() { return chrome.storage.local; }
  async function getClips() { var d = await area().get(KEY); return Array.isArray(d[KEY]) ? d[KEY] : []; }
  async function setClips(list) { var o = {}; o[KEY] = list; await area().set(o); }
  async function saveClip(input) {
    var r = addClip(await getClips(), makeClip(input));
    if (r.clip && !r.duplicate) await setClips(r.list);
    return r;
  }
  async function editClip(id, patch) { var r = updateClip(await getClips(), id, patch); await setClips(r.list); return r.clip; }
  async function reviewClip(id, status) { var r = markReviewed(await getClips(), id, status); await setClips(r.list); return r.clip; }
  async function deleteClip(id) { await setClips(removeClip(await getClips(), id)); }

  var api = {
    KEY: KEY, MAX_CLIPS: MAX_CLIPS, LANGS: LANGS, STATUSES: STATUSES, STATUS_LABEL: STATUS_LABEL, NEXT_IN: NEXT_IN,
    cleanText: cleanText, classify: classify, topicOf: topicOf, makeClip: makeClip, addClip: addClip, updateClip: updateClip,
    markReviewed: markReviewed, removeClip: removeClip, isDue: isDue, filterClips: filterClips, reviewQueue: reviewQueue, vaultStats: vaultStats,
    getClips: getClips, setClips: setClips, saveClip: saveClip, editClip: editClip, reviewClip: reviewClip, deleteClip: deleteClip
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.vault = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

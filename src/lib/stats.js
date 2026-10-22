/*
 * OutputIQ — progress maths (pure, no chrome APIs).
 *
 * Attempt shape:
 *   { id, ts, url, pageTitle, questionId, code, stdin, prediction,
 *     result: 'correct'|'incorrect'|'compile_error'|'runtime_error'|'timeout'|'error',
 *     kind, actualOutput, statusDescription }
 *
 * Accuracy only counts GRADED attempts (correct + incorrect). Compile errors,
 * runtime errors and timeouts are tracked separately, because there was no normal
 * output to compare against.
 */
(function (root) {
  'use strict';

  /** FNV-1a 32-bit hash -> 8 hex chars. Same code + same stdin => same question id. */
  function questionId(code, stdin) {
    var s = String(code || '').replace(/\r\n?/g, '\n').trim() + '\u0000' + String(stdin || '').replace(/\r\n?/g, '\n').trim();
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function isGraded(r) { return r === 'correct' || r === 'incorrect'; }

  /** Attempts saved by v0.1 had no language/site. */
  function languageOf(a) { return a.language || 'cpp'; }

  function siteOf(a) {
    if (a.site) return a.site;
    try {
      var h = new URL(a.url).hostname.replace(/^www\./, '');
      if (/geeksforgeeks\.org$/.test(h)) return 'geeksforgeeks';
      if (/programiz\.com$/.test(h)) return 'programiz';
      if (/w3schools\.com$/.test(h)) return 'w3schools';
      if (/tutorialspoint\.com$/.test(h)) return 'tutorialspoint';
      if (/javatpoint\.com$/.test(h)) return 'javatpoint';
      if (/scaler\.com$/.test(h)) return 'scaler';
      if (/studytonight\.com$/.test(h)) return 'studytonight';
      if (/sanfoundry\.com$/.test(h)) return 'sanfoundry';
      return h;
    } catch (e) { return 'other'; }
  }

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function groupAccuracy(list, keyFn) {
    var g = {};
    list.forEach(function (a) {
      var k = keyFn(a);
      var x = g[k] || (g[k] = { key: k, correct: 0, incorrect: 0, errors: 0 });
      if (a.result === 'correct') x.correct++;
      else if (a.result === 'incorrect') x.incorrect++;
      else x.errors++;
    });
    return Object.keys(g).map(function (k) {
      var x = g[k];
      var graded = x.correct + x.incorrect;
      x.graded = graded;
      x.accuracy = graded ? Math.round((x.correct / graded) * 100) : null;
      return x;
    }).sort(function (a, b) { return (b.graded + b.errors) - (a.graded + a.errors); });
  }

  /** Last `days` calendar days (oldest first), counts of correct / incorrect / errors per day. */
  function dailyActivity(attempts, days, now) {
    days = days || 14;
    var end = new Date(now || Date.now());
    var out = [];
    var index = {};
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      var k = dayKey(d.getTime());
      var row = { day: k, date: d, correct: 0, incorrect: 0, errors: 0 };
      index[k] = row;
      out.push(row);
    }
    (attempts || []).forEach(function (a) {
      var r = index[dayKey(a.ts)];
      if (!r) return;
      if (a.result === 'correct') r.correct++;
      else if (a.result === 'incorrect') r.incorrect++;
      else r.errors++;
    });
    return out;
  }

  function computeStats(attempts, recentCount) {
    var list = (attempts || []).slice().sort(function (a, b) { return a.ts - b.ts; });
    var correct = 0, incorrect = 0, errors = 0;
    var byQuestion = {};
    list.forEach(function (a) {
      if (a.result === 'correct') correct++;
      else if (a.result === 'incorrect') incorrect++;
      else errors++;
      var q = byQuestion[a.questionId] || (byQuestion[a.questionId] = { questionId: a.questionId, attempts: 0, correct: 0, lastGraded: null, last: null });
      q.attempts++;
      if (a.result === 'correct') q.correct++;
      if (isGraded(a.result)) q.lastGraded = a;
      q.last = a;
    });

    var streak = 0;
    for (var i = list.length - 1; i >= 0; i--) {
      if (!isGraded(list[i].result)) continue;
      if (list[i].result === 'correct') streak++; else break;
    }

    var questions = Object.keys(byQuestion).map(function (k) { return byQuestion[k]; });
    var needsRevision = questions
      .filter(function (q) { return q.lastGraded && q.lastGraded.result === 'incorrect'; })
      .map(function (q) { return q.lastGraded; })
      .sort(function (a, b) { return b.ts - a.ts; });

    var graded = correct + incorrect;
    return {
      total: list.length,
      graded: graded,
      correct: correct,
      incorrect: incorrect,
      errors: errors,
      accuracy: graded ? Math.round((correct / graded) * 100) : null,
      streak: streak,
      questionsSeen: questions.length,
      questionsMastered: questions.filter(function (q) { return q.lastGraded && q.lastGraded.result === 'correct'; }).length,
      needsRevision: needsRevision,
      recent: list.slice(-(recentCount || 10)).reverse(),
      byLanguage: groupAccuracy(list, languageOf),
      bySite: groupAccuracy(list, siteOf)
    };
  }

  var api = { questionId: questionId, computeStats: computeStats, isGraded: isGraded, languageOf: languageOf, siteOf: siteOf, dailyActivity: dailyActivity, dayKey: dayKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.stats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* OutputIQ — small helpers shared by popup and dashboard. */
(function (root) {
  'use strict';
  var LABELS = {
    correct: ['Correct', 'correct'],
    incorrect: ['Wrong', 'incorrect'],
    compile_error: ['Compile error', 'error'],
    runtime_error: ['Runtime error', 'error'],
    timeout: ['Timeout', 'error'],
    error: ['Runner error', 'error']
  };

  function badge(result) {
    var l = LABELS[result] || [result, 'error'];
    var b = document.createElement('span');
    b.className = 'badge ' + l[1];
    b.textContent = l[0];
    return b;
  }

  function timeAgo(ts) {
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    var m = Math.round(s / 60); if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    var d = Math.round(h / 24); if (d < 30) return d + ' d ago';
    return new Date(ts).toLocaleDateString();
  }

  function shortTitle(a) {
    var t = (a.pageTitle || '').replace(/\s*[-|–]\s*GeeksforGeeks\s*$/i, '').trim();
    return t || a.url || 'Untitled page';
  }

  /** Only allow http(s) links from stored data. */
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }

  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.ui = { badge: badge, timeAgo: timeAgo, shortTitle: shortTitle, safeUrl: safeUrl };
})(typeof globalThis !== 'undefined' ? globalThis : this);

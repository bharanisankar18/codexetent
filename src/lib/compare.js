/*
 * OutputIQ — output comparison.
 *
 * Normalisation (applied to BOTH the prediction and the real output):
 *   1. "\r\n" and "\r" become "\n"   (Windows / old Mac line endings)
 *   2. trailing whitespace at the very END of the whole text is removed
 *      (programs often print a final "\n" or " " that users don't type)
 * Everything else — spaces inside lines, blank lines, case — must match exactly.
 *
 * If the texts differ ONLY by spaces/tabs at the end of individual lines, the
 * verdict is "whitespace_only". Callers decide (via options.lenientTrailingSpaces)
 * whether that counts as correct; the UI always tells the user.
 */
(function (root) {
  'use strict';

  function normalize(text) {
    if (text == null) return '';
    return String(text)
      .replace(/\r\n?/g, '\n')
      .replace(/\s+$/, '');
  }

  function stripLineTrailing(text) {
    return text.split('\n').map(function (l) { return l.replace(/[ \t]+$/, ''); }).join('\n');
  }

  /** Make whitespace visible: space -> ·, tab -> →, empty line marker. */
  function visible(line) {
    if (line === undefined) return '(no line)';
    if (line === '') return '(empty line)';
    return line.replace(/ /g, '·').replace(/\t/g, '→');
  }

  /** Find first difference between two normalised strings. Lines/columns are 1-based. */
  function firstDifference(expected, actual) {
    var e = expected.split('\n');
    var a = actual.split('\n');
    var n = Math.max(e.length, a.length);
    for (var i = 0; i < n; i++) {
      var el = e[i];
      var al = a[i];
      if (el === al) continue;
      var col = 1;
      if (el !== undefined && al !== undefined) {
        var m = Math.min(el.length, al.length);
        var j = 0;
        while (j < m && el[j] === al[j]) j++;
        col = j + 1;
      }
      var reason;
      if (el === undefined) reason = 'Your prediction has extra line(s) the program did not print.';
      else if (al === undefined) reason = 'Your prediction is missing line(s) the program printed.';
      else if (col > al.length) reason = 'Your line ends early; the program printed more characters here.';
      else if (col > el.length) reason = 'Your line has extra characters at the end.';
      else reason = 'Different character at this position.';
      return {
        line: i + 1,
        column: col,
        expectedLine: el,
        actualLine: al,
        expectedVisible: visible(el),
        actualVisible: visible(al),
        reason: reason
      };
    }
    return null;
  }

  /**
   * @param {string} predicted  what the user typed
   * @param {string} actual     real program stdout
   * @param {{lenientTrailingSpaces?: boolean}} [options]
   * @returns {{correct:boolean, kind:'exact'|'whitespace_only'|'mismatch',
   *            diff:object|null, normalizedPrediction:string, normalizedActual:string,
   *            notes:string[]}}
   */
  // ---------- table results (MySQL) ----------
  // Accept "a|b", "a | b", tab- or space-separated cells, ASCII borders (+----+), with or without the header row.
  function tableLines(text) {
    return normalize(text).split('\n')
      .filter(function (l) { return !/^[\s+\-=|]*$/.test(l) || l === ''; })
      .map(function (l) { return l.replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim(); })
      .filter(function (l, i, arr) { return l !== '' || (i > 0 && i < arr.length - 1); });
  }
  function cells(l) { return l.split(/\s*\|\s*|\t+|\s{2,}/).map(function (c) { return c.trim(); }).join('|'); }
  function tokens(l) { return l.replace(/\|/g, ' ').trim().split(/\s+/).join(' '); }
  function sameRows(p, a, fn) {
    if (p.length !== a.length) return false;
    for (var i = 0; i < p.length; i++) if (fn(p[i]) !== fn(a[i])) return false;
    return true;
  }
  function compareTable(predicted, actual) {
    var p = tableLines(predicted), a = tableLines(actual);
    var match = function (rows) { return sameRows(p, rows, cells) || sameRows(p, rows, tokens); };
    if (match(a)) return { header: true };
    // the output has a header row per SELECT; allow the prediction to leave the header(s) out
    if (a.length > 1 && match(a.slice(1))) return { header: false };
    return null;
  }

  function compareOutput(predicted, actual, options) {
    var lenient = !options || options.lenientTrailingSpaces !== false;
    var p = normalize(predicted);
    var a = normalize(actual);
    var notes = [];

    if (/\r/.test(String(actual || '')) || /\r/.test(String(predicted || ''))) {
      notes.push('Windows-style line endings (\\r\\n) were treated as normal newlines.');
    }

    if (p === a) {
      return { correct: true, kind: 'exact', diff: null, normalizedPrediction: p, normalizedActual: a, notes: notes };
    }

    var diff = firstDifference(a, p); // expected = actual output, "actual" = user's line
    // rename for clarity in the UI: expected = program, yours = prediction
    var d = diff && {
      line: diff.line,
      column: diff.column,
      expectedLine: diff.expectedLine,
      yourLine: diff.actualLine,
      expectedVisible: diff.expectedVisible,
      yourVisible: diff.actualVisible,
      reason: diff.reason
    };

    if (options && options.table) {
      var t = compareTable(predicted, actual);
      if (t) {
        notes.push('Compared as a table: cells can be separated by |, tabs or spaces.' + (t.header ? '' : ' The header row was not needed.'));
        return { correct: true, kind: 'table', diff: null, normalizedPrediction: p, normalizedActual: a, notes: notes };
      }
    }

    if (stripLineTrailing(p) === stripLineTrailing(a)) {
      notes.push('The only difference is spaces/tabs at the end of line ' + d.line +
        (lenient ? ' — counted as correct (lenient mode).' : ' — counted as wrong (strict mode).'));
      return { correct: lenient, kind: 'whitespace_only', diff: d, normalizedPrediction: p, normalizedActual: a, notes: notes };
    }

    return { correct: false, kind: 'mismatch', diff: d, normalizedPrediction: p, normalizedActual: a, notes: notes };
  }

  var api = { normalize: normalize, compareOutput: compareOutput, compareTable: compareTable, firstDifference: firstDifference, visible: visible };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.compare = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

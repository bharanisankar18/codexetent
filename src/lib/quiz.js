/*
 * Codextent — "Quiz me" questions for a code example (C++ on GfG first).
 *
 * Two sources, combined:
 *   1. Concept bank: the code's concept tags pick verified examples from the concept catalog
 *      ("What does this print?" — answers were checked by running them, tests/concept-examples.js).
 *   2. What-if: small changes to THIS code (i <= n → i < n, endl → " ", a number, x / y → (double)x / y,
 *      x++ ↔ ++x in output). The background RUNS each changed program, so the right answer is always real.
 * Wrong options come from common mistakes (off by one, number ±1, lines joined, the unchanged output).
 *
 * Pure functions here; running happens in background.js (buildQuiz).
 */
(function (root) {
  'use strict';

  // ---------- helpers ----------
  /** Blank out comments and string/char literals (same length) so edits never land inside them. */
  function mask(code) {
    return String(code).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|^[ \t]*#[^\n]*/gm, function (m) { return m.replace(/[^\n]/g, ' '); });
  }
  function lineOf(code, index) { return code.slice(0, index).split('\n').length; }
  function lineText(code, n) { return code.split('\n')[n - 1].trim(); }
  function edit(code, index, len, repl) { return code.slice(0, index) + repl + code.slice(index + len); }

  // ---------- what-if mutations (C, C++, Java, Python) ----------
  function maskPy(code) {
    return String(code).replace(/#[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, function (m) { return m.replace(/[^\n]/g, ' '); });
  }
  /** Index of the ")" that closes the "(" at index `open` (masked text, so strings never confuse it). */
  function closeParen(m, open) {
    for (var d = 0, i = open; i < m.length; i++) { if (m[i] === '(') d++; else if (m[i] === ')' && --d === 0) return i; }
    return -1;
  }
  /**
   * Small, meaningful changes to the program. Each is later RUN to get its real output.
   * @param {string} code
   * @param {'c'|'cpp'|'java'|'python'} [lang='cpp']
   * @returns {{id, kind, line, before, after, code, prompt, why}[]}  at most one per kind
   */
  function mutations(code, lang) {
    lang = lang || 'cpp';
    var src = String(code), m = lang === 'python' ? maskPy(src) : mask(src), out = [], r;
    function add(id, index, len, repl, prompt, why) {
      var line = lineOf(src, index);
      var changed = edit(src, index, len, repl);
      out.push({ id: id, kind: 'whatif', line: line, before: lineText(src, line), after: lineText(changed, line), code: changed, prompt: prompt, why: why });
    }
    if (lang === 'python') { pyMutations(src, m, add); return out; }

    // 1) loop bound: first "for (...; x <= N; ...)"
    r = /\bfor\s*\([^;]*;\s*[A-Za-z_]\w*\s*(<=|<|>=|>)\s*[^;]+;/.exec(m);
    if (r) {
      var op = r[1], at = r.index + r[0].indexOf(op, r[0].indexOf(';'));
      var flip = { '<=': '<', '<': '<=', '>=': '>', '>': '>=' }[op];
      add('bound', at, op.length, flip, 'What if the loop condition used ' + flip + ' instead of ' + op + '?',
        (op.length === 2 ? op + ' includes the end value; ' + flip + ' stops one step earlier.' : op + ' stops before the end value; ' + flip + ' runs one more time.') + ' Count the iterations again.');
    }
    // 2) line breaks: endl (C++) / println (Java) / "\n" in printf (C)
    if (lang === 'cpp') {
      r = /<<\s*endl\b/.exec(m);
      if (r) add('newline', r.index, r[0].length, '<< " "', 'What if endl were replaced by " " (a space)?', 'endl starts a new line. A space keeps everything on one line, so the lines join with spaces.');
    } else if (lang === 'java') {
      r = /System\.out\.println\b/.exec(m);
      if (r) add('newline', r.index, r[0].length, 'System.out.print', 'What if System.out.println were System.out.print?', 'println adds a new line after the text; print does not, so the next output continues on the same line.');
    } else if (lang === 'c') {
      r = /\bprintf\s*\(/.exec(m);
      while (r) {
        var body = src.slice(r.index, closeParen(m, r.index + r[0].length - 1) + 1), nl = body.indexOf('\\n');
        if (nl !== -1) { add('newline', r.index + nl, 2, ' ', 'What if the \\n in this printf were a space?', '\\n moves to a new line. With a space, the next output continues on the same line.'); break; }
        var rest = /\bprintf\s*\(/g; rest.lastIndex = r.index + 1; r = rest.exec(m);
      }
    }
    // 3) a starting value: "int x = N" (first one)
    r = /\bint\s+[A-Za-z_]\w*\s*=\s*(\d+)\b/.exec(m);
    if (r) {
      var n = Number(r[1]), to = n === 0 ? 1 : n + 2, numAt = r.index + r[0].lastIndexOf(r[1]);
      add('value', numAt, r[1].length, String(to), 'What if ' + r[0].replace(/\s+/g, ' ').trim() + ' started at ' + to + ' instead?', 'Only the starting value changed. Trace the program again from ' + to + '.');
    }
    // 4) integer division: "a / b" with names or numbers
    // (C: only "double/float x = a / b" — a double passed to printf("%d") would print garbage)
    r = lang === 'c'
      ? (function () { var d = /\b(?:double|float)\s+[A-Za-z_]\w*\s*=\s*(([A-Za-z_]\w*|\d+)\s*\/\s*([A-Za-z_]\w*|\d+))/.exec(m); if (!d) return null; var x = [d[1], d[2], d[3]]; x.index = d.index + d[0].indexOf(d[1]); return x; })()
      : /([A-Za-z_]\w*|\d+)\s*\/\s*([A-Za-z_]\w*|\d+)/.exec(m);
    if (r && !/\./.test(r[0])) add('cast', r.index, r[1].length, '(double)' + r[1], 'What if it were (double)' + r[1] + ' / ' + r[2] + '?',
      'int / int drops the decimal part. Casting one side to double keeps it (for example 7 / 2 = 3, but (double)7 / 2 = 3.5).');
    // 5) x++ <-> ++x inside an output statement
    r = (lang === 'cpp' ? /cout[^;]*?(\b[A-Za-z_]\w*\+\+|\+\+[A-Za-z_]\w*\b)/ : lang === 'java' ? /System\.out\.print\w*\s*\([^;]*?(\b[A-Za-z_]\w*\+\+|\+\+[A-Za-z_]\w*\b)/ : /printf\s*\([^;]*?(\b[A-Za-z_]\w*\+\+|\+\+[A-Za-z_]\w*\b)/).exec(m);
    // C: printf arguments have no fixed order, so skip when the variable is used twice in the call
    if (r && lang === 'c') { var nm = r[1].replace(/\+\+/g, ''); if ((r[0].match(new RegExp('\\b' + nm + '\\b', 'g')) || []).length > 1) r = null; }
    if (r) {
      var tok = r[1], tokAt = r.index + r[0].lastIndexOf(tok), name = tok.replace(/\+\+/g, '');
      var sw = /^\+\+/.test(tok) ? name + '++' : '++' + name;
      add('incr', tokAt, tok.length, sw, 'What if ' + tok + ' were written as ' + sw + '?', name + '++ gives the old value and then adds 1; ++' + name + ' adds 1 first and gives the new value.');
    }
    return out;
  }

  function pyMutations(src, m, add) {
    var r;
    // 1) range end: range(n) -> range(n + 1), range(a, b) -> range(a, b + 1)
    r = /\brange\s*\(/.exec(m);
    if (r) {
      var open = r.index + r[0].length - 1, close = closeParen(m, open);
      var args = src.slice(open + 1, close);
      if (close > open && args.split(',').length <= 2) {
        var parts = args.split(','), last = parts[parts.length - 1].trim();
        var lastAt = open + 1 + args.lastIndexOf(last);
        add('bound', lastAt, last.length, last + ' + 1', 'What if it were range(' + (parts.length === 2 ? parts[0].trim() + ', ' : '') + last + ' + 1)?',
          'range stops BEFORE its end value. Adding 1 to the end gives one more number. Count the loop runs again.');
      }
    }
    // 2) print(...) -> print(..., end=" ")
    r = /\bprint\s*\(/.exec(m);
    while (r) {
      var o = r.index + r[0].length - 1, c = closeParen(m, o);
      if (c > o && !/\bend\s*=|\bsep\s*=|\bfile\s*=/.test(src.slice(o, c)) && src.slice(o + 1, c).trim()) {
        add('newline', c, 0, ', end=" "', 'What if this print had end=" "?', 'print ends with a new line by default. end=" " puts a space instead, so the next print continues on the same line.');
        break;
      }
      var g = /\bprint\s*\(/g; g.lastIndex = r.index + 1; r = g.exec(m);
    }
    // 3) a starting value: "x = N" at the start of a line
    r = /^([ \t]*)([A-Za-z_]\w*)[ \t]*=[ \t]*(\d+)[ \t]*$/m.exec(m);
    if (r) {
      var n = Number(r[3]), to = n === 0 ? 1 : n + 2, at = r.index + r[0].lastIndexOf(r[3]);
      add('value', at, r[3].length, String(to), 'What if ' + r[2] + ' = ' + n + ' started at ' + to + ' instead?', 'Only the starting value changed. Trace the program again from ' + to + '.');
    }
    // 4) division: // <-> /
    r = /\/\//.exec(m);
    if (r) add('cast', r.index, 2, '/', 'What if // were written as / ?', '// is floor division and gives a whole number (7 // 2 = 3). / always gives a float (7 / 2 = 3.5).');
    else if ((r = /[^/*]\/[^/=]/.exec(m))) add('cast', r.index + 1, 1, '//', 'What if / were written as // ?', '/ always gives a float (7 / 2 = 3.5). // is floor division and drops the fraction (7 // 2 = 3).');
  }

  // ---------- wrong options from common mistakes ----------
  function bumpLastNumber(s, d) { return s.replace(/-?\d+(?:\.\d+)?(?![\s\S]*\d)/, function (x) { return String(Number(x) + d); }); }
  function bumpFirstNumber(s, d) { return s.replace(/-?\d+(?:\.\d+)?/, function (x) { return String(Number(x) + d); }); }
  function distractors(answer, extra) {
    var a = String(answer).replace(/\s+$/, '');
    var c = [];
    (extra || []).forEach(function (x) { if (x != null) c.push(String(x).replace(/\s+$/, '')); });
    var toks = a.split(/(\s+)/).filter(function (t) { return t.trim(); });
    var allNum = toks.length > 1 && toks.every(function (t) { return /^-?\d+$/.test(t); });
    if (allNum) c.push(a.slice(0, a.lastIndexOf(toks[toks.length - 1])).replace(/\s+$/, ''));             // one item short (off by one)
    else if (a.indexOf('\n') !== -1) c.push(a.split('\n').slice(0, -1).join('\n'));                        // last line missing
    if (toks.length > 1 && toks.every(function (t) { return /^-?\d+$/.test(t); })) {
      var sep = a.indexOf('\n') !== -1 ? '\n' : ' ';
      c.push(a + sep + (2 * Number(toks[toks.length - 1]) - Number(toks[toks.length - 2]))); // one item too many (same step)
    }
    if (/\d/.test(a)) { c.push(bumpLastNumber(a, 1)); c.push(bumpFirstNumber(a, -1)); }
    if (a.indexOf('\n') !== -1) c.push(a.split('\n').join(' '));                                          // lines joined
    else if (toks.length > 1) c.push(toks.join('\n'));                                                     // split into lines
    if (/\d+\.\d+/.test(a)) c.push(a.replace(/(\d+)\.\d+/g, '$1'));                                       // decimals dropped
    if (/^[1-9]\d{0,3}$/.test(a.trim())) c.push(a + '.5');                                              // "it keeps the decimal"
    var seen = {}, norm = function (s) { return s.replace(/[ \t]+$/gm, '').replace(/\s+$/, ''); };
    seen[norm(a)] = true;
    return c.filter(function (x) { var k = norm(x); if (!k.trim() || seen[k]) return false; seen[k] = true; return true; }).slice(0, 3);
  }

  /** Deterministic shuffle (same question -> same order). */
  function shuffle(list, seed) {
    var s = 0; for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    var a = list.slice();
    for (var j = a.length - 1; j > 0; j--) { s = (s * 1103515245 + 12345) >>> 0; var k = s % (j + 1); var t = a[j]; a[j] = a[k]; a[k] = t; }
    return a;
  }
  function options(answer, extra, seed) {
    var list = [String(answer).replace(/\s+$/, '')].concat(distractors(answer, extra));
    return shuffle(list, seed);
  }

  // ---------- concept-bank questions ----------
  function conceptQuestions(concepts, lang, ids, max) {
    if (!concepts.has(lang)) return [];
    var out = [];
    (ids || []).forEach(function (id) {
      if (out.length >= (max || 2)) return;
      var c = concepts.get(lang, id);
      if (!c || c.stdin) return;
      out.push({
        id: 'concept-' + id, kind: 'concept', concept: id, conceptName: c.name,
        prompt: 'Concept check · ' + c.name + ': what does this print?', language: lang,
        snippet: (c.prelude ? c.prelude + '\n\n' : '') + c.body,
        answer: c.output.replace(/\s+$/, ''), options: options(c.output, [], id), why: c.trap
      });
    });
    return out;
  }

  /** Turn a run what-if into a question; null when the change makes no difference or did not run cleanly. */
  function whatIfQuestion(mut, original, run) {
    if (!run || run.category !== 'ok') return null;
    var ans = String(run.stdout).replace(/\s+$/, ''), orig = String(original).replace(/\s+$/, '');
    if (ans === orig || !ans.trim() || ans.length > 400) return null;
    return {
      id: 'whatif-' + mut.id, kind: 'whatif', prompt: mut.prompt, line: mut.line, before: mut.before, after: mut.after,
      answer: ans, options: options(ans, [orig], mut.id + ans), why: mut.why, original: orig
    };
  }

  var api = { mask: mask, mutations: mutations, distractors: distractors, options: options, conceptQuestions: conceptQuestions, whatIfQuestion: whatIfQuestion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.quiz = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

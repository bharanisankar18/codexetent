/*
 * Codextent — code-block detection, language classification and code extraction.
 * Languages: C, C++, Java, Python, MySQL (sql).
 *
 * Pure text functions (classifyCode, languageFromClassTokens, wrapSnippet) are unit-tested
 * in Node. DOM functions only read the elements they are given and never modify the page.
 */
(function (root) {
  'use strict';

  var LANGUAGES = ['c', 'cpp', 'java', 'python', 'sql'];
  var LABELS = { c: 'C', cpp: 'C++', java: 'Java', python: 'Python', sql: 'MySQL' };

  // ---------- language hints from class names ----------

  var HINTS = [
    { lang: 'cpp', re: /^(?:lang(?:uage)?-)?(?:cpp|c\+\+|cplusplus|cxx|hpp)$|^brush:(?:cpp|c\+\+)$|^cpp-exec$|^cpphigh$/i },
    { lang: 'c', re: /^(?:lang(?:uage)?-)c$|^brush:c$|^c-exec$|^chigh$/i },
    { lang: 'java', re: /^(?:lang(?:uage)?-)?java$|^brush:java$|^java-exec$/i },
    { lang: 'python', re: /^(?:lang(?:uage)?-)?(?:python[23]?|py)$|^brush:(?:python|py)$|^python-exec$|^pythonhigh$/i },
    { lang: 'sql', re: /^(?:lang(?:uage)?-)?(?:sql|mysql)$|^brush:(?:sql|mysql)$|^(?:sql|mysql)-exec$|^sqlhigh$/i },
    { lang: 'other', re: /^(?:lang(?:uage)?-)(?:javascript|js|jsx|typescript|ts|csharp|cs|php|ruby|go|golang|rust|kotlin|swift|bash|sh|shell|plsql|tsql|html|css|xml|json|text|plaintext|txt|console|output|r|scala|perl)$|^(?:javascript|typescript|csharp|php|ruby|golang|rust|kotlin|swift|bash|scala|perl)$|^brush:(?:js|javascript|csharp|php|bash|xml)$/i }
  ];

  // On ancestor elements only explicit markers count (a wrapper class "text" or "cpp-tutorial" means nothing)
  var STRICT_TOKEN = /^(?:lang(?:uage)?-|brush:)|-exec$/i;

  /**
   * @param {string} classString e.g. "language-cpp line-numbers" or "brush: cpp; gutter: true"
   * Note: a bare "c" token is NOT treated as C (too ambiguous); "cpp" token wins only when no
   * more specific "*-exec" token exists (Programiz C blocks carry both "c" and "cpp").
   */
  function languageFromClassTokens(classString, strict) {
    if (!classString) return null;
    var s = String(classString);
    var brush = /brush:\s*([a-z+#0-9]+)/i.exec(s);
    var tokens = s.split(/[\s;]+/).filter(Boolean);
    if (brush) tokens.unshift('brush:' + brush[1]);
    if (strict) tokens = tokens.filter(function (t) { return STRICT_TOKEN.test(t); });
    // most specific first: *-exec tokens
    var exec = tokens.filter(function (t) { return /-exec$/i.test(t); });
    var ordered = exec.concat(tokens.filter(function (t) { return !/-exec$/i.test(t); }));
    for (var t = 0; t < ordered.length; t++) {
      for (var h = 0; h < HINTS.length; h++) {
        if (HINTS[h].re.test(ordered[t])) return HINTS[h].lang;
      }
    }
    return null;
  }

  // ---------- text classification ----------

  var RULES = {
    cpp: [
      [/#\s*include\s*<\s*(?:iostream|bits\/stdc\+\+\.h|vector|string|map|set|unordered_map|algorithm|iomanip|sstream|fstream|queue|stack|deque|list|memory|utility|numeric|climits|cmath|array|bitset|functional|thread|chrono)\s*>/, 4],
      [/\busing\s+namespace\s+std\b/, 4],
      [/\bstd::\w+/, 3],
      [/\bcout\s*<</, 4],
      [/\bcin\s*>>/, 3],
      [/\btemplate\s*</, 2],
      [/\bnullptr\b/, 1],
      [/\bendl\b/, 2],
      [/\bint\s+main\s*\(/, 2],
      [/#\s*include\s*[<"]/, 1]
    ],
    c: [
      [/#\s*include\s*<\s*(?:stdio|stdlib|string|math|stdbool|ctype|limits|time)\.h\s*>/, 4],
      [/\bprintf\s*\(/, 3],
      [/\bscanf\s*\(/, 3],
      [/\bint\s+main\s*\(/, 2],
      [/\bmalloc\s*\(|\bfree\s*\(/, 1],
      [/#\s*include\s*[<"]/, 1]
    ],
    java: [
      [/\bpublic\s+static\s+void\s+main\s*\(/, 6],
      [/\bstatic\s+void\s+main\s*\(\s*String/, 4],
      [/\bSystem\.out\.print/, 5],
      [/\bimport\s+java\./, 4],
      [/\b(?:public\s+)?class\s+\w+\s*\{/, 1],
      [/\bString\[\]\s*\w+/, 2],
      [/\bnew\s+Scanner\s*\(/, 3]
    ],
    python: [
      [/^\s*def\s+\w+\s*\(.*\)\s*(?:->\s*[\w\[\], ]+)?:\s*$/m, 4],
      [/\bprint\s*\(/, 3],
      [/^\s*(?:for\s+\w+(?:\s*,\s*\w+)*\s+in\s+.+|while\s+.+|if\s+.+|elif\s+.+|else|try|except.*|with\s+.+)\s*:\s*$/m, 3],
      [/^\s*(?:from\s+[\w.]+\s+)?import\s+[\w., ]+\s*$/m, 2],
      [/\binput\s*\(/, 1],
      [/\bTrue\b|\bFalse\b|\bNone\b/, 1],
      [/\bself\b/, 1],
      [/^\s*#(?!\s*include)/m, 1]
    ]
  };

  RULES.sql = [
    [/\bSELECT\b[\s\S]{0,600}?\bFROM\b/i, 4],
    [/\bCREATE\s+TABLE\b/i, 4],
    [/\bINSERT\s+INTO\b/i, 3],
    [/\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b/i, 2],
    [/\bWHERE\b|\bGROUP\s+BY\b|\bORDER\s+BY\b|\bJOIN\b|\bVALUES\s*\(/i, 1],
    [/;\s*$/m, 1]
  ];

  // Signals that a block is NOT that language (or not code at all)
  var AGAINST = {
    sql: [[/#\s*include|\bpublic\s+static\b|^\s*def\s+\w+\s*\(|\bprint\s*\(|\bcout\s*<<|\bSystem\.out\.|\bprintf\s*\(|\bimport\s+\w+/m, -12]],
    cpp: [[/\bSystem\.out\./, -10], [/\bpublic\s+static\s+void\s+main\b/, -10], [/^\s*def\s+\w+\s*\(.*\)\s*:/m, -8]],
    c: [[/\bcout\s*<<|\bstd::|\busing\s+namespace\b|\bcin\s*>>|\bclass\s+\w+\s*\{/, -10], [/\bSystem\.out\./, -10]],
    java: [[/#\s*include/, -10], [/\bcout\s*<</, -10], [/^\s*def\s+\w+/m, -8]],
    python: [[/;\s*$/m, -3], [/[{}]\s*$/m, -3], [/#\s*include/, -10], [/\bSystem\.out\./, -10], [/\bcout\s*<</, -10], [/^\s*>>>/m, -10], [/\bprintf\s*\(/, -4]]
  };

  var NOT_CODE = [
    /\bconsole\.log\s*\(/, /\bfn\s+main\s*\(\s*\)/, /\bfunc\s+main\s*\(\s*\)/, /\bConsole\.Write/, /^\s*using\s+System\s*;/m,
    /<\?php/, /^\s*package\s+main\s*$/m, /^\s*\$\s+\S/m, /^\s*>>>\s/m, /^\s*mysql>\s/m, /^\s*sqlite>\s/m, /^\s*(?:sudo|npm|pip|g\+\+|gcc|javac|python3?)\s+\S/m
  ];

  var INPUT_RE = {
    cpp: /\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\(|\bgetchar\s*\(|\bcin\s*\.\s*(?:get|read|getline)\s*\(/,
    c: /\bscanf\s*\(|\bgetchar\s*\(|\bfgets\s*\(|\bgets\s*\(/,
    java: /\bnew\s+Scanner\s*\(\s*System\.in|\bBufferedReader\b|\bSystem\.in\.read/,
    python: /\binput\s*\(|\bsys\.stdin\b/,
    sql: /(?!)/
  };

  var OUTPUT_RE = {
    cpp: /\bcout\s*<<|\bprintf\s*\(|\bputs\s*\(|\bputchar\s*\(/,
    c: /\bprintf\s*\(|\bputs\s*\(|\bputchar\s*\(/,
    java: /\bSystem\.out\.print/,
    python: /\bprint\s*\(/,
    sql: /\bSELECT\b/i
  };

  /**
   * A MySQL example can only run if it builds its own data: every table it reads must be created
   * in the same block (tutorial snippets like "SELECT * FROM Customers" use a database we don't have).
   */
  function sqlSelfContained(code) {
    var c = String(code).replace(/--[^\n]*|#[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/'(?:''|[^'])*'/g, "''");
    if (!/\bSELECT\b/i.test(c)) return false;
    var created = {};
    var m, re = /\bCREATE\s+(?:TEMPORARY\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)/gi;
    while ((m = re.exec(c))) created[m[1].toLowerCase()] = true;
    var cte = /\bWITH\s+(?:RECURSIVE\s+)?(\w+)\s+AS\s*\(|,\s*(\w+)\s+AS\s*\(/gi;
    while ((m = cte.exec(c))) created[(m[1] || m[2]).toLowerCase()] = true;
    var ok = true;
    var ref = /\b(?:FROM|JOIN|UPDATE|INTO)\s+[`"]?(\w+)/gi;
    while ((m = ref.exec(c))) {
      var name = m[1].toLowerCase();
      if (name === 'select' || name === 'dual') continue; // FROM (SELECT ...) subqueries, MySQL's DUAL
      if (!created[name]) ok = false;
    }
    return ok;
  }

  function score(code, lang) {
    var s = 0;
    RULES[lang].forEach(function (r) { if (r[0].test(code)) s += r[1]; });
    AGAINST[lang].forEach(function (r) { if (r[0].test(code)) s += r[1]; });
    return s;
  }

  function hasEntryPoint(code, lang) {
    if (lang === 'sql') return sqlSelfContained(code);
    if (lang === 'c' || lang === 'cpp') return /\bmain\s*\(/.test(code);
    if (lang === 'java') return /\bstatic\s+void\s+main\s*\(/.test(code);
    return true; // python scripts run top to bottom
  }

  /**
   * @param {string} text  source code
   * @param {string|null} hint  language from markup/site ('c','cpp','java','python','other') or null
   * @param {{allowWrap?: boolean}} [opts]  allowWrap: site shows partial snippets (W3Schools) — may be wrapped in main()
   * @returns {{language:string|null, isCode:boolean, runnable:boolean, needsWrap:boolean, readsInput:boolean, scores:object, reasons:string[]}}
   */
  function classifyCode(text, hint, opts) {
    opts = opts || {};
    var code = String(text || '');
    var reasons = [];
    var res = { language: null, isCode: false, runnable: false, needsWrap: false, readsInput: false, scores: {}, reasons: reasons };

    if (code.trim().length < 15) { reasons.push('too short'); return res; }
    if (hint === 'other') { reasons.push('markup says unsupported language'); return res; }
    if (NOT_CODE.some(function (re) { return re.test(code); })) { reasons.push('looks like another language or a shell command'); return res; }

    LANGUAGES.forEach(function (l) { res.scores[l] = score(code, l); });

    var lang = null;
    if (hint && LANGUAGES.indexOf(hint) !== -1) {
      lang = hint;
      reasons.push('markup/site says ' + hint);
      // C markup on C++ code (or vice versa) is common: let strong content win between the two
      if ((hint === 'c' || hint === 'cpp') && res.scores.cpp >= 6 && res.scores.c < 0) lang = 'cpp';
      // a clearly different language in a mislabeled block -> skip
      var best = LANGUAGES.slice().sort(function (a, b) { return res.scores[b] - res.scores[a]; })[0];
      if (res.scores[lang] <= 2 && res.scores[best] >= 8 && best !== lang && !((lang === 'c' || lang === 'cpp') && (best === 'c' || best === 'cpp'))) {
        reasons.push('content looks like ' + best + ', not ' + hint);
        lang = best; // e.g. a SQL block on a C++ page, or a mislabelled block
      }
    } else {
      var ranked = LANGUAGES.slice().sort(function (a, b) { return res.scores[b] - res.scores[a]; });
      var top = ranked[0];
      var threshold = top === 'python' || top === 'sql' ? 6 : 5;
      if (res.scores[top] < threshold) { reasons.push('not confident about the language'); return res; }
      if (res.scores[ranked[1]] === res.scores[top] && !(top === 'cpp' || ranked[1] === 'cpp')) { reasons.push('ambiguous language'); return res; }
      lang = top;
    }

    res.language = lang;
    res.isCode = true;
    res.readsInput = INPUT_RE[lang].test(code);
    var producesOutput = OUTPUT_RE[lang].test(code) || res.readsInput;

    if (hasEntryPoint(code, lang)) {
      // python: must actually print or read something to be a meaningful prediction
      res.runnable = lang === 'python' ? producesOutput : true;
    } else if (opts.allowWrap && OUTPUT_RE[lang].test(code) && !/\{\s*\/\/\s*code block/i.test(code)) {
      res.runnable = true;
      res.needsWrap = true;
    }
    if (!res.runnable) reasons.push(lang === 'python' ? 'prints nothing' : lang === 'sql' ? 'uses tables it does not create' : 'no main()');
    return res;
  }

  /** Wrap a statement-only snippet (W3Schools style) into a full program. */
  function wrapSnippet(code, lang) {
    var body = String(code).replace(/\s+$/, '').split('\n').map(function (l) { return '    ' + l; }).join('\n');
    if (lang === 'cpp') {
      var inc = /#\s*include/.test(code) ? '' : '#include <iostream>\n#include <string>\n#include <vector>\nusing namespace std;\n\n';
      return inc + 'int main() {\n' + body + '\n    return 0;\n}\n';
    }
    if (lang === 'c') {
      return '#include <stdio.h>\n#include <string.h>\n#include <stdbool.h>\n\nint main() {\n' + body + '\n    return 0;\n}\n';
    }
    if (lang === 'java') {
      var inner = String(code).replace(/\s+$/, '').split('\n').map(function (l) { return '        ' + l; }).join('\n');
      return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n' + inner + '\n    }\n}\n';
    }
    return code;
  }

  /** Clean extracted code: nbsp -> space, zero-width chars removed, CRLF -> LF, trim outer blank lines. */
  function cleanCode(text) {
    return String(text || '')
      .replace(/ /g, ' ')
      .replace(/[​-‍﻿]/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/^\s*\n/, '')
      .replace(/\s+$/, '') + '\n';
  }

  // ---------- DOM helpers (browser only) ----------

  var STRIP_SELECTOR = [
    '.line-numbers-rows', '.gutter', '.code-gutter', '.lineno', '.line-number', '.line-numbers',
    '.linenodiv', '.hljs-ln-numbers', 'button', '.copy-button', '.copy-code', '.copy', '.copy-code-button',
    '[aria-hidden="true"]', '[data-outputiq-host]'
  ].join(',');

  /**
   * Text of an element whose line breaks are <br> tags and whose source newlines are just
   * whitespace (white-space: normal, e.g. W3Schools div.w3-code).
   */
  function textFromBrLayout(clone) {
    var doc = clone.ownerDocument;
    var walker = doc.createTreeWalker(clone, 4 /* SHOW_TEXT */);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) { n.nodeValue = n.nodeValue.replace(/[ \t\r\n]+/g, ' '); });
    Array.prototype.forEach.call(clone.querySelectorAll('br'), function (br) { br.replaceWith('\u0001'); });
    return clone.textContent.split('\u0001').map(function (l) { return l.replace(/^ +| +$/g, ''); }).join('\n');
  }

  /**
   * Extract source text from a code block element without modifying the page.
   * @param {Element} el
   * @param {string} [extraStrip]  adapter selectors to remove (gutters, embedded output panels)
   * @param {{brLayout?: boolean}} [opts]
   */
  function extractCode(el, extraStrip, opts) {
    // SyntaxHighlighter: <td class="code"><div class="line">...</div>...
    var shLines = el.querySelectorAll('td.code .line, .code .container > .line');
    if (shLines.length) {
      return cleanCode(Array.prototype.map.call(shLines, function (l) { return l.textContent; }).join('\n'));
    }
    var clone = el.cloneNode(true);
    var sel = STRIP_SELECTOR + (extraStrip ? ',' + extraStrip : '');
    Array.prototype.forEach.call(clone.querySelectorAll(sel), function (n) { n.remove(); });
    if (opts && opts.brLayout) return cleanCode(textFromBrLayout(clone));
    Array.prototype.forEach.call(clone.querySelectorAll('br'), function (br) { br.replaceWith('\n'); });
    var lineDivs = clone.querySelectorAll(':scope > div, :scope > code > div');
    if (lineDivs.length > 1 && lineDivs.length === clone.querySelectorAll('div').length) {
      return cleanCode(Array.prototype.map.call(lineDivs, function (d) { return d.textContent; }).join('\n'));
    }
    return cleanCode(clone.textContent);
  }

  /** Look at the element, its <code>/first child and up to 3 ancestors for a language class. */
  function languageHint(el) {
    var nodes = [{ n: el, strict: false }];
    var code = el.querySelector && el.querySelector('code, .code-mirror, textarea');
    if (code) nodes.push({ n: code, strict: false });
    var p = el.parentElement;
    for (var i = 0; i < 3 && p; i++, p = p.parentElement) nodes.push({ n: p, strict: true });
    for (var k = 0; k < nodes.length; k++) {
      var node = nodes[k].n;
      if (!node.getAttribute) continue;
      var data = node.getAttribute('data-lang') || node.getAttribute('data-language');
      if (data) {
        var d = languageFromClassTokens(data);
        if (d) return d;
      }
      var lang = languageFromClassTokens((node.getAttribute('class') || '').trim(), nodes[k].strict);
      if (lang) return lang;
    }
    return null;
  }

  /**
   * Find candidate code blocks. Returns outermost elements only (no nested duplicates).
   * @param {ParentNode} rootNode
   * @param {string} [extraSelector] site adapter may add selectors
   */
  function findCodeBlocks(rootNode, extraSelector) {
    var selector = 'pre, div.syntaxhighlighter' + (extraSelector ? ',' + extraSelector : '');
    var all = Array.prototype.slice.call(rootNode.querySelectorAll(selector));
    return all.filter(function (el) {
      if (el.closest && el.closest('[data-outputiq-host]')) return false;
      for (var p = el.parentElement; p; p = p.parentElement) {
        if (all.indexOf(p) !== -1) return false;
      }
      return true;
    });
  }

  var api = {
    LANGUAGES: LANGUAGES,
    LABELS: LABELS,
    languageFromClassTokens: languageFromClassTokens,
    classifyCode: classifyCode,
    wrapSnippet: wrapSnippet,
    cleanCode: cleanCode,
    extractCode: extractCode,
    languageHint: languageHint,
    findCodeBlocks: findCodeBlocks,
    sqlSelfContained: sqlSelfContained
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.detector = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

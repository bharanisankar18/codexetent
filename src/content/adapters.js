/*
 * OutputIQ — site adapters.
 *
 * Structures below were checked on the live sites (Oct 2026):
 *   Programiz       runnable examples: div.code-editor > .code-editor__area > div.pre-code-wrapper > pre.{cpp|c|java|python}-exec > code.hljs
 *                   (C blocks carry both "c" and "cpp" classes on <code> — the pre's *-exec class decides)
 *                   syntax snippets: div.content > pre > code (no *-exec);  outputs: pre > samp
 *   W3Schools       examples: div.w3-example > div.w3-code (lines separated by <br>, class is "javaHigh"
 *                   even on C/C++ pages, so the language comes from the URL path);
 *                   Java pages also use pre.language-java. Many C/C++/Java examples are statement-only
 *                   snippets (no main) -> wrapped automatically.
 *   TutorialsPoint  runnable: div.code-wrapper > pre.demo-code.language-xxx (contains div.code-mirror and
 *                   an embedded div.output-wrapper that must be stripped); syntax: pre.just-code; output: pre.result
 *   GeeksforGeeks   pre / SyntaxHighlighter tables, multi-language tabs, comments to ignore
 *
 *   Javatpoint, Scaler Topics, Studytonight, Sanfoundry (v0.6): NOT inspected live (the browser could not
 *                   open them). They use the generic <pre> detector plus URL rules for the language;
 *                   Javatpoint's legacy "div.codeblock > textarea" blocks are added explicitly.
 *
 * To support a new site: add an entry here AND the site to content_scripts.matches in manifest.json.
 */
(function (root) {
  'use strict';

  function urlLanguage(pathname, map) {
    for (var i = 0; i < map.length; i++) if (map[i][0].test(pathname)) return map[i][1];
    return null;
  }

  // language from the URL path, e.g. /topics/java/... or /cpp-for-loop
  var PATH_LANG = [
    [/(?:^|\/|-)(?:cpp|c-plus-plus|cplusplus|cpp-programming)(?:\/|-|\.|$)/i, 'cpp'],
    [/(?:^|\/|-)(?:mysql|sql|dbms)(?:\/|-|\.|$)/i, 'sql'],
    [/(?:^|\/|-)python(?:\/|-|\.|\d|$)/i, 'python'],
    [/(?:^|\/|-)java(?!script)(?:\/|-|\.|$)/i, 'java'],
    [/(?:^|\/)(?:c|c-programming|c-program|c-language)(?:\/|-|\.|$)/i, 'c']
  ];
  function pathLanguage(loc) { return urlLanguage(loc.pathname, PATH_LANG); }

  function generic(id, name, hostRe, extra) {
    return Object.assign({
      id: id,
      name: name,
      test: function (loc) { return hostRe.test(loc.hostname); },
      extraSelector: '',
      extraStrip: '.copy, .copy-btn, .copy-button, .line-numbers',
      ignoreSelector: 'header, footer, nav, aside, .sidebar, #sidebar, #comments, .comments, .comment',
      languageFor: function (el, loc) { return pathLanguage(loc); },
      placementTarget: function (el) { return el; }
    }, extra || {});
  }

  var ADAPTERS = [
    {
      id: 'geeksforgeeks',
      name: 'GeeksforGeeks',
      test: function (loc) { return /(^|\.)geeksforgeeks\.org$/i.test(loc.hostname); },
      extraSelector: '',
      extraStrip: '.code-gutter, .line-numbers, .lineNumbers',
      ignoreSelector: '#comments, .comment, .sidebar, .rightBar, .ide, .gfg-ide, footer, nav, header',
      barInset: 130, // GfG shows ×, ▷ and copy buttons at the top right of code boxes
      selectionTools: true, // select page text → [Key point] [Note]
      // Spoiler guard: GfG shows the answer in div.code-output ("Output" + pre), older articles use <p>Output</p><pre>
      spoilers: function (doc) {
        var list = Array.prototype.slice.call(doc.querySelectorAll('div.code-output'));
        Array.prototype.forEach.call(doc.querySelectorAll('pre'), function (pre) {
          var prev = pre.previousElementSibling;
          if (pre.closest('div.code-output, [data-outputiq-host]')) return;
          if (prev && /^(P|STRONG|B|H3|H4|DIV)$/.test(prev.tagName) && /^\s*Output\s*:?\s*$/i.test(prev.textContent)) list.push(pre);
        });
        return list;
      },
      allowWrap: 'strict',        // run self-contained Java / C++ snippets (no main) by wrapping them
      wrapLangs: ['java', 'cpp', 'c'],
      languageFor: function () { return null; },
      placementTarget: function (el) {
        var wrap = el.closest('.code-container, .code-block, .syntaxhighlighter');
        if (wrap && wrap !== el && wrap.querySelectorAll('pre, div.syntaxhighlighter').length <= 1) return wrap;
        return el;
      }
    },
    {
      id: 'programiz',
      name: 'Programiz',
      test: function (loc) { return /(^|\.)programiz\.com$/i.test(loc.hostname); },
      extraSelector: '',
      extraStrip: '.copy-code-button',
      // the online compiler pages and sidebars are not tutorial examples
      ignoreSelector: 'header, footer, nav, .sidebar',
      // only blocks marked runnable by Programiz itself
      accept: function (el) { return /(?:^|\s)(?:cpp|c|java|python)-exec(?:\s|$)/.test(el.className || ''); },
      languageFor: function (el) {
        var m = /(?:^|\s)(cpp|c|java|python)-exec(?:\s|$)/.exec(el.className || '');
        return m ? m[1] : null;
      },
      placementTarget: function (el) { return el.closest('div.code-editor') || el; }
    },
    {
      id: 'w3schools',
      name: 'W3Schools',
      test: function (loc) { return /(^|\.)w3schools\.com$/i.test(loc.hostname); },
      extraSelector: 'div.w3-code',
      extraStrip: '',
      brLayout: function (el) { return el.tagName !== 'PRE'; },
      allowWrap: true,
      selectionTools: true,
      // Spoiler guard: W3Schools writes the answer as a comment in the code: // Outputs "Thursday" (day 4)
      spoilers: function (doc) {
        return Array.prototype.filter.call(doc.querySelectorAll('.w3-example .token.comment, .w3-code .commentcolor, .w3-example .commentcolor'), function (c) {
          return /^\s*(?:\/\/|\/\*|#|--)\s*(?:Outputs?|Prints?|Displays?|Returns?|Result)\b/i.test(c.textContent);
        });
      },
      ignoreSelector: 'header, footer, nav, #sidenav, .sidesection, #topnav, .w3-sidebar, #exercisecontainer, .exercisewindow',
      languageFor: function (el, loc) {
        return urlLanguage(loc.pathname, [[/^\/cpp\//i, 'cpp'], [/^\/c\//i, 'c'], [/^\/java\//i, 'java'], [/^\/python\//i, 'python'], [/^\/(?:sql|mysql)\//i, 'sql']]);
      },
      placementTarget: function (el) {
        var ex = el.closest('.w3-example');
        return ex && ex.querySelectorAll('div.w3-code, pre').length <= 1 ? ex : el;
      }
    },
    {
      id: 'tutorialspoint',
      name: 'TutorialsPoint',
      test: function (loc) { return /(^|\.)tutorialspoint\.com$/i.test(loc.hostname); },
      extraSelector: '',
      extraStrip: '.output-wrapper, .code-output, .console-close',
      ignoreSelector: 'header, footer, nav, .sidebar, .left-menu, .right-sidebar, .tp-left-sidebar',
      accept: function (el) { return /(?:^|\s)demo-code(?:\s|$)/.test(el.className || ''); },
      languageFor: function () { return null; }, // language-xxx class on the pre is picked up by languageHint
      placementTarget: function (el) { return el.closest('div.code-wrapper') || el; }
    }
  ];

  ADAPTERS.push(
    generic('javatpoint', 'Javatpoint', /(^|\.)javatpoint\.com$/i, {
      // legacy SyntaxHighlighter blocks: <div class="codeblock"><textarea name="code" class="cpp">…</textarea></div>
      // (output is shown in div.codeblock3, which is not selected)
      extraSelector: 'div.codeblock'
    }),
    generic('scaler', 'Scaler Topics', /(^|\.)scaler\.com$/i),
    generic('studytonight', 'Studytonight', /(^|\.)studytonight\.com$/i),
    generic('sanfoundry', 'Sanfoundry', /(^|\.)sanfoundry\.com$/i)
  );

  var GENERIC = {
    id: 'generic',
    name: 'Website',
    test: function () { return true; },
    extraSelector: '',
    extraStrip: '',
    ignoreSelector: 'footer, nav, header, [contenteditable="true"], textarea',
    languageFor: function () { return null; },
    placementTarget: function (el) { return el; }
  };

  function adapterFor(loc) {
    for (var i = 0; i < ADAPTERS.length; i++) if (ADAPTERS[i].test(loc)) return ADAPTERS[i];
    return GENERIC;
  }

  var api = { adapterFor: adapterFor, ADAPTERS: ADAPTERS, GENERIC: GENERIC, pathLanguage: pathLanguage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.adapters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

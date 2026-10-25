/*
 * Codextent on LeetCode — "Solve later" marks with your idea note, synced between your PCs (chrome.storage.sync),
 * and a small board of everything you saved. Only problems tagged Array (OutputIQ.leetcode.ONLY_TAGS).
 *
 * Where it shows: two small icons in the Code panel's own icon bar, just left of LeetCode's  [bookmark] [{ }] [undo] [expand]:
 *   [bookmark + count]  → the Solve-later board: save this problem with a note, update / mark solved / remove,
 *                         To solve | Solved lists (open a problem, tick it off), Open in My Learning Hub
 *   [Codextent logo]    → the Templates + Notes panel (src/content/templates-ui.js, via the 'codextent:open-panel' event)
 * No icon bar found → the two icons float at the bottom right. Other LeetCode pages (problem list, home): a floating
 * "Solve later · N" button that opens the board. Problems without the Array tag: nothing is shown.
 * Tags come from LeetCode's own GraphQL (same site, the problem's public data), or the /tag/ links on the page.
 * LeetCode changes pages without reloading, so the URL is watched.
 */
(function () {
  'use strict';
  var OQ = globalThis.OutputIQ;
  if (!OQ || !OQ.leetcode || window.__codextentLeetcode) return;
  window.__codextentLeetcode = true;
  var L = OQ.leetcode;

  var state = { slug: null, info: null, mark: null, host: null, nav: null, loading: false, marks: [], tab: 'todo' };

  var ICON = {
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z"/></svg>',
    logo: '<svg viewBox="40 52 432 432" aria-hidden="true"><path d="M156 112 L66 268 L156 424" fill="none" stroke="currentColor" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/><path d="M356 112 L446 268 L356 424" fill="none" stroke="currentColor" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/><path d="M288 92 L186 292 L250 292 L222 444 L330 236 L266 236 Z" fill="#4c8dff"/></svg>'
  };
  var BASE = `
:host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --chip: rgba(255,255,255,.1); --chip-h: rgba(255,255,255,.16); --ink: #eff1f6; --muted: rgba(239,241,246,.6); --card: #282828; --line: rgba(255,255,255,.12);
  --field: #1f1f1f; --orange: #ffa116; --orange-soft: rgba(255,161,22,.14); --green: #2cbb5d; --blue: #4c8dff; --shadow: 0 14px 40px rgba(0,0,0,.55); }
:host([data-lc-theme="light"]) { --chip: rgba(0,0,0,.05); --chip-h: rgba(0,0,0,.09); --ink: #262626; --muted: rgba(38,38,38,.6); --card: #ffffff; --line: rgba(0,0,0,.1);
  --field: #f7f8fa; --orange-soft: rgba(255,161,22,.16); --shadow: 0 14px 40px rgba(0,0,0,.15); }
* { box-sizing: border-box; }
.d-easy { color: #00b8a3; } .d-medium { color: #ffc01e; } .d-hard { color: #ff375f; }
textarea { width: 100%; min-height: 84px; max-height: 220px; resize: vertical; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--field);
  color: var(--ink); font-family: inherit; font-size: 13px; line-height: 1.5; }
textarea:focus { outline: none; border-color: var(--orange); box-shadow: 0 0 0 3px var(--orange-soft); }
button.save { height: 30px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--orange); color: #1a1a1a; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
button.save:hover { filter: brightness(1.06); }
button.save[disabled] { opacity: .45; cursor: default; filter: none; }
button.ghost { height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--ink); font-family: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; }
button.ghost:hover { background: var(--chip); }
button.ghost.done { color: var(--green); border-color: rgba(44,187,93,.4); }
.status { font-size: 12px; color: var(--muted); }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--chip); color: var(--muted); }
`;
  var NAV_CSS = BASE + `
:host { display: inline-flex; align-items: center; gap: 6px; margin: 0 6px; vertical-align: middle; }
:host([data-lc-pos="tool"]) { margin: 0 4px 0 0; gap: 2px; }
:host([data-lc-pos="tool"]) .ib { width: 28px; height: 28px; background: transparent; color: var(--muted); }
:host([data-lc-pos="tool"]) .ib:hover, :host([data-lc-pos="tool"]) .ib[aria-expanded="true"] { background: var(--chip); color: var(--ink); box-shadow: none; }
:host([data-lc-pos="tool"]) .ib.bm.on { color: var(--orange); }
:host([data-lc-pos="tool"]) .ib svg { width: 16px; height: 16px; }
:host([data-lc-pos="tool"]) .count { top: -4px; right: -5px; }
:host([data-lc-float]) { position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; padding: 6px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); }
.ib { position: relative; width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 8px; background: var(--chip); color: var(--ink); cursor: pointer; padding: 0;
  transition: background .15s, box-shadow .15s; }
.ib:hover, .ib[aria-expanded="true"] { background: var(--chip-h); box-shadow: 0 0 0 2px rgba(76,141,255,.45); }
.ib svg { width: 17px; height: 17px; }
.ib.bm svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; }
.ib.bm.on { color: var(--orange); } .ib.bm.on svg { fill: currentColor; }
.pill { height: 34px; padding: 0 14px 0 11px; width: auto; display: inline-flex; gap: 7px; font: 600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.count { position: absolute; top: -5px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: var(--orange); color: #1a1a1a;
  font: 700 10.5px/17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; text-align: center; }
.count:empty { display: none; }
.pill .count { position: static; }
.board { display: none; position: fixed; z-index: 2147483600; width: min(400px, calc(100vw - 24px)); max-height: min(560px, calc(100vh - 80px)); flex-direction: column; overflow: hidden;
  border-radius: 14px; background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); color: var(--ink); font-size: 13px; }
.board.show { display: flex; }
.bh { display: flex; align-items: center; gap: 8px; padding: 12px 12px 10px; border-bottom: 1px solid var(--line); }
.bh b { font-size: 14px; font-weight: 650; }
.bh .x { margin-left: auto; width: 26px; height: 26px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); font-size: 17px; cursor: pointer; }
.bh .x:hover { background: var(--chip); color: var(--ink); }
.cur { padding: 12px; border-bottom: 1px solid var(--line); display: grid; gap: 8px; }
.cur .t { font-weight: 600; }
.cur .hint { font-size: 12px; color: var(--muted); }
.tabs { display: flex; gap: 4px; padding: 10px 12px 0; }
.tb { height: 26px; padding: 0 11px; border: 0; border-radius: 999px; background: transparent; color: var(--muted); font: inherit; font-weight: 600; font-size: 12px; cursor: pointer; }
.tb[aria-selected="true"] { background: var(--chip-h); color: var(--ink); }
.list { overflow: auto; padding: 6px 6px 10px; display: flex; flex-direction: column; gap: 2px; }
.it { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; align-items: center; padding: 8px 8px; border-radius: 9px; text-decoration: none; color: var(--ink); }
.it:hover { background: var(--chip); }
.it.here { box-shadow: inset 2px 0 0 var(--orange); background: var(--orange-soft); }
.it .nm { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.it .nm i { font-style: normal; color: var(--muted); font-weight: 500; margin-right: 4px; }
.it .nt { grid-column: 1; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.it .df { grid-row: 1; grid-column: 2; font-size: 11.5px; font-weight: 600; }
.it .tick { grid-row: 2; grid-column: 2; height: 22px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--line); background: transparent; color: var(--muted); font: inherit; font-size: 11px; cursor: pointer; }
.it .tick:hover { color: var(--green); border-color: rgba(44,187,93,.5); }
.empty { padding: 18px 12px; color: var(--muted); line-height: 1.5; }
.foot { padding: 9px 12px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--muted); display: flex; gap: 8px; align-items: center; }
.foot button { margin-left: auto; border: 0; background: none; color: var(--blue); font: inherit; font-size: 12px; cursor: pointer; padding: 0; }
.foot button:hover { text-decoration: underline; }
`;

  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function theme() { return document.documentElement.classList.contains('dark') || /dark/.test(document.documentElement.getAttribute('data-theme') || '') ? 'dark' : 'light'; }
  function isProblem() { return !!L.slugFromPath(location.pathname); }
  function todoCount() { return state.marks.filter(function (m) { return m.st === 'todo'; }).length; }

  // ---------- problem info ----------
  async function fetchInfo(slug) {
    var info = { slug: slug, id: '', title: '', difficulty: '', tags: [] };
    try {
      var csrf = (/(?:^|;\s*)csrftoken=([^;]+)/.exec(document.cookie) || [])[1];
      var res = await fetch('/graphql/', {
        method: 'POST', credentials: 'same-origin',
        headers: Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'x-csrftoken': csrf } : {}),
        body: JSON.stringify({ query: 'query q($titleSlug: String!) { question(titleSlug: $titleSlug) { questionFrontendId title difficulty topicTags { name slug } } }', variables: { titleSlug: slug } })
      });
      var q = res.ok && (await res.json()).data.question;
      if (q) { info.id = q.questionFrontendId; info.title = q.title; info.difficulty = q.difficulty; info.tags = (q.topicTags || []).map(function (t) { return t.name; }); }
    } catch (e) { /* fall back to the page */ }
    if (!info.tags.length) info.tags = Array.prototype.map.call(document.querySelectorAll('a[href^="/tag/"]'), function (a) { return a.textContent.trim(); }).filter(Boolean);
    if (!info.title) {
      var ta = document.querySelector('.text-title-large a, a[href^="/problems/' + slug + '"]');
      var m = ta && /^\s*(\d+)\.\s*(.+)$/.exec(ta.textContent);
      if (m) { info.id = m[1]; info.title = m[2].trim(); } else if (ta) info.title = ta.textContent.trim();
    }
    if (!info.difficulty) { var d = chipRowDifficulty(); if (d) info.difficulty = d.textContent.trim(); }
    return info;
  }
  function chipRowDifficulty() {
    return Array.prototype.filter.call(document.querySelectorAll('div, span'), function (e) {
      return e.children.length === 0 && /^(Easy|Medium|Hard)$/.test(e.textContent.trim()) && /difficulty/.test(String(e.className));
    })[0] || null;
  }

  // ---------- save / note actions (shared by the chip card and the board) ----------
  async function saveNow(note) {
    state.mark = await L.saveMark(Object.assign({}, state.info, { note: note != null ? note : (state.mark && state.mark.n) || '' }));
    await refreshMarks();
    return state.mark;
  }
  async function refreshMarks() {
    try { state.marks = await L.allMarks(); } catch (e) { state.marks = []; }
    renderNavCount();
    if (state.nav && state.nav.__ui.board.classList.contains('show')) renderBoard();
  }

  // ---------- 2. top-bar icons + the board ----------
  function buildNav() {
    var host = document.createElement('span');
    host.setAttribute('data-codextent-lcnav', '');
    var sh = host.attachShadow({ mode: 'open' });
    var st = document.createElement('style'); st.textContent = NAV_CSS; sh.appendChild(st);
    var bm = h('button', 'ib bm'); bm.type = 'button'; bm.innerHTML = ICON.bookmark; // static, trusted markup
    bm.setAttribute('aria-label', 'Solve later board'); bm.title = 'Solve later: your saved problems'; bm.setAttribute('aria-expanded', 'false');
    var count = h('span', 'count'); bm.appendChild(count);
    var lg = h('button', 'ib lg'); lg.type = 'button'; lg.innerHTML = ICON.logo;
    lg.setAttribute('aria-label', 'Codextent templates and notes'); lg.title = 'Codextent: templates and notes (Alt+Shift+T)';
    sh.appendChild(bm); sh.appendChild(lg);
    var board = h('div', 'board'); board.setAttribute('role', 'dialog'); board.setAttribute('aria-label', 'Solve later board');
    sh.appendChild(board);
    host.__ui = { bm: bm, lg: lg, count: count, board: board, sh: sh };
    bm.addEventListener('click', function (e) { e.stopPropagation(); toggleBoard(); });
    lg.addEventListener('click', function (e) {
      e.stopPropagation(); closeBoard();
      var r = lg.getBoundingClientRect();
      window.dispatchEvent(new CustomEvent('codextent:open-panel', { detail: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }));
    });
    board.addEventListener('click', function (e) { e.stopPropagation(); });
    board.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    ['keydown', 'keyup', 'keypress'].forEach(function (ev) { board.addEventListener(ev, function (e) { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') closeBoard(); }); });
    return host;
  }
  function setNavMode(mode) {
    var ui = state.nav.__ui;
    ui.lg.style.display = mode === 'page' ? 'none' : '';
    if (mode === 'page') { ui.bm.className = 'ib bm pill'; ui.bm.textContent = ''; ui.bm.insertAdjacentHTML('afterbegin', ICON.bookmark); ui.bm.appendChild(document.createTextNode('Solve later')); ui.bm.appendChild(ui.count); }
    else if (ui.bm.classList.contains('pill')) { ui.bm.className = 'ib bm'; ui.bm.textContent = ''; ui.bm.insertAdjacentHTML('afterbegin', ICON.bookmark); ui.bm.appendChild(ui.count); }
  }
  function renderNavCount() {
    if (!state.nav) return;
    var n = todoCount(), ui = state.nav.__ui;
    ui.count.textContent = n ? String(n) : '';
    ui.bm.classList.toggle('on', !!(state.mark && state.mark.st === 'todo'));
  }
  /** Top bar: the group that holds Run / Submit / Ask Leet. Our icons go at its end (after Ask Leet, before the layout button). */
  function topBarGroup() {
    var submit = document.querySelector('[data-e2e-locator="console-submit-button"]') ||
      Array.prototype.filter.call(document.querySelectorAll('button'), function (b) { return /^Submit$/.test(b.textContent.trim()) && b.getBoundingClientRect().top < 120; })[0];
    if (!submit) return null;
    // real page: the widest box around Submit that is still a small group near the top (Run · Submit · Note · Ask Leet)
    var best = null;
    for (var a = submit.parentElement; a && a !== document.body; a = a.parentElement) {
      var ar = a.getBoundingClientRect();
      if (!ar.width) break;                                   // not laid out (tests): use the structural rule below
      if (ar.width < window.innerWidth * 0.6 && ar.top < 100) best = a; else break;
    }
    if (best && best !== submit.parentElement) return best;
    for (var el = submit; el && el.parentElement && el !== document.body; el = el.parentElement) {
      var p = el.parentElement, kids = Array.prototype.filter.call(p.children, function (c) { return c.getAttribute && !c.hasAttribute('data-codextent-lcnav'); });
      var r = p.getBoundingClientRect();
      if (kids.length >= 3 && kids.filter(function (c) { return c.querySelector && (c.matches('button') || c.querySelector('button')); }).length >= 3 && r.width < window.innerWidth * 0.7) return p;
    }
    return null;
  }
  /**
   * Where the two icons go: the Code panel's own icon bar (LeetCode's  [bookmark] [{ }] [undo] [expand]  on the right of
   * "C++ / Python · Auto"), just before LeetCode's first icon. Found from the language button: the smallest box around it
   * that also holds 3+ icon-only buttons after it. Returns { group, before } or null.
   */
  var LANGS = /^(C\+\+|C|Java|Python3?|Python|JavaScript|TypeScript|C#|Go|Rust|Kotlin|Swift|Ruby|Scala|PHP|Dart|Racket|Erlang|Elixir|MySQL|MS SQL Server|Oracle|PostgreSQL|Pandas|Bash)$/;
  function editorToolbarSpot() {
    var lang = Array.prototype.filter.call(document.querySelectorAll('#editor button, [id="editor"] button, button'), function (b) {
      return LANGS.test(b.textContent.trim()) && !(state.nav && state.nav.contains(b));
    })[0];
    if (!lang) return null;
    for (var box = lang.parentElement, up = 0; box && box !== document.body && up < 8; box = box.parentElement, up++) {
      var icons = Array.prototype.filter.call(box.querySelectorAll('button'), function (b) {
        return !b.textContent.trim() && (lang.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && !b.closest('[data-codextent-lcnav]');
      });
      if (icons.length >= 3) {
        var first = icons[0], before = first;
        while (before.parentElement && before.parentElement !== box && !before.parentElement.contains(lang) && before.parentElement.querySelectorAll('button').length === 1) before = before.parentElement;
        return { group: before.parentElement, before: before };
      }
    }
    return null;
  }
  function placeNav() {
    if (!state.nav) state.nav = buildNav();
    var nav = state.nav;
    nav.setAttribute('data-lc-theme', theme());
    nav.style.left = nav.style.top = '';
    if (isProblem() && state.info && state.info.allowed) {
      setNavMode('bar');
      var spot = editorToolbarSpot();
      if (spot) {
        nav.removeAttribute('data-lc-float'); nav.setAttribute('data-lc-pos', 'tool');
        if (nav.nextElementSibling !== spot.before) spot.group.insertBefore(nav, spot.before);
      } else {
        nav.removeAttribute('data-lc-pos');
        if (nav.getAttribute('data-lc-float') !== 'bar' || nav.parentElement !== document.body) { nav.setAttribute('data-lc-float', 'bar'); document.body.appendChild(nav); }
      }
    } else if (isProblem()) {
      nav.remove();                                   // not an Array problem: nothing on this page
      return;
    } else {
      setNavMode('page');
      nav.removeAttribute('data-lc-pos');
      if (nav.getAttribute('data-lc-float') !== 'page' || nav.parentElement !== document.body) { nav.setAttribute('data-lc-float', 'page'); document.body.appendChild(nav); }
    }
    renderNavCount();
  }
  window.addEventListener('resize', function () { if (state.nav) placeNav(); });

  function renderBoard() {
    var ui = state.nav.__ui, b = ui.board;
    b.textContent = '';
    var bh = h('div', 'bh');
    var lg = h('span'); lg.innerHTML = ICON.logo; lg.style.cssText = 'width:17px;height:17px;display:inline-grid'; lg.firstChild.style.cssText = 'width:17px;height:17px';
    bh.appendChild(lg);
    bh.appendChild(h('b', null, 'Solve later · ' + todoCount()));
    var x = h('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', closeBoard);
    bh.appendChild(x);
    b.appendChild(bh);

    if (state.slug && state.info) {
      var cur = h('div', 'cur'), info = state.info, mark = state.mark;
      cur.appendChild(h('div', 't', (info.id ? info.id + '. ' : '') + (info.title || info.slug)));
      var row = h('div', 'row'); row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
      if (!info.allowed) {
        cur.appendChild(h('div', 'hint', 'Saving is on for Array problems for now.'));
      } else {
        var ta = h('textarea'); ta.placeholder = 'Your idea for later… e.g. "sort + two pointers", "prefix sum, watch negatives"';
        ta.maxLength = L.MAX_NOTE; ta.value = mark && mark.st === 'todo' ? mark.n || '' : ''; ta.setAttribute('aria-label', 'Your idea note'); ta.style.minHeight = '64px';
        cur.appendChild(ta);
        var sv = h('button', 'save', mark && mark.st === 'todo' ? 'Update note' : 'Save for later'); sv.type = 'button';
        var stt = h('span', 'status', mark && mark.st === 'todo' ? 'Saved' : mark && mark.st === 'done' ? 'Solved before' : '');
        sv.addEventListener('click', async function () {
          sv.disabled = true; stt.textContent = 'Saving…';
          try { await saveNow(ta.value); stt.textContent = 'Saved ✓'; renderBoard(); }
          catch (e) { sv.disabled = false; stt.textContent = /QUOTA/i.test(String(e)) ? 'Sync storage is full. Mark some problems solved.' : 'Could not save'; }
        });
        ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sv.click(); } });
        row.appendChild(sv);
        if (mark && mark.st === 'todo') {
          var done = h('button', 'ghost done', 'Mark solved'); done.type = 'button';
          done.addEventListener('click', async function () { state.mark = await L.markDone(state.slug); refreshMarks(); });
          row.appendChild(done);
          var rm = h('button', 'ghost', 'Remove'); rm.type = 'button';
          rm.addEventListener('click', async function () {
            if (!rm.dataset.armed) { rm.dataset.armed = '1'; rm.textContent = 'Sure?'; return; }
            await L.removeMark(state.slug); state.mark = null; refreshMarks();
          });
          row.appendChild(rm);
        }
        row.appendChild(stt);
        cur.appendChild(row);
      }
      b.appendChild(cur);
    }

    var tabs = h('div', 'tabs');
    [['todo', 'To solve'], ['done', 'Solved']].forEach(function (t) {
      var n = state.marks.filter(function (m) { return m.st === t[0]; }).length;
      var tb = h('button', 'tb', t[1] + ' ' + n); tb.type = 'button'; tb.setAttribute('aria-selected', String(state.tab === t[0])); tb.setAttribute('data-tab', t[0]);
      tb.addEventListener('click', function () { state.tab = t[0]; renderBoard(); });
      tabs.appendChild(tb);
    });
    b.appendChild(tabs);

    var list = h('div', 'list'), items = state.marks.filter(function (m) { return m.st === state.tab; });
    if (!items.length) list.appendChild(h('div', 'empty', state.tab === 'todo' ? 'Nothing saved yet. Open an Array problem, click the bookmark in the code bar and press Save for later.' : 'No solved problems yet.'));
    items.forEach(function (m) {
      var a = h('a', 'it' + (m.s === state.slug ? ' here' : '')); a.href = '/problems/' + m.s + '/'; a.setAttribute('data-slug', m.s);
      var nm = h('span', 'nm'); if (m.id) nm.appendChild(h('i', null, m.id + '.')); nm.appendChild(document.createTextNode(m.t || m.s));
      a.appendChild(nm);
      if (m.d) a.appendChild(h('span', 'df d-' + m.d, m.d[0].toUpperCase() + m.d.slice(1)));
      a.appendChild(h('span', 'nt', m.n || (m.g || []).slice(0, 3).join(' · ')));
      if (m.st === 'todo') {
        var tick = h('button', 'tick', 'Solved'); tick.type = 'button'; tick.title = 'Mark solved';
        tick.addEventListener('click', async function (e) { e.preventDefault(); e.stopPropagation(); await L.markDone(m.s); if (m.s === state.slug) { state.mark = await L.getMark(m.s); } refreshMarks(); });
        a.appendChild(tick);
      }
      list.appendChild(a);
    });
    b.appendChild(list);
    var foot = h('div', 'foot');
    foot.appendChild(h('span', null, 'Synced with your Google account'));
    var open = h('button', null, 'Open in My Learning Hub'); open.type = 'button';
    open.addEventListener('click', function () { try { chrome.runtime.sendMessage({ type: 'OPEN_VAULT', id: 'lc' }); } catch (e) { /* ignore */ } });
    foot.appendChild(open);
    b.appendChild(foot);
  }
  function positionBoard() {
    var ui = state.nav.__ui, r = ui.bm.getBoundingClientRect(), w = Math.min(400, window.innerWidth - 24);
    var left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    var below = r.bottom + 8 + 300 < window.innerHeight;
    ui.board.style.left = left + 'px';
    if (below) { ui.board.style.top = (r.bottom + 8) + 'px'; ui.board.style.bottom = 'auto'; }
    else { ui.board.style.top = 'auto'; ui.board.style.bottom = (window.innerHeight - r.top + 8) + 'px'; }
  }
  async function toggleBoard() {
    var ui = state.nav.__ui;
    if (ui.board.classList.contains('show')) { closeBoard(); return; }
    await refreshMarks();
    renderBoard(); positionBoard();
    ui.board.classList.add('show'); ui.bm.setAttribute('aria-expanded', 'true');
  }
  function closeBoard() { if (!state.nav) return; state.nav.__ui.board.classList.remove('show'); state.nav.__ui.bm.setAttribute('aria-expanded', 'false'); }
  document.addEventListener('click', function () { closeBoard(); });

  // ---------- page lifecycle ----------
  async function onPage() {
    placeNav();
    var slug = L.slugFromPath(location.pathname);
    if (slug === state.slug && (state.info || state.loading)) return;
    state.slug = slug; state.info = null; state.mark = null;
    closeBoard();
    if (!slug || state.loading) return;
    state.loading = true;
    try {
      var info = await fetchInfo(slug);
      if (slug !== state.slug) return;
      info.allowed = L.allowed(info.tags);
      state.info = info;
      state.mark = await L.getMark(slug);
      placeNav();
    } finally { state.loading = false; }
  }

  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      var mine = Object.keys(ch).some(function (k) { return k.indexOf(L.PREFIX) === 0; }) || (area === 'local' && ch[L.DONE_KEY]);
      if (!mine) return;
      if (state.slug) L.getMark(state.slug).then(function (m) { state.mark = m; renderNavCount(); });
      refreshMarks();
    });
  } catch (e) { /* tests */ }

  // LeetCode is a single-page app: check the URL and keep everything attached when React re-renders
  refreshMarks();
  onPage();
  setInterval(onPage, 900);
})();

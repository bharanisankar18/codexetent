/*
 * Codextent — coding-platform helper (CodeChef + LeetCode, C++ first).
 *
 *   One round Codextent button next to the editor (Alt+Shift+T opens it anywhere on the page).
 *   Click it → a small panel with two tabs:
 *     Templates — quick inserts (CodeChef: test-case loop, fast I/O, read array · LeetCode: ll + MOD, debug print)
 *                 + a searchable list (⭐ favorites first). Click a row to preview it, Insert puts it in the editor.
 *                 CodeChef: an empty editor gets the whole program (main + while (t--)); otherwise code goes in at the cursor.
 *                 LeetCode: code goes in at the cursor, inside class Solution (no main()).
 *     Notes     — write a note for this problem; it is saved to My Revision Vault (revise it in My Learning Hub).
 * The editors are reached through small page-world adapters (src/content/editors/*-editor.js) over postMessage.
 * If the editor can't be reached, the code is copied and a toast says "press Ctrl+V".
 */
(function () {
  'use strict';
  var OQ = globalThis.OutputIQ;
  if (!OQ || !OQ.templates || window.__cxTemplatesUi) return;
  window.__cxTemplatesUi = true;
  var TP = OQ.templates;

  var PLATFORM = /(^|\.)codechef\.com$/i.test(location.hostname) ? 'codechef' : /(^|\.)leetcode\.com$/i.test(location.hostname) ? 'leetcode' : null;
  if (!PLATFORM) return;
  var NAME = TP.PLATFORMS[PLATFORM];
  var LANG_LABEL = { cpp: 'C++', c: 'C', java: 'Java', python: 'Python', javascript: 'JavaScript' };

  /** Quick inserts: one click, no searching. full = replaces an empty editor with a whole program. */
  var QUICK = {
    codechef: [
      { id: 'loop', label: 'Test-case loop', hint: 'full main(), t cases', full: true },
      { id: 'fastio', label: 'Fast I/O', hint: 'two lines for main()', code: 'ios::sync_with_stdio(false);\ncin.tie(nullptr);\n' },
      { id: 'readarr', label: 'Read array', hint: 'n, then n numbers', code: 'int n;\ncin >> n;\nvector<long long> a(n);\nfor (auto &x : a) cin >> x;\n' }
    ],
    leetcode: [
      { id: 'llmod', label: 'll + MOD', hint: 'long long and 1e9+7', code: 'using ll = long long;\nstatic constexpr ll MOD = 1000000007LL;\n' },
      { id: 'debug', label: 'Debug print', hint: 'dbg(x) to stderr', code: '#define dbg(x) cerr << #x << " = " << (x) << endl\n' }
    ]
  };

  // ---------- talk to the page-world editor adapter ----------
  var seq = 0, waiting = {};
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.__cx !== 'editor-res' || !waiting[e.data.id]) return;
    waiting[e.data.id](e.data); delete waiting[e.data.id];
  });
  function ask(op, code) {
    return new Promise(function (resolve) {
      var id = 'cx' + (++seq) + Date.now().toString(36);
      waiting[id] = resolve;
      window.postMessage({ __cx: 'editor-req', id: id, op: op, code: code }, '*');
      setTimeout(function () { if (waiting[id]) { delete waiting[id]; resolve({ ok: false, error: 'The editor did not answer.' }); } }, 1500);
    });
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      try { var ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e2) { return false; }
    }
  }
  function isEmptyEditor(text) { return !String(text || '').replace(/\/\/\s*write (your )?code here\.*/i, '').trim(); }

  // ---------- this problem ----------
  function problemKey() {
    if (PLATFORM === 'leetcode') { var m = /^\/problems\/([^/]+)/.exec(location.pathname); return m ? '/problems/' + m[1] : location.pathname; }
    return location.pathname.replace(/\/+$/, '');
  }
  function problemTitle() {
    return document.title.replace(/\s*[-|–]\s*(LeetCode|CodeChef).*$/i, '').replace(/\s*Practice Coding Problem.*$/i, '').trim() || problemKey();
  }

  // ---------- UI ----------
  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var LOGO = '<svg viewBox="40 52 432 432" aria-hidden="true"><path d="M156 112 L66 268 L156 424" fill="none" stroke="currentColor" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><path d="M356 112 L446 268 L356 424" fill="none" stroke="currentColor" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><path d="M288 92 L186 292 L250 292 L222 444 L330 236 L266 236 Z" fill="var(--blue)"/></svg>';
  var CSS = `
:host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color-scheme: dark;
  --bg: #0f0f11; --card: #17171a; --row: #1f1f23; --ink: #f5f5f7; --muted: #9a9aa2; --line: rgba(255,255,255,.09); --line2: rgba(255,255,255,.16);
  --blue: #4c8dff; --blue-soft: rgba(76,141,255,.16); --green: #34d399; --amber: #fbbf24; --red: #f87171; --code: #0a0a0b; }
* { box-sizing: border-box; }
.fab { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--line2); background: #0b0b0d; color: #f5f5f7; display: grid; place-items: center;
  cursor: pointer; padding: 0; box-shadow: 0 4px 14px rgba(0,0,0,.35); transition: box-shadow .18s, border-color .18s, transform .18s; }
.fab:hover, .fab[aria-expanded="true"] { border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-soft), 0 0 18px rgba(76,141,255,.45); }
.fab:active { transform: scale(.94); }
.fab svg { width: 19px; height: 19px; }
.panel { position: fixed; z-index: 2147483600; width: min(440px, calc(100vw - 24px)); max-height: min(600px, calc(100vh - 32px)); display: none; flex-direction: column;
  background: var(--bg); color: var(--ink); border: 1px solid var(--line2); border-radius: 16px; box-shadow: 0 24px 60px rgba(0,0,0,.55); overflow: hidden; font-size: 13px; }
.panel.show { display: flex; }
.head { display: flex; align-items: center; gap: 10px; padding: 12px 12px 10px; border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; letter-spacing: -.01em; }
.brand svg { width: 18px; height: 18px; color: #f5f5f7; }
.tabs { margin-left: auto; display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: var(--card); border: 1px solid var(--line); }
.tab { height: 26px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); font: inherit; font-weight: 600; cursor: pointer; }
.tab[aria-selected="true"] { background: var(--ink); color: #0b0b0d; }
.x { width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font-size: 18px; cursor: pointer; }
.x:hover { background: var(--row); color: var(--ink); }
.body { padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 0; overflow: auto; }
.lbl { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.quick { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; }
.qb { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 9px 11px; border-radius: 11px; border: 1px solid var(--line2); background: var(--card);
  color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
.qb b { font-size: 13px; font-weight: 650; }
.qb span { font-size: 11.5px; color: var(--muted); }
.qb:hover, .qb:focus-visible { border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-soft); outline: none; }
.qb.confirm { border-color: var(--red); box-shadow: 0 0 0 3px rgba(248,113,113,.18); }
.qb.confirm b { color: var(--red); }
.q { width: 100%; height: 34px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line2); background: var(--code); color: var(--ink); font: inherit; font-size: 13px; }
.q:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-soft); }
.list { display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow: auto; margin: 0 -4px; padding: 0 4px; }
.row { border-radius: 10px; }
.row[aria-selected="true"] { background: var(--row); }
.line { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 6px 6px 6px 4px; cursor: pointer; }
.star { border: 0; background: none; color: var(--muted); font-size: 15px; cursor: pointer; padding: 2px 4px; border-radius: 6px; line-height: 1; }
.star.on { color: var(--amber); }
.star:hover { background: var(--line); }
.name { min-width: 0; }
.name b { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.name small { display: block; font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ins { height: 28px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line2); background: transparent; color: var(--ink); font: inherit; font-weight: 600; font-size: 12px; cursor: pointer; white-space: nowrap; }
.ins:hover, .row[aria-selected="true"] .ins { background: var(--blue); border-color: var(--blue); color: #fff; }
.ins.confirm { background: var(--red); border-color: var(--red); color: #fff; }
pre { margin: 0 4px 8px 32px; padding: 9px 11px; max-height: 190px; overflow: auto; background: var(--code); border: 1px solid var(--line); border-radius: 9px;
  font: 11.5px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: #e6e6ea; white-space: pre; }
.empty { padding: 14px 4px; color: var(--muted); }
.status { font-size: 12px; color: var(--muted); padding: 10px 12px; border-top: 1px solid var(--line); }
.status.warn { color: var(--amber); }
.note { width: 100%; min-height: 110px; resize: vertical; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line2); background: var(--code); color: var(--ink);
  font: inherit; font-size: 13px; line-height: 1.5; }
.note:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-soft); }
.ptitle { font-weight: 650; font-size: 13.5px; }
.bar { display: flex; align-items: center; gap: 8px; }
.save { height: 32px; padding: 0 16px; border: 0; border-radius: 9px; background: var(--blue); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
.save:hover { filter: brightness(1.08); }
.save[disabled] { opacity: .5; cursor: default; }
.link { margin-left: auto; border: 0; background: none; color: var(--blue); font: inherit; font-size: 12.5px; cursor: pointer; padding: 0; }
.link:hover { text-decoration: underline; }
.saved { display: flex; flex-direction: column; gap: 6px; }
.saved .it { padding: 8px 10px; border-radius: 9px; background: var(--card); border: 1px solid var(--line); white-space: pre-wrap; line-height: 1.45; }
.saved .it small { display: block; color: var(--muted); font-size: 11px; margin-top: 4px; }
.toast { position: fixed; z-index: 2147483601; right: 18px; bottom: 18px; display: none; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px;
  background: var(--bg); color: var(--ink); border: 1px solid var(--line2); box-shadow: 0 18px 44px rgba(0,0,0,.5); font-size: 13px; }
.toast.show { display: flex; }
.toast i { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-style: normal; font-weight: 800; font-size: 12px; background: var(--green); color: #04140d; }
.toast.err i { background: var(--amber); color: #1a1200; }
`;

  var host = document.createElement('span');
  host.setAttribute('data-codextent-templates', '');
  host.setAttribute('data-platform', PLATFORM);
  var sh = host.attachShadow({ mode: 'open' });
  var st = document.createElement('style'); st.textContent = CSS; sh.appendChild(st);
  var fab = h('button', 'fab'); fab.type = 'button'; fab.innerHTML = LOGO;
  fab.title = 'Codextent: templates and notes (Alt+Shift+T)'; fab.setAttribute('aria-label', 'Codextent templates and notes'); fab.setAttribute('aria-expanded', 'false');
  sh.appendChild(fab);
  var panel = h('div', 'panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Codextent');
  sh.appendChild(panel);
  var toastEl = h('div', 'toast'); toastEl.setAttribute('role', 'status'); sh.appendChild(toastEl);
  ['keydown', 'keyup', 'keypress'].forEach(function (ev) { panel.addEventListener(ev, function (e) { e.stopPropagation(); }); });

  var ui = { tab: 'templates', q: '', sel: 0, open: null, list: [], all: [], editor: null, confirm: null, notes: [] };

  function toast(text, err) {
    toastEl.textContent = '';
    toastEl.className = 'toast show' + (err ? ' err' : '');
    toastEl.appendChild(h('i', null, err ? '!' : '✓'));
    toastEl.appendChild(h('span', null, text));
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.className = 'toast'; }, 4000);
  }

  function editorText() { return ui.editor && ui.editor.ok ? ui.editor.text : ''; }
  function filtered() { return TP.search(ui.all, { q: ui.q, lang: 'cpp', platform: PLATFORM }); }

  function head() {
    var hd = h('div', 'head');
    var br = h('div', 'brand'); br.innerHTML = LOGO; br.appendChild(document.createTextNode('Codextent'));
    hd.appendChild(br);
    var tabs = h('div', 'tabs'); tabs.setAttribute('role', 'tablist');
    [['templates', 'Templates'], ['notes', 'Notes']].forEach(function (t) {
      var b = h('button', 'tab', t[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('data-tab', t[0]); b.setAttribute('aria-selected', String(ui.tab === t[0]));
      b.addEventListener('click', function () { ui.tab = t[0]; ui.confirm = null; render(); focusMain(); });
      tabs.appendChild(b);
    });
    hd.appendChild(tabs);
    var x = h('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', close);
    hd.appendChild(x);
    return hd;
  }

  function langWarning() {
    if (ui.editor && !ui.editor.ok) return PLATFORM === 'codechef' ? 'Open the IDE tab to insert directly. Until then, Insert copies the code.' : 'Editor not found. Insert will copy the code instead.';
    if (ui.editor && ui.editor.language && ui.editor.language !== 'cpp') return 'Your editor is set to ' + (LANG_LABEL[ui.editor.language] || ui.editor.language) + '. Switch it to C++ (C++ templates only for now).';
    return '';
  }

  function renderTemplates(body) {
    body.appendChild(h('div', 'lbl', 'Quick insert'));
    var quick = h('div', 'quick');
    QUICK[PLATFORM].forEach(function (qk) {
      var b = h('button', 'qb' + (ui.confirm === 'q:' + qk.id ? ' confirm' : '')); b.type = 'button'; b.setAttribute('data-q', qk.id);
      b.appendChild(h('b', null, ui.confirm === 'q:' + qk.id ? 'Replace my code?' : qk.label));
      b.appendChild(h('span', null, qk.hint));
      b.addEventListener('click', function () { quickInsert(qk); });
      quick.appendChild(b);
    });
    body.appendChild(quick);

    body.appendChild(h('div', 'lbl', 'Templates'));
    var q = h('input', 'q'); q.type = 'search'; q.placeholder = 'Search: binary search, bfs, dsu…'; q.value = ui.q; q.setAttribute('aria-label', 'Search templates');
    body.appendChild(q);
    ui.list = filtered();
    if (ui.sel >= ui.list.length) ui.sel = Math.max(0, ui.list.length - 1);
    var list = h('div', 'list'); list.setAttribute('role', 'listbox');
    if (!ui.list.length) list.appendChild(h('div', 'empty', 'No templates match. Add your own in My Learning Hub → Templates.'));
    ui.list.forEach(function (t, i) {
      var row = h('div', 'row'); row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(i === ui.sel)); row.setAttribute('data-id', t.id);
      var line = h('div', 'line');
      var star = h('button', 'star' + (t.fav ? ' on' : ''), t.fav ? '★' : '☆'); star.type = 'button'; star.title = t.fav ? 'Remove from favorites' : 'Add to favorites';
      star.addEventListener('click', function (e) { e.stopPropagation(); TP.toggleFav(t.id).then(reload); });
      line.appendChild(star);
      var nm = h('div', 'name'); nm.appendChild(h('b', null, t.name)); nm.appendChild(h('small', null, (t.topics || []).join(' · ')));
      line.appendChild(nm);
      var ins = h('button', 'ins' + (ui.confirm === 't:' + t.id ? ' confirm' : ''), ui.confirm === 't:' + t.id ? 'Replace?' : 'Insert'); ins.type = 'button';
      ins.addEventListener('click', function (e) { e.stopPropagation(); ui.sel = i; insertTemplate(t); });
      line.appendChild(ins);
      line.addEventListener('click', function () { ui.sel = i; ui.open = ui.open === t.id ? null : t.id; ui.confirm = null; render(); });
      row.appendChild(line);
      if (ui.open === t.id) row.appendChild(h('pre', null, TP.forPlatform(t, PLATFORM, editorText()).code));
      list.appendChild(row);
    });
    body.appendChild(list);

    q.addEventListener('input', function () { ui.q = q.value; ui.sel = 0; ui.open = null; var pos = q.selectionStart; render(); var nq = panel.querySelector('.q'); nq.focus(); nq.setSelectionRange(pos, pos); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); ui.sel = Math.min(ui.list.length - 1, ui.sel + 1); ui.confirm = null; render(); panel.querySelector('.q').focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); ui.sel = Math.max(0, ui.sel - 1); ui.confirm = null; render(); panel.querySelector('.q').focus(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (ui.list[ui.sel]) insertTemplate(ui.list[ui.sel]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    var selEl = list.querySelector('[aria-selected="true"]'); if (selEl && selEl.scrollIntoView) selEl.scrollIntoView({ block: 'nearest' });
  }

  function renderNotes(body) {
    body.appendChild(h('div', 'ptitle', problemTitle()));
    var ta = h('textarea', 'note'); ta.placeholder = 'Your idea, the trick, or the mistake to remember…'; ta.setAttribute('aria-label', 'Note for this problem');
    ta.value = ui.draft || '';
    ta.addEventListener('input', function () { ui.draft = ta.value; save.disabled = !ta.value.trim(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save.click(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } });
    body.appendChild(ta);
    var bar = h('div', 'bar');
    var save = h('button', 'save', 'Save note'); save.type = 'button'; save.disabled = !ta.value.trim();
    save.addEventListener('click', function () {
      var text = ta.value.trim();
      if (!text) return;
      save.disabled = true;
      chrome.runtime.sendMessage({ type: 'SAVE_CLIP', kind: 'note', notes: text, url: location.href, pageTitle: problemTitle() + (PLATFORM === 'leetcode' ? ' - LeetCode' : ' - CodeChef') }, function (r) {
        if (chrome.runtime.lastError || !r || !r.ok) { toast((r && r.error) || 'Could not save. Reload the page and try again.', true); save.disabled = false; return; }
        ui.draft = ''; toast('Note saved · revise it in My Learning Hub'); loadNotes().then(render);
      });
    });
    bar.appendChild(save);
    var link = h('button', 'link', 'Open My Learning Hub'); link.type = 'button';
    link.addEventListener('click', function () { chrome.runtime.sendMessage({ type: 'OPEN_VAULT' }); });
    bar.appendChild(link);
    body.appendChild(bar);
    if (ui.notes.length) {
      body.appendChild(h('div', 'lbl', 'Saved for this problem'));
      var box = h('div', 'saved');
      ui.notes.forEach(function (n) {
        var it = h('div', 'it', n.text);
        it.appendChild(h('small', null, new Date(n.createdAt || Date.now()).toLocaleString()));
        box.appendChild(it);
      });
      body.appendChild(box);
    }
  }

  function render() {
    panel.textContent = '';
    panel.appendChild(head());
    var body = h('div', 'body');
    if (ui.tab === 'notes') renderNotes(body); else renderTemplates(body);
    panel.appendChild(body);
    var warn = ui.tab === 'templates' ? langWarning() : '';
    var stl = h('div', 'status' + (warn ? ' warn' : ''));
    stl.textContent = warn || (ui.tab === 'notes' ? 'Notes are saved to My Revision Vault. Ctrl+Enter saves.'
      : PLATFORM === 'codechef' ? 'Empty editor: you get the whole program with while (t--). Otherwise code goes in at your cursor.'
        : 'Code goes in at your cursor, inside class Solution. Ctrl+Z undoes it.');
    panel.appendChild(stl);
  }
  function focusMain() { var el = panel.querySelector(ui.tab === 'notes' ? '.note' : '.q'); if (el) el.focus(); }

  async function put(code, full, label) {
    var state = await ask('state');
    if (!state.ok) {
      var copied = await copy(code);
      close();
      toast(copied ? 'Copied "' + label + '": click in the editor and press Ctrl+V' : (state.error || 'Editor not reachable.'), true);
      return;
    }
    var r = await ask(full ? 'replace' : 'insert', code);
    close();
    if (r.ok) toast('Inserted "' + label + '"' + (full ? ' (whole program)' : '') + ' · Ctrl+Z to undo');
    else { var c2 = await copy(code); toast(c2 ? 'Copied "' + label + '": press Ctrl+V in the editor' : (r.error || 'Could not insert.'), true); }
  }
  function needsConfirm(key) {
    if (ui.editor && ui.editor.ok && !isEmptyEditor(editorText()) && ui.confirm !== key) { ui.confirm = key; render(); return true; }
    return false;
  }
  async function quickInsert(qk) {
    if (qk.full) {
      if (needsConfirm('q:' + qk.id)) return;
      var base = ui.all.filter(function (t) { return t.id === 'cpp-contest-base'; })[0] || TP.BUILTIN[0];
      return put(TP.fullProgram(base), true, qk.label);
    }
    return put(qk.code, false, qk.label);
  }
  async function insertTemplate(t) {
    var pv = TP.forPlatform(t, PLATFORM, editorText());
    if (!pv.code) { toast('This template has nothing to insert on ' + NAME + '.', true); return; }
    return put(pv.code, pv.mode === 'full', t.name);
  }

  async function loadNotes() {
    var key = problemKey();
    try {
      var d = await chrome.storage.local.get('vault');
      ui.notes = (d.vault || []).filter(function (c) {
        if (c.kind !== 'note') return false;
        try { var u = new URL(c.url); return u.hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, '') && u.pathname.replace(/\/+$/, '').indexOf(key) === 0; } catch (e) { return false; }
      }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }).slice(0, 5);
    } catch (e) { ui.notes = []; }
  }
  async function reload() { ui.all = await TP.all(); render(); if (isOpen()) focusMain(); }
  async function open(tab) {
    if (tab) ui.tab = tab;
    ui.editor = await ask('state');
    ui.all = await TP.all();
    await loadNotes();
    ui.confirm = null; ui.q = ''; ui.sel = 0; ui.open = null;
    render();
    var r = fab.getBoundingClientRect(), w = Math.min(440, window.innerWidth - 24);
    var left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12)), top = r.bottom + 8;
    if (!fab.isConnected || r.width === 0) { left = (window.innerWidth - w) / 2; top = 60; }
    if (top + 420 > window.innerHeight) top = Math.max(12, r.top - 8 - Math.min(600, window.innerHeight - 32));
    panel.style.left = left + 'px'; panel.style.top = top + 'px';
    panel.classList.add('show');
    fab.setAttribute('aria-expanded', 'true');
    focusMain();
  }
  function close() { panel.classList.remove('show'); fab.setAttribute('aria-expanded', 'false'); ui.confirm = null; }
  function isOpen() { return panel.classList.contains('show'); }

  fab.addEventListener('click', function (e) { e.stopPropagation(); if (isOpen()) close(); else open(); });
  document.addEventListener('mousedown', function (e) { if (isOpen() && e.composedPath().indexOf(host) === -1) close(); }, true);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); return; }
    if (e.altKey && e.shiftKey && (e.key === 'T' || e.key === 't' || e.code === 'KeyT')) { e.preventDefault(); e.stopPropagation(); if (isOpen()) close(); else open('templates'); }
  }, true);
  try { chrome.storage.onChanged.addListener(function (ch, area) { if (area === 'local' && ch[TP.KEY] && isOpen()) reload(); }); } catch (e) { /* tests */ }

  // ---------- put the button next to the editor ----------
  function place() {
    var spot = null;
    if (PLATFORM === 'leetcode') {
      if (!/^\/problems\//.test(location.pathname)) { host.remove(); return; }
      var langBtn = Array.prototype.filter.call(document.querySelectorAll('#editor button, [id="editor"] button'), function (b) { return /^(C\+\+|C|Java|Python3?|JavaScript|TypeScript|C#|Go|Rust|Kotlin|Swift|Ruby|Scala|PHP|Dart)$/.test(b.textContent.trim()); })[0];
      if (langBtn) spot = { parent: langBtn.parentElement, after: langBtn };
    } else {
      var ace = document.getElementById('submit-ide-v2') || document.querySelector('.ace_editor');
      if (ace && ace.parentElement) spot = { parent: ace.parentElement, float: true };
    }
    if (!spot) {
      if (!host.isConnected || host.getAttribute('data-float') !== 'page') {
        host.setAttribute('data-float', 'page');
        host.style.cssText = 'position:fixed !important;left:18px !important;bottom:18px !important;z-index:2147483000 !important;';
        if (PLATFORM === 'leetcode' && !/^\/problems\//.test(location.pathname)) return;
        document.body.appendChild(host);
      }
      return;
    }
    if (spot.float) {
      if (host.parentElement !== spot.parent) {
        if (getComputedStyle(spot.parent).position === 'static') spot.parent.style.position = 'relative';
        host.setAttribute('data-float', 'editor');
        host.style.cssText = 'position:absolute !important;top:8px !important;right:22px !important;z-index:20 !important;';
        spot.parent.appendChild(host);
      }
    } else if (host.previousElementSibling !== spot.after) {
      host.setAttribute('data-float', 'no');
      host.style.cssText = 'display:inline-flex !important;align-items:center !important;margin-left:6px !important;';
      spot.after.insertAdjacentElement('afterend', host);
    }
  }
  place();
  setInterval(place, 1000);
})();

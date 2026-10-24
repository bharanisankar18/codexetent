/*
 * Codextent — template picker on coding platforms (CodeChef + LeetCode, C++ first).
 *
 *   [ { } Templates ] button next to the editor  ·  Alt+Shift+T opens the picker anywhere on the page
 *   Picker: search · ⭐ favorites first · topic chips · preview · Insert (Enter) · ↑/↓ to move · Esc to close
 *   CodeChef: empty editor → whole contest program (main + while (t--)); otherwise the snippet at the cursor.
 *   LeetCode: the snippet at the cursor (helpers inside class Solution; no main()).
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
  var LANG_LABEL = { cpp: 'C++', c: 'C', java: 'Java', python: 'Python' };

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

  // ---------- UI ----------
  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function dark() {
    if (PLATFORM === 'leetcode') return document.documentElement.classList.contains('dark');
    var bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [255, 255, 255];
    return (Number(bg[0]) + Number(bg[1]) + Number(bg[2])) / 3 < 110 || !!document.querySelector('.ace-tomorrow-night, [class*="_dark_"]');
  }
  var CSS = `
:host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color-scheme: dark;
  --bg: #1e1e20; --card: #26262a; --row: #2e2e33; --ink: #f2f2f4; --muted: #a0a0a8; --line: rgba(255,255,255,.1); --line2: rgba(255,255,255,.18);
  --accent: #ffa116; --accent-ink: #1a1a1a; --code: #151517; --star: #ffc01e; --green: #2cbb5d; --shadow: 0 18px 50px rgba(0,0,0,.55); }
:host([data-theme="light"]) { color-scheme: light; --bg: #ffffff; --card: #ffffff; --row: #f3f4f6; --ink: #1f2328; --muted: #6b7280; --line: rgba(0,0,0,.09);
  --line2: rgba(0,0,0,.16); --code: #f7f8fa; --shadow: 0 18px 50px rgba(0,0,0,.18); }
:host([data-platform="codechef"]) { --accent: #5b4638; --accent-ink: #fff; }
:host([data-platform="codechef"][data-theme="dark"]) { --accent: #d8b28c; --accent-ink: #1a1a1a; }
* { box-sizing: border-box; }
.btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line2); background: var(--card);
  color: var(--ink); font-family: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: border-color .15s, box-shadow .15s; }
.btn:hover { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
.btn .br { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 800; color: var(--accent); }
.btn kbd { font: 600 10.5px ui-monospace, Menlo, monospace; color: var(--muted); border: 1px solid var(--line2); border-radius: 4px; padding: 0 4px; }
.picker { position: fixed; z-index: 2147483600; width: min(720px, calc(100vw - 24px)); max-height: min(560px, calc(100vh - 40px)); display: none;
  grid-template-rows: auto auto minmax(0, 1fr) auto; background: var(--bg); color: var(--ink); border: 1px solid var(--line2); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
.picker.show { display: grid; }
.top { display: flex; align-items: center; gap: 10px; padding: 12px 12px 8px; }
.top .t { font-weight: 700; font-size: 14px; white-space: nowrap; }
.top .t span { color: var(--muted); font-weight: 500; }
.q { flex: 1; min-width: 0; height: 34px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--line2); background: var(--code); color: var(--ink); font: inherit; font-size: 13.5px; }
.q:focus { outline: none; border-color: var(--accent); }
.x { width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font-size: 18px; cursor: pointer; }
.x:hover { background: var(--row); color: var(--ink); }
.chips { display: flex; gap: 6px; padding: 0 12px 10px; overflow-x: auto; scrollbar-width: thin; }
.chip { flex: none; height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); }
.body { display: grid; grid-template-columns: minmax(200px, 40%) minmax(0, 1fr); min-height: 0; border-top: 1px solid var(--line); }
.list { overflow-y: auto; padding: 6px; border-right: 1px solid var(--line); }
.item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; width: 100%; padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; color: var(--ink); text-align: left; font: inherit; cursor: pointer; }
.item:hover { background: var(--row); }
.item[aria-selected="true"] { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 2px 0 0 var(--accent); }
.item b { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item small { grid-column: 1; font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.star { grid-row: 1 / span 2; grid-column: 2; align-self: center; border: 0; background: none; color: var(--muted); font-size: 15px; cursor: pointer; padding: 2px 4px; border-radius: 6px; }
.star.on { color: var(--star); }
.star:hover { background: var(--line); }
.mine { font-size: 10px; font-weight: 700; color: var(--accent); margin-left: 4px; }
.prev { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; min-width: 0; }
.prev .desc { padding: 10px 12px 6px; font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.prev .desc b { color: var(--ink); }
pre { margin: 0 12px 10px; padding: 10px 12px; background: var(--code); border: 1px solid var(--line); border-radius: 10px; overflow: auto; font: 12px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--ink); white-space: pre; min-height: 0; }
.foot { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); flex-wrap: wrap; }
.seg { display: inline-flex; padding: 2px; border-radius: 8px; border: 1px solid var(--line); }
.seg button { height: 26px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--row); color: var(--ink); font-weight: 600; }
.go { height: 32px; padding: 0 16px; border: 0; border-radius: 9px; background: var(--accent); color: var(--accent-ink); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.go:hover { filter: brightness(1.06); }
.go.danger { background: #ef4743; color: #fff; }
.ghost { height: 32px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--line2); background: transparent; color: var(--ink); font: inherit; font-size: 12.5px; cursor: pointer; }
.note { font-size: 12px; color: var(--muted); margin-right: auto; }
.note.warn { color: #ffb020; }
.empty { padding: 20px 12px; color: var(--muted); font-size: 13px; }
.toast { position: fixed; z-index: 2147483601; right: 18px; bottom: 18px; display: none; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px;
  background: var(--bg); color: var(--ink); border: 1px solid var(--line2); box-shadow: var(--shadow); font-size: 13px; }
.toast.show { display: flex; }
.toast i { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-style: normal; font-weight: 800; font-size: 12px; background: var(--green); color: #04140d; }
.toast.err i { background: #ffb020; }
@media (max-width: 620px) { .body { grid-template-columns: 1fr; } .prev { display: none; } }
`;

  var host = document.createElement('span');
  host.setAttribute('data-codextent-templates', '');
  host.setAttribute('data-platform', PLATFORM);
  var sh = host.attachShadow({ mode: 'open' });
  var st = document.createElement('style'); st.textContent = CSS; sh.appendChild(st);
  var btn = h('button', 'btn'); btn.type = 'button';
  btn.appendChild(h('span', 'br', '{ }')); btn.appendChild(document.createTextNode('Templates')); btn.appendChild(h('kbd', null, 'Alt+Shift+T'));
  btn.title = 'Codextent templates: insert a C++ template into the editor (Alt+Shift+T)';
  sh.appendChild(btn);
  var picker = h('div', 'picker'); picker.setAttribute('role', 'dialog'); picker.setAttribute('aria-label', 'Insert a template');
  sh.appendChild(picker);
  var toastEl = h('div', 'toast'); toastEl.setAttribute('role', 'status'); sh.appendChild(toastEl);
  ['keydown', 'keyup', 'keypress'].forEach(function (ev) { picker.addEventListener(ev, function (e) { e.stopPropagation(); }); });

  var ui = { q: '', topic: '', fav: false, sel: 0, mode: 'auto', list: [], all: [], editor: null, confirm: false };

  function toast(text, err) {
    toastEl.textContent = '';
    toastEl.className = 'toast show' + (err ? ' err' : '');
    toastEl.appendChild(h('i', null, err ? '!' : '✓'));
    toastEl.appendChild(h('span', null, text));
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.className = 'toast'; }, 4000);
  }

  function filtered() { return TP.search(ui.all, { q: ui.q, topic: ui.topic, fav: ui.fav, lang: 'cpp', platform: PLATFORM }); }
  function current() { return ui.list[ui.sel] || null; }
  function preview(t) {
    if (!t) return { mode: '', code: '' };
    var text = ui.editor && ui.editor.ok ? ui.editor.text : '';
    return TP.forPlatform(t, PLATFORM, text, ui.mode === 'auto' ? null : ui.mode);
  }

  function render() {
    picker.textContent = '';
    var top = h('div', 'top');
    var title = h('div', 't', '{ } Templates '); title.appendChild(h('span', null, '· ' + NAME + ' · C++'));
    top.appendChild(title);
    var q = h('input', 'q'); q.type = 'search'; q.placeholder = 'Search: binary search, bfs, sliding window…'; q.value = ui.q; q.setAttribute('aria-label', 'Search templates');
    top.appendChild(q);
    var x = h('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', close);
    top.appendChild(x);
    picker.appendChild(top);

    var chips = h('div', 'chips');
    var favChip = h('button', 'chip', '⭐ Favorites'); favChip.type = 'button'; favChip.setAttribute('aria-pressed', String(ui.fav));
    favChip.addEventListener('click', function () { ui.fav = !ui.fav; ui.sel = 0; render(); });
    chips.appendChild(favChip);
    TP.topicsOf(ui.all.filter(function (t) { return TP.usableOn(t, PLATFORM); })).forEach(function (tp) {
      var c = h('button', 'chip', tp); c.type = 'button'; c.setAttribute('aria-pressed', String(ui.topic === tp));
      c.addEventListener('click', function () { ui.topic = ui.topic === tp ? '' : tp; ui.sel = 0; render(); });
      chips.appendChild(c);
    });
    picker.appendChild(chips);

    ui.list = filtered();
    if (ui.sel >= ui.list.length) ui.sel = Math.max(0, ui.list.length - 1);
    var body = h('div', 'body');
    var list = h('div', 'list'); list.setAttribute('role', 'listbox');
    if (!ui.list.length) list.appendChild(h('div', 'empty', 'No templates match. Add your own in My Learning Hub → Templates.'));
    ui.list.forEach(function (t, i) {
      var it = h('button', 'item'); it.type = 'button'; it.setAttribute('role', 'option'); it.setAttribute('aria-selected', String(i === ui.sel));
      var b = h('b', null, t.name); if (t.custom) b.appendChild(h('span', 'mine', 'MINE'));
      it.appendChild(b);
      var star = h('span', 'star' + (t.fav ? ' on' : ''), t.fav ? '★' : '☆'); star.title = t.fav ? 'Remove from favorites' : 'Add to favorites';
      star.addEventListener('click', function (e) { e.stopPropagation(); TP.toggleFav(t.id).then(reload); });
      it.appendChild(star);
      it.appendChild(h('small', null, (t.topics || []).join(' · ')));
      it.addEventListener('click', function () { ui.sel = i; ui.confirm = false; render(); });
      it.addEventListener('dblclick', function () { ui.sel = i; insert(); });
      list.appendChild(it);
    });
    body.appendChild(list);
    var t = current(), pv = preview(t);
    var prev = h('div', 'prev');
    var desc = h('div', 'desc');
    if (t) { desc.appendChild(h('b', null, pv.mode === 'full' ? 'Whole program · ' : 'Snippet at the cursor · ')); desc.appendChild(document.createTextNode(t.desc || '')); }
    prev.appendChild(desc);
    prev.appendChild(h('pre', null, pv.code || ''));
    body.appendChild(prev);
    picker.appendChild(body);

    var foot = h('div', 'foot');
    var note = h('span', 'note');
    if (ui.editor && !ui.editor.ok) { note.textContent = 'Editor not reachable — Insert will copy the code instead.'; note.className = 'note warn'; }
    else if (ui.editor && ui.editor.language && ui.editor.language !== 'cpp') { note.textContent = 'Your editor is set to ' + (LANG_LABEL[ui.editor.language] || ui.editor.language) + '. Switch it to C++ (C++ templates only for now).'; note.className = 'note warn'; }
    else note.textContent = '↑ ↓ choose · Enter insert · Esc close';
    foot.appendChild(note);
    if (PLATFORM === 'codechef') {
      var seg = h('div', 'seg');
      [['auto', 'Auto'], ['full', 'Whole program'], ['snippet', 'Snippet']].forEach(function (m) {
        var b2 = h('button', null, m[1]); b2.type = 'button'; b2.setAttribute('aria-pressed', String(ui.mode === m[0]));
        b2.addEventListener('click', function () { ui.mode = m[0]; ui.confirm = false; render(); });
        seg.appendChild(b2);
      });
      foot.appendChild(seg);
    }
    var cp = h('button', 'ghost', 'Copy'); cp.type = 'button';
    cp.addEventListener('click', function () { var c = preview(current()).code; copy(c).then(function (ok) { toast(ok ? 'Copied ' + current().name : 'Could not copy', !ok); }); });
    foot.appendChild(cp);
    var willReplace = pv.mode === 'full' && ui.editor && ui.editor.ok && ui.editor.text && ui.editor.text.replace(/\/\/\s*write (your )?code here\.*/i, '').trim();
    var go = h('button', 'go' + (ui.confirm ? ' danger' : ''), ui.confirm ? 'Replace my code?' : (pv.mode === 'full' ? 'Insert whole program' : 'Insert'));
    go.type = 'button'; go.disabled = !t;
    go.addEventListener('click', function () { if (willReplace && !ui.confirm) { ui.confirm = true; render(); return; } insert(); });
    foot.appendChild(go);
    picker.appendChild(foot);

    q.addEventListener('input', function () { ui.q = q.value; ui.sel = 0; var pos = q.selectionStart; render(); var nq = picker.querySelector('.q'); nq.focus(); nq.setSelectionRange(pos, pos); });
    q.addEventListener('keydown', keys);
    var selEl = list.querySelector('[aria-selected="true"]'); if (selEl) selEl.scrollIntoView({ block: 'nearest' });
  }
  function keys(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); ui.sel = Math.min(ui.list.length - 1, ui.sel + 1); ui.confirm = false; render(); picker.querySelector('.q').focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); ui.sel = Math.max(0, ui.sel - 1); ui.confirm = false; render(); picker.querySelector('.q').focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); picker.querySelector('.go').click(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  async function insert() {
    var t = current();
    if (!t) return;
    var state = await ask('state');
    var pv = TP.forPlatform(t, PLATFORM, state.ok ? state.text : '', ui.mode === 'auto' ? null : ui.mode);
    if (!pv.code) { toast('This template has no snippet for ' + NAME + '.', true); return; }
    if (!state.ok) {
      var copied = await copy(pv.code);
      close();
      toast(copied ? 'Copied "' + t.name + '" — click in the editor and press Ctrl+V' : (state.error || 'Editor not reachable.'), true);
      return;
    }
    var r = await ask(pv.mode === 'full' ? 'replace' : 'insert', pv.code);
    close();
    if (r.ok) toast('Inserted "' + t.name + '"' + (pv.mode === 'full' ? ' (whole program)' : '') + ' · Ctrl+Z to undo');
    else { var c2 = await copy(pv.code); toast(c2 ? 'Copied "' + t.name + '" — press Ctrl+V in the editor' : (r.error || 'Could not insert.'), true); }
  }

  async function reload() { ui.all = await TP.all(); render(); if (isOpen()) picker.querySelector('.q').focus(); }
  async function open() {
    host.setAttribute('data-theme', dark() ? 'dark' : 'light');
    ui.editor = await ask('state');
    ui.all = await TP.all();
    ui.confirm = false;
    render();
    var r = btn.getBoundingClientRect(), w = Math.min(720, window.innerWidth - 24);
    var left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12)), top = r.bottom + 8;
    if (!btn.isConnected || r.width === 0) { left = (window.innerWidth - w) / 2; top = 60; }
    if (top + 400 > window.innerHeight) top = Math.max(12, window.innerHeight - 570);
    picker.style.left = left + 'px'; picker.style.top = top + 'px';
    picker.classList.add('show');
    picker.querySelector('.q').focus();
  }
  function close() { picker.classList.remove('show'); ui.confirm = false; }
  function isOpen() { return picker.classList.contains('show'); }

  btn.addEventListener('click', function (e) { e.stopPropagation(); if (isOpen()) close(); else open(); });
  document.addEventListener('mousedown', function (e) { if (isOpen() && e.composedPath().indexOf(host) === -1) close(); }, true);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(); return; }
    if (e.altKey && e.shiftKey && (e.key === 'T' || e.key === 't' || e.code === 'KeyT')) { e.preventDefault(); e.stopPropagation(); if (isOpen()) close(); else open(); }
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

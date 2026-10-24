/*
 * Codextent dashboard — Templates view (#templates).
 * Browse, search, favorite, add, edit, duplicate, delete C++ templates.
 * The same library is used by the { } Templates picker on CodeChef and LeetCode.
 */
(function () {
  'use strict';
  var OQ = globalThis.OutputIQ;
  var TP = OQ.templates;
  var st = { q: '', topic: '', fav: false, show: {}, edit: null, list: [], seq: 0 };
  var box = null;

  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(text, cls, fn) { var b = h('button', 'btn small' + (cls ? ' ' + cls : ''), text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  async function copy(text, b) {
    try { await navigator.clipboard.writeText(text); } catch (e) { return; }
    var old = b.textContent; b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = old; }, 1400);
  }

  function field(label, value, rows, ph, mono) {
    var w = h('label', 'tfield');
    w.appendChild(h('span', 'lbl', label));
    var i = rows ? h('textarea') : h('input');
    if (rows) { i.rows = rows; i.spellcheck = false; } else i.type = 'text';
    if (mono) {
      i.className = 'mono';
      i.addEventListener('keydown', function (ev) { // Tab = 4 spaces
        if (ev.key !== 'Tab' || ev.shiftKey) return;
        ev.preventDefault(); i.setRangeText('    ', i.selectionStart, i.selectionEnd, 'end'); i.dispatchEvent(new Event('input'));
      });
    }
    i.value = value || ''; i.placeholder = ph || '';
    w.appendChild(i);
    return { wrap: w, input: i };
  }

  function editor() {
    var e = st.edit, card = h('div', 'card tform');
    card.appendChild(h('h3', null, e.id ? 'Edit template' : 'New template'));
    var name = field('Name', e.name, 0, 'e.g. Segment tree (sum)');
    var topics = field('Topics (comma separated)', (e.topics || []).join(', '), 0, 'e.g. trees, range query');
    var desc = field('What it is for', e.desc, 0, 'One line — shown in the picker');
    var snip = field('Helpers — goes above solve() on CodeChef, at the cursor on LeetCode', e.snippet, 9, 'struct / functions / constants', true);
    var body = field('solve() body — CodeChef whole program only (one test case)', e.body, 6, 'int n; cin >> n;\n...', true);
    [name, topics, desc].forEach(function (f) { card.appendChild(f.wrap); });
    var two = h('div', 'tcols'); two.appendChild(snip.wrap); two.appendChild(body.wrap); card.appendChild(two);
    var prevLbl = h('span', 'lbl', 'Preview — CodeChef whole program'); var prev = h('pre', 'clipcode tprev');
    function upd() { prev.textContent = TP.fullProgram({ snippet: snip.input.value, body: body.input.value }); }
    snip.input.addEventListener('input', upd); body.input.addEventListener('input', upd); upd();
    card.appendChild(prevLbl); card.appendChild(prev);
    var err = h('p', 'terr hidden');
    card.appendChild(err);
    var bar = h('div', 'tbar');
    bar.appendChild(btn('Save', 'primary', async function () {
      if (!name.input.value.trim()) { err.textContent = 'Give it a name.'; err.classList.remove('hidden'); name.input.focus(); return; }
      if (!snip.input.value.trim() && !body.input.value.trim()) { err.textContent = 'Add helpers or a solve() body.'; err.classList.remove('hidden'); return; }
      await TP.saveTemplate({ id: e.id, name: name.input.value, topics: topics.input.value, desc: desc.input.value, snippet: snip.input.value, body: body.input.value });
      st.edit = null; render();
    }));
    bar.appendChild(btn('Cancel', '', function () { st.edit = null; render(); }));
    card.appendChild(bar);
    setTimeout(function () { name.input.focus(); }, 0);
    return card;
  }

  function card(t) {
    var c = h('div', 'clip tcard');
    c.setAttribute('data-id', t.id);
    var head = h('div', 'clip-head');
    var left = h('div');
    var nm = h('b', 'tname', t.name); if (t.custom) nm.appendChild(h('span', 'stbadge tmine', 'Mine'));
    left.appendChild(nm);
    left.appendChild(h('p', 'tdesc', t.desc || ''));
    head.appendChild(left);
    var star = h('button', 'tstar' + (t.fav ? ' on' : ''), t.fav ? '★' : '☆'); star.type = 'button';
    star.title = t.fav ? 'Remove from favorites' : 'Add to favorites'; star.setAttribute('aria-pressed', String(!!t.fav));
    star.addEventListener('click', async function () { await TP.toggleFav(t.id); render(); });
    head.appendChild(star);
    c.appendChild(head);
    var meta = h('div', 'clipmeta');
    (t.topics || []).forEach(function (x) {
      var ch = h('button', 'chip', x); ch.type = 'button'; ch.title = 'Show only ' + x;
      ch.addEventListener('click', function () { st.topic = x; render(); });
      meta.appendChild(ch);
    });
    c.appendChild(meta);
    var which = st.show[t.id] || 'codechef';
    var seg = h('div', 'seg');
    [['codechef', 'CodeChef · whole program'], ['leetcode', 'LeetCode · snippet']].forEach(function (p) {
      var b = h('button', null, p[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(which === p[0]));
      if (p[0] === 'leetcode' && !TP.usableOn(t, 'leetcode')) { b.disabled = true; b.title = 'No helpers — nothing to insert inside class Solution'; }
      b.addEventListener('click', function () { st.show[t.id] = p[0]; render(); });
      seg.appendChild(b);
    });
    c.appendChild(seg);
    var code = which === 'leetcode' ? TP.forPlatform(t, 'leetcode', '').code : TP.fullProgram(t);
    var pre = h('pre', 'clipcode folded', code);
    pre.addEventListener('click', function () { pre.classList.remove('folded'); });
    c.appendChild(pre);
    var bar = h('div', 'tbar');
    var cp = btn('Copy', 'primary', function () { copy(code, cp); });
    bar.appendChild(cp);
    if (t.custom) bar.appendChild(btn('Edit', '', function () { st.edit = Object.assign({}, t); render(); scrollTop(); }));
    bar.appendChild(btn('Duplicate', '', function () { st.edit = Object.assign({}, t, { id: null, name: t.name + ' (copy)' }); render(); scrollTop(); }));
    bar.appendChild(btn(t.custom ? 'Delete' : 'Hide', 'danger', async function () {
      if (!confirm(t.custom ? 'Delete "' + t.name + '"? This cannot be undone.' : 'Hide the built-in "' + t.name + '"? You can bring it back with Restore built-ins.')) return;
      await TP.deleteTemplate(t.id); render();
    }));
    c.appendChild(bar);
    return c;
  }
  function scrollTop() { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* ignore */ } }

  async function render(target) {
    if (target) box = target;
    if (!box) return;
    var my = ++st.seq;
    var saved = await TP.load();
    if (my !== st.seq) return; // a newer render started while this one waited
    st.list = TP.library(saved);
    var ae = document.activeElement, typing = ae && ae.id === 'tQ', pos = typing ? ae.selectionStart : 0;
    box.textContent = '';

    var info = h('div', 'card tinfo');
    info.appendChild(h('b', null, 'Use them while you code'));
    info.appendChild(h('p', null, 'On a CodeChef or LeetCode problem, click { } Templates next to the editor or press Alt+Shift+T. CodeChef: an empty editor gets the whole program (main + while (t--)), otherwise the helpers at the cursor. LeetCode: the helpers at the cursor, inside class Solution. C++ only for now.'));
    box.appendChild(info);

    if (st.edit) box.appendChild(editor());

    var tools = h('div', 'vtools ttools');
    var s = h('label', 'search');
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
    var q = h('input'); q.id = 'tQ'; q.type = 'search'; q.placeholder = 'Search templates: dsu, bfs, binary search…'; q.value = st.q; q.autocomplete = 'off';
    q.setAttribute('aria-label', 'Search templates');
    q.addEventListener('input', function () { st.q = q.value; render(); });
    s.appendChild(q); tools.appendChild(s);
    var sel = h('select'); sel.setAttribute('aria-label', 'Topic');
    sel.appendChild(new Option('All topics', ''));
    TP.topicsOf(st.list).forEach(function (x) { sel.appendChild(new Option(x, x)); });
    sel.value = st.topic;
    sel.addEventListener('change', function () { st.topic = sel.value; render(); });
    tools.appendChild(sel);
    var fav = btn(st.fav ? '★ Favorites' : '☆ Favorites', st.fav ? 'primary' : '', function () { st.fav = !st.fav; render(); });
    fav.setAttribute('aria-pressed', String(st.fav)); tools.appendChild(fav);
    tools.appendChild(btn('+ New template', 'primary', function () { st.edit = { name: '', topics: [], desc: '', snippet: '', body: '' }; render(); }));
    if ((saved.hidden || []).length) tools.appendChild(btn('Restore built-ins (' + saved.hidden.length + ')', '', async function () { await TP.restoreBuiltins(); render(); }));
    box.appendChild(tools);

    var list = TP.search(st.list, { q: st.q, topic: st.topic, fav: st.fav, lang: 'cpp' });
    var grid = h('div', 'clips');
    if (!list.length) grid.appendChild(h('p', 'empty', st.fav ? 'No favorites yet — tap ☆ on a template.' : 'No templates match.'));
    list.forEach(function (t) { grid.appendChild(card(t)); });
    box.appendChild(grid);
    if (typing) { q.focus(); q.setSelectionRange(pos, pos); }
  }

  OQ.templatesView = { render: render, count: async function () { return (await TP.all()).length; } };
})();

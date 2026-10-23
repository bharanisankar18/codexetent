/*
 * Codextent on LeetCode — "Solve later" + your idea note, synced between your PCs (chrome.storage.sync).
 * First version: only problems tagged Array (OutputIQ.leetcode.ONLY_TAGS).
 *
 * Where it shows: a chip in LeetCode's own chip row under the title (Easy · Topics · Companies · Hint · [Solve later]),
 * styled like LeetCode's chips. Clicking it opens a small note card. Fallback: a floating chip at the bottom right.
 * Tags come from LeetCode's own GraphQL (same site, the problem's public data), or the /tag/ links on the page.
 * LeetCode changes pages without reloading, so the URL is watched.
 */
(function () {
  'use strict';
  var OQ = globalThis.OutputIQ;
  if (!OQ || !OQ.leetcode || window.__codextentLeetcode) return;
  window.__codextentLeetcode = true;
  var L = OQ.leetcode;

  var state = { slug: null, info: null, mark: null, host: null, loading: false };

  var ICON = {
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z"/></svg>',
    logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 7 4 16l7 9M21 7l7 9-7 9" class="s"/><path d="M18 5 12 17h4l-2 10 7-13h-4z" class="f"/></svg>'
  };
  var CSS = `
:host { all: initial; display: inline-flex; vertical-align: middle; position: relative; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  --chip: rgba(255,255,255,.1); --chip-h: rgba(255,255,255,.16); --ink: #eff1f6; --muted: rgba(239,241,246,.6); --card: #282828; --line: rgba(255,255,255,.12);
  --field: #1f1f1f; --orange: #ffa116; --orange-soft: rgba(255,161,22,.14); --green: #2cbb5d; --shadow: 0 14px 40px rgba(0,0,0,.55); }
:host([data-lc-theme="light"]) { --chip: rgba(0,0,0,.05); --chip-h: rgba(0,0,0,.09); --ink: #262626; --muted: rgba(38,38,38,.6); --card: #ffffff; --line: rgba(0,0,0,.1);
  --field: #f7f8fa; --orange-soft: rgba(255,161,22,.16); --shadow: 0 14px 40px rgba(0,0,0,.15); }
:host([data-lc-float]) { position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; }
* { box-sizing: border-box; }
.chip { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px 0 7px; border: 0; border-radius: 999px; background: var(--chip);
  color: var(--ink); font-family: inherit; font-size: 12px; font-weight: 500; line-height: 1; cursor: pointer; white-space: nowrap; transition: background .15s, color .15s; }
.chip:hover { background: var(--chip-h); }
.chip svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; }
.chip.saved { color: var(--orange); background: var(--orange-soft); }
.chip.saved svg { fill: currentColor; }
.chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--orange); }
:host([data-lc-float]) .chip { height: 34px; padding: 0 14px 0 12px; font-size: 13px; box-shadow: var(--shadow); background: var(--card); border: 1px solid var(--line); }
.pop { display: none; position: absolute; top: 30px; left: 0; width: 350px; z-index: 2147483000; padding: 12px; border-radius: 12px; background: var(--card);
  border: 1px solid var(--line); box-shadow: var(--shadow); color: var(--ink); font-size: 13px; }
:host([data-lc-float]) .pop { top: auto; bottom: 42px; left: auto; right: 0; }
.pop.show { display: grid; gap: 10px; }
.head { display: flex; align-items: center; gap: 8px; }
.head .lg { width: 18px; height: 18px; flex: none; } .head .lg .s { fill: none; stroke: var(--ink); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; } .head .lg .f { fill: var(--orange); }
.head b { font-size: 13px; font-weight: 600; } .head span { margin-left: auto; font-size: 11.5px; color: var(--muted); }
.title { font-weight: 600; font-size: 13.5px; }
.meta { display: flex; gap: 6px; flex-wrap: wrap; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--chip); color: var(--muted); }
.d-easy { color: #00b8a3; } .d-medium { color: #ffc01e; } .d-hard { color: #ff375f; }
textarea { width: 100%; min-height: 84px; max-height: 220px; resize: vertical; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--field);
  color: var(--ink); font-family: inherit; font-size: 13px; line-height: 1.5; }
textarea:focus { outline: none; border-color: var(--orange); box-shadow: 0 0 0 3px var(--orange-soft); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
button.save { height: 30px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--orange); color: #1a1a1a; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
button.save:hover { filter: brightness(1.06); }
button.ghost { height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--ink); font-family: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; }
button.ghost:hover { background: var(--chip); }
button.ghost.done { color: var(--green); border-color: rgba(44,187,93,.4); }
.status { font-size: 12px; color: var(--muted); }
.sync { font-size: 11.5px; color: var(--muted); line-height: 1.4; }
`;

  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function theme() { return document.documentElement.classList.contains('dark') || /dark/.test(document.documentElement.getAttribute('data-theme') || '') ? 'dark' : 'light'; }

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

  // ---------- UI ----------
  function build() {
    var host = document.createElement('span');
    host.setAttribute('data-codextent-lc', '');
    host.setAttribute('data-lc-theme', theme());
    var sh = host.attachShadow({ mode: 'open' });
    var st = document.createElement('style'); st.textContent = CSS; sh.appendChild(st);
    var chip = h('button', 'chip'); chip.type = 'button';
    chip.setAttribute('aria-haspopup', 'dialog'); chip.setAttribute('aria-expanded', 'false');
    sh.appendChild(chip);
    var pop = h('div', 'pop'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Solve later note');
    sh.appendChild(pop);
    host.__ui = { chip: chip, pop: pop, sh: sh };
    chip.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    ['keydown', 'keyup', 'keypress'].forEach(function (ev) { pop.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    return host;
  }
  function renderChip() {
    var ui = state.host.__ui, saved = state.mark && state.mark.st === 'todo', done = state.mark && state.mark.st === 'done';
    ui.chip.textContent = '';
    ui.chip.className = 'chip' + (saved ? ' saved' : '');
    ui.chip.insertAdjacentHTML('afterbegin', ICON.bookmark); // static, trusted markup
    ui.chip.appendChild(document.createTextNode(saved ? 'Solve later' + (state.mark.n ? ' · note' : '') : done ? 'Solved ✓' : 'Solve later'));
    ui.chip.title = saved ? 'Saved to Codextent. Click to edit your note.' : 'Mark this problem to solve later, with your idea (syncs to your other PCs)';
  }
  function renderPop() {
    var ui = state.host.__ui, pop = ui.pop, info = state.info, mark = state.mark;
    pop.textContent = '';
    var head = h('div', 'head');
    var lg = h('span', 'lg'); lg.innerHTML = ICON.logo; head.appendChild(lg); // static, trusted markup
    head.appendChild(h('b', null, 'Codextent · Solve later'));
    head.appendChild(h('span', null, mark && mark.st === 'todo' ? 'Saved' : mark && mark.st === 'done' ? 'Solved' : 'Not saved'));
    pop.appendChild(head);
    pop.appendChild(h('div', 'title', (info.id ? info.id + '. ' : '') + (info.title || info.slug)));
    var meta = h('div', 'meta');
    if (info.difficulty) meta.appendChild(h('span', 'tag d-' + info.difficulty.toLowerCase(), info.difficulty));
    (info.tags || []).slice(0, 4).forEach(function (t) { meta.appendChild(h('span', 'tag', t)); });
    pop.appendChild(meta);
    var ta = h('textarea'); ta.placeholder = 'Your idea for later… e.g. "sort + two pointers", "prefix sum, watch negatives"';
    ta.maxLength = L.MAX_NOTE; ta.value = mark ? mark.n || '' : ''; ta.setAttribute('aria-label', 'Your idea note');
    pop.appendChild(ta);
    var row = h('div', 'row');
    var save = h('button', 'save', mark && mark.st === 'todo' ? 'Update note' : 'Save for later'); save.type = 'button';
    var status = h('span', 'status');
    row.appendChild(save);
    if (mark && mark.st === 'todo') {
      var done = h('button', 'ghost done', 'Mark solved'); done.type = 'button';
      done.addEventListener('click', async function () { state.mark = await L.markDone(state.slug); status.textContent = 'Marked solved ✓'; renderChip(); setTimeout(close, 700); });
      row.appendChild(done);
      var rm = h('button', 'ghost', 'Remove'); rm.type = 'button';
      rm.addEventListener('click', async function () {
        if (!rm.dataset.armed) { rm.dataset.armed = '1'; rm.textContent = 'Sure?'; return; }
        await L.removeMark(state.slug); state.mark = null; renderChip(); close();
      });
      row.appendChild(rm);
    }
    row.appendChild(status);
    pop.appendChild(row);
    pop.appendChild(h('div', 'sync', 'Syncs to every Chrome signed in to the same Google account. On a shared college PC, sign out of Chrome when you leave.'));
    save.addEventListener('click', async function () {
      save.disabled = true; status.textContent = 'Saving…';
      try {
        state.mark = await L.saveMark(Object.assign({}, info, { note: ta.value }));
        status.textContent = 'Saved ✓'; renderChip(); setTimeout(close, 700);
      } catch (e) { status.textContent = /QUOTA/i.test(String(e)) ? 'Sync storage is full. Mark some problems solved.' : 'Could not save: ' + (e && e.message || e); }
      save.disabled = false;
    });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save.click(); } if (e.key === 'Escape') close(); });
    setTimeout(function () { ta.focus(); }, 0);
  }
  function toggle() { var p = state.host.__ui.pop; if (p.classList.contains('show')) close(); else { renderPop(); p.classList.add('show'); state.host.__ui.chip.setAttribute('aria-expanded', 'true'); } }
  function close() { if (!state.host) return; state.host.__ui.pop.classList.remove('show'); state.host.__ui.chip.setAttribute('aria-expanded', 'false'); }
  document.addEventListener('click', function () { close(); });

  /** Put the chip in LeetCode's chip row (after Easy · Topics · Companies · Hint); else float it. */
  function place() {
    if (!state.host) state.host = build();
    var d = chipRowDifficulty(), row = d && d.parentElement;
    if (row) {
      if (state.host.parentElement !== row) { state.host.removeAttribute('data-lc-float'); row.appendChild(state.host); }
    } else if (!state.host.isConnected) {
      state.host.setAttribute('data-lc-float', '');
      document.body.appendChild(state.host);
    }
    state.host.setAttribute('data-lc-theme', theme());
  }

  async function onPage() {
    var slug = L.slugFromPath(location.pathname);
    if (slug === state.slug && state.info) { if (state.info.allowed) place(); return; }
    state.slug = slug; state.info = null; state.mark = null;
    if (state.host) { close(); state.host.remove(); }
    if (!slug || state.loading) return;
    state.loading = true;
    try {
      var info = await fetchInfo(slug);
      if (slug !== state.slug) return;
      info.allowed = L.allowed(info.tags);
      state.info = info;
      if (!info.allowed) return;            // Array problems only for now
      state.mark = await L.getMark(slug);
      place(); renderChip();
    } finally { state.loading = false; }
  }

  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (!state.slug || !state.host) return;
      if ((area === 'sync' && ch[L.PREFIX + state.slug]) || (area === 'local' && ch[L.DONE_KEY])) {
        L.getMark(state.slug).then(function (m) { state.mark = m; renderChip(); });
      }
    });
  } catch (e) { /* tests */ }

  // LeetCode is a single-page app: check the URL and keep the chip attached when React re-renders
  onPage();
  setInterval(onPage, 900);
})();

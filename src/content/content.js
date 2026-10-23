/*
 * OutputIQ — content script (GeeksforGeeks, Programiz, W3Schools, TutorialsPoint).
 *
 * After each runnable C / C++ / Java / Python example it inserts ONE small logo button.
 * Clicking the logo opens a slim horizontal bar:  [logo] [lang] [answer…] [Check] (✓/✗) [details] [next] [close]
 * with a one-line result underneath. Full details open inline (never an overlay).
 * All UI lives in a Shadow DOM; code is sent for execution only when the user clicks Check.
 */
(function () {
  'use strict';
  var OQ = globalThis.OutputIQ;
  if (!OQ || !OQ.detector || window.__outputiqLoaded) return;
  window.__outputiqLoaded = true;

  var adapter = OQ.adapters.adapterFor(location);
  var processed = new WeakSet();

  // Codextent mark: < ⚡ > on a black rounded tile
  // Codextent mark: < ⚡ > on a rounded tile; colours follow the theme (CSS variables of the shadow host)
  var LOGO_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x=".5" y=".5" width="31" height="31" rx="8" style="fill:var(--bg);stroke:var(--line)"/>' +
    '<g transform="translate(2.2 2.2) scale(0.064)"><path d="M156 112 L66 268 L156 424" transform="translate(-40 -52)" style="fill:none;stroke:var(--ink)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M356 112 L446 268 L356 424" transform="translate(-40 -52)" style="fill:none;stroke:var(--ink)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M288 92 L186 292 L250 292 L222 444 L330 236 L266 236 Z" transform="translate(-40 -52)" style="fill:var(--ink);stroke:var(--ink)" stroke-width="6"/></g></svg>';

  // ---------- theme (Settings → Appearance): dark | light | auto | night ----------
  var themeChoice = 'dark';
  var themeMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function resolvedTheme() { return themeChoice === 'auto' ? (themeMq && !themeMq.matches ? 'light' : 'dark') : themeChoice; }
  function applyTheme() {
    var t = resolvedTheme();
    document.querySelectorAll('[data-outputiq-host]').forEach(function (h) { h.setAttribute('data-theme', t); });
  }
  try {
    chrome.storage.local.get('ui').then(function (d) { themeChoice = (d.ui && d.ui.theme) || 'dark'; applyTheme(); });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area === 'local' && ch.ui) { themeChoice = (ch.ui.newValue && ch.ui.newValue.theme) || 'dark'; applyTheme(); }
    });
    if (themeMq && themeMq.addEventListener) themeMq.addEventListener('change', applyTheme);
  } catch (e) { /* storage unavailable (tests): default dark */ }


  function reportTheme() {
    try { chrome.runtime.sendMessage({ type: 'THEME', dark: matchMedia('(prefers-color-scheme: dark)').matches }); } catch (e) { /* extension reloaded */ }
  }
  reportTheme();
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reportTheme); } catch (e) { /* old browsers */ }

  function isIgnored(el) {
    return adapter.ignoreSelector && el.closest(adapter.ignoreSelector);
  }

  function scan() {
    var blocks = OQ.detector.findCodeBlocks(document, adapter.extraSelector);
    blocks.forEach(function (block) {
      if (processed.has(block)) return;
      processed.add(block);
      if (isIgnored(block)) return;
      if (adapter.accept && !adapter.accept(block)) return;
      var brLayout = adapter.brLayout ? adapter.brLayout(block) : false;
      var code = OQ.detector.extractCode(block, adapter.extraStrip, { brLayout: brLayout });
      var hint = adapter.languageFor(block, location) || OQ.detector.languageHint(block);
      var info = OQ.detector.classifyCode(code, hint, { allowWrap: adapter.allowWrap || false, wrapLangs: adapter.wrapLangs });
      if (!info.isCode || !info.runnable) return;
      var runCode = info.needsWrap ? OQ.detector.wrapSnippet(code, info.language) : code;
      info.source = code;
      attach(block, runCode, info);
    });
  }

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function autoGrow(t) {
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 132) + 'px';
  }

  var ICONS = {
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6.5 13.5 12 19l5.5-5.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>'
  };

  function orderedBars() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-outputiq-host]'))
      .map(function (host) { return host.__oiq; })
      .filter(Boolean);
  }

  function attach(block, code, info) {
    var target = adapter.placementTarget(block);
    var host = document.createElement('div');
    host.setAttribute('data-outputiq-host', '');
    host.setAttribute('data-outputiq-lang', info.language);
    host.setAttribute('data-theme', resolvedTheme());
    // sites float their own run/copy buttons over code boxes: keep our bar above them and clear of them
    host.style.setProperty('position', 'relative', 'important');
    host.style.setProperty('z-index', '2147483000', 'important');
    if (adapter.barInset) host.style.setProperty('padding-right', adapter.barInset + 'px', 'important');
    target.insertAdjacentElement('afterend', host);
    var shadow = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = OQ.panelCss;
    shadow.appendChild(style);

    var langLabel = OQ.detector.LABELS[info.language];

    var bar = h('div', 'bar');
    shadow.appendChild(bar);

    var logo = h('button', 'logo');
    logo.type = 'button';
    logo.innerHTML = LOGO_SVG; // static, trusted markup
    logo.title = 'Predict the output (' + langLabel + ') — Codextent';
    logo.setAttribute('aria-label', 'Predict the output of this ' + langLabel + ' example');
    logo.setAttribute('aria-expanded', 'false');
    bar.appendChild(logo);

    var panel = h('div', 'panel');
    bar.appendChild(panel);
    panel.appendChild(h('span', 'lang', langLabel));

    var stdin = null;
    if (info.readsInput) {
      stdin = h('textarea', 'field stdin');
      stdin.rows = 1;
      stdin.spellcheck = false;
      stdin.placeholder = 'Input (stdin)';
      stdin.title = 'This program reads input. What you type here is fed to it.';
      stdin.setAttribute('aria-label', 'Program input (stdin)');
      panel.appendChild(stdin);
    }

    var answer = h('textarea', 'field answer');
    answer.rows = 1;
    answer.spellcheck = false;
    answer.placeholder = 'What will it print?';
    answer.title = 'Type the output. Enter checks, Shift+Enter adds a new line.';
    answer.setAttribute('aria-label', 'Your predicted output');
    panel.appendChild(answer);

    var check = h('button', 'check', 'Check');
    check.type = 'button';
    panel.appendChild(check);

    var verdict = h('span', 'verdict');
    verdict.setAttribute('role', 'img');
    panel.appendChild(verdict);

    var sep = h('span', 'sep'); sep.setAttribute('aria-hidden', 'true');
    panel.appendChild(sep);
    var moreBtn = h('button', 'icon');
    moreBtn.innerHTML = ICONS.info; // static, trusted markup
    moreBtn.type = 'button';
    moreBtn.title = 'Show details and the exact code that runs';
    moreBtn.setAttribute('aria-label', 'Details');
    moreBtn.setAttribute('aria-expanded', 'false');
    panel.appendChild(moreBtn);

    var nextBtn = h('button', 'icon');
    nextBtn.innerHTML = ICONS.down;
    nextBtn.type = 'button';
    nextBtn.title = 'Next example on this page';
    nextBtn.setAttribute('aria-label', 'Next example');
    panel.appendChild(nextBtn);

    var saveBtn = h('button', 'icon save');
    saveBtn.type = 'button';
    saveBtn.innerHTML = SAVE_SVG; // static, trusted markup
    saveBtn.title = 'Save this example to My Revision Vault';
    saveBtn.setAttribute('aria-label', 'Save to My Revision Vault');
    panel.appendChild(saveBtn);
    saveBtn.addEventListener('click', function () {
      saveSelection({ text: info.source || code, hint: info.language }, function (r) {
        if (r && r.ok) saveBtn.classList.add('saved');
      });
    });

    // ✎ notes for this example: saved with the code in My Revision Vault (shown under the code)
    var noteBtn = h('button', 'icon note');
    noteBtn.type = 'button';
    noteBtn.innerHTML = NOTE_SVG; // static, trusted markup
    noteBtn.title = 'Write a note for this example (saved with the code)';
    noteBtn.setAttribute('aria-label', 'Add a note to this example');
    noteBtn.setAttribute('aria-expanded', 'false');
    panel.appendChild(noteBtn);

    var closeBtn = h('button', 'icon close');
    closeBtn.innerHTML = ICONS.close;
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close');
    panel.appendChild(closeBtn);

    var msg = h('div', 'msg');
    msg.setAttribute('role', 'status');
    var msgText = h('span', 'text');
    var detailsLink = h('button', 'link', 'Details');
    detailsLink.type = 'button';
    var tagsEl = h('span', 'tags');
    msg.appendChild(msgText);
    msg.appendChild(tagsEl);
    msg.appendChild(detailsLink);
    shadow.appendChild(msg);

    var noteBox = noteEditor('Your note for this example… (Ctrl+Enter saves)', function (text, done) {
      saveSelection({ text: info.source || code, hint: info.language, notes: text }, function (r) {
        if (r && r.ok) { saveBtn.classList.add('saved'); noteBtn.classList.add('saved'); }
        done(r && r.ok);
      });
    });
    shadow.appendChild(noteBox.el);
    noteBtn.addEventListener('click', function () {
      var on = noteBox.toggle();
      noteBtn.setAttribute('aria-expanded', String(on));
    });

    var details = h('div', 'details');
    shadow.appendChild(details);
    var resultSlot = h('div');
    details.appendChild(resultSlot);
    var conceptSlot = h('div', 'concepts');
    details.appendChild(conceptSlot);
    var codeView = h('details');
    codeView.appendChild(h('summary', null, info.needsWrap
      ? 'Exact code that runs (this snippet was wrapped in main() for you)'
      : 'Exact code that runs'));
    codeView.appendChild(h('pre', null, code));
    details.appendChild(codeView);

    var api = {
      host: host,
      open: function (focus) {
        // start running now (while the learner types) so Check is near-instant; programs that read input wait for Check
        if (!bar.classList.contains('open') && !info.readsInput) {
          try { chrome.runtime.sendMessage({ type: 'PRERUN', language: info.language, code: code, stdin: '' }); } catch (e) { /* reloaded */ }
        }
        bar.classList.add('open');
        logo.setAttribute('aria-expanded', 'true');
        updateNext();
        if (focus) answer.focus();
      },
      close: function () {
        bar.classList.remove('open');
        msg.classList.remove('show');
        details.classList.remove('show');
        logo.setAttribute('aria-expanded', 'false');
      }
    };
    host.__oiq = api;

    function updateNext() {
      var all = orderedBars();
      nextBtn.disabled = all.indexOf(api) === all.length - 1;
      nextBtn.title = nextBtn.disabled ? 'This is the last example on this page' : 'Next example on this page';
    }

    /** Tags appear only AFTER answering (showing them earlier would give hints). */
    function showConcepts(ids) {
      tagsEl.textContent = '';
      conceptSlot.textContent = '';
      var list = (ids || []).map(function (id) { return OQ.concepts.get(info.language, id); }).filter(Boolean);
      if (!list.length) return;
      list.slice(0, 3).forEach(function (c) {
        var chip = h('span', 'chip', c.name.replace(/ \(.*\)$/, ''));
        chip.title = c.trap;
        tagsEl.appendChild(chip);
      });
      if (list.length > 3) tagsEl.appendChild(h('span', 'chip more', '+' + (list.length - 3)));

      conceptSlot.appendChild(h('div', 'colhead', 'Concepts in this example'));
      var ul = h('ul', 'traps');
      list.forEach(function (c) {
        var li = h('li');
        li.appendChild(h('b', null, c.name));
        li.appendChild(document.createTextNode(' — ' + c.trap));
        ul.appendChild(li);
      });
      conceptSlot.appendChild(ul);
    }

    function toggleDetails(show) {
      var on = show == null ? !details.classList.contains('show') : show;
      details.classList.toggle('show', on);
      moreBtn.setAttribute('aria-expanded', String(on));
      detailsLink.textContent = on ? 'Hide details' : 'Details';
    }

    logo.addEventListener('click', function () {
      if (bar.classList.contains('open')) api.close(); else api.open(true);
    });
    closeBtn.addEventListener('click', api.close);
    moreBtn.addEventListener('click', function () { toggleDetails(); });
    detailsLink.addEventListener('click', function () { toggleDetails(); });
    nextBtn.addEventListener('click', function () {
      var all = orderedBars();
      var next = all[all.indexOf(api) + 1];
      if (!next) return;
      next.host.scrollIntoView({ behavior: 'smooth', block: 'center' });
      next.open(true);
    });

    [answer, stdin].forEach(function (t) {
      if (!t) return;
      t.addEventListener('input', function () { autoGrow(t); });
      // keep page shortcuts (search, tab switching) from firing while typing
      ['keydown', 'keyup', 'keypress'].forEach(function (ev) { t.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    });
    answer.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check.click(); }
      if (e.key === 'Escape') api.close();
    });

    check.addEventListener('click', function () {
      if (check.disabled) return;
      check.disabled = true;
      verdict.className = 'verdict busy';
      verdict.textContent = '';
      verdict.appendChild(h('span', 'spinner'));
      verdict.setAttribute('aria-label', 'Running');
      msg.className = 'msg';

      var prediction = answer.value;
      chrome.runtime.sendMessage({
        type: 'CHECK_PREDICTION',
        language: info.language,
        code: code,
        stdin: stdin ? stdin.value : '',
        prediction: prediction,
        wrapped: !!info.needsWrap,
        site: adapter.id,
        url: location.href,
        pageTitle: document.title
      }, function (response) {
        check.disabled = false;
        if (chrome.runtime.lastError) response = { ok: false, error: 'The extension was reloaded. Refresh this page and try again.' };
        var s = OQ.render.summarize(response);
        verdict.className = 'verdict ' + s.state;
        verdict.textContent = s.symbol;
        verdict.setAttribute('aria-label', s.label);
        verdict.title = s.label;
        msg.className = 'msg show ' + s.state;
        msgText.textContent = s.text;
        msgText.title = s.text;
        resultSlot.textContent = '';
        resultSlot.appendChild(OQ.render.renderResult(document, response, prediction));
        showConcepts(response && response.attempt && response.attempt.concepts);
        if (response && response.ok && response.run && response.run.category !== 'network_error') revealFor(block, host);
        if (s.state !== 'ok' && details.classList.contains('show')) toggleDetails(true);
      });
    });
  }

  // ---------------------------------------------------------------- Code Clipper
  var SAVE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z"/></svg>';
  var CODE_SEL = 'pre, code, textarea, div.syntaxhighlighter' + (adapter.extraSelector ? ',' + adapter.extraSelector : '');

  /** The current selection with its line breaks, plus a language hint from the code block it is in. */
  function readSelection() {
    var text = '', el = null;
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT') && !ae.closest('[data-outputiq-host]') && ae.selectionEnd > ae.selectionStart) {
      text = ae.value.slice(ae.selectionStart, ae.selectionEnd);
      el = ae;
    } else {
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount) {
        text = sel.toString();
        var node = sel.getRangeAt(0).commonAncestorContainer;
        el = node.nodeType === 1 ? node : node.parentElement;
      }
    }
    if (!text || !text.trim()) return null;
    var block = el && el.closest ? el.closest(CODE_SEL) : null;
    var hint = null;
    if (block) hint = adapter.languageFor(block, location) || OQ.detector.languageHint(block);
    if (!hint || hint === 'other') hint = (OQ.adapters.pathLanguage && OQ.adapters.pathLanguage(location)) || null;
    return { text: text, hint: hint === 'other' ? null : hint };
  }

  var toastHost = null, toastTimer = null;
  function toast(text, opts) {
    opts = opts || {};
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.setAttribute('data-outputiq-host', '');
      toastHost.setAttribute('data-outputiq-toast', '');
      toastHost.setAttribute('data-theme', resolvedTheme());
      var sh = toastHost.attachShadow({ mode: 'open' });
      var st = document.createElement('style');
      st.textContent = OQ.panelCss + TOAST_CSS;
      sh.appendChild(st);
      var box = h('div', 'toast');
      box.setAttribute('role', 'status');
      sh.appendChild(box);
      toastHost.__box = box;
      document.documentElement.appendChild(toastHost);
    }
    var b = toastHost.__box;
    b.textContent = '';
    b.className = 'toast show' + (opts.error ? ' err' : '');
    var icon = h('span', 'ti', opts.error ? '!' : '✓');
    b.appendChild(icon);
    var t = h('span', 'tt');
    t.appendChild(h('b', null, text));
    if (opts.sub) t.appendChild(h('small', null, opts.sub));
    b.appendChild(t);
    if (opts.id) {
      var open = h('button', 'topen', 'Open vault');
      open.type = 'button';
      open.addEventListener('click', function () { try { chrome.runtime.sendMessage({ type: 'OPEN_VAULT', id: opts.id }); } catch (e) { /* reloaded */ } });
      b.appendChild(open);
    }
    var x = h('button', 'tx', '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', function () { b.classList.remove('show'); });
    b.appendChild(x);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { b.classList.remove('show'); }, 5000);
  }
  var TOAST_CSS = `
:host([data-outputiq-toast]) { all: initial; position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; margin: 0; display: block;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", Inter, Roboto, sans-serif; font-size: 13px; }
.toast { display: none; align-items: center; gap: 10px; max-width: 380px; padding: 9px 10px 9px 10px; border-radius: 14px; color: var(--ink);
  background: var(--bg); background-image: var(--bg-grad); border: 1px solid var(--line); box-shadow: var(--shadow), 0 18px 40px -16px rgba(0,0,0,.55); }
.toast.show { display: flex; animation: up .22s ease; }
.toast:hover { box-shadow: var(--glow); }
@keyframes up { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
.ti { flex: none; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; background: var(--ok); color: var(--ok-ink); }
.toast.err .ti { background: transparent; color: var(--warn); box-shadow: inset 0 0 0 2px var(--warn); border-radius: 7px; }
.tt { display: grid; min-width: 0; line-height: 1.35; }
.tt b { font-weight: 600; } .tt small { color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topen { flex: none; height: 28px; padding: 0 12px; border: 0; border-radius: 999px; background: var(--brand); color: var(--brand-ink); font: inherit; font-weight: 600; font-size: 12.5px; cursor: pointer; }
.tx { flex: none; width: 24px; height: 24px; border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 16px; border-radius: 6px; }
.tx:hover { color: var(--ink); background: var(--field); }
`;

  function saveSelection(payload, done) {
    try {
      chrome.runtime.sendMessage({ type: 'SAVE_CLIP', text: payload.text, hint: payload.hint, kind: payload.kind, notes: payload.notes || '', url: location.href, pageTitle: document.title }, function (r) {
        if (chrome.runtime.lastError || !r) r = { ok: false, error: 'The extension was reloaded. Refresh this page and try again.' };
        if (!r.ok) toast(r.error || 'Could not save.', { error: true });
        else {
          var c = r.clip, lang = c.kind === 'note' ? 'Note' : c.kind === 'text' ? 'Key point' : (OQ.detector.LABELS[c.language] || 'Text');
          var concept = c.concept && OQ.concepts.get(c.language, c.concept);
          var head = c.kind === 'note' ? 'Note saved to My Revision Vault'
            : r.updated ? 'Note added to your saved ' + (c.kind === 'text' ? 'key point' : 'code')
            : r.duplicate ? 'Already in your Revision Vault'
            : (c.kind === 'text' ? 'Key point saved' : 'Saved to My Revision Vault') + (payload.notes ? ' with your note' : '');
          toast(head, { id: c.id, sub: lang + (concept ? ' · ' + concept.name : '') + (c.topic ? ' · ' + c.topic : '') });
        }
        if (done) done(r);
      });
    } catch (e) {
      toast('The extension was reloaded. Refresh this page and try again.', { error: true });
      if (done) done({ ok: false });
    }
  }

  // ---------------------------------------------------------------- Notes + key points (GfG, W3Schools)
  var NOTE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M5 4.5h10l4 4V19.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 14h8M8 18h5"/></svg>';
  var POINT_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round"><circle cx="5" cy="7" r="1.4" style="fill:currentColor"/><circle cx="5" cy="12" r="1.4" style="fill:currentColor"/><circle cx="5" cy="17" r="1.4" style="fill:currentColor"/><path d="M9.5 7H20M9.5 12H20M9.5 17h7"/></svg>';

  /** Small note editor (textarea + Save/Cancel). onSave(text, done(ok)). */
  function noteEditor(placeholder, onSave) {
    var wrap = h('div', 'notebox');
    var ta = h('textarea', 'field notearea');
    ta.rows = 3; ta.placeholder = placeholder; ta.spellcheck = true;
    ta.setAttribute('aria-label', 'Note');
    var row = h('div', 'noterow');
    var save = h('button', 'savenote', 'Save note'); save.type = 'button';
    var cancel = h('button', 'link', 'Cancel'); cancel.type = 'button';
    var status = h('span', 'notestatus');
    row.appendChild(save); row.appendChild(cancel); row.appendChild(status);
    wrap.appendChild(ta); wrap.appendChild(row);
    ['keydown', 'keyup', 'keypress'].forEach(function (ev) { ta.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save.click(); }
      if (e.key === 'Escape') api.toggle(false);
    });
    save.addEventListener('click', function () {
      if (!ta.value.trim()) { status.textContent = 'Write something first.'; ta.focus(); return; }
      save.disabled = true; status.textContent = 'Saving…';
      onSave(ta.value.trim(), function (ok) {
        save.disabled = false;
        status.textContent = ok ? 'Saved ✓' : '';
        if (ok) { ta.value = ''; setTimeout(function () { api.toggle(false); status.textContent = ''; }, 900); }
      });
    });
    var api = {
      el: wrap, textarea: ta,
      toggle: function (show) {
        var on = show == null ? !wrap.classList.contains('show') : show;
        wrap.classList.toggle('show', on);
        if (on) ta.focus();
        return on;
      }
    };
    cancel.addEventListener('click', function () { api.toggle(false); });
    return api;
  }

  // Floating tools when you select text on the page: [• Key point] [✎ Note] (or [Save code] inside a code block)
  var selHost = null, selUi = null, selPayload = null;
  function selTools() {
    if (selHost) return selUi;
    selHost = document.createElement('div');
    selHost.setAttribute('data-outputiq-host', '');
    selHost.setAttribute('data-outputiq-seltools', '');
    selHost.setAttribute('data-theme', resolvedTheme());
    var sh = selHost.attachShadow({ mode: 'open' });
    var st = document.createElement('style');
    st.textContent = OQ.panelCss + SEL_CSS;
    sh.appendChild(st);
    var box = h('div', 'seltools');
    var point = h('button', 'stool point'); point.type = 'button';
    point.innerHTML = POINT_SVG; point.appendChild(document.createTextNode('Key point'));
    point.title = 'Save the selected text as a key point in My Revision Vault';
    var note = h('button', 'stool note'); note.type = 'button';
    note.innerHTML = NOTE_SVG; note.appendChild(document.createTextNode('Note'));
    note.title = 'Save the selection with your own note';
    box.appendChild(point); box.appendChild(note);
    var editor = noteEditor('Your note about this… (Ctrl+Enter saves)', function (text, done) {
      saveSelection(Object.assign({}, selPayload, { notes: text }), function (r) { done(r && r.ok); if (r && r.ok) setTimeout(hideSel, 900); });
    });
    var pop = h('div', 'selpop');
    pop.appendChild(box); pop.appendChild(editor.el);
    sh.appendChild(pop);
    // keep the page selection while clicking our buttons
    pop.addEventListener('mousedown', function (e) { if (e.target.tagName !== 'TEXTAREA') e.preventDefault(); e.stopPropagation(); });
    point.addEventListener('click', function () {
      if (!selPayload) return;
      saveSelection(selPayload, function () { hideSel(); });
    });
    note.addEventListener('click', function () { editor.toggle(true); });
    document.documentElement.appendChild(selHost);
    selUi = { host: selHost, point: point, note: note, editor: editor, pop: pop };
    return selUi;
  }
  function hideSel() {
    if (!selHost) return;
    selHost.style.display = 'none';
    selUi.editor.toggle(false);
    selPayload = null;
  }
  function showSelTools() {
    if (!adapter.selectionTools) return;
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hideSel();
    var text = sel.toString();
    if (!text || text.trim().length < 3) return hideSel();
    var range = sel.getRangeAt(0);
    var node = range.commonAncestorContainer;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || el.closest('[data-outputiq-host], input, textarea, [contenteditable="true"]')) return;
    var inCode = !!el.closest(CODE_SEL);
    var p = readSelection();
    selPayload = inCode ? { text: p ? p.text : text, hint: p && p.hint } : { text: text.replace(/\s+\n/g, '\n').trim(), kind: 'text' };
    var ui = selTools();
    ui.point.lastChild.textContent = inCode ? 'Save code' : 'Key point';
    ui.point.title = inCode ? 'Save the selected code to My Revision Vault' : 'Save the selected text as a key point in My Revision Vault';
    ui.editor.toggle(false);
    var rect = range.getBoundingClientRect ? range.getBoundingClientRect() : (el.getBoundingClientRect ? el.getBoundingClientRect() : { top: 0, bottom: 0, left: 0, width: 0 });
    var top = rect.top + window.scrollY - 44, left = rect.left + window.scrollX + rect.width / 2;
    if (rect.top < 56) top = rect.bottom + window.scrollY + 8;
    selHost.style.cssText = 'position:absolute !important;z-index:2147483646 !important;margin:0 !important;display:block !important;' +
      'top:' + Math.max(0, top) + 'px !important;left:' + Math.max(8, Math.min(left - 110, document.documentElement.clientWidth - 330)) + 'px !important;';
  }
  var SEL_CSS = `
:host([data-outputiq-seltools]) { all: initial; }
.selpop { display: grid; gap: 6px; width: max-content; max-width: 320px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif; }
.seltools { display: inline-flex; gap: 2px; padding: 3px; border-radius: 12px; background: var(--bg); background-image: var(--bg-grad); border: 1px solid var(--line); box-shadow: var(--shadow), 0 12px 30px -12px rgba(0,0,0,.55); }
.stool { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border: 0; border-radius: 9px; background: transparent; color: var(--ink); font-family: inherit; font-size: 12.5px; font-weight: 600; line-height: 1; cursor: pointer; }
.stool:hover { background: var(--field); box-shadow: var(--glow); }
.stool.point { background: var(--brand); color: var(--brand-ink); }
.notebox { margin: 0; }
`;
  if (adapter.selectionTools) {
    document.addEventListener('mouseup', function (e) {
      if (selHost && e.composedPath && e.composedPath().indexOf(selHost) !== -1) return;
      setTimeout(showSelTools, 10);
    });
    document.addEventListener('keyup', function (e) { if (e.shiftKey || e.key === 'Shift') setTimeout(showSelTools, 10); });
    document.addEventListener('mousedown', function (e) {
      if (selHost && e.composedPath && e.composedPath().indexOf(selHost) !== -1) return;
      hideSel();
    });
    window.addEventListener('scroll', function () { if (selHost && !selUi.editor.el.classList.contains('show')) hideSel(); }, { passive: true });
  }

  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || sender.id !== chrome.runtime.id) return false;
      if (msg.type === 'NOTE_REQUEST') {
        // popup → "Note": a note on its own, filed under this page's topic
        saveSelection({ kind: 'note', text: '', notes: String(msg.notes || '') }, sendResponse);
        return true;
      }
      if (msg.type === 'PAGE_INFO') { sendResponse({ ok: true, title: document.title, url: location.href, supported: true }); return false; }
      if (msg.type !== 'CLIP_REQUEST') return false;
      var p = readSelection();
      if (!p && msg.fallbackText) p = { text: msg.fallbackText, hint: (OQ.adapters.pathLanguage && OQ.adapters.pathLanguage(location)) || null };
      if (!p) {
        toast('Select some code or text first', { error: true, sub: 'Then right-click → Save to My Revision Vault' });
        sendResponse({ ok: false, error: 'Select some code or text on the page first.' });
        return false;
      }
      saveSelection(p, sendResponse);
      return true;
    });
  } catch (e) { /* tests without chrome.runtime.onMessage */ }

  // ---------------------------------------------------------------- Spoiler guard (blur the site's answers)
  // Toggle: popup → "Blur outputs" (chrome.storage.local "spoiler": {on}). Click a blurred box to peek;
  // checking an example reveals its own answer.
  var spoilerOn = false;
  var SPOILER_CSS = '.cx-spoiler:not(.cx-revealed){filter:blur(7px) !important;cursor:pointer !important;user-select:none !important;transition:filter .2s}' +
    '.cx-spoiler:not(.cx-revealed):hover{filter:blur(5px) !important}' +
    'div.cx-spoiler:not(.cx-revealed),pre.cx-spoiler:not(.cx-revealed){position:relative}';
  function spoilerStyle() {
    if (document.getElementById('cx-spoiler-style')) return;
    var st = document.createElement('style');
    st.id = 'cx-spoiler-style';
    st.textContent = SPOILER_CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function applySpoilers() {
    if (!adapter.spoilers) return;
    if (spoilerOn) spoilerStyle();
    adapter.spoilers(document).forEach(function (el) {
      if (el.__cxSpoiler) return;
      el.__cxSpoiler = true;
      el.classList.add('cx-spoiler');
      el.title = 'Codextent: answer hidden — click to reveal';
      el.addEventListener('click', function (e) {
        if (!spoilerOn || el.classList.contains('cx-revealed')) return;
        e.preventDefault(); e.stopPropagation();
        el.classList.add('cx-revealed');
        el.removeAttribute('title');
      }, true);
    });
    document.documentElement.classList.toggle('cx-spoilers-on', spoilerOn);
    var st = document.getElementById('cx-spoiler-style');
    if (!spoilerOn && st) st.remove();   // off: no blur style on the page at all
  }
  /** Reveal the answer that belongs to this example: inside its code block, or the first one after it (before the next example). */
  function revealFor(block, host) {
    var outs = document.querySelectorAll('.cx-spoiler:not(.cx-revealed)');
    var hosts = orderedBars().map(function (b) { return b.host; });
    var next = hosts[hosts.indexOf(host) + 1];
    for (var i = 0; i < outs.length; i++) {
      var o = outs[i];
      var inside = block.contains(o);
      var after = host.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING;
      var beforeNext = !next || (next.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_PRECEDING);
      if (inside || (after && beforeNext)) { o.classList.add('cx-revealed'); o.removeAttribute('title'); if (!inside) break; }
    }
  }
  try {
    chrome.storage.local.get('spoiler').then(function (d) { spoilerOn = !!(d.spoiler && d.spoiler.on); applySpoilers(); });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== 'local' || !ch.spoiler) return;
      spoilerOn = !!(ch.spoiler.newValue && ch.spoiler.newValue.on);
      if (spoilerOn) document.querySelectorAll('.cx-revealed').forEach(function (o) { o.classList.remove('cx-revealed'); o.title = 'Codextent: answer hidden — click to reveal'; });
      applySpoilers();
    });
  } catch (e) { /* tests without storage */ }

  scan();
  applySpoilers();
  // GfG fills some articles in after load: look again a few times
  [800, 2000, 4000].forEach(function (ms) { setTimeout(applySpoilers, ms); });

  // Pages can load tabs/content after the first paint: rescan on DOM changes (debounced).
  var timer = null;
  new MutationObserver(function (mutations) {
    var relevant = mutations.some(function (m) {
      return Array.prototype.some.call(m.addedNodes, function (n) {
        return n.nodeType === 1 && !(n.hasAttribute && n.hasAttribute('data-outputiq-host'));
      });
    });
    if (!relevant) return;
    clearTimeout(timer);
    timer = setTimeout(function () { scan(); applySpoilers(); }, 400);
  }).observe(document.body, { childList: true, subtree: true });
})();

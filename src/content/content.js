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
    answer.placeholder = 'What will it print?  (Shift+Enter = new line)';
    answer.setAttribute('aria-label', 'Your predicted output');
    panel.appendChild(answer);

    var check = h('button', 'check', 'Check');
    check.type = 'button';
    panel.appendChild(check);

    var verdict = h('span', 'verdict');
    verdict.setAttribute('role', 'img');
    panel.appendChild(verdict);

    var moreBtn = h('button', 'icon', 'ⓘ');
    moreBtn.type = 'button';
    moreBtn.title = 'Show details and the exact code that runs';
    moreBtn.setAttribute('aria-label', 'Details');
    moreBtn.setAttribute('aria-expanded', 'false');
    panel.appendChild(moreBtn);

    var nextBtn = h('button', 'icon', '↓');
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

    var closeBtn = h('button', 'icon', '×');
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
      chrome.runtime.sendMessage({ type: 'SAVE_CLIP', text: payload.text, hint: payload.hint, url: location.href, pageTitle: document.title }, function (r) {
        if (chrome.runtime.lastError || !r) r = { ok: false, error: 'The extension was reloaded. Refresh this page and try again.' };
        if (!r.ok) toast(r.error || 'Could not save.', { error: true });
        else {
          var c = r.clip, lang = OQ.detector.LABELS[c.language] || 'Text';
          var concept = c.concept && OQ.concepts.get(c.language, c.concept);
          toast(r.duplicate ? 'Already in your Revision Vault' : 'Saved to My Revision Vault', { id: c.id, sub: lang + (concept ? ' · ' + concept.name : '') + (c.topic ? ' · ' + c.topic : '') });
        }
        if (done) done(r);
      });
    } catch (e) {
      toast('The extension was reloaded. Refresh this page and try again.', { error: true });
      if (done) done({ ok: false });
    }
  }

  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || msg.type !== 'CLIP_REQUEST' || sender.id !== chrome.runtime.id) return false;
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

  scan();

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
    timer = setTimeout(scan, 400);
  }).observe(document.body, { childList: true, subtree: true });
})();

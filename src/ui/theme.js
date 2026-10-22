/*
 * Codextent — applies the chosen theme to extension pages (dashboard, popup, settings).
 * Stored in chrome.storage.local under "ui": { theme: 'dark' | 'light' | 'auto' | 'night' }  (default: dark).
 * 'auto' follows the operating system's light/dark setting. Sets <html data-theme="dark|light|night">.
 */
(function (root) {
  'use strict';
  var THEMES = ['dark', 'light', 'auto', 'night'];
  var chosen = 'dark';
  var mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolve(t) { return t === 'auto' ? (mq && !mq.matches ? 'light' : 'dark') : (THEMES.indexOf(t) !== -1 ? t : 'dark'); }
  function apply() {
    var r = resolve(chosen);
    document.documentElement.setAttribute('data-theme', r);
    document.documentElement.setAttribute('data-theme-choice', chosen);
    root.dispatchEvent(new CustomEvent('codextent-theme', { detail: { theme: r, choice: chosen } }));
  }
  function load() {
    try {
      chrome.storage.local.get('ui').then(function (d) { chosen = (d.ui && d.ui.theme) || 'dark'; apply(); });
      chrome.storage.onChanged.addListener(function (ch, area) {
        if (area === 'local' && ch.ui) { chosen = (ch.ui.newValue && ch.ui.newValue.theme) || 'dark'; apply(); }
      });
    } catch (e) { apply(); }
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (chosen === 'auto') apply(); });
  }
  apply();
  load();

  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.theme = {
    THEMES: THEMES,
    resolve: resolve,
    get: function () { return chosen; },
    set: function (t) { chosen = THEMES.indexOf(t) !== -1 ? t : 'dark'; apply(); return chrome.storage.local.set({ ui: { theme: chosen } }); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

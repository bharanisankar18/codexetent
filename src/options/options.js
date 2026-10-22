(function () {
  'use strict';
  var DEFAULTS = globalThis.OutputIQ.judge0.DEFAULT_SETTINGS;
  var PRESETS = {
    public: { endpoint: 'https://ce.judge0.com', authMode: 'none' },
    rapidapi: { endpoint: 'https://judge0-ce.p.rapidapi.com', authMode: 'rapidapi' }
  };
  // Hosts already granted in manifest.json host_permissions
  var BUILT_IN_ORIGINS = ['https://ce.judge0.com', 'https://judge0-ce.p.rapidapi.com'];
  var $ = function (id) { return document.getElementById(id); };
  var current = null; // last loaded settings (keeps fields that have no input, e.g. wandboxEndpoint)

  if (new URLSearchParams(location.search).get('welcome')) $('welcome').classList.remove('hidden');

  function status(text, kind) {
    var s = $('status');
    s.textContent = text;
    s.className = 'notice ' + (kind || 'info');
  }

  function presetFor(s) {
    if (s.endpoint === PRESETS.public.endpoint && s.authMode === 'none') return 'public';
    if (s.endpoint === PRESETS.rapidapi.endpoint && s.authMode === 'rapidapi') return 'rapidapi';
    return 'custom';
  }

  function updateKeyVisibility() {
    $('keyWrap').classList.toggle('hidden', $('authMode').value === 'none');
  }

  function fill(s) {
    $('endpoint').value = s.endpoint;
    $('authMode').value = s.authMode;
    $('apiKey').value = s.apiKey || '';
    ['c', 'cpp', 'java', 'python', 'sql'].forEach(function (l) {
      $('id_' + l).value = globalThis.OutputIQ.judge0.languageIdFor(s, l);
    });
    $('lenient').checked = s.lenientTrailingSpaces !== false;
    $('runner').value = s.runner === 'judge0' ? 'judge0' : 'auto';
    current = s;
    $('preset').value = presetFor(s);
    updateKeyVisibility();
  }

  function read() {
    return {
      endpoint: $('endpoint').value.trim().replace(/\/+$/, ''),
      authMode: $('authMode').value,
      apiKey: $('apiKey').value.trim(),
      languageIds: {
        c: Number($('id_c').value) || DEFAULTS.languageIds.c,
        cpp: Number($('id_cpp').value) || DEFAULTS.languageIds.cpp,
        java: Number($('id_java').value) || DEFAULTS.languageIds.java,
        python: Number($('id_python').value) || DEFAULTS.languageIds.python,
        sql: Number($('id_sql').value) || DEFAULTS.languageIds.sql
      },
      lenientTrailingSpaces: $('lenient').checked,
      runner: $('runner').value === 'judge0' ? 'judge0' : 'auto',
      wandboxEndpoint: (current && current.wandboxEndpoint) || DEFAULTS.wandboxEndpoint
    };
  }

  async function load() {
    var data = await chrome.storage.local.get('settings');
    fill(Object.assign({}, DEFAULTS, data.settings || {}));
  }

  $('preset').addEventListener('change', function () {
    var p = PRESETS[$('preset').value];
    if (p) { $('endpoint').value = p.endpoint; $('authMode').value = p.authMode; }
    updateKeyVisibility();
  });
  $('authMode').addEventListener('change', updateKeyVisibility);
  $('showKey').addEventListener('change', function () { $('apiKey').type = this.checked ? 'text' : 'password'; });

  /** Ask Chrome for permission to call a custom server. Must run inside a click. */
  async function ensurePermission(endpoint) {
    var u;
    try { u = new URL(endpoint); } catch (e) { throw new Error('The server URL is not valid.'); }
    if (u.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) {
      throw new Error('Use an https:// URL (http is only allowed for localhost).');
    }
    if (BUILT_IN_ORIGINS.indexOf(u.origin) !== -1) return true;
    var granted = await chrome.permissions.request({ origins: [u.origin + '/*'] });
    if (!granted) throw new Error('Chrome permission to contact ' + u.origin + ' was not granted.');
    return true;
  }

  async function save() {
    var s = read();
    if (s.authMode !== 'none' && !s.apiKey) throw new Error('Enter an API key, or set Authentication to "None".');
    await ensurePermission(s.endpoint);
    await chrome.storage.local.set({ settings: s });
    $('preset').value = presetFor(s);
  }

  $('form').addEventListener('submit', async function (e) {
    e.preventDefault();
    try { await save(); status('Saved.', 'ok'); } catch (err) { status(err.message, 'bad'); }
  });

  $('test').addEventListener('click', async function () {
    var btn = this;
    try {
      await save();
    } catch (err) { status(err.message, 'bad'); return; }
    btn.disabled = true;
    status('Saved. Running a test program in C++, C, Java, Python and MySQL…', 'info');
    chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, function (res) {
      btn.disabled = false;
      if (chrome.runtime.lastError || !res) { status('No response from the background worker: ' + (chrome.runtime.lastError ? chrome.runtime.lastError.message : ''), 'bad'); return; }
      status(res.message, res.ok ? 'ok' : 'bad');
    });
  });

  $('reset').addEventListener('click', async function () {
    await chrome.storage.local.set({ settings: Object.assign({}, DEFAULTS) });
    fill(DEFAULTS);
    status('Reset to the free public server.', 'ok');
  });

  // ---------- appearance ----------
  function markTheme() {
    var cur = globalThis.OutputIQ.theme.get();
    document.querySelectorAll('[data-theme-choice]').forEach(function (b) {
      if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-choice') === cur));
    });
  }
  document.querySelectorAll('button[data-theme-choice]').forEach(function (b) {
    b.addEventListener('click', function () { globalThis.OutputIQ.theme.set(b.getAttribute('data-theme-choice')).then(markTheme); markTheme(); });
  });
  window.addEventListener('codextent-theme', markTheme);
  markTheme();

  load();
})();

(async function () {
  'use strict';
  var OQ = globalThis.OutputIQ;
  try { chrome.runtime.sendMessage({ type: 'THEME', dark: matchMedia('(prefers-color-scheme: dark)').matches }); } catch (e) { /* ignore */ }
  var LANG = { c: 'C', cpp: 'C++', java: 'Java', python: 'Python', sql: 'MySQL' };
  var SYM = { correct: ['\u2713', 'ok', 'Correct'], incorrect: ['\u2717', 'bad', 'Wrong'] };
  var data = await chrome.storage.local.get('attempts');
  var s = OQ.stats.computeStats(data.attempts || [], 5);
  var $ = function (id) { return document.getElementById(id); };

  $('accuracy').textContent = s.accuracy == null ? '–' : s.accuracy + '%';
  $('correct').textContent = s.correct;
  $('wrong').textContent = s.incorrect;
  $('streak').textContent = s.streak;
  if (s.needsRevision.length) $('revBadge').textContent = '· ' + s.needsRevision.length + ' to revise';

  s.byLanguage.filter(function (g) { return g.graded; }).forEach(function (g) {
    var t = document.createElement('span');
    var b = document.createElement('b');
    b.textContent = LANG[g.key] || g.key;
    t.appendChild(b);
    t.appendChild(document.createTextNode(' ' + g.accuracy + '%'));
    $('langs').appendChild(t);
  });

  if (!s.recent.length) $('emptyRecent').classList.remove('hidden');
  s.recent.forEach(function (a) {
    var li = document.createElement('li');
    var m = SYM[a.result] || ['!', 'warn', a.result.replace('_', ' ')];
    var sym = document.createElement('span');
    sym.className = 'sym ' + m[1];
    sym.textContent = m[0];
    sym.title = m[2];
    sym.setAttribute('aria-label', m[2]);
    var t = document.createElement('span');
    t.className = 't';
    t.textContent = OQ.ui.shortTitle(a);
    t.title = t.textContent;
    var w = document.createElement('span');
    w.className = 'w';
    w.textContent = (LANG[OQ.stats.languageOf(a)] || '') + ' · ' + OQ.ui.timeAgo(a.ts);
    li.appendChild(sym); li.appendChild(t); li.appendChild(w);
    $('recent').appendChild(li);
  });

  $('openDashboard').addEventListener('click', function () {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/dashboard.html') });
  });
  // ---- Code Clipper ----
  var HUB = 'src/dashboard/dashboard.html';
  var vs = OQ.vault.vaultStats((await chrome.storage.local.get('vault')).vault || []);
  if (vs.total) $('vaultBadge').textContent = vs.due ? '· ' + vs.due + ' due' : '· ' + vs.total;
  $('openVault').addEventListener('click', function () { chrome.tabs.create({ url: chrome.runtime.getURL(HUB + '#vault') }); });
  $('clipBtn').addEventListener('click', async function () {
    var msg = $('clipMsg');
    msg.className = 'cliphint';
    msg.textContent = 'Saving…';
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var r = null;
    try { r = await chrome.tabs.sendMessage(tabs[0].id, { type: 'CLIP_REQUEST' }, { frameId: 0 }); } catch (e) { r = null; }
    if (!r) { msg.textContent = 'Open a supported learning site (GfG, W3Schools, Programiz…), refresh it once, then select code.'; return; }
    if (!r.ok) { msg.textContent = r.error || 'Could not save.'; return; }
    msg.className = 'cliphint ok';
    msg.textContent = r.duplicate ? '✓ Already in your Revision Vault' : '✓ Saved to My Revision Vault';
  });

  $('openOptions').addEventListener('click', function () { chrome.runtime.openOptionsPage(); });
})();

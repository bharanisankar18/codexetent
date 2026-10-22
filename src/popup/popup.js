(async function () {
  'use strict';
  var OQ = globalThis.OutputIQ;
  try { chrome.runtime.sendMessage({ type: 'THEME', dark: matchMedia('(prefers-color-scheme: dark)').matches }); } catch (e) { /* ignore */ }
  var $ = function (id) { return document.getElementById(id); };
  var HUB = 'src/dashboard/dashboard.html';

  // Popup: accuracy · Clip selection / Revision Vault · correct / wrong / streak · My Learning Hub + Settings
  var s = OQ.stats.computeStats((await chrome.storage.local.get('attempts')).attempts || [], 5);
  $('accuracy').textContent = s.accuracy == null ? '–' : s.accuracy + '%';
  $('correct').textContent = s.correct;
  $('wrong').textContent = s.incorrect;
  $('streak').textContent = s.streak;

  $('openDashboard').addEventListener('click', function () { chrome.tabs.create({ url: chrome.runtime.getURL(HUB) }); });
  $('openVault').addEventListener('click', function () { chrome.tabs.create({ url: chrome.runtime.getURL(HUB + '#vault') }); });
  $('openOptions').addEventListener('click', function () { chrome.runtime.openOptionsPage(); });

  // ---- Code Clipper: save the selection on the current page ----
  $('clipBtn').addEventListener('click', async function () {
    var msg = $('clipMsg');
    msg.className = 'cliphint';
    msg.textContent = 'Saving…';
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var r = null;
    try { r = await chrome.tabs.sendMessage(tabs[0].id, { type: 'CLIP_REQUEST' }, { frameId: 0 }); } catch (e) { r = null; }
    if (!r) { msg.textContent = 'Open GfG or W3Schools (refresh once), select code, then clip.'; return; }
    if (!r.ok) { msg.textContent = r.error || 'Could not save.'; return; }
    msg.className = 'cliphint ok';
    msg.textContent = r.duplicate ? '✓ Already in your Revision Vault' : '✓ Saved to My Revision Vault';
  });
})();

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

  // ---- Note for this page (topic note, saved alone under the page's heading) ----
  async function activeTab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }
  $('noteBtn').addEventListener('click', async function () {
    var open = $('notePanel').classList.toggle('hidden') === false;
    this.setAttribute('aria-expanded', String(open));
    if (!open) return;
    var info = null;
    try { info = await chrome.tabs.sendMessage((await activeTab()).id, { type: 'PAGE_INFO' }, { frameId: 0 }); } catch (e) { info = null; }
    $('noteFor').textContent = info ? 'Note for: ' + info.title.replace(/\s*[-|–]\s*(GeeksforGeeks|W3Schools|Programiz|Tutorialspoint|TutorialsPoint|javatpoint|Javatpoint|Scaler Topics|Studytonight|Sanfoundry)\s*$/i, '') : 'Open a supported learning site (refresh it once) to add a note.';
    $('noteSave').disabled = !info;
    $('noteText').focus();
  });
  $('noteCancel').addEventListener('click', function () { $('notePanel').classList.add('hidden'); $('noteBtn').setAttribute('aria-expanded', 'false'); });
  $('noteText').addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('noteSave').click(); } });
  $('noteSave').addEventListener('click', async function () {
    var text = $('noteText').value.trim(), msg = $('clipMsg');
    if (!text) { $('noteText').focus(); return; }
    var r = null;
    try { r = await chrome.tabs.sendMessage((await activeTab()).id, { type: 'NOTE_REQUEST', notes: text }, { frameId: 0 }); } catch (e) { r = null; }
    msg.className = 'cliphint' + (r && r.ok ? ' ok' : '');
    msg.textContent = r && r.ok ? '✓ Note saved to My Revision Vault' : (r && r.error) || 'Open a supported learning site (refresh it once), then try again.';
    if (r && r.ok) { $('noteText').value = ''; $('notePanel').classList.add('hidden'); $('noteBtn').setAttribute('aria-expanded', 'false'); }
  });

  // LeetCode "Solve later" count (synced across PCs)
  try {
    var lc = (await OQ.leetcode.allMarks()).filter(function (m) { return m.st === 'todo'; }).length;
    $('lcCount').textContent = lc + ' to solve';
  } catch (e) { /* sync unavailable */ }
  $('lcRow').addEventListener('click', function () { chrome.tabs.create({ url: chrome.runtime.getURL(HUB + '#vault/lc') }); });

  // Spoiler guard switch
  $('spoiler').checked = !!(((await chrome.storage.local.get('spoiler')).spoiler || {}).on);
  $('spoiler').addEventListener('change', function () { chrome.storage.local.set({ spoiler: { on: this.checked } }); });

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
    if (!r) { msg.textContent = 'Open a supported learning site (refresh it once), select code, then clip.'; return; }
    if (!r.ok) { msg.textContent = r.error || 'Could not save.'; return; }
    msg.className = 'cliphint ok';
    msg.textContent = r.duplicate ? '✓ Already in your Revision Vault' : '✓ Saved to My Revision Vault';
  });
})();

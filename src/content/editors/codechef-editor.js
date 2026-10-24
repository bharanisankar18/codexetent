/*
 * Codextent editor adapter — CodeChef (runs in the PAGE, "world": "MAIN", so it can reach CodeChef's Ace editor).
 * CodeChef's IDE is Ace: <div id="submit-ide-v2" class="ace_editor …">, window.ace (checked live on /problems/FLOW001).
 * Talks to the extension's content script with window.postMessage:
 *   request  {__cx:'editor-req', id, op:'state'|'insert'|'replace', code}
 *   reply    {__cx:'editor-res', id, ok, language, text, error}
 * Never throws into the page: every failure becomes {ok:false, error}.
 */
(function () {
  'use strict';
  if (window.__cxEditorCodechef) return;
  window.__cxEditorCodechef = true;

  function editor() {
    if (!window.ace) return null;
    var el = document.getElementById('submit-ide-v2') || document.querySelector('.ace_editor');
    return el ? window.ace.edit(el) : null;
  }
  function language(ed) {
    var mode = String(ed.session.getMode().$id || '');
    if (/c_cpp/.test(mode)) return 'cpp';
    if (/javascript/.test(mode)) return 'javascript';
    if (/java/.test(mode)) return 'java';
    if (/python/.test(mode)) return 'python';
    return mode.replace('ace/mode/', '') || 'unknown';
  }
  function handle(req) {
    var ed = editor();
    if (!ed) return { ok: false, error: 'CodeChef editor not found. Open the problem\'s IDE tab first.' };
    if (req.op === 'state') return { ok: true, language: language(ed), text: ed.getValue() };
    if (req.op === 'replace') { ed.setValue(String(req.code), -1); ed.focus(); return { ok: true, language: language(ed) }; }
    if (req.op === 'insert') { ed.insert(String(req.code)); ed.focus(); return { ok: true, language: language(ed) }; }
    return { ok: false, error: 'Unknown request' };
  }
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.__cx !== 'editor-req') return;
    var res;
    try { res = handle(e.data); } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
    window.postMessage(Object.assign({ __cx: 'editor-res', id: e.data.id }, res), '*');
  });
})();

/*
 * Codextent editor adapter — LeetCode (runs in the PAGE, "world": "MAIN", so it can reach LeetCode's Monaco editor).
 * LeetCode's code editor is Monaco: window.monaco, monaco.editor.getEditors(); the code model has a language id
 * like "cpp" (a second "plaintext" editor is the test-case box). Checked live on /problems/two-sum.
 * Same postMessage protocol as codechef-editor.js. Edits go through executeEdits, so Ctrl+Z undoes them.
 */
(function () {
  'use strict';
  if (window.__cxEditorLeetcode) return;
  window.__cxEditorLeetcode = true;

  function editor() {
    var m = window.monaco;
    if (!m || !m.editor || !m.editor.getEditors) return null;
    var eds = m.editor.getEditors().filter(function (e) { return e.getModel(); });
    return eds.filter(function (e) { return e.getModel().getLanguageId() !== 'plaintext'; })[0] || null;
  }
  function language(ed) { var id = ed.getModel().getLanguageId(); return id === 'python3' ? 'python' : id; }
  function handle(req) {
    var ed = editor();
    if (!ed) return { ok: false, error: 'LeetCode code editor not found yet. Wait for the page to load.' };
    var model = ed.getModel();
    if (req.op === 'state') return { ok: true, language: language(ed), text: model.getValue() };
    var range = req.op === 'replace' ? model.getFullModelRange() : ed.getSelection();
    if (!range) return { ok: false, error: 'Click inside the editor first.' };
    ed.pushUndoStop();
    ed.executeEdits('codextent', [{ range: range, text: String(req.code), forceMoveMarkers: true }]);
    ed.pushUndoStop();
    ed.focus();
    return { ok: true, language: language(ed) };
  }
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.__cx !== 'editor-req') return;
    var res;
    try { res = handle(e.data); } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
    window.postMessage(Object.assign({ __cx: 'editor-res', id: e.data.id }, res), '*');
  });
})();

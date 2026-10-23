/*
 * OutputIQ — background service worker.
 *
 * Message API (chrome.runtime.sendMessage):
 *   { type: 'CHECK_PREDICTION', code, stdin, prediction, url, pageTitle }
 *     -> runs code on Judge0, compares with prediction, saves the attempt, returns:
 *        { ok:true, attempt, run, comparison }  or  { ok:false, error }
 *
 *   { type: 'SAVE_CLIP', text, hint, url, pageTitle }      (Code Clipper)
 *     -> classifies the selection (language + concepts) and saves it to My Revision Vault:
 *        { ok:true, clip, duplicate }  or  { ok:false, error }
 *   { type: 'OPEN_VAULT', id? }  -> opens My Learning Hub on the Revision Vault
 *
 * Code Clipper entry points: right-click "Save to My Revision Vault", the toolbar popup's
 * "Clip selection" button, and the Alt+Shift+S shortcut. All ask the page's content script for
 * the selection (it keeps line breaks), which then sends SAVE_CLIP here.
 *
 * The API key is read here and only here. Content scripts never receive it.
 */
importScripts('lib/compare.js', 'lib/judge0.js', 'lib/wandbox.js', 'lib/runner.js', 'lib/stats.js', 'lib/storage.js', 'lib/concepts.js', 'lib/concepts-lang.js', 'lib/detector.js', 'lib/vault.js', 'lib/quiz.js');

var OQ = self.OutputIQ;

async function checkPrediction(msg) {
  if (typeof msg.code !== 'string' || !msg.code.trim()) return { ok: false, error: 'No code to run.' };
  if (msg.code.length > 65000) return { ok: false, error: 'This program is too long to run (over 65,000 characters).' };
  var language = ['c', 'cpp', 'java', 'python', 'sql'].indexOf(msg.language) !== -1 ? msg.language : 'cpp';
  try {
    var settings = await OQ.storage.getSettings();
    // fastest free runner per language + cache; a PRERUN started when the bar opened is reused here
    var run = await OQ.runner.run(settings, language, msg.code, msg.stdin || '');

    var result, comparison = null;
    if (run.category === 'ok') {
      comparison = OQ.compare.compareOutput(msg.prediction || '', run.stdout, { lenientTrailingSpaces: settings.lenientTrailingSpaces, table: language === 'sql' });
      result = comparison.correct ? 'correct' : 'incorrect';
    } else if (run.category === 'compile_error') result = 'compile_error';
    else if (run.category === 'runtime_error') result = 'runtime_error';
    else if (run.category === 'timeout') result = 'timeout';
    else result = 'error';

    // Network/HTTP failures are not the learner's attempt — don't save them.
    var attempt = null;
    if (run.category !== 'network_error' && run.category !== 'http_error' && run.category !== 'runner_error') {
      attempt = await OQ.storage.addAttempt({
        questionId: OQ.stats.questionId(msg.code, msg.stdin),
        language: language,
        site: String(msg.site || '').slice(0, 60) || null,
        wrapped: !!msg.wrapped,
        concepts: OQ.concepts.tag(msg.code, language),
        url: String(msg.url || '').slice(0, 2000),
        pageTitle: String(msg.pageTitle || '').slice(0, 300),
        code: msg.code,
        stdin: msg.stdin || '',
        prediction: msg.prediction || '',
        result: result,
        kind: comparison ? comparison.kind : null,
        actualOutput: run.stdout || '',
        statusDescription: run.statusDescription || ''
      });
    }

    // Never send settings back to the page.
    return { ok: true, attempt: attempt, run: run, comparison: comparison };
  } catch (e) {
    return { ok: false, error: 'Unexpected error: ' + (e && e.message ? e.message : String(e)) };
  }
}

/** Quiz me: concept-bank questions + what-if questions whose answers come from really running the changed code. */
async function buildQuiz(msg) {
  var lang = msg.language;
  if (['c', 'cpp', 'java', 'python'].indexOf(lang) === -1) return { ok: false, error: 'Practice works for C, C++, Java and Python.' };
  if (typeof msg.code !== 'string' || !msg.code.trim() || msg.code.length > 20000) return { ok: false, error: 'No code to quiz on.' };
  var settings = await OQ.storage.getSettings();
  var Q = OQ.quiz;
  var maxWhatIf = msg.maxWhatIf != null ? msg.maxWhatIf : 3, maxConcept = msg.maxConcept != null ? msg.maxConcept : 2;
  var base = await OQ.runner.run(settings, lang, msg.code, msg.stdin || '');
  var whatifs = [];
  if (base.category === 'ok' && maxWhatIf > 0) {
    var muts = Q.mutations(msg.code, lang).slice(0, maxWhatIf + 1);
    var runs = await Promise.all(muts.map(function (m) { return OQ.runner.run(settings, lang, m.code, msg.stdin || ''); }));
    whatifs = muts.map(function (m, i) { return Q.whatIfQuestion(m, base.stdout, runs[i]); }).filter(Boolean).slice(0, maxWhatIf);
  }
  var concepts = Q.conceptQuestions(OQ.concepts, lang, OQ.concepts.tag(msg.code, lang), maxConcept);
  var questions = [];
  if (concepts[0]) questions.push(concepts[0]);
  questions = questions.concat(whatifs);
  if (concepts[1]) questions.push(concepts[1]);
  if (!questions.length) return { ok: false, error: base.category === 'ok' ? 'No good questions for this example. Try a longer one.' : 'Could not run this example, so no questions yet.' };
  return { ok: true, questions: questions, original: base.category === 'ok' ? base.stdout : null };
}

async function saveQuizAnswer(msg) {
  var d = await chrome.storage.local.get('quizLog');
  var log = Array.isArray(d.quizLog) ? d.quizLog : [];
  log.push({ ts: Date.now(), where: msg.where === 'dashboard' ? 'dashboard' : 'page', qid: String(msg.qid || '').slice(0, 80), kind: msg.kind === 'concept' ? 'concept' : 'whatif', concept: String(msg.concept || '').slice(0, 40),
    correct: !!msg.correct, url: String(msg.url || '').slice(0, 2000), pageTitle: String(msg.pageTitle || '').slice(0, 300) });
  if (log.length > 500) log = log.slice(log.length - 500);
  await chrome.storage.local.set({ quizLog: log });
}

/** Start running as soon as the learner opens the bar, so Check is (almost) instant. Result is cached, not saved. */
async function prerun(msg) {
  if (typeof msg.code !== 'string' || !msg.code.trim() || msg.code.length > 65000) return;
  var language = ['c', 'cpp', 'java', 'python', 'sql'].indexOf(msg.language) !== -1 ? msg.language : 'cpp';
  var settings = await OQ.storage.getSettings();
  await OQ.runner.run(settings, language, msg.code, msg.stdin || '');
}

/** Options page "Test connection": runs a tiny program with the saved settings. Not saved as an attempt. */
async function testConnection() {
  var settings = await OQ.storage.getSettings();
  var programs = {
    cpp: '#include <iostream>\nint main() { std::cout << "Codextent OK" << std::endl; return 0; }\n',
    c: '#include <stdio.h>\nint main() { printf("Codextent OK\\n"); return 0; }\n',
    java: 'public class Main { public static void main(String[] a) { System.out.println("Codextent OK"); } }\n',
    python: 'print("Codextent OK")\n',
    sql: "CREATE TABLE t (msg VARCHAR(20));\nINSERT INTO t VALUES ('Codextent OK');\nSELECT msg FROM t;\n"
  };
  var labels = { cpp: 'C++', c: 'C', java: 'Java', python: 'Python', sql: 'MySQL' };
  var lines = [];
  var allOk = true;
  for (var lang of ['cpp', 'c', 'java', 'python', 'sql']) {
    var run = await OQ.runner.run(settings, lang, programs[lang], '', { noCache: true });
    var ok = run.category === 'ok' && /Codextent OK/.test(run.stdout);
    allOk = allOk && ok;
    lines.push((ok ? '✓ ' : '✗ ') + labels[lang] + (ok
      ? ' (' + OQ.runner.label(run).replace(/^Ran on /, '') + ')'
      : ': ' + (run.error || run.statusDescription || run.category)));
    // a network/auth failure will be the same for every language
    if (!ok && (run.category === 'network_error' || run.category === 'http_error')) break;
  }
  return { ok: allOk, message: (allOk ? 'Connected. ' : 'Problem found. ') + '\n' + lines.join('\n') };
}

// ---------------------------------------------------------------- Code Clipper
var VAULT_PAGE = 'src/dashboard/dashboard.html#vault';

async function saveClip(msg) {
  var text = typeof msg.text === 'string' ? msg.text : '';
  var notes = typeof msg.notes === 'string' ? msg.notes.slice(0, 5000) : '';
  var url = String(msg.url || '');
  var base = { site: OQ.stats.siteOf({ url: url }), url: url, pageTitle: String(msg.pageTitle || ''), notes: notes };
  if (msg.kind === 'note') {
    // a note on its own, filed under the page's topic
    if (!notes.trim()) return { ok: false, error: 'Write a note first.' };
    var rn = await OQ.vault.saveClip(Object.assign(base, { kind: 'note', text: notes, notes: '' }));
    return { ok: true, clip: rn.clip, duplicate: false };
  }
  if (!text.trim()) return { ok: false, error: 'Select some code or text first.' };
  if (text.length > 20000) return { ok: false, error: 'The selection is too long (over 20,000 characters).' };
  var c = msg.kind === 'text'
    ? { text: text, language: 'text', concepts: [] }        // key point: the learner picked page text, keep it as text
    : OQ.vault.classify(text, msg.hint || null, OQ.detector, OQ.concepts);
  var r = await OQ.vault.saveClip(Object.assign(base, { text: c.text, language: c.language, concepts: c.concepts }));
  if (!r.clip) return { ok: false, error: r.error || 'Nothing to save.' };
  return { ok: true, clip: r.clip, duplicate: r.duplicate, updated: !!r.updated };
}

/** Ask the tab's content script for the selection (keeps newlines); fall back to Chrome's selectionText. */
async function clipFromTab(tab, fallbackText, fallbackUrl) {
  if (!tab || tab.id == null) return { ok: false, error: 'No tab.' };
  try {
    var r = await chrome.tabs.sendMessage(tab.id, { type: 'CLIP_REQUEST', fallbackText: fallbackText || '' }, { frameId: 0 });
    if (r) return r;
  } catch (e) { /* no content script on this page (unsupported site or not refreshed) */ }
  if (fallbackText) return saveClip({ text: fallbackText, url: fallbackUrl || tab.url || '', pageTitle: tab.title || '' });
  return { ok: false, error: 'Open a supported learning site (refresh it once after installing) and select code first.' };
}

function setupMenus() {
  var matches = (chrome.runtime.getManifest().content_scripts || [])[0].matches;
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({ id: 'codextent-clip', title: 'Save to My Revision Vault', contexts: ['selection'], documentUrlPatterns: matches });
  });
}
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'codextent-clip') clipFromTab(tab, info.selectionText, info.pageUrl);
});
chrome.commands.onCommand.addListener(function (command) {
  if (command !== 'clip-selection') return;
  chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) { clipFromTab(tabs[0]); });
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg) return false;
  // Only accept messages from this extension's own scripts/pages.
  if (sender.id !== chrome.runtime.id) return false;
  if (msg.type === 'CHECK_PREDICTION') {
    checkPrediction(msg).then(sendResponse);
    return true; // async response
  }
  if (msg.type === 'THEME') {
    // Black icon for light toolbars (manifest default), white icon for dark toolbars.
    var w = msg.dark ? 'icons/icon-white' : 'icons/icon';
    chrome.action.setIcon({ path: { 16: w + '16.png', 32: w + '32.png', 48: w + '48.png', 128: w + '128.png' } }).catch(function () {});
    return false;
  }
  if (msg.type === 'QUIZ_BUILD') {
    buildQuiz(msg).then(sendResponse, function (e) { sendResponse({ ok: false, error: String(e && e.message || e) }); });
    return true;
  }
  if (msg.type === 'QUIZ_ANSWER') {
    saveQuizAnswer(msg).catch(function () {});
    return false;
  }
  if (msg.type === 'PRERUN') {
    prerun(msg).catch(function () {});
    return false;
  }
  if (msg.type === 'SAVE_CLIP') {
    var url = sender.tab && sender.url ? sender.url : msg.url; // a page can only clip its own URL
    saveClip(Object.assign({}, msg, { url: url })).then(sendResponse, function (e) { sendResponse({ ok: false, error: String(e) }); });
    return true;
  }
  if (msg.type === 'OPEN_VAULT') {
    chrome.tabs.create({ url: chrome.runtime.getURL(VAULT_PAGE + (msg.id ? '/' + encodeURIComponent(msg.id) : '')) });
    return false;
  }
  if (msg.type === 'TEST_CONNECTION') {
    // extension pages only (options), never content scripts on websites
    if (!sender.url || sender.url.indexOf(chrome.runtime.getURL('')) !== 0) return false;
    testConnection().then(sendResponse, function (e) { sendResponse({ ok: false, message: String(e) }); });
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(function (details) {
  setupMenus();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html?welcome=1') });
  }
});

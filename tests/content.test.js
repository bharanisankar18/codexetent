/*
 * Integration test: loads the REAL content scripts (same order as manifest.json) into jsdom
 * pages served at each supported site's URL, with a fake `chrome` API, then clicks through
 * the compact bar.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const scripts = manifest.content_scripts[0].js.map((p) => fs.readFileSync(path.join(root, p), 'utf8'));
const fixture = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

const PAGES = {
  gfg: ['gfg-like.html', 'https://www.geeksforgeeks.org/cpp/for-loop-in-cpp/'],
  programiz: ['programiz.html', 'https://www.programiz.com/cpp-programming/for-loop'],
  w3s: ['w3schools.html', 'https://www.w3schools.com/cpp/cpp_for_loop.asp'],
  tp: ['tutorialspoint.html', 'https://www.tutorialspoint.com/python/python_for_loops.htm']
};

function setup(page, reply) {
  const [file, url] = PAGES[page];
  const dom = new JSDOM(fixture(file), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const sent = [];
  const themes = [];
  const preruns = [];
  const listeners = [];
  window.chrome = {
    runtime: {
      id: 'ext',
      onMessage: { addListener(fn) { listeners.push(fn); } },
      lastError: undefined,
      sendMessage(msg, cb) {
        if (msg.type === 'THEME') { themes.push(msg); return; } // toolbar icon theme report, no reply
        if (msg.type === 'PRERUN') { preruns.push(msg); return; } // early run when the bar opens, no reply
        sent.push(msg); setTimeout(() => cb(typeof reply === 'function' ? reply(msg) : reply), 0);
      }
    }
  };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {} });
  scripts.forEach((s) => window.eval(s));
  // deliver a message from the extension (background/popup) to the content script
  const deliver = (msg) => new Promise((resolve) => {
    let async = false;
    listeners.forEach((fn) => { if (fn(msg, { id: 'ext' }, resolve) === true) async = true; });
    if (!async) setTimeout(() => resolve(undefined), 0);
  });
  return { window, doc: window.document, sent, themes, deliver, preruns };
}

const hosts = (doc) => Array.from(doc.querySelectorAll('[data-outputiq-host]'));
const langs = (doc) => hosts(doc).map((h) => h.getAttribute('data-outputiq-lang'));
const prevId = (h) => h.previousElementSibling && h.previousElementSibling.id;
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const okReply = (stdout, pred) => ({ ok: true, run: { category: 'ok', stdout }, comparison: { correct: true, kind: 'exact', diff: null, normalizedPrediction: pred, normalizedActual: pred, notes: [] } });

// ---------- detection per site ----------

test('GfG: one logo per runnable example in every language (C++ x3, C, Java, Python)', () => {
  const { doc } = setup('gfg', { ok: true });
  assert.deepEqual(langs(doc), ['cpp', 'cpp', 'cpp', 'c', 'java', 'python']);
  const hs = hosts(doc);
  assert.equal(prevId(hs[0]), 'sh-cpp');
  assert.equal(prevId(hs[1]), 'wrap-pre-cpp', 'placed after the .code-container wrapper');
  assert.equal(prevId(hs[2]), 'tab-cpp');
  assert.equal(prevId(hs[3]), 'tab-c');
});

test('GfG: header, comments, snippets, output and shell blocks are left alone', () => {
  const { doc } = setup('gfg', { ok: true });
  ['snippet', 'shell', 'output-block', 'comment-cpp'].forEach((id) => {
    const next = doc.getElementById(id).nextElementSibling;
    assert.ok(!next || !next.hasAttribute('data-outputiq-host'), id + ' should have no logo');
  });
  assert.equal(doc.querySelector('header').querySelectorAll('[data-outputiq-host]').length, 0);
});

test('Programiz: only *-exec examples, after the code editor; correct language each', () => {
  const { doc } = setup('programiz', { ok: true });
  assert.deepEqual(langs(doc), ['cpp', 'c', 'java', 'python']);
  assert.deepEqual(hosts(doc).map(prevId), ['ed-cpp-1', 'ed-c-1', 'ed-java-1', 'ed-python-1']);
});

test('W3Schools: language from URL, full program + wrapped snippet, syntax/sidebar skipped', () => {
  const { doc } = setup('w3s', { ok: true });
  assert.deepEqual(langs(doc), ['cpp', 'cpp']);
  const code2 = hosts(doc)[1].shadowRoot.querySelector('.details pre').textContent;
  assert.match(code2, /int main\(\) \{\n    for \(int i = 0; i < 5; i\+\+\) \{/);
  assert.match(hosts(doc)[1].shadowRoot.querySelector('.details summary').textContent, /wrapped in main\(\)/);
});

test('TutorialsPoint: only demo-code blocks, console text not part of the code', () => {
  const { doc } = setup('tp', { ok: true });
  assert.deepEqual(langs(doc), ['python', 'cpp']);
  assert.deepEqual(hosts(doc).map(prevId), ['wrap-py-1', 'wrap-cpp-1']);
  const code = hosts(doc)[1].shadowRoot.querySelector('.details pre').textContent;
  assert.ok(code.trim().endsWith('return 0;\n}'));
});

// ---------- compact bar behaviour ----------

test('collapsed state shows only the logo', () => {
  const { doc } = setup('programiz', { ok: true });
  const sr = hosts(doc)[0].shadowRoot;
  assert.ok(sr.querySelector('.logo svg'));
  assert.ok(!sr.querySelector('.bar').classList.contains('open'));
  assert.ok(!sr.querySelector('.msg').classList.contains('show'));
  assert.ok(!sr.querySelector('.details').classList.contains('show'));
});

test('clicking the logo opens a one-line bar with language tag; nothing is sent yet', async () => {
  const { doc, sent } = setup('programiz', { ok: true });
  const sr = hosts(doc)[1].shadowRoot;
  sr.querySelector('.logo').click();
  assert.ok(sr.querySelector('.bar').classList.contains('open'));
  assert.equal(sr.querySelector('.lang').textContent, 'C');
  assert.equal(sr.querySelector('textarea.answer').rows, 1);
  await tick();
  assert.equal(sent.length, 0);
});

test('correct answer: ✓ symbol at the side + short message, details closed', async () => {
  const { doc, sent } = setup('programiz', okReply('1 2 3 4 5 ', '1 2 3 4 5'));
  const sr = hosts(doc)[0].shadowRoot;
  sr.querySelector('.logo').click();
  sr.querySelector('textarea.answer').value = '1 2 3 4 5';
  sr.querySelector('.check').click();
  await tick(20);
  assert.equal(sent[0].type, 'CHECK_PREDICTION');
  assert.equal(sent[0].language, 'cpp');
  assert.equal(sent[0].site, 'programiz');
  assert.ok(!('apiKey' in sent[0]));
  const v = sr.querySelector('.verdict');
  assert.ok(v.classList.contains('ok'));
  assert.equal(v.textContent, '✓');
  assert.equal(v.getAttribute('aria-label'), 'Correct');
  assert.match(sr.querySelector('.msg').textContent, /Correct/);
  assert.ok(!sr.querySelector('.details').classList.contains('show'));
});

test('wrong answer: ✗ symbol, one-line actual output + diff position, full details on demand', async () => {
  const reply = {
    ok: true,
    run: { category: 'ok', stdout: 'Java is fun\nJava is fun\nJava is fun\n' },
    comparison: {
      correct: false, kind: 'mismatch', normalizedPrediction: 'Java is fun', normalizedActual: 'Java is fun\nJava is fun\nJava is fun', notes: [],
      diff: { line: 2, column: 1, expectedVisible: 'Java·is·fun', yourVisible: '(no line)', reason: 'Your prediction is missing line(s) the program printed.' }
    }
  };
  const { doc } = setup('programiz', reply);
  const sr = hosts(doc)[2].shadowRoot;
  sr.querySelector('.logo').click();
  sr.querySelector('textarea.answer').value = 'Java is fun';
  sr.querySelector('.check').click();
  await tick(20);
  assert.equal(sr.querySelector('.verdict').textContent, '✗');
  assert.match(sr.querySelector('.msg .text').textContent, /Output: Java is fun …\s+·\s+differs at line 2, col 1/);
  sr.querySelector('.msg .link').click();
  assert.ok(sr.querySelector('.details').classList.contains('show'));
  assert.match(sr.querySelector('.details .diff').textContent, /line 2, column 1/);
});

test('Enter submits, Shift+Enter does not', async () => {
  const { doc, window, sent } = setup('programiz', okReply('x', 'x'));
  const sr = hosts(doc)[0].shadowRoot;
  sr.querySelector('.logo').click();
  const a = sr.querySelector('textarea.answer');
  a.value = 'x';
  a.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
  await tick();
  assert.equal(sent.length, 0);
  a.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await tick(20);
  assert.equal(sent.length, 1);
});

test('Next opens the following example and is disabled on the last one', () => {
  const { doc } = setup('programiz', { ok: true });
  const hs = hosts(doc);
  const sr0 = hs[0].shadowRoot;
  sr0.querySelector('.logo').click();
  const icons = sr0.querySelectorAll('.icon');
  const next = Array.from(icons).find((b) => b.getAttribute('aria-label') === 'Next example');
  assert.equal(next.disabled, false);
  next.click();
  assert.ok(hs[1].shadowRoot.querySelector('.bar').classList.contains('open'));
  hs[3].shadowRoot.querySelector('.logo').click();
  const last = Array.from(hs[3].shadowRoot.querySelectorAll('.icon')).find((b) => b.getAttribute('aria-label') === 'Next example');
  assert.equal(last.disabled, true);
});

test('errors get their own symbol and short message', async () => {
  const cases = [
    [{ ok: true, run: { category: 'compile_error', compileOutput: "main.cpp:3:5: error: expected ';' before 'return'" } }, '✗', /Compilation error: expected ';'/],
    [{ ok: true, run: { category: 'runtime_error', statusDescription: 'Runtime Error (SIGFPE)', stdout: '' } }, '✗', /SIGFPE\) — division by zero/],
    [{ ok: true, run: { category: 'timeout' } }, '⏱', /Time limit exceeded/],
    [{ ok: true, run: { category: 'network_error', error: 'Could not reach the code runner' } }, '!', /Could not reach/]
  ];
  for (const [reply, symbol, text] of cases) {
    const { doc } = setup('programiz', reply);
    const sr = hosts(doc)[0].shadowRoot;
    sr.querySelector('.logo').click();
    sr.querySelector('textarea.answer').value = 'x';
    sr.querySelector('.check').click();
    await tick(20);
    assert.equal(sr.querySelector('.verdict').textContent, symbol);
    assert.match(sr.querySelector('.msg .text').textContent, text);
  }
});

test('stdin box only for programs that read input, and it is sent', async () => {
  const { doc, sent } = setup('gfg', okReply('15\n', '15'));
  const hs = hosts(doc);
  assert.equal(hs[0].shadowRoot.querySelector('textarea.stdin'), null);
  const sr = hs[2].shadowRoot;
  sr.querySelector('.logo').click();
  sr.querySelector('textarea.stdin').value = '5 10';
  sr.querySelector('textarea.answer').value = '15';
  sr.querySelector('.check').click();
  await tick(20);
  assert.equal(sent[0].stdin, '5 10');
});

test('code blocks added later (lazy tabs) get a logo', async () => {
  const { doc } = setup('gfg', { ok: true });
  const pre = doc.createElement('pre');
  pre.textContent = 'print("late")\nfor i in range(2):\n    print(i)';
  pre.className = 'language-python';
  doc.querySelector('article .text').appendChild(pre);
  await tick(600);
  assert.ok(pre.nextElementSibling.hasAttribute('data-outputiq-host'));
  assert.equal(pre.nextElementSibling.getAttribute('data-outputiq-lang'), 'python');
});

test('running the scripts twice does not duplicate logos', () => {
  const { window, doc } = setup('programiz', { ok: true });
  scripts.forEach((s) => window.eval(s));
  assert.equal(hosts(doc).length, 4);
});

// ---------- concept tags (v0.3, C++) ----------

test('concept tags are hidden before answering and shown after, with traps in details', async () => {
  const reply = Object.assign(okReply('1 2 3 ', '1 2 3'), { attempt: { concepts: ['loops', 'int-division'] } });
  const { doc } = setup('gfg', reply);
  const sr = hosts(doc)[0].shadowRoot;
  sr.querySelector('.logo').click();
  assert.equal(sr.querySelectorAll('.tags .chip').length, 0, 'no hints before answering');
  assert.equal(sr.querySelector('.details .concepts').textContent, '');
  sr.querySelector('textarea.answer').value = '1 2 3';
  sr.querySelector('.check').click();
  await tick(20);
  const chips = Array.from(sr.querySelectorAll('.tags .chip')).map((c) => c.textContent);
  assert.deepEqual(chips, ['Loops', 'Integer division & modulo']);
  assert.match(sr.querySelector('.tags .chip').title, /Off-by-one/);
  const traps = sr.querySelector('.details .concepts').textContent;
  assert.match(traps, /Concepts in this example/);
  assert.match(traps, /7 \/ 2 is 3, not 3\.5/);
});

test('no chips when the attempt has no concepts (other languages, network errors)', async () => {
  const { doc } = setup('programiz', { ok: true, run: { category: 'network_error', error: 'x' }, attempt: null });
  const sr = hosts(doc)[3].shadowRoot;
  sr.querySelector('.logo').click();
  sr.querySelector('textarea.answer').value = 'x';
  sr.querySelector('.check').click();
  await tick(20);
  assert.equal(sr.querySelectorAll('.tags .chip').length, 0);
});

test('reports the browser theme so the toolbar icon can switch black/white', () => {
  const { themes } = setup('gfg', { ok: true });
  assert.equal(themes.length, 1);
  assert.equal(typeof themes[0].dark, 'boolean');
});

// ---------------- Code Clipper ----------------
const toastText = (doc) => {
  const host = doc.querySelector('[data-outputiq-toast]');
  return host ? host.shadowRoot.querySelector('.toast').textContent : '';
};

test('Clip: right-click/popup request saves the selection with line breaks and the block language (GfG)', async () => {
  const { window, doc, sent, deliver } = setup('gfg', (m) => ({ ok: true, duplicate: false, clip: { id: 'k1', language: 'python', concept: 'loops', topic: 'For loop' } }));
  const pre = doc.getElementById('tab-c');
  window.getSelection().selectAllChildren(pre);
  const r = await deliver({ type: 'CLIP_REQUEST' });
  const msg = sent.find((m) => m.type === 'SAVE_CLIP');
  assert.ok(msg, 'SAVE_CLIP sent');
  assert.ok(msg.text.includes('\n'), 'line breaks kept');
  assert.equal(msg.hint, 'c', 'language-c class on the block');
  assert.equal(msg.url, 'https://www.geeksforgeeks.org/cpp/for-loop-in-cpp/');
  assert.equal(r.ok, true);
  assert.match(toastText(doc), /Saved to My Revision Vault/);
  assert.match(toastText(doc), /Python · Loops/);
  assert.ok(doc.querySelector('[data-outputiq-toast]').shadowRoot.querySelector('.topen'), 'Open vault button');
});

test('Clip: nothing selected -> friendly message, nothing saved', async () => {
  const { doc, sent, deliver } = setup('gfg', { ok: true });
  const r = await deliver({ type: 'CLIP_REQUEST' });
  assert.equal(r.ok, false);
  assert.equal(sent.filter((m) => m.type === 'SAVE_CLIP').length, 0);
  assert.match(toastText(doc), /Select some code/);
});

test('Clip: W3Schools <br> code keeps its lines; language comes from the URL', async () => {
  const { window, doc, sent, deliver } = setup('w3s', { ok: true, duplicate: true, clip: { id: 'k2', language: 'cpp', concept: '' } });
  const block = doc.querySelector('.w3-code');
  window.getSelection().selectAllChildren(block);
  await deliver({ type: 'CLIP_REQUEST' });
  const msg = sent.find((m) => m.type === 'SAVE_CLIP');
  assert.equal(msg.hint, 'cpp');
  assert.match(toastText(doc), /Already in your Revision Vault/);
});

test('Clip: the bookmark button in the bar saves that example', async () => {
  const { doc, sent } = setup('gfg', { ok: true, duplicate: false, clip: { id: 'k3', language: 'cpp', concept: '' } });
  const sh = hosts(doc)[0].shadowRoot;
  sh.querySelector('.logo').click();
  sh.querySelector('.icon.save').click();
  await new Promise((r) => setTimeout(r, 5));
  const msg = sent.find((m) => m.type === 'SAVE_CLIP');
  assert.ok(msg && /main\s*\(/.test(msg.text));
  assert.equal(msg.hint, 'cpp');
  assert.ok(sh.querySelector('.icon.save').classList.contains('saved'));
});

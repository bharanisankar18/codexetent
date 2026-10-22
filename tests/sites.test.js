/*
 * v0.6 sites (Javatpoint, Sanfoundry, Scaler Topics, Studytonight) + theme setting, using the REAL content
 * scripts in jsdom. The fixtures are modelled on these sites' usual markup — they were NOT inspected live.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const scripts = manifest.content_scripts[0].js.map((p) => fs.readFileSync(path.join(root, p), 'utf8'));

function load(file, url, theme) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'fixtures', file), 'utf8'), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const listeners = [];
  window.chrome = {
    runtime: { sendMessage() {} },
    storage: {
      local: { get: async () => (theme ? { ui: { theme } } : {}) },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    }
  };
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {} });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  scripts.forEach((s) => window.eval(s));
  return { doc: window.document, listeners };
}
const hosts = (doc) => Array.from(doc.querySelectorAll('[data-outputiq-host]'));
const langs = (doc) => hosts(doc).map((h) => h.getAttribute('data-outputiq-lang'));
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

test('manifest covers all 8 learning sites', () => {
  const m = manifest.content_scripts[0].matches.join(' ');
  ['geeksforgeeks.org', 'programiz.com', 'w3schools.com', 'tutorialspoint.com', 'javatpoint.com', 'scaler.com/topics', 'studytonight.com', 'sanfoundry.com']
    .forEach((s) => assert.ok(m.includes(s), s));
});

test('Javatpoint: textarea code blocks (C++ and a self-contained MySQL query); output block and header skipped', () => {
  const { doc } = load('javatpoint.html', 'https://www.javatpoint.com/cpp-for-loop');
  assert.deepEqual(langs(doc), ['cpp', 'sql']);
  assert.equal(hosts(doc)[0].previousElementSibling.id, 'cb1');
  assert.match(hosts(doc)[0].shadowRoot.querySelector('.details pre').textContent, /for \(int i = 1; i <= 3; i\+\+\)/);
});

test('Sanfoundry: question code is C (from the URL), syntax line and sidebar skipped', () => {
  const { doc } = load('sanfoundry.html', 'https://www.sanfoundry.com/c-programming-questions-answers-for-loop-1/');
  assert.deepEqual(langs(doc), ['c']);
  assert.equal(hosts(doc)[0].previousElementSibling.id, 'q1');
});

test('Scaler Topics: Python example gets a logo, the output block does not', () => {
  const { doc } = load('scaler.html', 'https://www.scaler.com/topics/python/for-loop-in-python/');
  assert.deepEqual(langs(doc), ['python']);
  assert.equal(hosts(doc)[0].previousElementSibling.id, 'py1');
});

test('Studytonight: Java example gets a logo, footer skipped', () => {
  const { doc } = load('studytonight.html', 'https://www.studytonight.com/java/for-loop-in-java.php');
  assert.deepEqual(langs(doc), ['java']);
});

test('in-page bar follows the theme setting (default dark; light/night from Settings; live updates)', async () => {
  const dark = load('scaler.html', 'https://www.scaler.com/topics/python/x/');
  await tick();
  assert.equal(hosts(dark.doc)[0].getAttribute('data-theme'), 'dark');
  const light = load('scaler.html', 'https://www.scaler.com/topics/python/x/', 'light');
  await tick();
  assert.equal(hosts(light.doc)[0].getAttribute('data-theme'), 'light');
  light.listeners.forEach((fn) => fn({ ui: { newValue: { theme: 'night' } } }, 'local'));
  assert.equal(hosts(light.doc)[0].getAttribute('data-theme'), 'night');
  const auto = load('scaler.html', 'https://www.scaler.com/topics/python/x/', 'auto');
  await tick();
  assert.equal(hosts(auto.doc)[0].getAttribute('data-theme'), 'light', 'auto follows the system (light in this test)');
});

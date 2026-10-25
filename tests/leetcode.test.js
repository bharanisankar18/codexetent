const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const L = require('../src/lib/leetcode.js');

function fakeStorage() {
  const mk = () => {
    const data = {};
    return {
      data,
      async get(k) { if (k == null) return JSON.parse(JSON.stringify(data)); const ks = Array.isArray(k) ? k : [k]; const o = {}; ks.forEach((x) => { if (x in data) o[x] = JSON.parse(JSON.stringify(data[x])); }); return o; },
      async set(o) { Object.assign(data, JSON.parse(JSON.stringify(o))); },
      async remove(k) { (Array.isArray(k) ? k : [k]).forEach((x) => delete data[x]); },
      async getBytesInUse() { return JSON.stringify(data).length; }
    };
  };
  return { sync: mk(), local: mk() };
}

test('slug from URL, Array-only filter, mark fits Chrome sync', () => {
  assert.equal(L.slugFromPath('/problems/two-sum/description/'), 'two-sum');
  assert.equal(L.slugFromPath('/problems/3sum'), '3sum');
  assert.equal(L.slugFromPath('/problemset/'), null);
  assert.equal(L.allowed(['Array', 'Hash Table']), true, 'Array');
  assert.equal(L.allowed(['String', 'Dynamic Programming']), false, 'String alone is off');
  assert.equal(L.allowed(['Hash Table', 'Two Pointers']), false, 'no Array tag');
  const m = L.makeMark({ slug: 'two-sum', id: '1', title: 'Two Sum', difficulty: 'Easy', tags: ['Array', 'Hash Table'], note: 'x'.repeat(5000) }, null, 1000);
  assert.deepEqual([m.s, m.id, m.t, m.d, m.st, m.n.length, m.ca], ['two-sum', '1', 'Two Sum', 'easy', 'todo', L.MAX_NOTE, 1000]);
  assert.ok(JSON.stringify(m).length < 8000, 'under the 8 KB per-item sync limit');
});

test('save → sync, solved → moves to local, reopen, remove; list + filters', async () => {
  const st = fakeStorage();
  global.chrome = { storage: st };
  await L.saveMark({ slug: 'two-sum', id: '1', title: 'Two Sum', difficulty: 'Easy', tags: ['Array'], note: 'hash map of value -> index' });
  await L.saveMark({ slug: 'maximum-subarray', id: '53', title: 'Maximum Subarray', difficulty: 'Medium', tags: ['Array', 'Dynamic Programming'], note: 'kadane' });
  assert.ok(st.sync.data['lc:two-sum'] && st.sync.data['lc:maximum-subarray']);
  const again = await L.saveMark({ slug: 'two-sum', title: 'Two Sum', note: 'one pass' });
  assert.equal(again.n, 'one pass');
  assert.equal(again.ca, st.sync.data['lc:two-sum'].ca, 'created time kept');
  await L.markDone('two-sum');
  assert.equal(st.sync.data['lc:two-sum'], undefined, 'solved problems leave the small sync space');
  assert.equal(st.local.data.lcDone['two-sum'].st, 'done');
  let all = await L.allMarks();
  assert.deepEqual(all.map((m) => [m.s, m.st]).sort(), [['maximum-subarray', 'todo'], ['two-sum', 'done']]);
  assert.equal(L.filterMarks(all, { status: 'todo' }).length, 1);
  assert.equal(L.filterMarks(all, { difficulty: 'easy' })[0].s, 'two-sum');
  assert.equal(L.filterMarks(all, { q: 'kadane' })[0].s, 'maximum-subarray');
  await L.reopen('two-sum');
  assert.equal(st.sync.data['lc:two-sum'].st, 'todo');
  assert.equal(st.local.data.lcDone['two-sum'], undefined);
  await L.removeMark('maximum-subarray');
  all = await L.allMarks();
  assert.deepEqual(all.map((m) => m.s), ['two-sum']);
  assert.ok((await L.usage()).pct >= 0);
  delete global.chrome;
});

// ---------- content script on a LeetCode-like page ----------
const root = path.join(__dirname, '..');
const scripts = ['src/lib/leetcode.js', 'src/content/leetcode.js'].map((p) => fs.readFileSync(path.join(root, p), 'utf8'));
const PAGE = (diff) => `<html class="dark"><head><title>Two Sum - LeetCode</title></head><body>
  <div class="flex items-start gap-2"><div class="text-title-large"><a href="/problems/two-sum/">1. Two Sum</a></div></div>
  <div class="flex gap-1"><div class="text-difficulty-easy">${diff}</div><div>Topics</div><div>Companies</div><div>Hint</div></div>
</body></html>`;
function setupLC(url, tags, opts = {}) {
  const dom = new JSDOM(opts.html || PAGE('Easy'), { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const st = fakeStorage();
  w.chrome = { storage: Object.assign(st, { onChanged: { addListener() {} } }) };
  w.fetch = async (u, init) => ({ ok: true, json: async () => ({ data: { question: { questionFrontendId: '1', title: 'Two Sum', difficulty: 'Easy', topicTags: tags.map((t) => ({ name: t, slug: t.toLowerCase() })) } } }), body: init && init.body });
  w.setInterval = () => 0; // no polling in tests
  scripts.forEach((s) => w.eval(s));
  return { w, doc: w.document, st };
}
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const TOOLBAR = (extra = '') => `<html class="dark"><head><title>Two Sum - LeetCode</title></head><body>
  <div class="flex items-start gap-2"><div class="text-title-large"><a href="/problems/two-sum/">1. Two Sum</a></div></div>
  <div class="flex gap-1"><div class="text-difficulty-easy">Easy</div><div>Topics</div><div>Companies</div><div>Hint</div></div>
  <div id="editor"><div id="head"><span>Code</span><button title="full"></button><button title="close"></button></div>
    <div id="bar"><div id="leftbar"><button>Python</button><div>Auto</div></div>
      <div id="icons"><div class="tip"><button id="lcbm"><svg></svg></button></div><button id="braces"><svg></svg></button><button id="undo"><svg></svg></button><button id="expand"><svg></svg></button></div></div></div>${extra}
</body></html>`;

test('LeetCode Array problem: bookmark + Codextent icons in the Code bar, before LeetCode\'s own bookmark; board saves a note', async () => {
  const { w, doc, st } = setupLC('https://leetcode.com/problems/two-sum/description/', ['Array', 'Hash Table'], { html: TOOLBAR() });
  let opened = null;
  w.addEventListener('codextent:open-panel', (e) => { opened = e.detail; });
  await wait();
  assert.equal(doc.querySelector('[data-codextent-lc]'), null, 'no chip under the title any more');
  const nav = doc.querySelector('[data-codextent-lcnav]');
  assert.ok(nav, 'icons added');
  assert.equal(nav.parentElement.id, 'icons', 'inside the Code icon bar');
  assert.equal(nav.nextElementSibling.className, 'tip', 'just before LeetCode\'s bookmark');
  assert.equal(nav.getAttribute('data-lc-pos'), 'tool');
  const sh = nav.shadowRoot;
  sh.querySelector('.ib.lg').click();
  assert.ok(opened, 'logo asks the templates panel to open');
  sh.querySelector('.ib.bm').click();
  await wait();
  const board = sh.querySelector('.board.show');
  assert.match(board.textContent, /Solve later · 0[\s\S]*1\. Two Sum[\s\S]*Save for later/);
  board.querySelector('textarea').value = 'hash map, one pass';
  board.querySelector('button.save').click();
  await wait(40);
  assert.equal(st.sync.data['lc:two-sum'].n, 'hash map, one pass');
  assert.equal(sh.querySelector('.count').textContent, '1');
  assert.ok(sh.querySelector('.ib.bm.on'), 'bookmark turns orange');
  assert.match(sh.querySelector('.board').textContent, /Solve later · 1[\s\S]*Update note[\s\S]*Mark solved[\s\S]*To solve 1/);
  assert.equal(sh.querySelector('.list .it').getAttribute('href'), '/problems/two-sum/');
  sh.querySelector('.list .it .tick').click();
  await wait(40);
  assert.equal(sh.querySelector('.count').textContent, '', 'ticked off → count 0');
  assert.ok(!st.sync.data['lc:two-sum'], 'solved problems leave sync storage');
});

test('LeetCode: problems without the Array tag get nothing', async () => {
  const { doc } = setupLC('https://leetcode.com/problems/valid-anagram/', ['String', 'Hash Table'], { html: TOOLBAR() });
  await wait();
  assert.equal(doc.querySelector('[data-codextent-lcnav]'), null);
  assert.equal(doc.querySelector('[data-codextent-lc]'), null);
});

test('LeetCode: no Code icon bar → icons float at the bottom right', async () => {
  const { doc } = setupLC('https://leetcode.com/problems/two-sum/', ['Array'], { html: '<html><head><title>x</title></head><body><main></main></body></html>' });
  await wait();
  const nav = doc.querySelector('[data-codextent-lcnav]');
  assert.ok(nav && nav.getAttribute('data-lc-float') === 'bar');
  assert.equal(nav.getAttribute('data-lc-theme'), 'light');
});

test('LeetCode problem list page: floating "Solve later" button opens the board', async () => {
  const { doc } = setupLC('https://leetcode.com/problemset/', [], { html: '<html class="dark"><head><title>Problems - LeetCode</title></head><body><main>list</main></body></html>' });
  await wait();
  const nav = doc.querySelector('[data-codextent-lcnav]');
  assert.equal(nav.getAttribute('data-lc-float'), 'page');
  assert.match(nav.shadowRoot.querySelector('.ib.bm').textContent, /Solve later/);
  nav.shadowRoot.querySelector('.ib.bm').click();
  await wait();
  assert.match(nav.shadowRoot.querySelector('.board.show').textContent, /Nothing saved yet/);
});

const test = require('node:test');
const assert = require('node:assert');
const V = require('../src/lib/vault.js');
const D = require('../src/lib/detector.js');
const C = require('../src/lib/concepts-lang.js');

const DAY = 86400000;
const T0 = new Date(2026, 9, 22, 9, 0).getTime();

test('cleanText keeps line breaks, drops CRLF, nbsp and shared indent', () => {
  assert.equal(V.cleanText('\r\n    for (int i = 0; i < 3; i++)\u00a0\r\n        cout << i;  \r\n'), 'for (int i = 0; i < 3; i++)\n    cout << i;');
});

test('classify: language from content, page hint for short snippets, text otherwise', () => {
  const cpp = V.classify('#include <iostream>\nusing namespace std;\nint main() {\n  int *p = new int(5);\n  cout << *p;\n}', null, D, C);
  assert.equal(cpp.language, 'cpp');
  assert.ok(cpp.concepts.includes('pointers'), cpp.concepts.join());
  assert.equal(V.classify('x = [1, 2, 3]\nfor v in x:\n    print(v * 2)', 'python', D, C).language, 'python');
  assert.equal(V.classify('def main():\n    print("Hello")\n\nmain()', 'cpp', D, C).language, 'python', 'Python tab on a /cpp/ page');
  assert.equal(V.classify('i++;', 'java', D, C).language, 'java', 'short code uses the page hint');
  const t = V.classify('A pointer stores the address of another variable.', 'cpp', D, C);
  assert.deepEqual([t.language, t.kind, t.concepts], ['text', 'text', []]);
  assert.equal(V.classify("SELECT name FROM emp WHERE salary > 500 ORDER BY name;", 'sql', D, C).language, 'sql');
});

test('makeClip fills every field; topic drops the site name; bad URLs are dropped', () => {
  const c = V.makeClip({ text: 'print(1)', language: 'python', concepts: ['print'], site: 'w3schools', url: 'https://www.w3schools.com/python/x.asp', pageTitle: 'Python Print - W3Schools' }, T0);
  assert.equal(c.topic, 'Python Print');
  assert.equal(c.concept, 'print');
  assert.deepEqual([c.status, c.notes, c.reviewCount, c.kind], ['new', '', 0, 'code']);
  assert.equal(V.makeClip({ text: 'x', url: 'javascript:alert(1)' }, T0).url, '');
  assert.equal(V.makeClip({ text: 'x', language: 'ruby' }, T0).language, 'text');
});

test('addClip: no duplicates for the same text on the same page; empty text refused', () => {
  const a = V.makeClip({ text: 'int x;', language: 'c', url: 'https://www.geeksforgeeks.org/a/' }, T0);
  let r = V.addClip([], a);
  assert.equal(r.list.length, 1);
  r = V.addClip(r.list, V.makeClip({ text: 'int x;', language: 'c', url: 'https://www.geeksforgeeks.org/a/#top' }, T0 + 1));
  assert.equal(r.duplicate, true);
  assert.equal(r.list.length, 1);
  assert.equal(r.clip.id, a.id);
  assert.equal(V.addClip(r.list, V.makeClip({ text: '  ' }, T0)).clip, null);
});

test('updateClip edits only allowed fields; markReviewed schedules the next revision', () => {
  const a = V.makeClip({ text: 'x++;', language: 'cpp' }, T0);
  let r = V.updateClip([a], a.id, { notes: 'post-increment!', status: 'difficult', id: 'hacked', text: 'changed' }, T0 + 5);
  assert.equal(r.clip.notes, 'post-increment!');
  assert.equal(r.clip.status, 'difficult');
  assert.equal(r.clip.id, a.id);
  assert.equal(r.clip.text, 'x++;');
  assert.equal(V.updateClip([a], a.id, { status: 'bogus' }).clip.status, 'new');
  r = V.markReviewed(r.list, a.id, 'learning', T0 + DAY);
  assert.deepEqual([r.clip.status, r.clip.reviewCount, r.clip.reviewedAt, r.clip.nextReviewAt], ['learning', 1, T0 + DAY, T0 + 4 * DAY]);
  r = V.markReviewed(r.list, a.id, 'difficult', T0 + 2 * DAY);
  assert.equal(r.clip.nextReviewAt, T0 + 3 * DAY);
  assert.equal(r.clip.reviewCount, 2);
});

function sample() {
  const mk = (text, language, concept, site, status, ts, notes) => Object.assign(V.makeClip({ text, language, concepts: concept ? [concept] : [], site, url: 'https://x.org/' + ts }, ts), { status, notes: notes || '' });
  return [
    mk('int *p = &x;', 'cpp', 'pointers', 'geeksforgeeks', 'difficult', T0, 'pointer arithmetic'),
    mk('for i in range(3): print(i)', 'python', 'loops', 'w3schools', 'learning', T0 + 1),
    mk('SELECT COUNT(*) FROM t;', 'sql', 'aggregates', 'w3schools', 'mastered', T0 + 2),
    mk('A class is a blueprint.', 'text', '', 'geeksforgeeks', 'new', T0 + 3),
    mk('int *q = nullptr;', 'cpp', 'pointers', 'w3schools', 'difficult', T0 + 4)
  ];
}

test('filterClips: search (text, notes, concept names), language, status, site, concept, sort', () => {
  const L = sample();
  assert.equal(V.filterClips(L, { q: 'arithmetic' }).length, 1, 'notes are searched');
  assert.equal(V.filterClips(L, { q: 'POINTER' }).length, 2, 'case-insensitive');
  assert.equal(V.filterClips(L, { q: 'loops-name', conceptNames: (c) => c.concept === 'loops' ? ['loops-name'] : [] }).length, 1);
  assert.equal(V.filterClips(L, { language: 'cpp' }).length, 2);
  assert.equal(V.filterClips(L, { status: 'difficult' }).length, 2);
  assert.equal(V.filterClips(L, { site: 'w3schools' }).length, 3);
  assert.equal(V.filterClips(L, { concept: 'pointers', site: 'w3schools' }).length, 1);
  assert.equal(V.filterClips(L)[0].text, 'int *q = nullptr;', 'newest first');
  assert.equal(V.filterClips(L, { sort: 'oldest' })[0].text, 'int *p = &x;');
  assert.equal(V.filterClips(L, { sort: 'new' })[0].status, 'new', 'New first');
  assert.deepEqual(V.filterClips(L, { sort: 'difficult' }).map((c) => c.status), ['difficult', 'difficult', 'learning', 'new', 'mastered']);
});

test('reviewQueue: due clips only, difficult first; mastered never due; stats', () => {
  const L = sample();
  const q = V.reviewQueue(L, T0 + 10);
  assert.deepEqual(q.map((c) => c.status), ['difficult', 'difficult', 'learning', 'new']);
  const after = V.markReviewed(L, q[0].id, 'mastered', T0 + 20).list;
  assert.equal(V.reviewQueue(after, T0 + 30).length, 3);
  const s = V.vaultStats(L, T0 + 10);
  assert.deepEqual(s.byStatus, { new: 1, learning: 1, difficult: 2, mastered: 1 });
  assert.equal(s.due, 4);
  assert.deepEqual(s.difficultConcepts, [{ language: 'cpp', concept: 'pointers', count: 2 }]);
});

test('chrome.storage helpers: save -> edit -> review -> delete', async () => {
  const store = {};
  global.chrome = { storage: { local: {
    async get(k) { return { [k]: store[k] }; },
    async set(o) { Object.assign(store, JSON.parse(JSON.stringify(o))); }
  } } };
  const r = await V.saveClip({ text: 'cout << 7 / 2;', language: 'cpp', concepts: ['int-division'], site: 'geeksforgeeks', url: 'https://www.geeksforgeeks.org/p/' });
  assert.equal(store.vault.length, 1);
  assert.equal((await V.saveClip({ text: 'cout << 7 / 2;', language: 'cpp', url: 'https://www.geeksforgeeks.org/p/' })).duplicate, true);
  await V.editClip(r.clip.id, { notes: 'prints 3, not 3.5', status: 'difficult' });
  assert.equal(store.vault[0].notes, 'prints 3, not 3.5');
  const rv = await V.reviewClip(r.clip.id, 'mastered');
  assert.equal(rv.reviewCount, 1);
  await V.deleteClip(r.clip.id);
  assert.equal(store.vault.length, 0);
  delete global.chrome;
});

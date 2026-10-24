const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const T = require('../src/lib/templates.js');

function runCpp(src, input) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-tpl-'));
  fs.writeFileSync(path.join(dir, 'a.cpp'), src);
  const c = spawnSync('g++', ['-std=c++17', '-O1', '-o', path.join(dir, 'a'), path.join(dir, 'a.cpp')], { encoding: 'utf8' });
  if (c.status !== 0) return { error: c.stderr };
  const r = spawnSync(path.join(dir, 'a'), [], { input, encoding: 'utf8', timeout: 5000 });
  return { out: r.stdout, code: r.status };
}

test('every built-in C++ template compiles as a full contest program and prints the expected output', () => {
  assert.ok(T.BUILTIN.length >= 15);
  for (const t of T.BUILTIN) {
    const full = T.fullProgram(t);
    assert.match(full, /while \(t--\) solve\(\);/, t.id);
    const r = runCpp(full, t.sample.input);
    assert.ok(!r.error, t.id + ': ' + r.error);
    assert.equal(r.out, t.sample.output, t.id);
  }
});

test('every snippet also compiles inside LeetCode\'s class Solution (as member helpers)', () => {
  for (const t of T.BUILTIN.filter((x) => x.snippet)) {
    // exactly what LeetCode gets: no global `ll`, the insert brings its own class-level alias
    const code = T.forPlatform(t, 'leetcode', 'class Solution {\npublic:\n};').code;
    const src = '#include <bits/stdc++.h>\nusing namespace std;\nclass Solution {\npublic:\n' + code + '\n};\nint main() { Solution s; (void)s; return 0; }\n';
    const r = runCpp(src, '');
    assert.ok(!r.error, t.id + ': ' + r.error);
  }
});

test('platform variants: CodeChef empty editor → full program, otherwise snippet; LeetCode → snippet only', () => {
  const bs = T.BUILTIN.find((x) => x.id === 'cpp-binary-search');
  assert.equal(T.forPlatform(bs, 'codechef', '//write code here...').mode, 'full');
  assert.equal(T.forPlatform(bs, 'codechef', '').mode, 'full');
  assert.equal(T.forPlatform(bs, 'codechef', '#include <bits/stdc++.h>\nint main(){}').mode, 'snippet');
  assert.equal(T.forPlatform(bs, 'codechef', 'x', 'full').mode, 'full', 'user can force full');
  const lc = T.forPlatform(bs, 'leetcode', 'class Solution {};');
  assert.equal(lc.mode, 'snippet');
  assert.doesNotMatch(lc.code, /int main/);
  const gm = T.BUILTIN.find((x) => x.id === 'cpp-gcd-modpow');
  assert.match(T.forPlatform(gm, 'leetcode', 'class Solution {};').code, /^using ll = long long;/, 'brings ll along');
  assert.doesNotMatch(T.forPlatform(gm, 'leetcode', 'class Solution {\n    using ll = long long;\n};').code, /using ll/, 'only once');
  const base = T.BUILTIN.find((x) => x.id === 'cpp-contest-base');
  assert.equal(T.usableOn(base, 'leetcode'), false, 'no main() template on LeetCode');
});

test('search by words and topic, favorites first; library hides deleted built-ins', () => {
  const lib = T.library({ fav: ['cpp-dsu'], hidden: ['cpp-sieve'], custom: [] });
  assert.ok(!lib.some((t) => t.id === 'cpp-sieve'));
  assert.equal(T.search(lib, { q: 'graph' })[0].id, 'cpp-dsu', 'favorite first');
  assert.deepEqual(T.search(lib, { topic: 'two pointers' }).map((t) => t.id), ['cpp-two-pointers']);
  assert.ok(T.search(lib, { q: 'binary search' }).length >= 2);
  assert.ok(T.topicsOf(lib).includes('sliding window'));
  assert.ok(!T.search(lib, { platform: 'leetcode' }).some((t) => t.id === 'cpp-contest-base'));
});

test('your templates: add, edit, favorite, delete (chrome.storage.local)', async () => {
  const data = {};
  global.chrome = { storage: { local: { async get(k) { return { [k]: data[k] && JSON.parse(JSON.stringify(data[k])) }; }, async set(o) { Object.assign(data, JSON.parse(JSON.stringify(o))); } } } };
  const t = await T.saveTemplate({ name: 'My segment tree', topics: 'segment tree, range query', snippet: 'struct Seg {};', body: '    cout << 1 << "\\n";' });
  assert.match(t.id, /^my-/);
  let lib = await T.all();
  assert.ok(lib.some((x) => x.id === t.id && x.custom));
  await T.saveTemplate(Object.assign({}, t, { name: 'My segtree' }));
  lib = await T.all();
  assert.equal(lib.filter((x) => x.custom).length, 1, 'edit replaces, does not duplicate');
  assert.equal(await T.toggleFav(t.id), true);
  assert.equal((await T.all()).find((x) => x.id === t.id).fav, true);
  await T.deleteTemplate(t.id);
  await T.deleteTemplate('cpp-sieve');
  lib = await T.all();
  assert.ok(!lib.some((x) => x.id === t.id || x.id === 'cpp-sieve'));
  await T.restoreBuiltins();
  assert.ok((await T.all()).some((x) => x.id === 'cpp-sieve'));
  delete global.chrome;
});

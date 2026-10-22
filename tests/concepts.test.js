const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tagCpp, tag, conceptsOf, conceptStats, CONCEPTS, strip } = require('../src/lib/concepts.js');

const has = (code, id) => tagCpp(code).includes(id);
const main = (body, pre) => '#include <iostream>\nusing namespace std;\n' + (pre || '') + '\nint main() {\n' + body + '\n}';

test('every concept has a name, explanation, trap and example', () => {
  assert.ok(CONCEPTS.length >= 18);
  CONCEPTS.forEach((c) => {
    assert.ok(c.name && c.what && c.trap && c.body && typeof c.output === 'string', c.id);
  });
  assert.equal(new Set(CONCEPTS.map((c) => c.id)).size, CONCEPTS.length);
});

test('strip removes comments, #include lines and string contents', () => {
  const s = strip('#include <iostream>\n// a % b\nint x = 1; /* 7 / 2 */\ncout << "50% off, a/b";');
  assert.ok(!/%|\/\s*2|iostream/.test(s.clean));
  assert.match(s.withLiterals, /"50% off, a\/b"/);
});

test('loops vs nested loops (braced, unbraced, while inside for)', () => {
  assert.ok(has(main('for (int i = 0; i < 3; i++) cout << i;'), 'loops'));
  assert.ok(!has(main('for (int i = 0; i < 3; i++) cout << i;\nfor (int j = 0; j < 2; j++) cout << j;'), 'nested-loops'), 'two loops side by side are not nested');
  assert.ok(has(main('for (int i = 0; i < 3; i++) {\n  int j = 0;\n  while (j < i) { cout << j; j++; }\n}'), 'nested-loops'));
  assert.ok(has(main('for (int i = 0; i < 2; i++)\n  for (int j = 0; j < 2; j++)\n    cout << i << j;'), 'nested-loops'));
  assert.ok(!has(main('cout << "for (int i = 0; i < 3; i++)";'), 'loops'), 'loop text inside a string');
});

test('integer division: int/int yes; double, comments, strings, printf %d no', () => {
  assert.ok(has(main('cout << 7 / 2;'), 'int-division'));
  assert.ok(has(main('int a = 7, b = 2;\ncout << a / b;'), 'int-division'));
  assert.ok(has(main('int n = 17;\ncout << n % 5;'), 'int-division'), 'modulo');
  assert.ok(!has(main('double a = 7, b = 2;\ncout << a / b;'), 'int-division'));
  assert.ok(!has(main('cout << 7.0 / 2;'), 'int-division'));
  assert.ok(!has(main('// 7 / 2\ncout << "a/b and 50%";'), 'int-division'));
  assert.ok(!has('#include <stdio.h>\nint main() { double x = 1.5; printf("%d %f", 1, x); }', 'int-division'));
});

test('increment tricks only when ++/-- is inside a bigger expression', () => {
  assert.ok(!has(main('int i = 0;\nfor (int k = 0; k < 3; k++) i++;\n++i;\ncout << i;'), 'increment'));
  assert.ok(has(main('int i = 5;\nint a = i++;\ncout << a;'), 'increment'));
  assert.ok(has(main('int i = 5;\ncout << ++i;'), 'increment'));
  assert.ok(has(main('int a[3] = {0}, k = 0;\na[k++] = 4;'), 'increment'));
  assert.ok(!has(main('int a[3] = {0};\na[1]++;'), 'increment'));
});

test('functions, reference parameters and recursion', () => {
  const byVal = main('cout << sq(3);', 'int sq(int x) { return x * x; }');
  assert.deepEqual(['functions', 'reference', 'recursion'].map((id) => has(byVal, id)), [true, false, false]);
  assert.ok(has(main('int a = 1; inc(a);', 'void inc(int &x) { x++; }'), 'reference'));
  assert.ok(has(main('int v = 1; show(v);', 'void show(const string& s) { cout << s; }'), 'reference'));
  assert.ok(!has(main('bool ok = true && false;', ''), 'reference'), '&& is not a reference');
  assert.ok(has(main('cout << fact(4);', 'int fact(int n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}'), 'recursion'));
  assert.ok(!has(main('cout << 1;'), 'functions'), 'main alone is not a function concept');
  assert.ok(!has(main('if (true) { cout << 1; }\nwhile (false) { }'), 'functions'), 'if/while blocks are not functions');
});

test('pointers: declarations, & and *, ->, new — but not multiplication', () => {
  assert.ok(has(main('int x = 5;\nint *p = &x;\ncout << *p;'), 'pointers'));
  assert.ok(has(main('Node* n = new Node();\ncout << n->v;', 'struct Node { int v = 1; };'), 'pointers'));
  assert.ok(!has(main('int a = 3, b = 4;\nint c = a * b;\ncout << a * b << c*2;'), 'pointers'), 'multiplication');
  assert.ok(!has(main('cout << sq(3);', 'int sq(int x) { return x * x; }'), 'pointers'));
});

test('arrays, strings, STL', () => {
  assert.ok(has(main('int arr[5] = {1, 2, 3};\ncout << arr[2];'), 'arrays'));
  assert.ok(has(main('string s = "hi";\ncout << s.length();'), 'strings'));
  assert.ok(!has(main('cout << "just text";'), 'strings'), 'a string literal alone is not the strings concept');
  assert.ok(has('#include <bits/stdc++.h>\nusing namespace std;\nint main() { vector<int> v = {1}; cout << v[0]; }', 'stl'));
  assert.ok(has('#include <map>\nint main() { std::map<int, int> m; m[1] = 2; }', 'stl'));
});

test('casting and char maths; formatting; bitwise vs cout <<', () => {
  assert.ok(has(main("cout << 'A' + 1;"), 'casting'));
  assert.ok(has(main('cout << (int)3.9;'), 'casting'));
  assert.ok(has(main('cout << static_cast<int>(2.5);'), 'casting'));
  assert.ok(!has(main('int x = 3;\ncout << x + 1;'), 'casting'));
  assert.ok(has('#include <iomanip>\n' + main('cout << fixed << setprecision(2) << 3.14159;'), 'formatting'));
  assert.ok(!has(main('cout << 1 << 2 << endl;'), 'bitwise'), 'cout chaining is not a shift');
  assert.ok(has(main('cout << (1 << 3);'), 'bitwise'));
  assert.ok(has(main('int x = 5 & 3;\ncout << x;'), 'bitwise'));
  assert.ok(has(main('int y = 6 ^ 3;\ncout << y;'), 'bitwise'));
  assert.ok(!has(main('if (1 && 0 || 1) cout << 1;'), 'bitwise'), '&& and || are logical');
  assert.ok(!has('#include <vector>\nint main() { std::vector<std::vector<int>> g; }', 'bitwise'), 'template >> is not a shift');
});

test('classes, inheritance, static, exceptions, input, conditions', () => {
  const cls = 'struct T {\n  T() { cout << "+"; }\n  ~T() { cout << "-"; }\n};';
  const tags = tagCpp(main('T a;', cls));
  assert.ok(tags.includes('classes'));
  assert.ok(!tags.includes('bitwise'), 'destructor ~ is not bitwise');
  assert.ok(!tags.includes('functions'), 'constructors are not the functions concept');
  assert.ok(has(main('', 'class A { public: virtual void f() {} };\nclass B : public A {};'), 'inheritance'));
  assert.ok(has(main('', 'void f() { static int c = 0; c++; }'), 'static'));
  assert.ok(!has(main('cout << static_cast<int>(1.5);'), 'static'), 'static_cast is not static');
  assert.ok(has(main('try { throw 1; } catch (int e) { cout << e; }'), 'exceptions'));
  assert.ok(has(main('int n;\ncin >> n;'), 'input'));
  assert.ok(has(main('int x = 3;\ncout << (x > 2 ? "big" : "small");'), 'conditions'));
  assert.ok(!has(main('std::cout << 1;'), 'conditions'), ':: is not a ternary');
});

test('GfG fixture examples get sensible tags', () => {
  const { JSDOM } = require('jsdom');
  const det = require('../src/lib/detector.js');
  const doc = new JSDOM(fs.readFileSync(path.join(__dirname, 'fixtures', 'gfg-like.html'), 'utf8')).window.document;
  const sh = det.extractCode(doc.getElementById('sh-cpp'));
  assert.deepEqual(tagCpp(sh), ['loops']);
  const pre = det.extractCode(doc.getElementById('pre-cpp'));
  assert.deepEqual(tagCpp(pre), ['functions']);
  const tab = det.extractCode(doc.getElementById('tab-cpp'));
  assert.deepEqual(tagCpp(tab), ['input']);
});

test('tagging is per language; old attempts tagged on the fly', () => {
  require('../src/lib/concepts-lang.js');
  assert.ok(tag('for i in range(3):\n    print(i)', 'python').includes('loops'));
  assert.deepEqual(tag('anything', 'kotlin'), [], 'unknown language: no tags');
  assert.deepEqual(tag('for (int i = 0; i < 2; i++) cout << i;', 'cpp'), ['loops']);
  assert.deepEqual(conceptsOf({ code: 'int main() { for (int i = 0; i < 2; i++) std::cout << i; }' }), ['loops'], 'v0.1 attempt, no language field');
  assert.deepEqual(conceptsOf({ language: 'java', code: 'x' }), []);
  assert.deepEqual(conceptsOf({ language: 'cpp', concepts: ['recursion'], code: '' }), ['recursion'], 'saved tags win');
});

test('conceptStats: accuracy per concept and weak flag (>= 3 checked, < 60%)', () => {
  const A = (result, concepts) => ({ result, language: 'cpp', concepts, code: '' });
  const s = conceptStats([
    A('incorrect', ['int-division', 'loops']), A('incorrect', ['int-division']), A('correct', ['int-division']),
    A('correct', ['loops']), A('correct', ['loops']),
    A('compile_error', ['pointers']), A('incorrect', ['pointers'])
  ]);
  const get = (id) => s.find((r) => r.id === id);
  assert.deepEqual([get('int-division').graded, get('int-division').accuracy, get('int-division').weak], [3, 33, true]);
  assert.deepEqual([get('loops').graded, get('loops').accuracy, get('loops').weak], [3, 67, false]);
  assert.deepEqual([get('pointers').graded, get('pointers').weak], [1, false], 'errors not counted; too few to be weak');
  assert.equal(get('recursion').accuracy, null);
  assert.equal(s.length, CONCEPTS.length, 'every concept listed, even untried');
});

// ---------- other languages (v0.6) ----------
const L = require('../src/lib/concepts-lang.js');
const tagL = (code, lang) => L.tag(code, lang);

test('every language has a full catalog with explanations', () => {
  for (const [lang, min] of [['c', 16], ['java', 16], ['python', 16], ['sql', 12]]) {
    const list = L.list(lang);
    assert.ok(list.length >= min, lang + ' has ' + list.length);
    list.forEach((c) => assert.ok(c.name && c.what && c.trap && c.body && typeof c.output === 'string', lang + ':' + c.id));
    assert.equal(new Set(list.map((c) => c.id)).size, list.length, lang + ' ids unique');
  }
});

test('C: macros, structs, pointers (not scanf &), formatting, memory', () => {
  assert.ok(tagL('#define SQ(x) x*x\nint main(){ printf("%d", SQ(3)); }', 'c').includes('macros'));
  assert.ok(tagL('struct P { int x; };\nint main(){ struct P p = {1}; }', 'c').includes('structs'));
  assert.ok(!tagL('int main(){ int a; scanf("%d", &a); printf("%d", a * 2); }', 'c').includes('pointers'), 'scanf & is routine');
  assert.ok(tagL('int main(){ int a; scanf("%d", &a); }', 'c').includes('input'));
  assert.ok(tagL('int main(){ printf("%5.2f", 3.1); }', 'c').includes('formatting'));
  assert.ok(!tagL('int main(){ printf("%d", 3); }', 'c').includes('formatting'), 'plain %d is not formatting');
  assert.ok(tagL('int main(){ int *a = malloc(4); free(a); }', 'c').includes('memory'));
});

test('Java: string traps, collections, static fields (not main), overflow', () => {
  assert.ok(tagL('System.out.println(1 + 2 + "3");', 'java').includes('string-concat'));
  assert.ok(tagL('System.out.println("Sum: " + a + b);', 'java').includes('string-concat'));
  assert.ok(!tagL('System.out.println("Sum: " + a + " end");', 'java').includes('string-concat'), 'plain labelled print');
  assert.ok(tagL('if (a == "x" || a.equals(b)) {}', 'java').includes('string-equality'));
  assert.ok(tagL('List<Integer> l = new ArrayList<>();', 'java').includes('collections'));
  const main = 'public class Main { public static void main(String[] args) { System.out.println(1); } }';
  assert.ok(!tagL(main, 'java').includes('static'), 'main itself is not the static concept');
  assert.ok(!tagL(main, 'java').includes('arrays'), 'String[] args is not the arrays concept');
  assert.ok(tagL('static int count = 0;', 'java').includes('static'));
  assert.ok(tagL('int x = Integer.MAX_VALUE + 1;', 'java').includes('overflow'));
  assert.ok(tagL('class B extends A {}', 'java').includes('inheritance'));
});

test('Python: indentation-aware nested loops & recursion; strings/comments ignored', () => {
  assert.ok(tagL('for i in range(2):\n    for j in range(2):\n        print(i, j)', 'python').includes('nested-loops'));
  assert.ok(!tagL('for i in range(2):\n    print(i)\nfor j in range(2):\n    print(j)', 'python').includes('nested-loops'));
  assert.ok(tagL('def f(n):\n    if n == 0:\n        return 0\n    return f(n - 1)\nprint(f(3))', 'python').includes('recursion'));
  assert.ok(!tagL('print("for x in y: a // b")  # 7 // 2', 'python').includes('division'), 'text in strings/comments ignored');
  assert.ok(tagL('print(7 // 2)', 'python').includes('division'));
  assert.ok(tagL('print(s[1:3])', 'python').includes('slicing'));
  assert.ok(tagL('def add(x, items=[]):\n    return items', 'python').includes('functions'));
  assert.ok(tagL('print("a", end="")', 'python').includes('print'));
  assert.ok(tagL('n = input()\nprint(int(n) + 1)', 'python').includes('input'));
});

test('MySQL: clauses, joins (inner vs outer), NULL (not NOT NULL constraints), strings ignored', () => {
  assert.deepEqual(tagL('SELECT name FROM t WHERE x > 1 ORDER BY name;', 'sql'), ['where', 'order-limit']);
  assert.ok(tagL('SELECT a.x FROM a LEFT JOIN b ON a.id = b.id;', 'sql').includes('left-join'));
  assert.ok(!tagL('SELECT a.x FROM a LEFT JOIN b ON a.id = b.id;', 'sql').includes('inner-join'));
  assert.ok(tagL('SELECT * FROM a JOIN b ON a.id = b.id;', 'sql').includes('inner-join'));
  assert.ok(!tagL('CREATE TABLE t (id INT NOT NULL);', 'sql').includes('null'), 'NOT NULL constraint is not the NULL concept');
  assert.ok(tagL('SELECT * FROM t WHERE d IS NULL;', 'sql').includes('null'));
  assert.ok(!tagL("SELECT 'GROUP BY in text' AS s;", 'sql').includes('group-by'), 'text inside quotes ignored');
  assert.ok(tagL('SELECT d, COUNT(*) FROM t GROUP BY d HAVING COUNT(*) > 1;', 'sql').includes('having'));
});

test('conceptStats per language; old non-C++ attempts tagged on the fly', () => {
  const A = (result, language, code) => ({ result, language, code, concepts: [] });
  const list = [A('incorrect', 'python', 'print(7 // 2)'), A('incorrect', 'python', 'print(-7 // 2)'), A('correct', 'python', 'print(7 / 2)'), A('correct', 'java', 'System.out.print(7 / 2);')];
  const py = L.conceptStats(list, 'python').find((r) => r.id === 'division');
  assert.deepEqual([py.graded, py.accuracy, py.weak], [3, 33, true]);
  assert.equal(L.conceptStats(list, 'python').length, L.list('python').length);
  assert.equal(L.conceptStats(list, 'java').find((r) => r.id === 'int-division').graded, 1, 'languages counted separately');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../src/lib/quiz.js');
const C = require('../src/lib/concepts-lang.js');
const local = require('./local-runner.js');

const GFG = `#include <bits/stdc++.h>
using namespace std;

int main() {
    // for loop to print "i <= 9" 3 times
    for (int i = 1; i <= 3; i++) {
        cout << i << endl;
    }
    int a = 7, b = 2;
    cout << a / b << " " << a++ << endl;
    return 0;
}`;

test('mutations: loop bound, endl, start value, cast, x++ — never inside comments, strings or #include', () => {
  const ms = Q.mutations(GFG, 'cpp');
  assert.deepEqual(ms.map((m) => m.id), ['bound', 'newline', 'value', 'cast', 'incr']);
  const by = Object.fromEntries(ms.map((m) => [m.id, m]));
  assert.equal(by.bound.after, 'for (int i = 1; i < 3; i++) {');
  assert.equal(by.newline.after, 'cout << i << " ";');
  assert.equal(by.value.after, 'for (int i = 3; i <= 3; i++) {');
  assert.equal(by.cast.after, 'cout << (double)a / b << " " << a++ << endl;');
  assert.equal(by.incr.after, 'cout << a / b << " " << ++a << endl;');
  assert.match(by.bound.code, /\/\/ for loop to print "i <= 9" 3 times/, 'comment untouched');
  assert.match(by.cast.code, /#include <bits\/stdc\+\+\.h>/, '#include untouched');
});

test('what-if answers come from really running the changed program; unchanged results are dropped', () => {
  const orig = local.run('cpp', GFG, '').stdout;
  assert.equal(orig, '1\n2\n3\n3 7\n');
  const qs = Q.mutations(GFG, 'cpp').map((m) => Q.whatIfQuestion(m, orig, local.run('cpp', m.code, '')));
  const by = Object.fromEntries(qs.filter(Boolean).map((q) => [q.id, q]));
  assert.equal(by['whatif-bound'].answer, '1\n2\n3 7');
  assert.equal(by['whatif-newline'].answer, '1 2 3 3 7');
  assert.equal(by['whatif-value'].answer, '3\n3 7');
  assert.equal(by['whatif-cast'].answer, '1\n2\n3\n3.5 7');
  assert.equal(by['whatif-incr'].answer, '1\n2\n3\n3 8');
  for (const q of Object.values(by)) {
    assert.ok(q.options.includes(q.answer), q.id + ' has the right answer');
    assert.ok(q.options.length >= 3 && new Set(q.options).size === q.options.length, q.id + ' options unique');
    assert.ok(q.options.includes(q.original), q.id + ' "nothing changes" is a wrong option');
  }
  assert.equal(Q.whatIfQuestion(Q.mutations(GFG)[0], orig, { category: 'ok', stdout: orig }), null, 'same output -> no question');
  assert.equal(Q.whatIfQuestion(Q.mutations(GFG)[0], orig, { category: 'compile_error' }), null);
});

test('concept-bank questions use the verified catalog outputs; options are stable', () => {
  const qs = Q.conceptQuestions(C, 'cpp', C.tag(GFG, 'cpp'), 2);
  assert.equal(qs.length, 2);
  qs.forEach((q) => {
    assert.equal(q.answer, C.get('cpp', q.concept).output.replace(/\s+$/, ''));
    assert.ok(q.options.includes(q.answer));
    assert.deepEqual(q.options, Q.conceptQuestions(C, 'cpp', [q.concept], 1)[0].options, 'same order every time');
  });
});

test('distractors: common mistakes, never the answer, no duplicates', () => {
  assert.deepEqual(Q.distractors('0 1 2 3'), ['0 1 2', '0 1 2 3 4', '0 1 2 4']);
  assert.deepEqual(Q.distractors('3'), ['4', '2', '3.5']);
  assert.ok(Q.distractors('*\n**\n***').includes('*\n**'));
  assert.ok(!Q.distractors('Hi').includes('Hi'));
});

test('Java, C and Python get their own what-if changes; every answer is real (run here with javac / gcc / python3)', () => {
  const P = {
    java: ['public class GFG {\n    public static void main(String[] args) {\n        int a = 7, b = 2;\n        for (int i = 1; i <= 3; i++)\n            System.out.println("i = " + i);\n        System.out.println(a / b + " " + a++);\n    }\n}',
      { bound: 'i = 1\ni = 2\n3 7', newline: 'i = 1i = 2i = 33 7', value: 'i = 1\ni = 2\ni = 3\n4 9', cast: 'i = 1\ni = 2\ni = 3\n3.5 7', incr: 'i = 1\ni = 2\ni = 3\n3 8' }],
    c: ['#include <stdio.h>\nint main() {\n    int a = 7, b = 2;\n    double r = a / b;\n    for (int i = 0; i < 2; i++)\n        printf("%d\\n", i);\n    printf("%.1f\\n", r);\n    printf("%d\\n", a++);\n    return 0;\n}',
      { bound: '0\n1\n2\n3.0\n7', newline: '0 1 3.0\n7', value: '0\n1\n4.0\n9', cast: '0\n1\n3.5\n7', incr: '0\n1\n3.0\n8' }],
    python: ['x = 7\nfor i in range(3):\n    print(i)\nprint(x // 2, x / 2)  # floor and true division\n',
      { bound: '0\n1\n2\n3\n3 3.5', newline: '0 1 2 3 3.5', value: '0\n1\n2\n4 4.5', cast: '0\n1\n2\n3.5 3.5' }]
  };
  for (const [lang, [code, want]] of Object.entries(P)) {
    const orig = local.run(lang, code, '').stdout;
    const got = {};
    for (const m of Q.mutations(code, lang)) {
      const q = Q.whatIfQuestion(m, orig, local.run(lang, m.code, ''));
      if (q) { got[m.id] = q.answer; assert.ok(q.options.includes(q.answer)); }
    }
    assert.deepEqual(got, want, lang);
  }
});

test('C: printf with the same variable twice is not changed (argument order is undefined in C)', () => {
  const ids = Q.mutations('#include <stdio.h>\nint main() { int a = 7; printf("%d %d\\n", a, a++); }', 'c').map((m) => m.id);
  assert.ok(!ids.includes('incr'));
  assert.ok(!ids.includes('cast'), 'no (double) inside printf("%d")');
});

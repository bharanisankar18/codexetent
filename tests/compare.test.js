const test = require('node:test');
const assert = require('node:assert/strict');
const { compareOutput, normalize, firstDifference } = require('../src/lib/compare.js');

test('exact match', () => {
  const r = compareOutput('Hello, World!', 'Hello, World!\n');
  assert.equal(r.correct, true);
  assert.equal(r.kind, 'exact');
  assert.equal(r.diff, null);
});

test('trailing newlines/spaces at very end are ignored', () => {
  assert.equal(compareOutput('1 2 3', '1 2 3 \n\n').correct, true);
  assert.equal(compareOutput('1 2 3\n\n\n', '1 2 3').correct, true);
});

test('CRLF and CR line endings are treated as LF', () => {
  const r = compareOutput('a\r\nb\r\nc', 'a\nb\nc\n');
  assert.equal(r.correct, true);
  assert.ok(r.notes.some((n) => /line endings/.test(n)));
  assert.equal(normalize('x\ry'), 'x\ny');
});

test('leading spaces matter', () => {
  const r = compareOutput('*\n**', ' *\n**');
  assert.equal(r.correct, false);
  assert.equal(r.diff.line, 1);
  assert.equal(r.diff.column, 1);
});

test('spaces inside a line matter', () => {
  const r = compareOutput('Sum=5', 'Sum = 5');
  assert.equal(r.correct, false);
  assert.equal(r.kind, 'mismatch');
  assert.equal(r.diff.line, 1);
  assert.equal(r.diff.column, 4);
});

test('blank lines matter', () => {
  const r = compareOutput('a\nb', 'a\n\nb');
  assert.equal(r.correct, false);
  assert.equal(r.diff.line, 2);
  assert.equal(r.diff.expectedVisible, '(empty line)');
});

test('case matters', () => {
  assert.equal(compareOutput('hello', 'Hello').correct, false);
});

test('per-line trailing spaces: lenient by default, reported', () => {
  const actual = '1 2 3 \n4 5 6 \n';
  const r = compareOutput('1 2 3\n4 5 6', actual);
  assert.equal(r.correct, true);
  assert.equal(r.kind, 'whitespace_only');
  assert.equal(r.diff.line, 1);
  assert.ok(r.notes.some((n) => /lenient/.test(n)));
});

test('per-line trailing spaces: strict mode counts as wrong', () => {
  const r = compareOutput('1 2 3\n4 5 6', '1 2 3 \n4 5 6 \n', { lenientTrailingSpaces: false });
  assert.equal(r.correct, false);
  assert.equal(r.kind, 'whitespace_only');
});

test('missing line in prediction', () => {
  const r = compareOutput('1\n2', '1\n2\n3');
  assert.equal(r.correct, false);
  assert.equal(r.diff.line, 3);
  assert.equal(r.diff.yourVisible, '(no line)');
  assert.match(r.diff.reason, /missing/);
});

test('extra line in prediction', () => {
  const r = compareOutput('1\n2\n3\n4', '1\n2\n3');
  assert.equal(r.diff.line, 4);
  assert.match(r.diff.reason, /extra line/);
});

test('prediction line ends early / has extra chars', () => {
  assert.match(compareOutput('Hello', 'Hello!').diff.reason, /ends early/);
  assert.match(compareOutput('Hello!!', 'Hello!').diff.reason, /extra characters/);
});

test('visible whitespace markers in diff', () => {
  const r = compareOutput('a\tb', 'a b');
  assert.equal(r.diff.expectedVisible, 'a·b');
  assert.equal(r.diff.yourVisible, 'a→b');
});

test('empty prediction vs empty output is correct', () => {
  assert.equal(compareOutput('', '').correct, true);
  assert.equal(compareOutput('   \n', '').correct, true);
});

test('empty prediction vs real output is wrong', () => {
  const r = compareOutput('', 'x');
  assert.equal(r.correct, false);
  assert.equal(r.diff.line, 1);
});

test('unicode output compares exactly', () => {
  assert.equal(compareOutput('π ≈ 3.14', 'π ≈ 3.14\n').correct, true);
});

test('firstDifference returns null for equal strings', () => {
  assert.equal(firstDifference('a\nb', 'a\nb'), null);
});

// ---------- table results (MySQL) ----------
const TABLE = 'name|salary\nMeena|700\nAsha|500\n';
test('table: exact, spaced pipes, tabs and plain spaces all accepted', () => {
  for (const p of ['name|salary\nMeena|700\nAsha|500', 'name | salary\nMeena | 700\nAsha | 500', 'name\tsalary\nMeena\t700\nAsha\t500', 'name salary\nMeena 700\nAsha 500']) {
    assert.equal(compareOutput(p, TABLE, { table: true }).correct, true, JSON.stringify(p));
  }
});
test('table: header row may be left out; ASCII borders are ignored', () => {
  const r = compareOutput('Meena 700\nAsha 500', TABLE, { table: true });
  assert.equal(r.correct, true);
  assert.ok(r.notes.some((n) => /header row was not needed/.test(n)));
  assert.equal(compareOutput('+-------+--------+\n| name  | salary |\n+-------+--------+\n| Meena |    700 |\n| Asha  |    500 |\n+-------+--------+', TABLE, { table: true }).correct, true);
});
test('table: wrong values or order are still wrong; table mode off = exact rules', () => {
  assert.equal(compareOutput('Asha 500\nMeena 700', TABLE, { table: true }).correct, false, 'order matters');
  assert.equal(compareOutput('Meena 700\nAsha 400', TABLE, { table: true }).correct, false);
  assert.equal(compareOutput('Meena 700\nAsha 500', TABLE).correct, false, 'only MySQL uses table mode');
});
test('table: NULL shown as empty cell', () => {
  assert.equal(compareOutput('name|floor\nAsha|3\nJohn|', 'name|floor\nAsha|3\nJohn|\n', { table: true }).correct, true);
});

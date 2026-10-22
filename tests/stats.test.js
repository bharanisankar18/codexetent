const test = require('node:test');
const assert = require('node:assert/strict');
const { computeStats, questionId } = require('../src/lib/stats.js');

const A = (q, result, ts) => ({ id: q + ts, questionId: q, result, ts, code: 'c' + q, prediction: 'p' });

test('questionId is stable and depends on code + stdin', () => {
  assert.equal(questionId('int main(){}', ''), questionId('int main(){}\r\n', ''));
  assert.notEqual(questionId('int main(){}', '1'), questionId('int main(){}', '2'));
  assert.match(questionId('x', ''), /^[0-9a-f]{8}$/);
});

test('empty history', () => {
  const s = computeStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.accuracy, null);
  assert.deepEqual(s.needsRevision, []);
});

test('accuracy ignores compile/runtime errors and timeouts', () => {
  const s = computeStats([A('q1', 'correct', 1), A('q2', 'incorrect', 2), A('q3', 'compile_error', 3), A('q4', 'timeout', 4)]);
  assert.equal(s.graded, 2);
  assert.equal(s.errors, 2);
  assert.equal(s.accuracy, 50);
});

test('needs revision = latest graded attempt per question is wrong', () => {
  const s = computeStats([
    A('q1', 'incorrect', 1), A('q1', 'correct', 5),   // fixed later -> not in revision
    A('q2', 'correct', 2), A('q2', 'incorrect', 6),   // got worse -> revision
    A('q3', 'incorrect', 3), A('q3', 'runtime_error', 7) // last graded wrong -> revision
  ]);
  assert.deepEqual(s.needsRevision.map((a) => a.questionId), ['q2', 'q3']);
  assert.equal(s.questionsSeen, 3);
  assert.equal(s.questionsMastered, 1);
});

test('streak counts trailing correct answers, skipping errors', () => {
  const s = computeStats([A('a', 'incorrect', 1), A('b', 'correct', 2), A('c', 'compile_error', 3), A('d', 'correct', 4)]);
  assert.equal(s.streak, 2);
});

test('recent is newest first and limited', () => {
  const list = Array.from({ length: 12 }, (_, i) => A('q' + i, 'correct', i));
  const s = computeStats(list, 5);
  assert.equal(s.recent.length, 5);
  assert.equal(s.recent[0].ts, 11);
});

test('per-language and per-site accuracy (old attempts count as C++)', () => {
  const list = [
    Object.assign(A('a', 'correct', 1), { language: 'python', url: 'https://www.programiz.com/x' }),
    Object.assign(A('b', 'incorrect', 2), { language: 'python', site: 'programiz' }),
    Object.assign(A('c', 'correct', 3), { url: 'https://www.geeksforgeeks.org/y' }),
    Object.assign(A('d', 'compile_error', 4), { language: 'java', site: 'w3schools' })
  ];
  const s = computeStats(list);
  const py = s.byLanguage.find((g) => g.key === 'python');
  assert.deepEqual([py.correct, py.incorrect, py.accuracy], [1, 1, 50]);
  assert.equal(s.byLanguage.find((g) => g.key === 'cpp').accuracy, 100);
  assert.equal(s.byLanguage.find((g) => g.key === 'java').accuracy, null);
  assert.deepEqual(s.bySite.map((g) => g.key).sort(), ['geeksforgeeks', 'programiz', 'w3schools']);
});

test('dailyActivity buckets the last N days, oldest first', () => {
  const { dailyActivity } = require('../src/lib/stats.js');
  const now = new Date(2026, 9, 21, 15, 0).getTime();
  const day = 86400000;
  const d = dailyActivity([A('a', 'correct', now), A('b', 'incorrect', now - day), A('c', 'timeout', now - day), A('old', 'correct', now - 30 * day)], 14, now);
  assert.equal(d.length, 14);
  assert.deepEqual([d[13].correct, d[13].incorrect], [1, 0]);
  assert.deepEqual([d[12].correct, d[12].incorrect, d[12].errors], [0, 1, 1]);
  assert.equal(d.reduce((n, x) => n + x.correct, 0), 1, '30-day-old attempt excluded');
});

test('siteOf recognises the new learning sites', () => {
  const { siteOf } = require('../src/lib/stats.js');
  assert.equal(siteOf({ url: 'https://www.javatpoint.com/cpp-for-loop' }), 'javatpoint');
  assert.equal(siteOf({ url: 'https://www.scaler.com/topics/java/loops/' }), 'scaler');
  assert.equal(siteOf({ url: 'https://www.studytonight.com/mysql/' }), 'studytonight');
  assert.equal(siteOf({ url: 'https://www.sanfoundry.com/c-questions/' }), 'sanfoundry');
});

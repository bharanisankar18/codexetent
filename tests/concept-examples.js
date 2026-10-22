#!/usr/bin/env node
/*
 * Runs every concept-guide example (C, C++, Java, Python, MySQL) with the local toolchain and checks:
 *   1. the output shown to learners is exactly what the program prints
 *   2. the tagger tags the example with its own concept
 *   node tests/concept-examples.js            (all languages)
 *   node tests/concept-examples.js java       (one language)
 */
const C = require('../src/lib/concepts-lang.js');
const local = require('./local-runner.js');

const only = process.argv[2];
let pass = 0, fail = 0;
for (const lang of ['cpp', 'c', 'java', 'python', 'sql']) {
  if (only && only !== lang) continue;
  console.log(`\n== ${lang} (${C.list(lang).length} concepts)`);
  for (const c of C.list(lang)) {
    const program = C.program(lang, c);
    const r = local.run(lang, program, c.stdin || '');
    const okOut = r.category === 'ok' && r.stdout.replace(/\n$/, '') === c.output.replace(/\n$/, '') && (lang === 'sql' || r.stdout === c.output || r.stdout === c.output + '\n');
    const tags = C.tag(lang === 'sql' ? c.body : program, lang);
    const okTag = tags.includes(c.id);
    const ok = okOut && okTag;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.id.padEnd(16)} ${okOut ? '' : 'output ' + JSON.stringify(r.stdout) + ' expected ' + JSON.stringify(c.output) + ' [' + r.category + '] ' + (r.compileOutput || r.stderr || '').slice(0, 300)} tags [${tags.join(', ')}]${okTag ? '' : ' MISSING ' + c.id}`);
    ok ? pass++ : fail++;
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

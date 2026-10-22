#!/usr/bin/env node
/*
 * Runs the sample programs in tests/programs (C, C++, Java, Python) and checks results +
 * the comparison logic.
 *
 *   node tests/run-programs.js --local     compile & run locally (needs gcc, g++, javac/java, python3)
 *   node tests/run-programs.js --judge0    run through a real Judge0 server (needs internet)
 *
 * Judge0 mode settings (environment variables, all optional):
 *   OUTPUTIQ_ENDPOINT  default https://ce.judge0.com
 *   OUTPUTIQ_AUTH      none | rapidapi | x-auth-token   (default none)
 *   OUTPUTIQ_KEY       API key / token
 *   OUTPUTIQ_ONLY      run only cases whose file name contains this text (e.g. "java")
 */
const fs = require('node:fs');
const path = require('node:path');
const { compareOutput } = require('../src/lib/compare.js');
const judge0 = require('../src/lib/judge0.js');
const local = require('./local-runner.js');

const dir = path.join(__dirname, 'programs');
const cases = JSON.parse(fs.readFileSync(path.join(dir, 'cases.json'), 'utf8'));
const mode = process.argv.includes('--judge0') ? 'judge0' : 'local';
const only = process.env.OUTPUTIQ_ONLY || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runJudge0(lang, source, stdin) {
  const settings = {
    endpoint: process.env.OUTPUTIQ_ENDPOINT || 'https://ce.judge0.com',
    authMode: process.env.OUTPUTIQ_AUTH || 'none',
    apiKey: process.env.OUTPUTIQ_KEY || ''
  };
  return judge0.runCode(settings, lang, source, stdin, { maxWaitMs: 40000 });
}

(async () => {
  let pass = 0, fail = 0;
  const check = (ok, label) => { console.log((ok ? '  PASS ' : '  FAIL ') + label); ok ? pass++ : fail++; };
  const entries = Object.entries(cases).filter(([f]) => f.includes(only));
  console.log(`Running ${entries.length} programs (${mode})\n`);

  for (const [file, exp] of entries) {
    const lang = exp.language || 'cpp';
    console.log(`${file}  [${lang}]`);
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const r = mode === 'local' ? local.run(lang, source, exp.stdin) : await runJudge0(lang, source, exp.stdin);
    check(r.category === exp.category, `category = ${exp.category} (got ${r.category}${r.statusDescription ? ', ' + r.statusDescription : ''}${r.error ? ', ' + r.error : ''})`);
    if (exp.stdout !== undefined) check(r.stdout === exp.stdout, `stdout = ${JSON.stringify(exp.stdout)} (got ${JSON.stringify(r.stdout)})`);
    if (exp.category === 'ok') {
      check(compareOutput(exp.stdout.replace(/\s+$/, ''), r.stdout).correct, 'correct prediction is accepted');
      if (lang === 'sql') check(compareOutput(exp.stdout.split('\n').slice(1).join('\n').replace(/\|/g, ' '), r.stdout, { table: true }).correct, 'table answer without header, space-separated, is accepted');
      if (exp.wrongPrediction) check(!compareOutput(exp.wrongPrediction, r.stdout, { table: lang === 'sql' }).correct, 'wrong prediction is rejected');
      if (exp.lenientPrediction) {
        check(compareOutput(exp.lenientPrediction, r.stdout).kind === 'whitespace_only', 'missing trailing spaces detected as whitespace-only');
        check(compareOutput(exp.lenientPrediction, r.stdout, { lenientTrailingSpaces: true }).correct, 'lenient mode accepts it');
        check(!compareOutput(exp.lenientPrediction, r.stdout, { lenientTrailingSpaces: false }).correct, 'strict mode rejects it');
      }
    }
    if (exp.category === 'compile_error') check(!!(r.compileOutput || '').trim(), 'compiler message present');
    if (mode === 'judge0') await sleep(600); // be gentle with the public server
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

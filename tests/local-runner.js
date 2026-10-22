/*
 * Compiles and runs a program locally (TEST USE ONLY — no sandbox).
 * Returns a Judge0-like result: {category, stdout, stderr, compileOutput, statusDescription, time}
 * Needs: gcc, g++, javac/java, python3 on PATH.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { prepareJava, prepareSql } = require('../src/lib/judge0.js');

const SIG = { SIGSEGV: 'Runtime Error (SIGSEGV)', SIGFPE: 'Runtime Error (SIGFPE)', SIGABRT: 'Runtime Error (SIGABRT)', SIGXFSZ: 'Runtime Error (SIGXFSZ)' };
const LIMIT = { c: 2000, cpp: 2000, java: 6000, python: 3000, sql: 3000 };

function run(language, source, stdin, opts) {
  opts = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiq-run-'));
  const env = Object.assign({}, process.env);
  delete env.JAVA_TOOL_OPTIONS; // keeps "Picked up JAVA_TOOL_OPTIONS" out of stderr
  let cmd, args;

  const compile = (c, a) => {
    const r = spawnSync(c, a, { encoding: 'utf8', env, cwd: dir });
    if (r.error) throw new Error(c + ' not found on PATH');
    return r.status === 0 ? null : { category: 'compile_error', stdout: '', stderr: '', compileOutput: r.stderr || r.stdout, statusDescription: 'Compilation Error' };
  };

  if (language === 'c' || language === 'cpp') {
    const src = path.join(dir, language === 'c' ? 'main.c' : 'main.cpp');
    fs.writeFileSync(src, source);
    const err = compile(language === 'c' ? 'gcc' : 'g++', language === 'c' ? [src, '-o', 'main', '-lm'] : ['-std=c++17', src, '-o', 'main']);
    if (err) return err;
    cmd = path.join(dir, 'main'); args = [];
  } else if (language === 'java') {
    // the mock server receives source already renamed by the extension; prepare again for direct runs
    const prepared = opts.alreadyPrepared ? source : prepareJava(source).code;
    fs.writeFileSync(path.join(dir, 'Main.java'), prepared);
    const err = compile('javac', ['Main.java']);
    if (err) return err;
    cmd = 'java'; args = ['-cp', dir, 'Main'];
  } else if (language === 'sql') {
    // Judge0 uses the sqlite3 CLI; tests/sqlite_cli.py mimics it with Python's sqlite3 module
    fs.writeFileSync(path.join(dir, 'script.sql'), opts.alreadyPrepared ? source : prepareSql(source).code);
    cmd = 'python3'; args = [path.join(__dirname, 'sqlite_cli.py'), path.join(dir, 'script.sql')];
  } else if (language === 'python') {
    fs.writeFileSync(path.join(dir, 'script.py'), source);
    cmd = 'python3'; args = [path.join(dir, 'script.py')];
  } else {
    throw new Error('unsupported language ' + language);
  }

  const t0 = Date.now();
  const r = spawnSync(cmd, args, { input: stdin || '', encoding: 'utf8', timeout: opts.timeoutMs || LIMIT[language], env, cwd: dir });
  const time = ((Date.now() - t0) / 1000).toFixed(3);
  const base = { stdout: r.stdout || '', stderr: r.stderr || '', compileOutput: '', time };
  if (r.error && r.error.code === 'ETIMEDOUT') return Object.assign(base, { category: 'timeout', statusDescription: 'Time Limit Exceeded' });
  if (r.signal) return Object.assign(base, { category: 'runtime_error', statusDescription: SIG[r.signal] || 'Runtime Error (Other)', signal: r.signal });
  if (r.status !== 0) return Object.assign(base, { category: 'runtime_error', statusDescription: 'Runtime Error (NZEC)', exitCode: r.status });
  return Object.assign(base, { category: 'ok', statusDescription: 'Accepted' });
}

module.exports = { run };

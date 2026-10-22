/*
 * OutputIQ — builds the result view (verdict, outputs, first difference).
 * Shared by the in-page panel and the dashboard "retry" view.
 * Uses textContent only — never innerHTML with program output or page text.
 */
(function (root) {
  'use strict';

  function el(doc, tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function preBlock(doc, heading, text) {
    var wrap = el(doc, 'div');
    wrap.appendChild(el(doc, 'div', 'colhead', heading));
    wrap.appendChild(el(doc, 'pre', null, text === '' ? '(nothing printed)' : text));
    return wrap;
  }

  /** Inline code with the differing character highlighted. */
  function markedLine(doc, visibleText, column) {
    var code = el(doc, 'code');
    if (visibleText === '(no line)' || visibleText === '(empty line)') { code.textContent = visibleText; return code; }
    var i = Math.max(0, column - 1);
    code.appendChild(doc.createTextNode(visibleText.slice(0, i)));
    var mark = el(doc, 'span', 'mark', visibleText.slice(i, i + 1) || ' ');
    code.appendChild(mark);
    code.appendChild(doc.createTextNode(visibleText.slice(i + 1)));
    return code;
  }

  /** Beginner-friendly meaning of common crash signals. */
  function crashHint(description) {
    var d = String(description || '');
    if (/SIGFPE/.test(d)) return 'SIGFPE usually means division (or modulo) by zero.';
    if (/SIGSEGV/.test(d)) return 'SIGSEGV means the program touched memory it should not: an array index out of range, a null or dangling pointer, or very deep recursion.';
    if (/SIGABRT/.test(d)) return 'SIGABRT means the program aborted, e.g. an uncaught exception (like vector::at out of range) or a failed assert.';
    if (/NZEC/.test(d)) return 'NZEC means main() ended with a non-zero exit code (for example return 1, or exit(1)).';
    if (/SIGXFSZ/.test(d)) return 'SIGXFSZ means the program printed too much output.';
    return null;
  }

  function verdict(doc, cls, title, sub) {
    var v = el(doc, 'div', 'vd ' + cls, title);
    if (sub) v.appendChild(el(doc, 'small', null, sub));
    return v;
  }

  /**
   * @param {Document} doc
   * @param {object} response  background reply {ok, run, comparison, error}
   * @param {string} prediction
   */
  function renderResult(doc, response, prediction) {
    var box = el(doc, 'div', 'result');
    box.setAttribute('role', 'status');

    if (!response || !response.ok) {
      box.appendChild(verdict(doc, 'warn', 'Could not run the program', (response && response.error) || 'No response from the extension.'));
      return box;
    }

    var run = response.run || {};
    var cmp = response.comparison;

    if (run.category === 'network_error' || run.category === 'http_error' || run.category === 'runner_error') {
      box.appendChild(verdict(doc, 'warn', 'Could not reach the code runner', run.error || ''));
      box.appendChild(el(doc, 'p', 'hint', 'This attempt was not saved. Your prediction is still in the box — try again.'));
      return box;
    }

    if (run.runner) {
      box.appendChild(el(doc, 'p', 'hint runon', run.runner === 'cache' ? 'Instant · saved result'
        : 'Ran on ' + (run.runner === 'wandbox' ? 'Wandbox' : 'Judge0') + (run.ms != null ? ' · ' + (run.ms / 1000).toFixed(1) + ' s' : '')));
    }
    if (run.note) box.appendChild(el(doc, 'p', 'hint', 'ℹ️ ' + run.note));

    if (run.category === 'compile_error') {
      box.appendChild(verdict(doc, 'bad', 'Compilation error', 'The program did not compile, so it printed nothing. Was that your prediction?'));
      box.appendChild(preBlock(doc, 'Compiler message', run.compileOutput || run.message || run.statusDescription));
      return box;
    }

    if (run.category === 'runtime_error') {
      var desc = run.statusDescription || 'program crashed';
      box.appendChild(verdict(doc, 'bad', /^runtime error/i.test(desc) ? desc : 'Runtime error: ' + desc,
        'The program started but stopped with an error. Output printed before the crash is shown below.'));
      var tip = crashHint(desc);
      if (tip) box.appendChild(el(doc, 'p', 'hint', '💡 ' + tip));
      var colsR = el(doc, 'div', 'cols');
      colsR.appendChild(preBlock(doc, 'Your prediction', prediction || ''));
      colsR.appendChild(preBlock(doc, 'Output before the error', run.stdout || ''));
      box.appendChild(colsR);
      var details = [run.stderr, run.message].filter(function (s) { return s && s.trim(); }).join('\n');
      if (details) box.appendChild(preBlock(doc, 'Error details', details));
      return box;
    }

    if (run.category === 'timeout') {
      box.appendChild(verdict(doc, 'warn', 'Time limit exceeded',
        run.error || 'The program ran too long (maybe an infinite loop, or it is waiting for input you did not provide).'));
      if (run.stdout) box.appendChild(preBlock(doc, 'Output before it was stopped', run.stdout));
      return box;
    }

    if (run.category !== 'ok' || !cmp) {
      box.appendChild(verdict(doc, 'warn', 'The code runner had a problem', run.statusDescription || run.error || ''));
      return box;
    }

    if (cmp.correct) {
      box.appendChild(verdict(doc, 'ok', '✅ Correct! Your prediction matches the output.', cmp.kind === 'whitespace_only' ? 'Matched after ignoring trailing spaces at line ends.' : null));
    } else {
      box.appendChild(verdict(doc, 'bad', '❌ Not quite. Compare your prediction with the real output.'));
    }

    if (!cmp.correct || cmp.kind !== 'exact') {
      var cols = el(doc, 'div', 'cols');
      cols.appendChild(preBlock(doc, 'Your prediction', cmp.normalizedPrediction));
      cols.appendChild(preBlock(doc, 'Actual output', cmp.normalizedActual));
      box.appendChild(cols);
    }

    if (cmp.diff) {
      var d = el(doc, 'div', 'diff');
      d.appendChild(el(doc, 'div', null, 'First difference at line ' + cmp.diff.line + ', column ' + cmp.diff.column + '. ' + cmp.diff.reason));
      var exp = el(doc, 'div', null, 'Expected: ');
      exp.appendChild(markedLine(doc, cmp.diff.expectedVisible, cmp.diff.column));
      var yours = el(doc, 'div', null, 'You wrote: ');
      yours.appendChild(markedLine(doc, cmp.diff.yourVisible, cmp.diff.column));
      d.appendChild(exp);
      d.appendChild(yours);
      d.appendChild(el(doc, 'div', 'hint', '· means a space, → means a tab.'));
      box.appendChild(d);
    }

    if (cmp.notes && cmp.notes.length) {
      var ul = el(doc, 'ul', 'notes');
      cmp.notes.forEach(function (n) { ul.appendChild(el(doc, 'li', null, n)); });
      box.appendChild(ul);
    }

    var how = el(doc, 'details');
    how.appendChild(el(doc, 'summary', null, 'How outputs are compared'));
    how.appendChild(el(doc, 'p', 'hint', 'Line endings (\\r\\n) count as normal newlines, and spaces or newlines at the very end of the output are ignored. ' +
      'Everything else, including spaces inside lines and blank lines, must match exactly. Trailing spaces at the end of individual lines can be made strict in Options.'));
    box.appendChild(how);
    return box;
  }

  function firstLine(s, max) {
    var l = String(s || '').split('\n')[0];
    max = max || 60;
    return l.length > max ? l.slice(0, max - 1) + '…' : l;
  }

  /**
   * One-line verdict for the compact bar (pure — no DOM, unit-tested).
   * @returns {{state:'ok'|'bad'|'warn', symbol:string, label:string, text:string}}
   */
  function summarize(response) {
    if (!response || !response.ok) return { state: 'warn', symbol: '!', label: 'Not run', text: (response && response.error) || 'No response from the extension.' };
    var run = response.run || {};
    var cmp = response.comparison;
    if (run.category === 'network_error' || run.category === 'http_error') return { state: 'warn', symbol: '!', label: 'Not run', text: run.error || 'Could not reach the code runner.' };
    if (run.category === 'compile_error') return { state: 'bad', symbol: '✗', label: 'Compile error', text: 'Compilation error: ' + firstLine((run.compileOutput || '').replace(/^.*?error:\s*/s, ''), 70) };
    if (run.category === 'runtime_error') {
      var d = String(run.statusDescription || '');
      var short = /SIGFPE/.test(d) ? 'division by zero?'
        : /SIGSEGV/.test(d) ? 'bad memory access (index out of range / null pointer)?'
        : /SIGABRT/.test(d) ? 'program aborted (uncaught exception / assert)?'
        : /NZEC/.test(d) ? 'exited with an error (exception or non-zero exit code)'
        : /SIGXFSZ/.test(d) ? 'too much output' : '';
      return { state: 'bad', symbol: '✗', label: 'Runtime error', text: (d || 'Runtime error') + (short ? ' — ' + short : '') };
    }
    if (run.category === 'timeout') return { state: 'warn', symbol: '⏱', label: 'Timeout', text: 'Time limit exceeded — infinite loop, or waiting for input?' };
    if (run.category !== 'ok' || !cmp) return { state: 'warn', symbol: '!', label: 'Runner problem', text: run.statusDescription || run.error || 'The code runner had a problem.' };
    if (cmp.correct) return { state: 'ok', symbol: '✓', label: 'Correct', text: cmp.kind === 'whitespace_only' ? 'Correct (trailing spaces ignored)' : 'Correct!' };
    var actual = cmp.normalizedActual === '' ? '(nothing printed)' : firstLine(cmp.normalizedActual, 48) + (cmp.normalizedActual.indexOf('\n') !== -1 ? ' …' : '');
    return { state: 'bad', symbol: '✗', label: 'Wrong', text: 'Output: ' + actual + (cmp.diff ? '  ·  differs at line ' + cmp.diff.line + ', col ' + cmp.diff.column : '') };
  }

  var api = { renderResult: renderResult, summarize: summarize, crashHint: crashHint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.render = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

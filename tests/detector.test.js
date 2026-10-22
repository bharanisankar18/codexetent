const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const det = require('../src/lib/detector.js');

const CPP = '#include <iostream>\nusing namespace std;\nint main() {\n  cout << "hi";\n}\n';
const C = '#include <stdio.h>\nint main() {\n  printf("hi");\n  return 0;\n}';
const JAVA = 'import java.util.*;\npublic class Main {\n  public static void main(String[] a) {\n    System.out.println(1);\n  }\n}';
const PY = 'def greet(name):\n    return "Hi " + name\n\nprint(greet("Ravi"))\n';

const lang = (code, hint, opts) => det.classifyCode(code, hint || null, opts).language;

test('detects each language without markup hints', () => {
  assert.equal(lang(CPP), 'cpp');
  assert.equal(lang(C), 'c');
  assert.equal(lang(JAVA), 'java');
  assert.equal(lang(PY), 'python');
  assert.equal(lang('#include <bits/stdc++.h>\nint main(){ std::vector<int> v; }'), 'cpp');
});

test('runnable only with an entry point (or output for Python)', () => {
  assert.equal(det.classifyCode(CPP).runnable, true);
  assert.equal(det.classifyCode(C).runnable, true);
  assert.equal(det.classifyCode(JAVA).runnable, true);
  assert.equal(det.classifyCode(PY).runnable, true);
  assert.equal(det.classifyCode('template <typename T>\nT add(T a, T b) { return a + b; }\nstd::vector<int> v;').runnable, false);
  assert.equal(det.classifyCode('public class A {\n  int x;\n  void f() { System.out.println(x); }\n}', 'java').runnable, false);
  assert.equal(det.classifyCode('def add(a, b):\n    return a + b\n', 'python').runnable, false, 'python that prints nothing');
});

test('detects programs that read input in every language', () => {
  assert.equal(det.classifyCode('#include <iostream>\nint main(){int a; std::cin >> a;}').readsInput, true);
  assert.equal(det.classifyCode('#include <stdio.h>\nint main(){int a; scanf("%d", &a); printf("%d", a);}').readsInput, true);
  assert.equal(det.classifyCode('import java.util.Scanner;\npublic class Main { public static void main(String[] a) { Scanner s = new Scanner(System.in); System.out.println(s.nextInt()); } }').readsInput, true);
  assert.equal(det.classifyCode('name = input()\nprint("Hi", name)\n', 'python').readsInput, true);
});

test('rejects unsupported languages, shell commands and REPL sessions', () => {
  assert.equal(det.classifyCode('function main() { console.log("hi"); }\nmain();').isCode, false);
  assert.equal(det.classifyCode('using System;\nclass P { static void Main() { Console.WriteLine(1); } }').isCode, false);
  assert.equal(det.classifyCode('g++ -std=c++17 main.cpp -o main && ./main').isCode, false);
  assert.equal(det.classifyCode('$ python3 hello.py\nHello', null).isCode, false);
  assert.equal(det.classifyCode('>>> print("hi")\nhi\n>>> 1 + 1\n2', 'python').runnable, false);
  assert.equal(det.classifyCode(CPP, 'other').isCode, false);
});

test('markup hint wins, but C/C++ content can correct a C label', () => {
  assert.equal(lang(C, 'cpp'), 'cpp', 'C code under a C++ label runs as C++ (valid C++)');
  assert.equal(lang(CPP, 'c'), 'cpp', 'clearly C++ code under a C label');
  assert.equal(lang(CPP, 'java'), 'cpp', 'clearly C++ inside a Java-labelled block runs as C++');
  assert.equal(lang('x = 5\nprint(x * 2)', 'python'), 'python');
});

test('short or empty text is ignored', () => {
  assert.equal(det.classifyCode('').isCode, false);
  assert.equal(det.classifyCode('cout << x;').isCode, false);
});

test('statement-only snippets: wrapped only when the site allows it and they print', () => {
  const snip = 'for (int i = 0; i < 5; i++) {\n  cout << i << "\\n";\n}';
  assert.equal(det.classifyCode(snip, 'cpp').runnable, false);
  const w = det.classifyCode(snip, 'cpp', { allowWrap: true });
  assert.equal(w.runnable, true);
  assert.equal(w.needsWrap, true);
  const syntax = 'for (statement 1; statement 2; statement 3) {\n  // code block to be executed\n}';
  assert.equal(det.classifyCode(syntax, 'cpp', { allowWrap: true }).runnable, false);
});

test('wrapSnippet builds compilable programs', () => {
  const cpp = det.wrapSnippet('cout << 1;', 'cpp');
  assert.match(cpp, /#include <iostream>[\s\S]*using namespace std;[\s\S]*int main\(\) \{\n    cout << 1;\n    return 0;\n\}/);
  assert.match(det.wrapSnippet('printf("%d", 1);', 'c'), /#include <stdio.h>[\s\S]*int main\(\) \{/);
  assert.match(det.wrapSnippet('System.out.println(1);', 'java'), /public class Main \{\n    public static void main\(String\[\] args\) \{\n        System\.out\.println\(1\);/);
});

test('language hints from class attributes', () => {
  const L = det.languageFromClassTokens;
  assert.equal(L('language-cpp'), 'cpp');
  assert.equal(L('lang-c++ line-numbers'), 'cpp');
  assert.equal(L('brush: cpp; gutter: true'), 'cpp');
  assert.equal(L('syntaxhighlighter nogutter cpp'), 'cpp');
  assert.equal(L('language-c'), 'c');
  assert.equal(L('c hljs cpp'), 'cpp', 'bare "c" is ambiguous');
  assert.equal(L('c-exec'), 'c', 'Programiz runnable C block');
  assert.equal(L('cpp-exec'), 'cpp');
  assert.equal(L('java-exec'), 'java');
  assert.equal(L('python-exec'), 'python');
  assert.equal(L('language-java'), 'java');
  assert.equal(L('language-python3'), 'python');
  assert.equal(L('w3-code notranslate pythonHigh'), 'python');
  assert.equal(L('w3-code notranslate javaHigh'), null, 'W3Schools uses javaHigh on C/C++ pages too');
  assert.equal(L('language-bash'), 'other');
  assert.equal(L('code-container'), null);
  assert.equal(L(''), null);
});

test('cleanCode normalises nbsp, zero-width chars, CRLF', () => {
  assert.equal(det.cleanCode('\n\u00A0int\u200B x;\r\n\n'), ' int x;\n');
});

// ---------- DOM: GeeksforGeeks-like fixture ----------

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const load = (name) => new JSDOM(fixture(name)).window.document;

test('GfG: extracts SyntaxHighlighter code line by line (no line numbers, nbsp -> spaces)', () => {
  const doc = load('gfg-like.html');
  const code = det.extractCode(doc.getElementById('sh-cpp'));
  assert.equal(code,
    '#include <iostream>\nusing namespace std;\nint main() {\n    for (int i = 1; i <= 3; i++)\n        cout << i << " ";\n    return 0;\n}\n');
  assert.equal(det.languageHint(doc.getElementById('sh-cpp')), 'cpp');
});

test('GfG: extracts pre/code without copy button text', () => {
  const doc = load('gfg-like.html');
  const code = det.extractCode(doc.getElementById('pre-cpp'));
  assert.ok(code.startsWith('#include <bits/stdc++.h>\n'));
  assert.ok(!/Copy Code/.test(code));
  assert.ok(code.includes('\n\nint square(int x)'), 'blank lines preserved');
});

test('GfG: findCodeBlocks returns outermost blocks only', () => {
  const ids = det.findCodeBlocks(load('gfg-like.html')).map((e) => e.id);
  assert.deepEqual(ids, ['', 'sh-cpp', 'output-block', 'pre-cpp', 'tab-cpp', 'tab-c', 'tab-java', 'tab-python', 'snippet', 'shell', 'comment-cpp']);
});

test('GfG: every language tab is classified correctly', () => {
  const doc = load('gfg-like.html');
  const got = {};
  det.findCodeBlocks(doc).forEach((el) => {
    const info = det.classifyCode(det.extractCode(el), det.languageHint(el));
    if (info.runnable) got[el.id] = info.language;
  });
  delete got['']; delete got['comment-cpp']; // removed later by the adapter's ignoreSelector
  assert.deepEqual(got, { 'sh-cpp': 'cpp', 'pre-cpp': 'cpp', 'tab-cpp': 'cpp', 'tab-c': 'c', 'tab-java': 'java', 'tab-python': 'python' });
});

// ---------- DOM: other sites ----------

test('Programiz: C block with both "c" and "cpp" classes is C; copy button stripped', () => {
  const doc = load('programiz.html');
  const c = doc.getElementById('c-1');
  assert.equal(det.languageFromClassTokens(c.className), 'c');
  const code = det.extractCode(c, '.copy-code-button');
  assert.ok(code.startsWith('#include <stdio.h>\n\nint main() {'));
  const cpp = det.extractCode(doc.getElementById('cpp-1'), '.copy-code-button');
  assert.ok(!/Copy/.test(cpp));
  assert.match(cpp, /cout << i << " ";/);
});

test('W3Schools: <br> lines rebuilt, source newlines ignored, nbsp indentation kept', () => {
  const doc = load('w3schools.html');
  const full = det.extractCode(doc.getElementById('full'), '', { brLayout: true });
  assert.equal(full, '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello World!";\n  return 0;\n}\n');
  const snip = det.extractCode(doc.getElementById('snippet'), '', { brLayout: true });
  assert.equal(snip, 'for (int i = 0; i < 5; i++) {\n  cout << i << "\\n";\n}\n');
});

test('TutorialsPoint: embedded output console is stripped from the code', () => {
  const doc = load('tutorialspoint.html');
  const cpp = det.extractCode(doc.getElementById('cpp-1'), '.output-wrapper, .code-output, .console-close');
  assert.ok(!/value of a: 10\n?$/.test(cpp.split('return 0;')[1] || ''), 'console text not included');
  assert.ok(cpp.trim().endsWith('return 0;\n}'));
  assert.equal(det.languageHint(doc.getElementById('py-1')), 'python');
  const py = det.extractCode(doc.getElementById('py-1'), '.output-wrapper');
  assert.equal(det.classifyCode(py, 'python').runnable, true, 'print (x) with a space is still print');
});

// ---------- MySQL (v0.6) ----------
const SQL_FULL = "CREATE TABLE s (id INT, name VARCHAR(10));\nINSERT INTO s VALUES (1, 'A'), (2, 'B');\nSELECT name FROM s WHERE id > 1;";

test('MySQL: detected without hints; runnable only when it creates the tables it reads', () => {
  const r = det.classifyCode(SQL_FULL);
  assert.equal(r.language, 'sql');
  assert.equal(r.runnable, true);
  assert.equal(det.classifyCode("SELECT * FROM Customers WHERE Country = 'Mexico';", 'sql').runnable, false);
  assert.equal(det.sqlSelfContained("CREATE TABLE a (x INT);\nINSERT INTO a VALUES (1);\nSELECT * FROM a JOIN b ON a.x = b.x;"), false, 'b is not created');
  assert.equal(det.sqlSelfContained("CREATE TABLE a (x INT);\nSELECT * FROM (SELECT x FROM a) t;"), true, 'subquery in FROM');
  assert.equal(det.sqlSelfContained("WITH t AS (SELECT 1 AS x) SELECT x FROM t;"), true, 'CTE');
  assert.equal(det.sqlSelfContained("SELECT 1 + 1 AS two FROM dual;"), true, 'MySQL DUAL');
});

test('MySQL: class hints and REPL transcripts', () => {
  assert.equal(det.languageFromClassTokens('language-sql'), 'sql');
  assert.equal(det.languageFromClassTokens('language-mysql'), 'sql');
  assert.equal(det.languageFromClassTokens('w3-code notranslate sqlHigh'), 'sql');
  assert.equal(det.classifyCode('mysql> SELECT name FROM s;\n+------+\n| name |\n+------+', 'sql').runnable, false);
});

test('MySQL on a C++ page (URL hint cpp) is still recognised as SQL', () => {
  assert.equal(det.classifyCode(SQL_FULL, 'cpp').language, 'sql');
});

test('Python that embeds SQL strings is not mistaken for SQL', () => {
  const py = 'import sqlite3\nconn = sqlite3.connect(":memory:")\nfor row in conn.execute("SELECT 1"):\n    print(row)\n';
  assert.notEqual(det.classifyCode(py).language, 'sql');
});

test('Javatpoint-style textarea block: language from the textarea class', () => {
  const doc = new JSDOM('<div class="codeblock" id="cb"><textarea name="code" class="java">public class Main { public static void main(String[] a) { System.out.println(1); } }</textarea></div>').window.document;
  assert.equal(det.languageHint(doc.getElementById('cb')), 'java');
  assert.match(det.extractCode(doc.getElementById('cb')), /public class Main/);
});

test('strict wrapping (GfG): self-contained Java/C++ snippets run, fragments do not', () => {
  const o = { allowWrap: 'strict', wrapLangs: ['java', 'cpp'] };
  const sw = 'int day = 4;\nswitch (day) {\n  case 6:\n    System.out.println("Today is Saturday");\n    break;\n  default:\n    System.out.println("Looking forward to the Weekend");\n}';
  const r = det.classifyCode(sw, 'java', o);
  assert.equal(r.runnable && r.needsWrap, true);
  assert.equal(det.classifyCode('int x = 5;\nint y = 3;\ncout << x + y;', 'cpp', o).runnable, true);
  assert.equal(det.classifyCode('for (int i = 0; i < n; i++) {\n    std::cout << arr[i];\n}', 'cpp', o).runnable, false, 'n and arr unknown');
  assert.equal(det.classifyCode('System.out.println(myObj.x);  // prints the field', 'java', o).runnable, false);
  assert.equal(det.classifyCode('int x = 5;\nprintf("%d", x);', 'c', o).runnable, false, 'C is not wrapped on GfG yet');
});

/*
 * OutputIQ — C++ concept tags.
 *
 * tagCpp(code) looks for simple patterns (regular expressions + brace matching) in the code
 * AFTER comments, string literals and #include lines are removed, so text inside strings or
 * comments never creates a tag. No AI, no network, instant.
 *
 * Each concept has: what it is, the common trap that makes people predict wrong, and a tiny
 * example whose output is verified with g++ by tests/concept-examples.js.
 *
 * v0.3 scope: C++ only (tested on GeeksforGeeks pages). Other languages return no tags.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- concept guide
  // prelude = code above main(), body = code inside main(), output = exact stdout
  var CONCEPTS = [
    {
      id: 'loops', name: 'Loops',
      what: 'for, while and do-while repeat a block of code while a condition is true.',
      trap: 'Off-by-one: "<" vs "<=" changes how many times the loop runs. Count the iterations exactly.',
      body: 'for (int i = 0; i < 3; i++)\n    cout << i;',
      output: '012'
    },
    {
      id: 'nested-loops', name: 'Nested loops',
      what: 'A loop inside another loop. The inner loop runs completely for every single step of the outer loop.',
      trap: 'Total runs = outer count × inner count. Write the (i, j) pairs in order.',
      body: 'for (int i = 0; i < 2; i++)\n    for (int j = 0; j < 3; j++)\n        cout << i << j << " ";',
      output: '00 01 02 10 11 12 '
    },
    {
      id: 'conditions', name: 'Conditions & switch',
      what: 'if / else, switch and the ternary operator ( ? : ) choose which code runs.',
      trap: 'A switch case without break "falls through" and runs the next cases too.',
      body: 'switch (2) {\n    case 1: cout << "A";\n    case 2: cout << "B";\n    case 3: cout << "C";\n}',
      output: 'BC'
    },
    {
      id: 'int-division', name: 'Integer division & modulo',
      what: 'Dividing two integers gives an integer: the decimal part is thrown away. % gives the remainder.',
      trap: '7 / 2 is 3, not 3.5 — even when the result is stored in a double. Use 7.0 / 2 for 3.5.',
      body: 'double d = 7 / 2;\ncout << 7 / 2 << " " << d << " ";\ncout << 7.0 / 2 << " " << 7 % 3;',
      output: '3 3 3.5 1'
    },
    {
      id: 'increment', name: 'Increment tricks (i++ vs ++i)',
      what: 'i++ uses the value first and then adds 1. ++i adds 1 first and then uses the new value.',
      trap: 'Inside an expression, i++ gives the OLD value. (Changing the same variable twice in one expression is undefined — the output can differ by compiler.)',
      body: 'int i = 5;\nint a = i++;\nint b = ++i;\ncout << a << " " << b << " " << i;',
      output: '5 7 7'
    },
    {
      id: 'functions', name: 'Functions (pass by value)',
      what: 'A function gets a COPY of each normal argument.',
      trap: 'Changing a parameter inside the function does not change the caller\u2019s variable.',
      prelude: 'void change(int x) { x = 10; }',
      body: 'int a = 1;\nchange(a);\ncout << a;',
      output: '1'
    },
    {
      id: 'reference', name: 'Pass by reference (&)',
      what: 'A parameter written as int &x is another name for the caller\u2019s variable, not a copy.',
      trap: 'Changes inside the function DO change the caller\u2019s variable.',
      prelude: 'void change(int &x) { x = 10; }',
      body: 'int a = 1;\nchange(a);\ncout << a;',
      output: '10'
    },
    {
      id: 'recursion', name: 'Recursion',
      what: 'A function that calls itself, with a base case that stops it.',
      trap: 'Code BEFORE the recursive call runs on the way down; code AFTER it runs on the way back up, in reverse order.',
      prelude: 'void show(int n) {\n    if (n == 0) return;\n    cout << n;\n    show(n - 1);\n    cout << n;\n}',
      body: 'show(3);',
      output: '321123'
    },
    {
      id: 'pointers', name: 'Pointers',
      what: 'A pointer stores an address. &x gives the address of x; *p gives the value at that address.',
      trap: 'Writing to *p changes the original variable. Printing p itself prints an address, not the value.',
      body: 'int x = 5;\nint *p = &x;\n*p = 8;\ncout << x;',
      output: '8'
    },
    {
      id: 'arrays', name: 'Arrays',
      what: 'A fixed-size list. Indexes start at 0, so the last element is at size - 1.',
      trap: 'Elements you don\u2019t initialise in a partial list like {1, 2} become 0. Going past the end is undefined behaviour.',
      body: 'int a[5] = {1, 2};\ncout << a[0] << a[1] << a[2] << a[4];',
      output: '1200'
    },
    {
      id: 'strings', name: 'Strings',
      what: 'std::string holds text and has helpers like length(), substr() and +.',
      trap: 'substr(pos, len) takes a START position and a LENGTH, not a start and an end.',
      body: 'string s = "hello";\ncout << s.substr(1, 3) << " " << s.length() << " " << s + "!";',
      output: 'ell 5 hello!'
    },
    {
      id: 'stl', name: 'STL containers',
      what: 'vector, set, map, stack, queue, pair… ready-made data structures.',
      trap: 'set and map keep keys SORTED and UNIQUE; stack pops the LAST item pushed.',
      body: 'set<int> s = {3, 1, 3, 2};\nfor (int x : s) cout << x;\nstack<int> st;\nst.push(1); st.push(2);\ncout << " " << st.top();',
      output: '123 2'
    },
    {
      id: 'casting', name: 'Type casting & char maths',
      what: 'Converting between types, e.g. (int)3.9 or adding numbers to characters.',
      trap: '\'A\' + 1 is the NUMBER 66 (an int), not \'B\'. Casting a double to int cuts off the decimals.',
      body: 'cout << \'A\' + 1 << " " << char(\'A\' + 1) << " " << (int)3.9;',
      output: '66 B 3'
    },
    {
      id: 'formatting', name: 'Output formatting',
      what: 'setprecision, fixed, setw and boolalpha change how numbers and bools are printed.',
      trap: 'Without fixed, setprecision(n) means n SIGNIFICANT digits; with fixed it means n digits after the dot. bool prints 1/0.',
      body: 'cout << setprecision(2) << 3.14159 << " ";\ncout << fixed << 3.14159 << " " << true;',
      output: '3.1 3.14 1'
    },
    {
      id: 'classes', name: 'Classes, constructors & destructors',
      what: 'A class bundles data and functions. The constructor runs when an object is created; the destructor when it is destroyed.',
      trap: 'Destructors run automatically at the end of the scope, in REVERSE order of creation.',
      prelude: 'struct T {\n    char c;\n    T(char x) : c(x) { cout << "+" << c; }\n    ~T() { cout << "-" << c; }\n};',
      body: 'T a(\'a\');\nT b(\'b\');',
      output: '+a+b-b-a'
    },
    {
      id: 'inheritance', name: 'Inheritance & virtual',
      what: 'A derived class extends a base class. virtual lets a base pointer call the derived version.',
      trap: 'Without virtual, a Base* calls the BASE version even if it points to a Derived object.',
      prelude: 'struct Base {\n    void a() { cout << "Ba "; }\n    virtual void b() { cout << "Bb "; }\n};\nstruct Derived : Base {\n    void a() { cout << "Da "; }\n    void b() override { cout << "Db "; }\n};',
      body: 'Derived d;\nBase *p = &d;\np->a();\np->b();',
      output: 'Ba Db '
    },
    {
      id: 'static', name: 'Static variables',
      what: 'A static local variable is created once and keeps its value between function calls.',
      trap: 'The initialisation (= 0) happens only the FIRST time, not on every call.',
      prelude: 'void counter() {\n    static int c = 0;\n    c++;\n    cout << c;\n}',
      body: 'counter();\ncounter();\ncounter();',
      output: '123'
    },
    {
      id: 'bitwise', name: 'Bitwise operators',
      what: '&, |, ^, ~, << and >> work on the individual bits of integers.',
      trap: '& is not &&, ^ is XOR (not power), and with cout you need brackets: cout << (1 << 3).',
      body: 'cout << (5 & 3) << " " << (5 | 3) << " ";\ncout << (5 ^ 3) << " " << (1 << 3);',
      output: '1 7 6 8'
    },
    {
      id: 'exceptions', name: 'Exceptions',
      what: 'throw jumps to the matching catch block.',
      trap: 'Everything after the throw inside the try block is SKIPPED.',
      body: 'try {\n    cout << "A";\n    throw 1;\n    cout << "B";\n} catch (int) {\n    cout << "C";\n}\ncout << "D";',
      output: 'ACD'
    },
    {
      id: 'input', name: 'Reading input',
      what: 'cin >> reads one word or number; getline reads a whole line.',
      trap: 'cin >> stops at spaces, so "Ravi Kumar" read with cin >> gives only "Ravi". Fill the Input box to test.',
      body: 'string first;\ncin >> first;\ncout << "Hi " << first;',
      stdin: 'Ravi Kumar',
      output: 'Hi Ravi'
    }
  ];

  var BY_ID = {};
  CONCEPTS.forEach(function (c) { BY_ID[c.id] = c; });

  /** Full program for an example (used by tests and the dashboard "exact code" view). */
  function exampleProgram(c) {
    return '#include <bits/stdc++.h>\nusing namespace std;\n\n' + (c.prelude ? c.prelude + '\n\n' : '') +
      'int main() {\n' + c.body.split('\n').map(function (l) { return '    ' + l; }).join('\n') + '\n    return 0;\n}\n';
  }

  // ---------------------------------------------------------------- preprocessing

  /**
   * Removes comments and preprocessor lines. Returns two versions:
   *   withLiterals: strings/chars kept (needed for char-maths and printf formats)
   *   clean:        string and char literals replaced by "" / '' (so "a % b" inside text is ignored)
   */
  function strip(code) {
    var src = String(code || '');
    var out = '', clean = '';
    var i = 0, n = src.length;
    while (i < n) {
      var ch = src[i], nx = src[i + 1];
      if (ch === '/' && nx === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (ch === '/' && nx === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') { out += '\n'; clean += '\n'; } i++; } i += 2; continue; }
      if (ch === '"' || ch === '\'') {
        var q = ch, j = i + 1;
        while (j < n && src[j] !== q && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
        out += src.slice(i, j + 1);
        clean += q + q;
        i = j + 1;
        continue;
      }
      out += ch; clean += ch; i++;
    }
    var noPre = function (s) { return s.replace(/^\s*#.*$/gm, ''); };
    return { withLiterals: noPre(out), clean: noPre(clean), raw: out };
  }

  /** Index of the bracket matching the one at `open` (works for ( and {). */
  function matchBracket(s, open) {
    var o = s[open], c = o === '(' ? ')' : o === '{' ? '}' : ']';
    var depth = 0;
    for (var i = open; i < s.length; i++) {
      if (s[i] === o) depth++;
      else if (s[i] === c) { depth--; if (depth === 0) return i; }
    }
    return s.length - 1;
  }

  var NOT_FUNCS = { if: 1, for: 1, while: 1, switch: 1, catch: 1, return: 1, sizeof: 1, main: 1 };

  /** Function definitions: [{name, params, body}] (main excluded). */
  function functionDefs(clean) {
    var defs = [];
    var classNames = {};
    var cr = /\b(?:class|struct)\s+([A-Za-z_]\w*)/g, cm;
    while ((cm = cr.exec(clean))) classNames[cm[1]] = true;
    var re = /\b([A-Za-z_]\w*)\s*\(/g, m;
    while ((m = re.exec(clean))) {
      var name = m[1];
      if (NOT_FUNCS[name] || classNames[name]) continue; // constructors / destructors are not "functions" here
      var open = clean.indexOf('(', m.index + name.length);
      var close = matchBracket(clean, open);
      var after = clean.slice(close + 1).match(/^\s*(?:const\s*)?(?:override\s*)?(?::[^{;]*)?\{/);
      if (!after) continue;
      // must be preceded by a type-ish word (definition, not a call followed by a block)
      var before = clean.slice(Math.max(0, m.index - 60), m.index);
      if (!/(?:[\w>&*~]\s+|[&*]\s*|::|~)$/.test(before) || /\b(?:return|else|new|throw)\s+$/.test(before)) continue;
      var bodyOpen = close + 1 + after[0].length - 1;
      var bodyClose = matchBracket(clean, bodyOpen);
      defs.push({ name: name, params: clean.slice(open + 1, close), body: clean.slice(bodyOpen + 1, bodyClose) });
    }
    return defs;
  }

  /** Loop bodies: [{start, end}] ranges in `clean`. */
  function loops(clean) {
    var out = [];
    var re = /\b(for|while)\s*\(|\bdo\s*\{/g, m;
    while ((m = re.exec(clean))) {
      var bodyStart, bodyEnd;
      if (m[0].indexOf('do') === 0) {
        bodyStart = clean.indexOf('{', m.index);
        bodyEnd = matchBracket(clean, bodyStart);
      } else {
        var open = clean.indexOf('(', m.index);
        var close = matchBracket(clean, open);
        var rest = clean.slice(close + 1);
        var lead = rest.match(/^\s*/)[0].length;
        if (rest[lead] === ';') continue; // do { } while (x);  — the tail of a do-loop
        bodyStart = close + 1 + lead;
        if (clean[bodyStart] === '{') bodyEnd = matchBracket(clean, bodyStart);
        else {
          // single statement (may itself be a loop: for(..) for(..) x;)
          var inner = clean.slice(bodyStart).match(/^(?:for|while)\s*\(/);
          if (inner) {
            var io = clean.indexOf('(', bodyStart);
            var ic = matchBracket(clean, io);
            var after = clean.slice(ic + 1);
            var al = after.match(/^\s*/)[0].length;
            bodyEnd = clean[ic + 1 + al] === '{' ? matchBracket(clean, ic + 1 + al) : clean.indexOf(';', ic + 1);
          } else bodyEnd = clean.indexOf(';', bodyStart);
        }
      }
      out.push({ start: bodyStart, end: bodyEnd < 0 ? clean.length : bodyEnd });
    }
    return out;
  }

  function intVars(clean) {
    var names = {};
    var re = /\b(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:int|long(?:\s+long)?|short|size_t)\s+([^;()]+);/g, m;
    while ((m = re.exec(clean))) {
      m[1].split(',').forEach(function (part) {
        var nm = part.trim().match(/^[*&]?\s*([A-Za-z_]\w*)/);
        if (nm) names[nm[1]] = true;
      });
    }
    // loop counters: for (int i = ...
    var fr = /\bfor\s*\(\s*(?:int|long|short|unsigned)\s+([A-Za-z_]\w*)/g;
    while ((m = fr.exec(clean))) names[m[1]] = true;
    return names;
  }

  // ---------------------------------------------------------------- rules

  var RULES = {
    loops: function (x) { return /\bfor\s*\(|\bwhile\s*\(|\bdo\s*\{/.test(x.clean); },

    'nested-loops': function (x) {
      var ls = loops(x.clean);
      return ls.some(function (a) { return ls.some(function (b) { return b !== a && b.start > a.start && b.end <= a.end; }); });
    },

    conditions: function (x) { return /\bif\s*\(|\bswitch\s*\(|\?[^:;?]*:(?!:)/.test(x.clean); },

    'int-division': function (x) {
      var ints = intVars(x.clean);
      var operand = '([A-Za-z_]\\w*|\\d+)(?![\\w.])';
      var re = new RegExp('(?:^|[^\\w.])' + operand + '\\s*\\/\\s*(?!\\/)' + operand, 'g');
      var m;
      while ((m = re.exec(x.clean))) {
        var isInt = function (t) { return /^\d+$/.test(t) || ints[t]; };
        if (isInt(m[1]) && isInt(m[2])) return true;
      }
      // modulo between two operands (not inside strings — they are blanked)
      return /[\w)\]]\s*%\s*[\w(]/.test(x.clean);
    },

    increment: function (x) {
      // remove for(...) headers: "i++" in a loop header is the normal pattern
      var s = x.clean, out = '', i = 0, re = /\bfor\s*\(/g, m;
      while ((m = re.exec(s))) {
        var open = s.indexOf('(', m.index);
        var close = matchBracket(s, open);
        out += s.slice(i, m.index);
        i = close + 1;
        re.lastIndex = close + 1;
      }
      out += s.slice(i);
      return out.split(/[;{}]/).some(function (stmt) {
        var t = stmt.trim();
        if (!/\+\+|--/.test(t)) return false;
        // plain "i++" / "--i" / "arr[k]++" on its own is not tricky
        return !/^(?:\+\+|--)?\s*[A-Za-z_][\w.\[\]>-]*\s*(?:\+\+|--)?$/.test(t.replace(/->/g, '.'));
      });
    },

    // the lesson is "arguments are copies", so only functions that take parameters count
    functions: function (x) { return x.defs.some(function (d) { return d.params.trim() !== '' && d.params.trim() !== 'void'; }); },

    reference: function (x) {
      return x.defs.some(function (d) { return /(?:^|,)\s*(?:const\s+)?[\w:<>]+\s*&(?!&)\s*\w+/.test(d.params); });
    },

    recursion: function (x) {
      return x.defs.some(function (d) { return new RegExp('\\b' + d.name + '\\s*\\(').test(d.body); });
    },

    pointers: function (x) {
      var c = x.clean;
      return /->/.test(c) ||
        /\bnew\s+\w/.test(c) || /\bnullptr\b|\bNULL\b/.test(c) ||
        /\b(?:int|char|double|float|long|short|bool|void|string|auto|[A-Z]\w*)\s*\*+\s*[A-Za-z_]\w*\s*(?:[=;,)\[])/.test(c) ||
        /(?:[=(,]|return)\s*&\s*[A-Za-z_]/.test(c) ||
        /(?:^|[=(,;{<]\s*|<<\s*|\breturn\s+)\*\s*\(?[A-Za-z_]/m.test(c.replace(/\/\*|\*\//g, ''));
    },

    arrays: function (x) {
      var c = x.clean;
      return /\b[A-Za-z_]\w*\s+[A-Za-z_]\w*\s*\[\s*\w*\s*\](?:\s*\[\s*\w*\s*\])*\s*(?:=|;|,)/.test(c) ||
        /\b(?!argv\b)[A-Za-z_]\w*\s*\[[^\]\n]+\]/.test(c) && !/\b(?:map|unordered_map)\s*</.test(c);
    },

    strings: function (x) {
      return /\bstring\b/.test(x.clean) || /\.\s*(?:substr|find|append|c_str)\s*\(/.test(x.clean) ||
        /\b(?:strlen|strcpy|strcat|strcmp)\s*\(/.test(x.clean) || /\bchar\s+\w+\s*\[/.test(x.clean);
    },

    stl: function (x) { return /\b(?:vector|map|set|unordered_map|unordered_set|multiset|multimap|stack|queue|deque|list|pair|priority_queue|array)\s*</.test(x.clean); },

    casting: function (x) {
      return /\b(?:static_cast|reinterpret_cast)\s*</.test(x.clean) ||
        /\((?:int|double|float|char|long|unsigned|short)\)\s*[\w('(]/.test(x.clean) ||        // C-style (int)x
        /\b(?:int|char|double|float|long)\s*\((?!\s*\*)\s*[^)\s]/.test(x.clean) ||               // functional char(x)
        /'(?:\\.|[^'\\])'\s*[+\-]\s*[\w(]|[\w)]\s*[+\-]\s*'(?:\\.|[^'\\])'/.test(x.withLiterals); // 'A' + 1
    },

    formatting: function (x) {
      return /\b(?:setprecision|setw|setfill)\s*\(|\b(?:fixed|scientific|boolalpha|showpoint|showpos)\b/.test(x.clean) ||
        /\bprintf\s*\(\s*"[^"]*%[-+ 0#]*\d*\.?\d+[a-z]/.test(x.withLiterals);
    },

    classes: function (x) { return /\b(?:class|struct)\s+[A-Za-z_]\w*\s*(?::[^{;]*)?\{/.test(x.clean); },

    inheritance: function (x) { return /\b(?:class|struct)\s+\w+\s*:\s*(?:public|private|protected)?\s*\w+/.test(x.clean) || /\bvirtual\b/.test(x.clean); },

    static: function (x) { return /\bstatic\b/.test(x.clean); },

    bitwise: function (x) {
      var c = x.clean;
      var lines = c.split('\n').filter(function (l) { return !/\b(?:cout|cin|cerr|clog)\b/.test(l); }).join('\n');
      if (/<<|>>/.test(lines.replace(/>>\s*$/gm, '').replace(/<[^<>;]*>>/g, ''))) return true;
      if (/\(\s*[\w]+\s*(?:<<|>>)\s*[\w]+\s*\)/.test(c)) return true; // cout << (1 << 3)
      return /[\w)]\s*\^\s*[\w(]/.test(c) || /(?:[=(,?:]|<<|\breturn)\s*~\s*[\w(]/.test(c) ||
        /[\w)]\s*\|(?!\|)\s*[\w(]/.test(c.replace(/\|\|/g, '')) ||
        /(?:\d|\))\s*&(?!&)\s*[\w(]|[\w)]\s*&(?!&)\s*\d/.test(c);
    },

    exceptions: function (x) { return /\btry\s*\{|\bthrow\b|\bcatch\s*\(/.test(x.clean); },

    input: function (x) { return /\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\(|\bcin\s*\.\s*get/.test(x.clean); }
  };

  // ---------------------------------------------------------------- per-language registry
  // CATALOG[lang] = { concepts: [...], rules: {id: fn(x)}, prepare: code -> x, program: concept -> full source }
  var CATALOG = {};
  function prepareCLike(code) {
    var s = strip(code);
    return { clean: s.clean, withLiterals: s.withLiterals, raw: s.raw, defs: functionDefs(s.clean) };
  }
  function register(lang, def) {
    var byId = {};
    def.concepts.forEach(function (c) { byId[c.id] = c; });
    CATALOG[lang] = { concepts: def.concepts, rules: def.rules, prepare: def.prepare || prepareCLike, program: def.program, byId: byId };
  }
  register('cpp', { concepts: CONCEPTS, rules: RULES, program: exampleProgram });

  function list(lang) { return CATALOG[lang] ? CATALOG[lang].concepts : []; }
  function get(lang, id) { return CATALOG[lang] ? CATALOG[lang].byId[id] || null : null; }
  function has(lang) { return !!CATALOG[lang]; }
  function program(lang, c) { return CATALOG[lang].program(c); }

  /** Concept ids (guide order) found in `code` for `language`. */
  function tag(code, language) {
    var cat = CATALOG[language];
    if (!cat) return [];
    var x = cat.prepare(String(code || ''));
    return cat.concepts.filter(function (c) {
      try { return !!cat.rules[c.id](x); } catch (e) { return false; }
    }).map(function (c) { return c.id; });
  }
  function tagCpp(code) { return tag(code, 'cpp'); }

  /** Tags for an attempt. Saved tags are used when present; otherwise (older versions, or languages
   *  that had no catalog when the attempt was saved) the code is tagged on the fly. */
  function conceptsOf(a) {
    var lang = a.language || 'cpp';
    if (Array.isArray(a.concepts) && a.concepts.length) return a.concepts;
    return tag(a.code || '', lang);
  }

  /**
   * Accuracy per concept over graded attempts (correct/incorrect) of one language.
   * weak = at least MIN_FOR_WEAK checked answers and accuracy below WEAK_BELOW %.
   */
  var MIN_FOR_WEAK = 3, WEAK_BELOW = 60;
  function conceptStats(attempts, lang) {
    lang = lang || 'cpp';
    var concepts = list(lang);
    var acc = {};
    concepts.forEach(function (c) { acc[c.id] = { id: c.id, correct: 0, incorrect: 0, graded: 0, accuracy: null, weak: false }; });
    (attempts || []).forEach(function (a) {
      if ((a.language || 'cpp') !== lang) return;
      if (a.result !== 'correct' && a.result !== 'incorrect') return;
      conceptsOf(a).forEach(function (id) {
        var r = acc[id];
        if (!r) return;
        if (a.result === 'correct') r.correct++; else r.incorrect++;
      });
    });
    return concepts.map(function (c) {
      var r = acc[c.id];
      r.graded = r.correct + r.incorrect;
      r.accuracy = r.graded ? Math.round(r.correct / r.graded * 100) : null;
      r.weak = r.graded >= MIN_FOR_WEAK && r.accuracy < WEAK_BELOW;
      return r;
    });
  }

  var api = {
    CONCEPTS: CONCEPTS, BY_ID: BY_ID, MIN_FOR_WEAK: MIN_FOR_WEAK, WEAK_BELOW: WEAK_BELOW, CATALOG: CATALOG,
    register: register, list: list, get: get, has: has, program: program,
    tag: tag, tagCpp: tagCpp, conceptsOf: conceptsOf, conceptStats: conceptStats,
    exampleProgram: exampleProgram, strip: strip,
    // helpers reused by other languages' rules
    _h: { strip: strip, matchBracket: matchBracket, functionDefs: functionDefs, loops: loops, intVars: intVars, cppRules: RULES }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.concepts = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

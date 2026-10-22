/*
 * Codextent — concept catalogs for C, Java, Python and MySQL (C++ lives in concepts.js).
 * Every example's `output` is verified by tests/concept-examples.js with gcc / javac / python3 / SQLite.
 * Load AFTER concepts.js (it registers into OutputIQ.concepts).
 */
(function (root) {
  'use strict';
  var C = (typeof module !== 'undefined' && module.exports) ? require('./concepts.js') : root.OutputIQ.concepts;
  var H = C._h, R = H.cppRules;
  var indent = function (s, n) { var p = new Array(n + 1).join(' '); return String(s).split('\n').map(function (l) { return l ? p + l : l; }).join('\n'); };

  // =====================================================================================  C
  var C_CONCEPTS = [
    { id: 'loops', name: 'Loops', what: 'for, while and do-while repeat a block while a condition is true.',
      trap: 'Off-by-one: "<" vs "<=" changes how many times the loop runs. Count the iterations exactly.',
      body: 'for (int i = 0; i < 3; i++)\n    printf("%d", i);', output: '012' },
    { id: 'nested-loops', name: 'Nested loops', what: 'A loop inside another loop. The inner loop finishes completely for every step of the outer loop.',
      trap: 'Total runs = outer count × inner count. Write the (i, j) pairs in order.',
      body: 'for (int i = 0; i < 2; i++)\n    for (int j = 0; j < 3; j++)\n        printf("%d%d ", i, j);', output: '00 01 02 10 11 12 ' },
    { id: 'conditions', name: 'Conditions & switch', what: 'if / else, switch and ? : choose which code runs.',
      trap: 'A case without break falls through into the next cases. Also, if (x = 5) assigns and is always true.',
      body: 'switch (2) {\n    case 1: printf("A");\n    case 2: printf("B");\n    case 3: printf("C");\n}', output: 'BC' },
    { id: 'int-division', name: 'Integer division & modulo', what: 'int / int throws away the decimal part. % gives the remainder.',
      trap: '7 / 2 is 3 — even when stored in a double. Write 7.0 / 2 to get 3.5.',
      body: 'double d = 7 / 2;\nprintf("%d %.1f %.1f %d", 7 / 2, d, 7.0 / 2, 7 % 3);', output: '3 3.0 3.5 1' },
    { id: 'increment', name: 'Increment tricks (i++ vs ++i)', what: 'i++ uses the value, then adds 1. ++i adds 1 first.',
      trap: 'Inside an expression i++ gives the OLD value. Changing a variable twice in one expression is undefined.',
      body: 'int i = 5;\nint a = i++;\nint b = ++i;\nprintf("%d %d %d", a, b, i);', output: '5 7 7' },
    { id: 'functions', name: 'Functions (pass by value)', what: 'A function receives COPIES of its arguments.',
      trap: 'Changing a parameter inside the function does not change the caller\u2019s variable.',
      prelude: 'void change(int x) { x = 10; }', body: 'int a = 1;\nchange(a);\nprintf("%d", a);', output: '1' },
    { id: 'pointers', name: 'Pointers & pass by address', what: 'A pointer holds an address: &x is the address of x, *p is the value there.',
      trap: 'To let a function change the caller\u2019s variable in C, pass its address and write through *p.',
      prelude: 'void change(int *p) { *p = 10; }', body: 'int a = 1;\nchange(&a);\nprintf("%d", a);', output: '10' },
    { id: 'arrays', name: 'Arrays', what: 'Fixed-size lists. Indexes start at 0, so the last element is size - 1.',
      trap: 'Missing values in a partial initialiser like {1, 2} become 0. Reading past the end is undefined.',
      body: 'int a[5] = {1, 2};\nprintf("%d%d%d%d", a[0], a[1], a[2], a[4]);', output: '1200' },
    { id: 'strings', name: 'Strings (char arrays)', what: 'A C string is a char array ending with the hidden character \'\\0\'.',
      trap: 'strlen counts the letters; sizeof also counts the \'\\0\' — so "hello" gives 5 and 6.',
      body: 'char s[] = "hello";\nprintf("%zu %zu %c", strlen(s), sizeof(s), s[1]);', output: '5 6 e' },
    { id: 'structs', name: 'Structures', what: 'struct groups several values into one type.',
      trap: 'Assigning one struct to another COPIES all fields; changing the copy leaves the original alone.',
      prelude: 'struct Point { int x, y; };', body: 'struct Point p = {1, 2};\nstruct Point q = p;\nq.x = 9;\nprintf("%d %d", p.x, q.x);', output: '1 9' },
    { id: 'formatting', name: 'printf formatting', what: 'Width, precision and flags in %d / %f change how values are printed.',
      trap: '%5d pads to 5 characters on the left, %-5d on the right, %.2f keeps 2 decimals, %05d pads with zeros.',
      body: 'printf("[%5d][%-5d][%.2f][%05d]", 42, 42, 3.14159, 42);', output: '[   42][42   ][3.14][00042]' },
    { id: 'recursion', name: 'Recursion', what: 'A function that calls itself, with a base case that stops it.',
      trap: 'Code BEFORE the recursive call runs going down; code AFTER it runs coming back up, in reverse.',
      prelude: 'void show(int n) {\n    if (n == 0) return;\n    printf("%d", n);\n    show(n - 1);\n    printf("%d", n);\n}', body: 'show(3);', output: '321123' },
    { id: 'static', name: 'Static variables', what: 'A static local variable is created once and keeps its value between calls.',
      trap: 'The = 0 initialisation happens only the FIRST time, not on every call.',
      prelude: 'void counter(void) {\n    static int c = 0;\n    c++;\n    printf("%d", c);\n}', body: 'counter();\ncounter();\ncounter();', output: '123' },
    { id: 'bitwise', name: 'Bitwise operators', what: '&, |, ^, ~, << and >> work on the bits of integers.',
      trap: '& is not &&, and ^ is XOR, not "power".',
      body: 'printf("%d %d %d %d", 5 & 3, 5 | 3, 5 ^ 3, 1 << 3);', output: '1 7 6 8' },
    { id: 'macros', name: 'Macros (#define)', what: '#define replaces text before the program is compiled.',
      trap: 'Macros paste text, not values: SQUARE(2 + 3) becomes 2 + 3 * 2 + 3 = 11, not 25. Use brackets.',
      prelude: '#define SQUARE(x) x * x', body: 'printf("%d", SQUARE(2 + 3));', output: '11' },
    { id: 'casting', name: 'Type casting & char maths', what: 'Converting between types, e.g. (int)3.9, and doing maths on characters.',
      trap: '\'A\' + 1 is the number 66; printed with %c it is \'B\'. Casting a double to int drops the decimals.',
      body: 'printf("%d %c %d", \'A\' + 1, \'A\' + 1, (int)3.9);', output: '66 B 3' },
    { id: 'memory', name: 'Dynamic memory', what: 'malloc / calloc reserve memory at run time; free gives it back.',
      trap: 'calloc fills the memory with zeros, malloc does NOT — malloc\u2019d values are garbage until you set them.',
      body: 'int *a = calloc(3, sizeof(int));\nprintf("%d%d%d", a[0], a[1], a[2]);\nfree(a);', output: '000' },
    { id: 'input', name: 'Reading input (scanf)', what: 'scanf reads values from the input into variables (note the &).',
      trap: 'Forgetting & in scanf("%d", &x) is a classic crash; %s stops at the first space.',
      body: 'int a, b;\nscanf("%d %d", &a, &b);\nprintf("%d", a + b);', stdin: '4 9', output: '13' }
  ];
  var C_RULES = {
    loops: R.loops, 'nested-loops': R['nested-loops'], conditions: R.conditions, 'int-division': R['int-division'],
    increment: R.increment, functions: R.functions, recursion: R.recursion, static: R.static, bitwise: R.bitwise, casting: R.casting,
    pointers: function (x) {
      var c = x.clean.replace(/\bscanf\s*\([^;]*\)/g, ''); // & in scanf is routine, not the lesson
      return R.pointers({ clean: c, withLiterals: x.withLiterals }) || /\b(?:malloc|calloc)\s*\(/.test(c) && /\*\s*\w+\s*=/.test(c);
    },
    arrays: R.arrays,
    strings: function (x) { return /\bchar\s+\w+\s*\[|\bchar\s*\*\s*\w+\s*=|\bstr(?:len|cpy|ncpy|cat|cmp|chr|str)\s*\(/.test(x.clean) || /"[^"]*%s/.test(x.withLiterals); },
    structs: function (x) { return /\bstruct\s+\w+\s*\{|\btypedef\s+struct\b|\bstruct\s+\w+\s+\w+\s*[=;]/.test(x.clean); },
    formatting: function (x) { return /\bprintf\s*\(\s*"[^"]*%[-+ 0#]*(?:\d+|\d*\.\d+)[a-z]/.test(x.withLiterals); },
    macros: function (x) { return /^\s*#\s*define\s+\w+/m.test(x.raw); },
    memory: function (x) { return /\b(?:malloc|calloc|realloc|free)\s*\(/.test(x.clean); },
    input: function (x) { return /\bscanf\s*\(|\bgetchar\s*\(|\bfgets\s*\(|\bgets\s*\(/.test(x.clean); }
  };
  C.register('c', {
    concepts: C_CONCEPTS, rules: C_RULES,
    program: function (c) {
      return '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\n' + (c.prelude ? c.prelude + '\n\n' : '') +
        'int main(void) {\n' + indent(c.body, 4) + '\n    return 0;\n}\n';
    }
  });

  // =====================================================================================  Java
  var J_CONCEPTS = [
    { id: 'loops', name: 'Loops', what: 'for, while, do-while and for-each repeat a block of code.',
      trap: 'Off-by-one: "<" vs "<=" changes how many times the loop runs.',
      body: 'for (int i = 0; i < 3; i++)\n    System.out.print(i);', output: '012' },
    { id: 'nested-loops', name: 'Nested loops', what: 'The inner loop runs completely for every step of the outer loop.',
      trap: 'Total runs = outer × inner. Write the (i, j) pairs in order.',
      body: 'for (int i = 0; i < 2; i++)\n    for (int j = 0; j < 3; j++)\n        System.out.print(i + "" + j + " ");', output: '00 01 02 10 11 12 ' },
    { id: 'conditions', name: 'Conditions & switch', what: 'if / else, switch and ? : choose which code runs.',
      trap: 'A classic switch case without break falls through into the next cases.',
      body: 'switch (2) {\n    case 1: System.out.print("A");\n    case 2: System.out.print("B");\n    case 3: System.out.print("C");\n}', output: 'BC' },
    { id: 'int-division', name: 'Integer division & modulo', what: 'int / int gives an int: the decimal part is dropped. % is the remainder.',
      trap: '7 / 2 is 3 even when stored in a double (it becomes 3.0). Use 7.0 / 2 for 3.5.',
      body: 'double d = 7 / 2;\nSystem.out.print(7 / 2 + " " + d + " " + 7.0 / 2 + " " + 7 % 3);', output: '3 3.0 3.5 1' },
    { id: 'increment', name: 'Increment tricks (i++ vs ++i)', what: 'i++ uses the value, then adds 1. ++i adds 1 first.',
      trap: 'Inside an expression, i++ gives the OLD value.',
      body: 'int i = 5;\nint a = i++;\nint b = ++i;\nSystem.out.print(a + " " + b + " " + i);', output: '5 7 7' },
    { id: 'string-concat', name: 'String + number (concatenation)', what: '+ adds numbers, but joins text as soon as a String is involved.',
      trap: '+ works left to right: 1 + 2 + "3" is "33", but "3" + 1 + 2 is "312".',
      body: 'System.out.println(1 + 2 + "3" + 4 + 5);\nSystem.out.print("Sum: " + 2 + 3);', output: '3345\nSum: 23' },
    { id: 'string-equality', name: 'Comparing strings (== vs equals)', what: '== compares whether two references point to the SAME object; equals() compares the text.',
      trap: 'Two strings with the same text can still be == false. Always compare text with equals().',
      body: 'String a = "hi";\nString b = new String("hi");\nSystem.out.print((a == b) + " " + a.equals(b));', output: 'false true' },
    { id: 'methods', name: 'Methods (pass by value)', what: 'Java always passes a COPY: of the value for primitives, of the reference for objects/arrays.',
      trap: 'Changing an int parameter does nothing outside; changing an array\u2019s CONTENTS is seen by the caller.',
      prelude: 'static void change(int x, int[] arr) {\n    x = 10;\n    arr[0] = 10;\n}',
      body: 'int x = 1;\nint[] arr = {1};\nchange(x, arr);\nSystem.out.print(x + " " + arr[0]);', output: '1 10' },
    { id: 'arrays', name: 'Arrays', what: 'Fixed-size lists. Indexes start at 0; length is a field, not a method.',
      trap: 'new int[3] is filled with 0s. Using index 3 throws ArrayIndexOutOfBoundsException.',
      body: 'int[] a = new int[3];\na[1] = 5;\nSystem.out.print(a[0] + "" + a[1] + a.length);', output: '053' },
    { id: 'strings', name: 'String methods', what: 'substring, charAt, length, toUpperCase… return information or NEW strings.',
      trap: 'substring(begin, end) stops BEFORE end. Strings are immutable: s.toUpperCase() doesn\u2019t change s.',
      body: 'String s = "hello";\ns.toUpperCase();\nSystem.out.print(s.substring(1, 3) + " " + s.length() + " " + s.charAt(4) + " " + s);', output: 'el 5 o hello' },
    { id: 'collections', name: 'Collections (ArrayList, HashMap…)', what: 'Resizable lists, maps and sets from java.util.',
      trap: 'list.remove(2) removes the item at INDEX 2; list.remove(Integer.valueOf(2)) removes the VALUE 2.',
      body: 'ArrayList<Integer> list = new ArrayList<>(List.of(3, 1, 2));\nCollections.sort(list);\nlist.remove(Integer.valueOf(2));\nSystem.out.print(list + " " + list.size());', output: '[1, 3] 2' },
    { id: 'classes', name: 'Objects & references', what: 'A class describes objects; variables hold REFERENCES to objects.',
      trap: 'Box b = a; does not copy the object — both names point to the same Box.',
      prelude: 'static class Box {\n    int v;\n    Box(int v) { this.v = v; }\n}',
      body: 'Box a = new Box(1);\nBox b = a;\nb.v = 5;\nSystem.out.print(a.v);', output: '5' },
    { id: 'inheritance', name: 'Inheritance & overriding', what: 'A subclass extends a class and can override its methods.',
      trap: 'The ACTUAL object decides which overridden method runs, even through a parent-type variable.',
      prelude: 'static class A { String hi() { return "A"; } }\nstatic class B extends A { String hi() { return "B"; } }',
      body: 'A x = new B();\nSystem.out.print(x.hi());', output: 'B' },
    { id: 'static', name: 'Static members', what: 'A static field belongs to the class and is shared by all objects.',
      trap: 'Every new object changes the SAME static counter.',
      prelude: 'static class Counter {\n    static int n = 0;\n    Counter() { n++; }\n}',
      body: 'new Counter();\nnew Counter();\nSystem.out.print(Counter.n);', output: '2' },
    { id: 'exceptions', name: 'Exceptions (try / catch / finally)', what: 'throw jumps to the matching catch; finally runs no matter what.',
      trap: 'The rest of the try block is skipped after an exception, and finally ALWAYS runs.',
      body: 'try {\n    System.out.print("A");\n    int x = 1 / 0;\n    System.out.print("B");\n} catch (ArithmeticException e) {\n    System.out.print("C");\n} finally {\n    System.out.print("D");\n}', output: 'ACD' },
    { id: 'casting', name: 'Type casting & char maths', what: 'Converting between types, e.g. (int) 3.9, and maths on chars.',
      trap: '\'A\' + 1 is the int 66; cast to (char) to get \'B\'. (int) 3.9 is 3.',
      body: 'System.out.print((\'A\' + 1) + " " + (char) (\'A\' + 1) + " " + (int) 3.9);', output: '66 B 3' },
    { id: 'overflow', name: 'Integer overflow', what: 'int holds values up to 2,147,483,647.',
      trap: 'Going past the limit wraps around silently to a large negative number — no error.',
      body: 'int x = Integer.MAX_VALUE;\nSystem.out.print(x + 1);', output: '-2147483648' },
    { id: 'input', name: 'Reading input (Scanner)', what: 'Scanner reads words, numbers and lines from the input.',
      trap: 'next() reads ONE word; nextLine() reads the rest of the line.',
      body: 'Scanner sc = new Scanner(System.in);\nString first = sc.next();\nSystem.out.print("Hi " + first);', stdin: 'Ravi Kumar', output: 'Hi Ravi' }
  ];
  var J_RULES = {
    loops: function (x) { return /\bfor\s*\(|\bwhile\s*\(|\bdo\s*\{/.test(x.clean); },
    'nested-loops': R['nested-loops'], conditions: R.conditions, increment: R.increment, casting: R.casting,
    'int-division': function (x) { return R['int-division']({ clean: x.clean.replace(/\b(?:byte|short)\s+/g, 'int ') }); },
    'string-concat': function (x) {
      var s = x.withLiterals;
      // 1 + 2 + "3"  (numbers added first, then joined)   |   "Sum: " + 2 + 3  (joined, not added)
      return /(?:^|[(=,;]\s*)(?!")[\w.()]+\s*\+\s*(?!")[\w.()]+\s*\+\s*"/m.test(s) ||
        /"(?:\\.|[^"\\])*"\s*\+\s*(?!")[\w.()]+\s*\+\s*(?!")[\w(]/.test(s);
    },
    'string-equality': function (x) { return /==\s*""|""\s*==|\.equals\s*\(|\bnew\s+String\s*\(/.test(x.clean); },
    methods: function (x) { return x.defs.some(function (d) { return d.params.trim() && !/String\s*\[\]\s*\w+/.test(d.params); }); },
    arrays: function (x) { return /\b\w+\s*\[\s*\]\s*\w+\s*=|\bnew\s+\w+\s*\[|\w\s*\[\s*\w+\s*\]\s*=/.test(x.clean.replace(/String\s*\[\]\s*args/g, '')); },
    strings: function (x) { return /\.\s*(?:substring|charAt|indexOf|toUpperCase|toLowerCase|split|replace|trim|concat|compareTo|contains|startsWith)\s*\(|\bStringBuilder\b/.test(x.clean); },
    collections: function (x) { return /\b(?:ArrayList|LinkedList|HashMap|TreeMap|LinkedHashMap|HashSet|TreeSet|List|Map|Set|Deque|ArrayDeque|Stack|Queue|PriorityQueue)\s*</.test(x.clean); },
    classes: function (x) { return /\bnew\s+(?!String\b|Scanner\b|ArrayList\b|HashMap\b|HashSet\b|LinkedList\b|TreeMap\b|TreeSet\b|StringBuilder\b|Random\b|Integer\b|Object\b|int\b|double\b|char\b|long\b|boolean\b|ArithmeticException\b|\w*Exception\b|ArrayDeque\b|PriorityQueue\b|Stack\b)[A-Z]\w*\s*\(/.test(x.clean); },
    inheritance: function (x) { return /\bextends\b|\bimplements\b|@Override|\babstract\s+class\b|\binterface\s+\w+/.test(x.clean); },
    static: function (x) { return /\bstatic\s+(?!void\s+main\b)(?:final\s+)?(?:int|long|double|String|boolean|char|[A-Z]\w*(?:<[^>]*>)?)\s+\w+\s*[=;]/.test(x.clean); },
    exceptions: function (x) { return /\btry\s*\{|\bthrow\b|\bcatch\s*\(|\bfinally\b/.test(x.clean); },
    overflow: function (x) { return /\b(?:Integer|Long|Short|Byte)\.(?:MAX|MIN)_VALUE\b|\(\s*byte\s*\)|\bbyte\s+\w+\s*=/.test(x.clean); },
    input: function (x) { return /\bnew\s+Scanner\s*\(|\bBufferedReader\b/.test(x.clean); }
  };
  C.register('java', {
    concepts: J_CONCEPTS, rules: J_RULES,
    program: function (c) {
      return 'import java.util.*;\n\npublic class Main {\n' + (c.prelude ? indent(c.prelude, 4) + '\n\n' : '') +
        '    public static void main(String[] args) {\n' + indent(c.body, 8) + '\n    }\n}\n';
    }
  });

  // =====================================================================================  Python
  /** Python prep: comments removed, string contents blanked (prefix kept, e.g. f""). */
  function stripPy(code) {
    var src = String(code || ''), out = '', i = 0, n = src.length;
    while (i < n) {
      var ch = src[i];
      if (ch === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if (ch === '"' || ch === '\'') {
        var triple = src.substr(i, 3) === ch + ch + ch;
        var q = triple ? ch + ch + ch : ch, j = i + q.length;
        while (j < n && src.substr(j, q.length) !== q && (triple || src[j] !== '\n')) { if (src[j] === '\\') j++; j++; }
        out += '""';
        i = j + q.length;
        continue;
      }
      out += ch; i++;
    }
    return out;
  }
  function pyBlocks(clean) { // [{kw, name, indent, body}] for def/for/while blocks
    var lines = clean.split('\n'), res = [];
    lines.forEach(function (l, i) {
      var m = /^(\s*)(def|for|while)\b\s*([A-Za-z_]\w*)?/.exec(l);
      if (!m || !/:\s*$/.test(l)) return;
      var ind = m[1].length, body = [];
      for (var k = i + 1; k < lines.length; k++) {
        if (!lines[k].trim()) continue;
        if (lines[k].match(/^\s*/)[0].length <= ind) break;
        body.push(lines[k]);
      }
      res.push({ kw: m[2], name: m[3] || '', indent: ind, body: body.join('\n') });
    });
    return res;
  }
  var P_CONCEPTS = [
    { id: 'loops', name: 'Loops & range()', what: 'for walks over a sequence; range(a, b) counts from a up to b - 1.',
      trap: 'range stops BEFORE the end value: range(1, 4) gives 1, 2, 3.',
      body: 'for i in range(1, 4):\n    print(i, end="")', output: '123' },
    { id: 'nested-loops', name: 'Nested loops', what: 'The inner loop runs completely for every step of the outer loop.',
      trap: 'Total runs = outer × inner. Write the pairs in order.',
      body: 'for i in range(2):\n    for j in range(3):\n        print(f"{i}{j}", end=" ")', output: '00 01 02 10 11 12 ' },
    { id: 'conditions', name: 'Conditions & truthiness', what: 'if / elif / else pick ONE branch; values like 0, "" and [] count as False.',
      trap: 'The text "0" is True (it is a non-empty string), while the number 0 is False.',
      body: 'for v in [0, "", [], "0"]:\n    print("T" if v else "F", end="")', output: 'FFFT' },
    { id: 'division', name: 'Division: /, // and %', what: '/ always gives a float, // floors (rounds DOWN), % gives the remainder.',
      trap: '7 / 2 is 3.5, 7 // 2 is 3, and -7 // 2 is -4 (it rounds down, not towards zero).',
      body: 'print(7 / 2, 7 // 2, -7 // 2, 7 % 3)', output: '3.5 3 -4 1' },
    { id: 'print', name: 'print(): sep and end', what: 'print puts a space between items and a newline at the end.',
      trap: 'sep= changes the separator and end= replaces the newline, so the next print continues on the same line.',
      body: 'print("a", "b", sep="-", end="!")\nprint("c")', output: 'a-b!c' },
    { id: 'lists', name: 'Lists & aliasing', what: 'Lists are mutable: append, pop, sort… change them in place.',
      trap: 'b = a does NOT copy the list; both names see the same list. Use a.copy() for a real copy.',
      body: 'a = [1, 2]\nb = a\nb.append(3)\nprint(a, len(a))', output: '[1, 2, 3] 3' },
    { id: 'slicing', name: 'Indexing & slicing', what: 's[start:end:step] takes a part of a string or list.',
      trap: 'The end index is excluded; negative numbers count from the end; [::-1] reverses.',
      body: 's = "hello"\nprint(s[1:3], s[-1], s[::-1], s[:2])', output: 'el o olleh he' },
    { id: 'strings', name: 'String methods & f-strings', what: 'upper, split, join, replace, f"{x}"… build and change text.',
      trap: 'Strings are immutable: s.upper() returns a NEW string and s stays the same. "ab" * 3 repeats.',
      body: 's = "hi"\nt = s.upper()\nprint(s, t, s * 3, f"{len(s)}!")', output: 'hi HI hihihi 2!' },
    { id: 'dicts', name: 'Dictionaries', what: 'key → value pairs; keys are unique and keep insertion order.',
      trap: 'Assigning an existing key REPLACES its value; d.get(key, default) avoids a KeyError.',
      body: 'd = {"a": 1}\nd["b"] = 2\nd["a"] = 5\nprint(d, len(d), d.get("z", 0))', output: "{'a': 5, 'b': 2} 2 0" },
    { id: 'functions', name: 'Functions & default arguments', what: 'def creates a function; parameters can have default values.',
      trap: 'A default list is created ONCE and shared by every call, so it keeps growing.',
      prelude: 'def add(x, items=[]):\n    items.append(x)\n    return items', body: 'print(add(1), add(2))', output: '[1, 2] [1, 2]' },
    { id: 'recursion', name: 'Recursion', what: 'A function that calls itself, with a base case that stops it.',
      trap: 'Code BEFORE the recursive call runs going down; code AFTER it runs coming back up, in reverse.',
      prelude: 'def show(n):\n    if n == 0:\n        return\n    print(n, end="")\n    show(n - 1)\n    print(n, end="")', body: 'show(3)', output: '321123' },
    { id: 'comprehensions', name: 'List comprehensions', what: '[expr for x in seq if cond] builds a new list in one line.',
      trap: 'The if filter runs before expr; range(5) is 0–4.',
      body: 'print([x * x for x in range(5) if x % 2 == 0])', output: '[0, 4, 16]' },
    { id: 'classes', name: 'Classes & objects', what: 'A class bundles data and methods; __init__ runs when an object is made.',
      trap: 'A class attribute (count) is SHARED by all objects; self.name belongs to one object.',
      prelude: 'class Dog:\n    count = 0\n    def __init__(self, name):\n        self.name = name\n        Dog.count += 1',
      body: 'Dog("a")\nDog("b")\nprint(Dog.count)', output: '2' },
    { id: 'inheritance', name: 'Inheritance & super()', what: 'A child class extends a parent and can override its methods.',
      trap: 'The child\u2019s method runs; super() calls the parent\u2019s version from inside it.',
      prelude: 'class A:\n    def hi(self):\n        return "A"\n\nclass B(A):\n    def hi(self):\n        return "B" + super().hi()',
      body: 'print(B().hi())', output: 'BA' },
    { id: 'exceptions', name: 'Exceptions (try / except / finally)', what: 'except catches errors; finally always runs.',
      trap: 'After an error the rest of the try block is skipped, and finally ALWAYS runs.',
      body: 'try:\n    print("A", end="")\n    x = 1 / 0\n    print("B", end="")\nexcept ZeroDivisionError:\n    print("C", end="")\nfinally:\n    print("D")', output: 'ACD' },
    { id: 'scope', name: 'Variable scope (global)', what: 'Assigning inside a function creates a LOCAL variable unless you say global.',
      trap: 'x = 10 inside f() does not touch the outer x; only `global x` does.',
      prelude: 'x = 5\n\ndef f():\n    x = 10\n\ndef g():\n    global x\n    x = 20', body: 'f()\nprint(x, end=" ")\ng()\nprint(x)', output: '5 20' },
    { id: 'conversion', name: 'Type conversion', what: 'int(), float(), str() and round() convert between types.',
      trap: 'int(3.9) cuts to 3, str(7) + "1" is "71", and round(2.5) is 2 (rounds to the even number).',
      body: 'print(int("7") + 1, str(7) + "1", int(3.9), round(2.5))', output: '8 71 3 2' },
    { id: 'input', name: 'input() returns text', what: 'input() reads one line of input as a STRING.',
      trap: 'input() + input() joins text; "5" * 2 is "55". Convert with int() first.',
      body: 'n = input()\nprint(n * 2)', stdin: '5', output: '55' }
  ];
  var P_RULES = {
    loops: function (x) { return /^\s*(?:for|while)\b.*:\s*$/m.test(x.clean); },
    'nested-loops': function (x) { return x.blocks.some(function (b) { return (b.kw === 'for' || b.kw === 'while') && /^\s*(?:for|while)\b/m.test(b.body); }); },
    conditions: function (x) { return /^\s*(?:if|elif)\b/m.test(x.clean) || /\S\s+if\s+.+\s+else\s+\S/.test(x.clean); },
    division: function (x) { return /[\w)\]]\s*(?:\/\/?|%)\s*-?[\w(]/.test(x.clean); },
    print: function (x) { return /\bprint\s*\([^)]*\b(?:sep|end)\s*=/.test(x.clean); },
    lists: function (x) { return /\.(?:append|extend|pop|insert|remove|sort|reverse)\s*\(|=\s*\[/.test(x.clean); },
    slicing: function (x) { return /[\w)\]"]\s*\[[^\]\n]*:[^\]\n]*\]/.test(x.clean); },
    strings: function (x) { return /\.(?:upper|lower|split|join|strip|replace|find|startswith|endswith|format|title|count|capitalize)\s*\(|\bf""|""\s*\*\s*\d/.test(x.clean); },
    dicts: function (x) { return /\{\s*(?:""|\w+)\s*:|\bdict\s*\(|\.(?:items|keys|values|get)\s*\(/.test(x.clean); },
    functions: function (x) { return /^\s*def\s+\w+\s*\(\s*(?!self\s*\))[^)\s]/m.test(x.clean); },
    recursion: function (x) { return x.blocks.some(function (b) { return b.kw === 'def' && b.name && new RegExp('\\b' + b.name + '\\s*\\(').test(b.body); }); },
    comprehensions: function (x) { return /\[[^\]\n]*\bfor\b[^\]\n]*\bin\b[^\]\n]*\]|\{[^}\n]*\bfor\b[^}\n]*\bin\b/.test(x.clean); },
    classes: function (x) { return /^\s*class\s+\w+/m.test(x.clean); },
    inheritance: function (x) { return /^\s*class\s+\w+\s*\(\s*(?!object\s*\))\w+/m.test(x.clean) || /\bsuper\s*\(\s*\)/.test(x.clean); },
    exceptions: function (x) { return /^\s*(?:try|except|finally)\b|\braise\b/m.test(x.clean); },
    scope: function (x) { return /^\s*(?:global|nonlocal)\b/m.test(x.clean); },
    conversion: function (x) { return /\b(?:int|float|str|round|bool)\s*\(\s*[^)\s]/.test(x.clean); },
    input: function (x) { return /\binput\s*\(/.test(x.clean); }
  };
  C.register('python', {
    concepts: P_CONCEPTS, rules: P_RULES,
    prepare: function (code) { var clean = stripPy(code); return { clean: clean, blocks: pyBlocks(clean) }; },
    program: function (c) { return (c.prelude ? c.prelude + '\n\n' : '') + c.body + '\n'; }
  });

  // =====================================================================================  MySQL
  var SQL_SETUP = [
    'CREATE TABLE emp (id INT PRIMARY KEY, name VARCHAR(20), dept VARCHAR(10), salary INT);',
    "INSERT INTO emp VALUES (1, 'Asha', 'IT', 500), (2, 'Ravi', 'HR', 300), (3, 'Meena', 'IT', 700), (4, 'John', NULL, 400);",
    'CREATE TABLE dept_info (dept VARCHAR(10), floor INT);',
    "INSERT INTO dept_info VALUES ('IT', 3), ('HR', 1), ('Sales', 2);"
  ].join('\n');
  var SQL_TABLES = 'Sample tables — emp: (1, Asha, IT, 500) (2, Ravi, HR, 300) (3, Meena, IT, 700) (4, John, NULL, 400); dept_info: (IT, 3) (HR, 1) (Sales, 2)';
  var S_CONCEPTS = [
    { id: 'where', name: 'SELECT … WHERE', what: 'WHERE keeps only the rows whose condition is true.',
      trap: 'Without ORDER BY the row order is not guaranteed — always sort when order matters.',
      body: 'SELECT name FROM emp WHERE salary > 400 ORDER BY id;', output: 'name\nAsha\nMeena' },
    { id: 'order-limit', name: 'ORDER BY & LIMIT', what: 'ORDER BY sorts the result; LIMIT keeps the first N rows.',
      trap: 'ORDER BY is ascending unless you write DESC, and LIMIT is applied AFTER sorting.',
      body: 'SELECT name, salary FROM emp ORDER BY salary DESC LIMIT 2;', output: 'name|salary\nMeena|700\nAsha|500' },
    { id: 'aggregates', name: 'COUNT, SUM, AVG, MIN, MAX', what: 'Aggregate functions turn many rows into one value.',
      trap: 'COUNT(*) counts rows, but COUNT(column) skips NULLs — they can differ.',
      body: 'SELECT COUNT(*), COUNT(dept), SUM(salary), MAX(salary) FROM emp;', output: 'COUNT(*)|COUNT(dept)|SUM(salary)|MAX(salary)\n4|3|1900|700' },
    { id: 'group-by', name: 'GROUP BY', what: 'GROUP BY makes one result row per group of equal values.',
      trap: 'You get ONE row per group, not one per original row.',
      body: 'SELECT dept, COUNT(*) AS n FROM emp WHERE dept IS NOT NULL GROUP BY dept ORDER BY dept;', output: 'dept|n\nHR|1\nIT|2' },
    { id: 'having', name: 'HAVING vs WHERE', what: 'WHERE filters rows BEFORE grouping; HAVING filters groups AFTER.',
      trap: 'You can\u2019t use SUM() in WHERE — conditions on totals go in HAVING.',
      body: 'SELECT dept, SUM(salary) AS total FROM emp GROUP BY dept HAVING SUM(salary) > 400 ORDER BY dept;', output: 'dept|total\nIT|1200' },
    { id: 'null', name: 'NULL values', what: 'NULL means "unknown". It is not equal to anything — not even NULL.',
      trap: 'dept = NULL is never true; you must write dept IS NULL.',
      body: 'SELECT COUNT(*) FROM emp WHERE dept = NULL;\nSELECT COUNT(*) FROM emp WHERE dept IS NULL;', output: 'COUNT(*)\n0\nCOUNT(*)\n1' },
    { id: 'distinct', name: 'DISTINCT', what: 'DISTINCT removes duplicate values or rows.',
      trap: 'COUNT(DISTINCT col) counts different values and ignores NULL.',
      body: 'SELECT COUNT(dept), COUNT(DISTINCT dept) FROM emp;', output: 'COUNT(dept)|COUNT(DISTINCT dept)\n3|2' },
    { id: 'inner-join', name: 'INNER JOIN', what: 'JOIN combines rows from two tables where the ON condition matches.',
      trap: 'Rows with no match on the other side disappear (John has no dept, Sales has no employee).',
      body: 'SELECT e.name, d.floor FROM emp e JOIN dept_info d ON e.dept = d.dept ORDER BY e.id;', output: 'name|floor\nAsha|3\nRavi|1\nMeena|3' },
    { id: 'left-join', name: 'LEFT JOIN', what: 'LEFT JOIN keeps every row from the left table, matched or not.',
      trap: 'Unmatched rows are kept with NULL (shown empty) in the right table\u2019s columns.',
      body: 'SELECT e.name, d.floor FROM emp e LEFT JOIN dept_info d ON e.dept = d.dept ORDER BY e.id;', output: 'name|floor\nAsha|3\nRavi|1\nMeena|3\nJohn|' },
    { id: 'like', name: 'LIKE patterns', what: '% matches any number of characters, _ matches exactly one.',
      trap: '\'%a\' means "ends with a". In MySQL LIKE ignores upper/lower case by default.',
      body: "SELECT name FROM emp WHERE name LIKE '%a' ORDER BY id;", output: 'name\nAsha\nMeena' },
    { id: 'subquery', name: 'Subqueries', what: 'A SELECT inside another query, computed first.',
      trap: 'The inner query runs first and gives a value (here the average, 475) used by the outer query.',
      body: 'SELECT name FROM emp WHERE salary > (SELECT AVG(salary) FROM emp) ORDER BY id;', output: 'name\nAsha\nMeena' },
    { id: 'update-delete', name: 'UPDATE & DELETE', what: 'UPDATE changes rows, DELETE removes them; later queries see the changes.',
      trap: 'Without WHERE, UPDATE and DELETE affect EVERY row. Statements run in order.',
      body: "UPDATE emp SET salary = salary + 100 WHERE dept = 'IT';\nDELETE FROM emp WHERE salary < 350;\nSELECT COUNT(*), SUM(salary) FROM emp;", output: 'COUNT(*)|SUM(salary)\n3|1800' },
    { id: 'aliases', name: 'Aliases & expressions', what: 'AS renames a column or table; you can compute in SELECT.',
      trap: 'The alias becomes the column\u2019s header in the output.',
      body: 'SELECT name, salary * 12 AS yearly FROM emp WHERE id = 1;', output: 'name|yearly\nAsha|6000' },
    { id: 'case', name: 'CASE WHEN', what: 'CASE picks a value per row, like if / else.',
      trap: 'The FIRST matching WHEN wins; rows matching none get ELSE (or NULL if there is no ELSE).',
      body: "SELECT name, CASE WHEN salary >= 500 THEN 'high' ELSE 'low' END AS band FROM emp ORDER BY id;", output: 'name|band\nAsha|high\nRavi|low\nMeena|high\nJohn|low' }
  ];
  /** SQL prep: comments removed, '...' strings blanked. */
  function stripSql(code) {
    return String(code || '').replace(/--[^\n]*|#[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/'(?:''|[^'])*'/g, "''");
  }
  var S_RULES = {
    where: function (x) { return /\bWHERE\b/i.test(x.clean); },
    'order-limit': function (x) { return /\bORDER\s+BY\b|\bLIMIT\b/i.test(x.clean); },
    aggregates: function (x) { return /\b(?:COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(x.clean); },
    'group-by': function (x) { return /\bGROUP\s+BY\b/i.test(x.clean); },
    having: function (x) { return /\bHAVING\b/i.test(x.clean); },
    null: function (x) { return /\bIS\s+(?:NOT\s+)?NULL\b|\b(?:IFNULL|COALESCE|ISNULL|NULLIF)\s*\(|=\s*NULL\b|[,(]\s*NULL\s*[,)]/i.test(x.clean); },
    distinct: function (x) { return /\bDISTINCT\b/i.test(x.clean); },
    'inner-join': function (x) {
      var all = (x.clean.match(/\bJOIN\b/gi) || []).length, outer = (x.clean.match(/\b(?:LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?JOIN\b/gi) || []).length;
      return all > outer;
    },
    'left-join': function (x) { return /\b(?:LEFT|RIGHT|FULL)\s+(?:OUTER\s+)?JOIN\b/i.test(x.clean); },
    like: function (x) { return /\bLIKE\b/i.test(x.clean); },
    subquery: function (x) { return /\(\s*SELECT\b/i.test(x.clean); },
    'update-delete': function (x) { return /\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b/i.test(x.clean); },
    aliases: function (x) { return /\bAS\s+[A-Za-z_]/i.test(x.clean); },
    case: function (x) { return /\bCASE\s+WHEN\b/i.test(x.clean); }
  };
  C.register('sql', {
    concepts: S_CONCEPTS.map(function (c) { c.prelude = SQL_SETUP; c.context = SQL_TABLES; return c; }), rules: S_RULES,
    prepare: function (code) { return { clean: stripSql(code) }; },
    program: function (c) { return c.prelude + '\n' + c.body + '\n'; }
  });

  var api = { stripPy: stripPy, stripSql: stripSql, SQL_SETUP: SQL_SETUP };
  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign({}, C, api);
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.conceptsLang = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

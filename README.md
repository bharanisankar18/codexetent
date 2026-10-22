# Codextent — Predict Code Output (Chrome extension) · v0.7

*(formerly OutputIQ)* · Logo `< ⚡ >`. The toolbar icon switches between black (light Chrome) and white (dark Chrome).

Read a code example, **guess what it prints**, check it, see exactly where your guess differed, and learn the
**concepts** behind it. Progress stays in your browser, with no account needed.

| Languages | Learning sites |
|---|---|
| C · C++ · Java · Python · **MySQL** | GeeksforGeeks · Programiz · W3Schools · TutorialsPoint · **Javatpoint · Scaler Topics · Studytonight · Sanfoundry** |

Code runs on a Judge0 server through the extension's background worker, never inside the webpage, and only when you press **Check**.

---

## 1. Install or update
1. Keep **one folder** for Codextent (e.g. `Documents\codextent`) and extract the zip into it, overwriting the old files.
   `manifest.json` must be directly inside.
2. `chrome://extensions` → Developer mode → **Load unpacked** (first time), or click **↻ Reload** on Codextent (updates).
   Always reload from the same folder. Loading from a new folder makes Chrome treat it as a new extension with empty history.
3. Settings → **Test connection** runs a tiny program in C++, C, Java, Python and MySQL and shows ✓ for each.
4. Refresh any tutorial tabs that were already open.

## 2. Use it
- Under each runnable example there's a small **`< ⚡ >`** button. Click it to open a slim bar:
  `[MySQL] [ What will it print? ] [Check] (✓) ⓘ ↓ ×`
  - **Enter** checks your answer. **Shift+Enter** adds a new line. An **Input** box appears if the program reads input.
  - The result shows as a symbol, by **shape**: filled ✓ correct, outlined ✗ wrong or error, square ⏱/! timeout or not run.
    One short line underneath shows the real output, plus the **concept tags** (only after you answer, so they never give hints).
  - **ⓘ / Details** opens the full comparison, the trap for each concept in the example, and the exact code that ran.
  - **↓** jumps to the next example on the page.
- **MySQL:** an example gets a button only if it creates the tables it reads (W3Schools' `SELECT * FROM Customers` can't run,
  because we don't have their database). It runs on Judge0's SQL engine (SQLite), with MySQL-only options such as `AUTO_INCREMENT`,
  `ENGINE=` and `CREATE DATABASE`/`USE` removed. Type table answers however you like: `Asha|500`, `Asha 500`, tabs, or ASCII
  borders, **with or without the header row**.
- **Java:** if the class with `main()` isn't called `Main` (GfG uses `GFG`), it's renamed automatically before running.
- **W3Schools:** statement-only snippets that print are wrapped in `main()` automatically.

## 3. Concepts (all languages)
| Language | Concepts |
|---|---|
| C++ (20) | loops, nested loops, conditions/switch, integer division & %, i++ vs ++i, functions, pass by reference, recursion, pointers, arrays, strings, STL, casting & char maths, output formatting, classes, inheritance & virtual, static, bitwise, exceptions, input |
| C (18) | loops, nested loops, conditions/switch, integer division, i++/++i, functions, pointers & pass by address, arrays, strings (`\0`, strlen vs sizeof), structs, printf formatting, recursion, static, bitwise, **macros**, casting, **dynamic memory**, scanf input |
| Java (18) | loops, nested loops, switch, integer division, i++/++i, **String + number**, **== vs equals**, methods (pass by value), arrays, String methods, collections, objects & references, inheritance & overriding, static members, try/catch/**finally**, casting, **integer overflow**, Scanner |
| Python (18) | loops & range, nested loops, truthiness, **/ vs // vs %**, print sep/end, lists & aliasing, slicing, strings & f-strings, dicts, **default-argument trap**, recursion, comprehensions, classes, inheritance & super, exceptions, global scope, type conversion, input() returns text |
| MySQL (14) | WHERE, ORDER BY/LIMIT, aggregates (COUNT(*) vs COUNT(col)), GROUP BY, HAVING vs WHERE, NULL (`= NULL` vs `IS NULL`), DISTINCT, INNER JOIN, LEFT JOIN, LIKE, subqueries, UPDATE/DELETE, aliases, CASE WHEN |

Each concept has **what it is**, **the common trap**, and a tiny **example with its exact output**. All 88 examples are verified
by running them (`tests/concept-examples.js`). Tags come from rules run on the code after comments and string contents are removed.
There's no AI and no network.

## 4. Code Clipper → My Revision Vault
Select code (or text) on any supported site, then **right-click → Save to My Revision Vault**, or click the Codextent icon →
**Clip selection**, or press **Alt+Shift+S**, or press the bookmark in the `< ⚡ >` bar to save that whole example.
Each clip keeps the code with its line breaks, the language, the concept, the website and page link, your **notes** and a
**status** (New · Learning · Difficult · Mastered). The vault has search, filters (status, website, concept, language), a
"Revisit difficult" row and **Start revision**: one clip at a time, answer Still difficult / Getting there / Got it, and it
comes back in 1 / 3 / 14 days. Clips stay only in this browser.

## 5. My Learning Hub
Sidebar: **My Revision Vault · My Learning Hub · Recent attempts · Needs revision · Concepts · Settings**. The hub shows recent
attempts and needs-revision first, then the vault, overview, compact Top concepts and Websites (**View full** expands them) and
Daily activity at the bottom. Old notes below:
Sidebar (before v0.7): **Dashboard · Recent attempts · Needs revision · Concepts · Settings**. Compact language switcher (All, C, C++, Java,
Python, MySQL) at the top right. Dashboard page: overview tiles with "today", an accuracy ring, a **Top concepts** table, the
**Websites** (8, click to filter), a 14-day **Activity** chart (hover for details), recent attempts and revision.
Attempt cards show the topic, website · language · time, and ✓/✗. **Topics & output** shows your output vs the actual output,
then the subtopics with their traps, plus Retry. **Concepts** page: per language, a "Focus on" list of weak spots, every concept
explained, and the problems you did with each.

## 5. Settings
- **Appearance:** **Dark** (default, black & white), **Light**, **Auto** (follows your system) and **Night sky**. It applies instantly
  to the dashboard, popup, Settings and the in-page bar. The dark theme has a soft spotlight, fine film grain and a vignette for a
  realistic finish, and the glow appears only on hover.
- **Code runner:** Judge0 CE public server (default, no key), RapidAPI (your key) or self-hosted. Language IDs: C 50, C++ 54,
  Java 62, Python 71, SQL 82. The key is stored only in `chrome.storage.local` and is never visible to websites.
- **Comparing outputs:** Windows line endings and whitespace at the very end are ignored; trailing spaces on each line are
  lenient by default (strict is optional); MySQL compares cell by cell.

---

## 6. Tests
Needs Node 18+. Program tests also need `gcc`, `g++`, `javac`/`java`, `python3` (MySQL is emulated with Python's sqlite3).
```bash
npm install
npm test               # 131 unit + integration tests (8 sites' fixtures, themes, MySQL, concepts in 5 languages)
npm run test:programs  # 19 sample programs (70 checks) + 88 concept examples run for real
npm run test:judge0    # the sample programs on the REAL Judge0 server (needs internet)
npm run test:e2e       # real extension in Chromium + mock Judge0 — 23 checks
npm run check          # every file referenced by manifest.json exists
```

| What | Status |
|---|---|
| Programiz, W3Schools, TutorialsPoint page structure | Inspected live; fixtures built from it |
| Javatpoint, Scaler Topics, Studytonight, Sanfoundry | **Not inspected live** (the browser couldn't open them). Generic `<pre>` detector + URL language rules + Javatpoint's `div.codeblock`; check on real pages |
| Real Judge0 (incl. SQL id 82 and `.headers on`) | ⏳ run `npm run test:judge0` / Test connection |

### Manual checklist
- [ ] Settings → Test connection: ✓ for all 5 languages
- [ ] Settings → Appearance: try Light, Night sky and Auto; the dashboard and the bar on a tutorial page change instantly
- [ ] A MySQL example that creates its tables (GfG/Javatpoint): button appears, `Asha 500` style answers are accepted
- [ ] One page on each new site: buttons under runnable examples only, with the correct language tag

## 7. Project structure
```
src/lib/concepts.js        C++ catalog + per-language registry, tagging, stats
src/lib/concepts-lang.js   C, Java, Python, MySQL catalogs and rules
src/lib/detector.js        language detection (5 languages), SQL self-contained check, extraction
src/lib/judge0.js          Judge0 client: ids, limits, Java rename, MySQL→SQLite prep
src/lib/compare.js         exact comparison + table mode for MySQL
src/content/               adapters (8 sites), in-page bar (themed), styles
src/ui/theme.js            Dark / Light / Auto / Night sky for extension pages
src/dashboard/ src/popup/ src/options/
tests/                     unit, fixtures, programs/, concept-examples.js, local-runner.js, sqlite_cli.py, e2e/
HANDOFF.md                 project state and decisions for the next developer/agent
```

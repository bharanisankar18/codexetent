# Codextent (formerly OutputIQ) — Handoff Notes (read this first)

> **For any AI agent or developer picking this up:** this file is the single source of truth
> for project state. Read it fully before changing code, and update "Status", "Next steps"
> and "Change log" when you stop.

## What this project is

A Chrome extension (Manifest V3) that lets learners **predict the output of code examples**
on tutorial sites, run the code through a **Judge0-compatible API**, compare, and track
progress locally. Owner: Sukumar M. Requirements: "plan of the project" doc in the claude.ai
Project "OutputIQ". User docs: `README.md`.

## Scope decisions (agreed with the owner — don't change without asking)

| Decision | Choice |
|---|---|
| Languages | **C, C++, Java, Python, MySQL** (MySQL since v0.6). v0.1 was C++ only |
| Websites | **GeeksforGeeks, Programiz, W3Schools, TutorialsPoint** (`https://www.<site>/*`) |
| In-page UI | **Logo only** by default (purple "?" button after the example). Click → **slim horizontal bar**: logo, language tag, 1-line auto-growing answer box, Check, **✓/✗ symbol at the side**, ⓘ details, ↓ next, × close. One short result line below. Details open **inline**, never an overlay/modal. Owner asked for "short text, correct/wrong as symbol, not covering the screen, next" |
| Concept tags (v0.3) | **C++ only**, owner asked to start with GfG + C++. Tags shown **only after answering** (no hints). Details lists each concept's trap. Dashboard "C++ concepts": Focus-on weak strip (>=3 checked, <60%), every concept expandable (what / trap / example with g++-verified output), "Show my questions" sets the concept filter; untried concepts listed as a guide until practice starts, then folded |
| Name | **Codextent** (renamed from OutputIQ in v0.5). Visible strings renamed; internal JS namespace `globalThis.OutputIQ`, storage keys and the project folder name are unchanged on purpose. Logo (v0.5.1): owner chose `< ⚡ >` (chevrons + sharp lightning bolt), NO circle. icons/icon*.png = black mark (light toolbars, manifest default); icons/icon-white*.png = white mark; background switches via chrome.action.setIcon on a THEME message {dark} sent by content script + popup (matchMedia prefers-color-scheme). Sources: icons/logo-dark.svg, logo-white.svg. Small sizes use thicker strokes. In-page button = same mark on a black rounded tile |
| Dashboard (v0.5) | Owner's reference: dark admin-dashboard layout, but **black & white, Apple-like, glow ONLY on hover**, compact language switcher top-right, **Languages section removed**. Pages: Dashboard (overview tiles with today deltas, accuracy ring, Top concepts table, Websites, Activity line chart with crosshair/tooltip, recent + revision), Recent, Needs revision, Concepts. Monochrome status: filled ✓ correct, outlined ✗ wrong, square ! / ⏱ errors. Real language logos are NOT bundled (trademarks; Claude won't draw them) — optional files icons/lang/{c,cpp,java,python}.svg are picked up automatically, else lettermarks |
| Dashboard (v0.4, replaced) | Owner asked for a more "fantasy" design: dark night-sky theme (self-contained dashboard.css, no pages.css), sidebar nav (#home #recent #revision #concepts hash routes), header language tabs + Home language cards (selection glows, filters all views, saved in localStorage oiq-dash), attempt card = emblem circle + topic / site · language · time, "Topics & output" expands to your output vs actual output THEN subtopics (concept chips + traps) THEN Retry/Open page. Concepts page per language: C++ live incl. "Problems you did with X"; C/Java/Python = designed coming-soon page. Design covers 4 languages + 4 sites; concept features work for C++ only (owner: C++ + GfG first) |
| Dashboard (v0.2–0.3, replaced) | Slim horizontal top bar with **logo only** + language/site filters + settings icon. KPIs, accuracy-by-language bars, 14-day stacked bars, needs-revision, recent (10 + show more), inline retry |
| Execution | Judge0 via **background service worker** only. Default `https://ce.judge0.com` (no key); RapidAPI or self-hosted optional; key in `chrome.storage.local`, never hard-coded |
| Storage | `chrome.storage.local`, no backend. Future backend = Node/Express + MongoDB Atlas. **Never PostgreSQL** |
| Run trigger | Only on explicit Check / Enter |
| Accuracy | correct ÷ (correct + incorrect); compile/runtime/timeout tracked separately; network/HTTP failures not saved |

## Output comparison rules (stable — tests depend on them)
1. `\r\n`, `\r` → `\n` (both sides). 2. Trailing whitespace at the very end ignored (both sides).
3. Everything else exact. 4. Only per-line trailing spaces differ → `whitespace_only`; `lenientTrailingSpaces` (default true) decides; UI says so.
5. Mismatch → first difference line/column (1-based), visible whitespace (· space, → tab).

## Site structures (inspected live in Chrome, Oct 2026 — fixtures in tests/fixtures/ mirror these)
- **Programiz**: runnable = `div.code-editor > .code-editor__area > div.pre-code-wrapper > pre.{cpp|c|java|python}-exec > code.hljs`; copy button `div.copy-code-button` is a sibling. C `<code>` has classes `c hljs cpp` → language taken from the pre's `*-exec` class. Syntax = `div.content > pre > code` (no -exec), output = `pre > samp`. Adapter `accept()` only takes `*-exec`.
- **W3Schools**: `div.w3-example > div.w3-code.notranslate.javaHigh` (**javaHigh even on C/C++ pages**; `pythonHigh` on Python). Lines are `<br>`; HTML source newlines are whitespace → `extractCode(..., {brLayout:true})`. Java pages also use `pre.w3-white.language-java`. Language from URL path. Many C/C++/Java examples are statement-only → wrapped in main (`allowWrap`, only if they print).
- **TutorialsPoint**: runnable = `div.code-wrapper > div.code-header + pre.demo-code.notranslate.language-xxx > div.code-mirror + div.output-wrapper` (strip `.output-wrapper`). Syntax `pre.just-code`, output `pre.result`. Python examples write `print (x)` with a space.
- **GeeksforGeeks**: could not be opened in the owner's Chrome during inspection (site permission not granted). Fixture modelled on known GfG markup (SyntaxHighlighter tables, `pre > code.language-cpp`, `.code-container`, language tabs). v0.1 worked on the owner's live GfG pages.

## Architecture
```
src/background.js   SAVE_CLIP {text, hint} -> vault.classify + saveClip; OPEN_VAULT; context menu + Alt+Shift+S -> CLIP_REQUEST to tab
                    CHECK_PREDICTION {language, code, stdin, prediction, site, wrapped, url, pageTitle}
                      -> judge0.runCode -> compare -> save attempt {..., language, site, wrapped}
                    TEST_CONNECTION (extension pages only) -> hello world in all 4 languages
                    Rejects other extensions' messages; one run at a time.
src/lib/detector.js classifyCode(text, hint, {allowWrap}) -> {language, isCode, runnable, needsWrap, readsInput}
                    Score-based per language (RULES/AGAINST); markup hint wins (C<->C++ content may correct);
                    ancestor classes only count with explicit prefixes (language-, lang-, brush:, -exec).
                    runnable: C/C++ main(), Java static void main, Python prints/reads input.
src/lib/judge0.js   ids c50 cpp54 java62 python71 (settings.languageIds; v0.1 settings.languageId honoured);
                    limits (java cpu5/wall10); prepareJava renames main-holding class to Main.
src/lib/concepts.js CONCEPTS (20: id, name, what, trap, prelude/body/output[/stdin]); tagCpp(code) on comment/string-stripped code;
                    conceptsOf(attempt) (saved tags or tag on the fly for old C++ attempts); conceptStats -> accuracy + weak
src/lib/render.js   summarize() -> {state, symbol, label, text} for the bar; renderResult() full view.
src/lib/stats.js    computeStats (+byLanguage, bySite), dailyActivity, languageOf/siteOf (old attempts = cpp, site from URL)
src/content/        adapters.js (per-site), content.js (bar), panel-styles.js (Shadow DOM CSS, light/dark)
tests/              *.test.js (node --test), fixtures/ per site, programs/ (16 cases), local-runner.js,
                    e2e/ (Chromium + mock Judge0 that runs the 4 languages locally)
```

## Status (v0.7.0) — Code Clipper + My Revision Vault
- [x] Dashboard renamed **My Learning Hub** (sidebar, title, popup, options). Sidebar order: My Revision Vault, My Learning Hub, Recent attempts, Needs revision, Concepts, Settings
- [x] Hub layout: Recent attempts + Needs revision on top → vault strip → Overview + Accuracy → Top concepts (3 rows) & Websites (4 rows, most used first) with **View full** toggles → Daily activity at the bottom
- [x] Language tabs restyled as separate pills (owner's reference image), selected = solid white pill, glow on hover only
- [x] **Code Clipper**: select code/text on any supported site → right-click "Save to My Revision Vault" (contextMenus, documentUrlPatterns = content-script matches), toolbar popup "Clip selection", Alt+Shift+S (commands), or the bookmark button in the `< ⚡ >` bar (saves the whole example). Background asks the tab's content script (CLIP_REQUEST, frame 0) for the selection — keeps line breaks — falls back to info.selectionText. Toast in page with "Open vault" (OPEN_VAULT → hub #vault/<id>)
- [x] src/lib/vault.js: storage key `vault` (max 1000). Clip = text, kind, language (c/cpp/java/python/sql/text), concepts[], concept (main, editable), topic, site, url, pageTitle, notes, status new|learning|difficult|mastered, createdAt/updatedAt/reviewedAt/reviewCount/nextReviewAt. classify(): page/URL hint is weak — if content scores <0 for the hint, re-classify without it; prose → `text`. Same text + same page is not saved twice
- [x] Vault page (#vault): stat buttons (filter), search (text, notes, topic, concept names), status / website / concept / sort filters, language tabs, "Revisit difficult" chips, cards with status segment, concept + language pickers, trap, autosaving notes, Predict & run (reuses retry), Copy, Open page, Delete (2-click). Revise mode: due queue (difficult → learning → new), Still difficult (+1 day) / Getting there (+3 days) / Got it = mastered (+14 days), Skip; marking Difficult by hand keeps it due now
- [x] Tests: unit 131 (tests/vault.test.js + clipper content tests) · e2e 23 (clip on GfG + W3Schools via the shortcut path, bar bookmark, vault search/filters/notes/status/predict/revise/deep link) · programs 70 · concept examples 88

## Status (v0.6.0)
- [x] Concepts for ALL languages: C 18, C++ 20, Java 18, Python 18, MySQL 14 (lib/concepts.js registry + lib/concepts-lang.js); 88 examples verified by running them
- [x] MySQL language: detection (language-sql/mysql/sqlHigh + content rules), runnable only if self-contained (creates every table it reads; CTEs, FROM (SELECT…), DUAL ok), Judge0 id 82, prepareSql (drops CREATE DATABASE/USE/AUTO_INCREMENT/ENGINE/CHARSET, prepends `.headers on` + `.mode list`), table-mode comparison (|, tabs, spaces, ASCII borders, header optional). Local tests emulate the sqlite3 CLI with tests/sqlite_cli.py
- [x] 4 new sites: Javatpoint (div.codeblock > textarea), Scaler Topics (/topics/*), Studytonight, Sanfoundry — generic adapters + URL language rules (PATH_LANG). NOT inspected live (browser permission denied) — verify on real pages
- [x] Hint override: if content is clearly another language (score >= 8 and hint score <= 2), the content wins (e.g. SQL block on a C++ page)
- [x] Themes: storage key `ui.theme` = dark (default) | light | auto | night. src/ui/theme.js sets <html data-theme> on extension pages; content script sets data-theme on each shadow host and listens for changes. Dark has spotlight + film grain (SVG feTurbulence) + vignette; Night sky adds stars
- [x] In-page bar, popup, settings restyled in black & white (themed). Settings has an Appearance picker
- [x] Tests: unit 119 · programs 70 checks (19 programs incl. 3 MySQL) · concept examples 88 · e2e 21

### v0.5.0
- [x] Rename to Codextent, monochrome Apple-style dashboard, e2e updated (19/19), unit 94/94
- [x] Owner's logo `< ⚡ >` installed (v0.5.1), auto black/white toolbar icon

### v0.4.0
- [x] Dashboard redesign (see Scope table). e2e dashboard step rewritten for the new layout; 19/19 pass

### v0.3.0
- [x] C++ concept tags: tagger + 20 explained concepts, bar chips after answering, traps in details, dashboard concepts card + concept filter
- [x] `npm test` 94/94 (incl. tagger false-positive tests) · `tests/concept-examples.js` 20/20 outputs verified with g++ · e2e 19/19

### v0.2.0
- [x] 4 languages, 4 sites, compact logo bar with ✓/✗ + Next, redesigned dashboard + popup, options with 4 language IDs
- [x] `npm test` 79/79 · `npm run test:programs` 16 programs / 59 checks · `npm run test:e2e` 18/18 · `npm run check`
- [ ] `npm run test:judge0` against REAL ce.judge0.com — not run (build sandbox has no internet)
- [ ] Owner's manual checklist on live pages (README §5)

## Next steps
- Owner: check the 4 new sites on live pages; run Test connection (confirms Judge0 SQL id 82 + dot-commands work on the real server).
- Owner preference: don't create/send demo screenshots; just describe changes (private layout checks are fine).
0. Concept tags for C, Java, Python (same CONCEPTS structure, per-language RULES) once the owner has tried C++.
1. Owner: README §5 manual checklist + `npm run test:judge0`.
2. If a live page misbehaves: capture the block's outer HTML → fixture + test → fix adapter.
3. Ideas not yet requested: spoiler guard (blur the site's own output box until predicted), keyboard shortcut to open the nearest bar, Chrome Web Store packaging.

## Known gaps / risks
- Judge0 CE ids/versions (C/C++ GCC 9.2, Java OpenJDK 13, Python 3.8) — Python 3.10+ syntax (match, `X | Y` types) fails there.
- W3Schools snippet wrapping includes common headers only; snippets needing other includes/imports may not compile (shown as compile error).
- Python detection without markup needs a confident score; very short untagged Python blocks are skipped on purpose.

## Change log
- 2026-10-22 — v0.9.0: FAST RUNNER. src/lib/wandbox.js (wandbox.org /api/compile.json; compilers gcc-13.2.0-c, gcc-13.2.0, openjdk-jdk-22+36 [runs whichever class has main → we only strip top-level `public`], cpython-3.12.7, sqlite-3.46.1 [`cat prog.sql | sqlite3`, same prepareSql]; signals mapped to SIGFPE/SIGSEGV names; non-zero exit = NZEC; 'runner_error' when not the program's fault). src/lib/runner.js: settings.runner 'auto' (default) = Wandbox first, Judge0 joins after 4 s or on Wandbox failure, first definitive result wins; 'judge0' = old behaviour. Cache (memory + chrome.storage.local runCache, 300, ok/compile/runtime only) + in-flight sharing. Content sends PRERUN when a bar opens (not for programs that read input) → Check reuses it. Judge0 polls every 300 ms (1 s after 10 polls). Background run lock removed. Details show "Ran on Wandbox · 0.6 s" / "Instant · saved result". Settings → Code runner → Speed. manifest host wandbox.org. e2e mock emulates Wandbox at /wandbox. NOT verified against the real wandbox.org from the build sandbox (no network) — owner: Settings → Test connection.
- 2026-10-22 — v0.8.0: GfG runs self-contained Java/C++ snippets without main() (adapter allowWrap:'strict', wrapLangs; detector.snippetSelfContained: needs a declared variable, every name in for/if/while/switch conditions and output statements declared). Popup minimal: accuracy, Clip selection / Revision Vault, correct/wrong/streak, My Learning Hub + settings (no hint line, badges, language chips or recent list). Hub & vault cards: no language icon (topic, then site • language • time). Vault cards: no language/concept pickers; default sort 'New first'. Softer code background (--code #17171b dark).
- 2026-10-22 — v0.7.2: hub order Overview+Accuracy → Recent/Needs revision → vault strip → Top concepts/Websites → Daily activity; ✓/✗/! as rounded-square boxes (filled / outlined / dashed) everywhere; in-page bar host is position:relative + top z-index, GfG adapter barInset 130px so GfG's own ×/▷/copy buttons don't overlap it.
- 2026-10-22 — v0.7.1: Judge0 submit uses wait=false + polling (60 s), POST retried once, slow polls tolerated — owner's Test connection hit 'took too long' on ce.judge0.com with wait=true.
- 2026-10-22 — v0.7.0: Code Clipper + My Revision Vault; dashboard renamed My Learning Hub; recent attempts on top, daily activity at the bottom; compact Top concepts / Websites with View full; pill language tabs.
- 2026-10-21 — v0.1.0: C++ + GfG only.
- 2026-10-21 — v0.2.0: C, Java, Python; Programiz, W3Schools, TutorialsPoint; compact logo bar UI (✓/✗, details inline, Next); dashboard redesign (filters, accuracy by language, 14-day chart, inline retry, show more); new icon without "C++" badge.
- 2026-10-21 — v0.3.0: C++ concept tags (20 concepts) shown after answering; dashboard C++ concepts section with explanations, weak spots, concept filter.
- 2026-10-21 — v0.6.0: concepts for C/Java/Python/MySQL, MySQL support, Javatpoint/Scaler/Studytonight/Sanfoundry, themes (Dark/Light/Auto/Night sky) everywhere, realistic dark background, B&W in-page bar.
- 2026-10-21 — v0.5.1: new Codextent logo `< ⚡ >` (no circle), black/white icon sets with automatic switching, new mark on dashboard/popup/settings/in-page button.
- 2026-10-21 — v0.5.0: renamed Codextent; monochrome Apple-style dashboard, hover-only glow, compact language switcher, Top concepts table, activity line chart; Languages section removed.
- 2026-10-21 — v0.4.0: night-sky dashboard with sidebar, glowing language switcher, attempt cards (topic/site/language → outputs → subtopics), concepts page with problems per concept.

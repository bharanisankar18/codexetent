#!/usr/bin/env node
/*
 * End-to-end test: loads the REAL unpacked extension into Chromium, serves fixtures at the
 * real site URLs (GeeksforGeeks, Programiz, W3Schools, TutorialsPoint — intercepted, no network),
 * and runs C / C++ / Java / Python through a local Judge0-compatible mock.
 *
 *   npm run test:e2e
 *   CHROMIUM_PATH=/path/to/chrome npm run test:e2e   (if Chromium isn't auto-found)
 *
 * Needs gcc, g++, javac/java, python3. Screenshots -> tests/e2e/screenshots/.
 * NOT covered: the real ce.judge0.com server and live site HTML (see README checklist).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const mock = require('./mock-judge0.js');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'screenshots');
const fx = (n) => fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', n), 'utf8');

const URLS = {
  programiz: 'https://www.programiz.com/cpp-programming/for-loop',
  w3s: 'https://www.w3schools.com/cpp/cpp_for_loop.asp',
  tp: 'https://www.tutorialspoint.com/python/python_for_loops.htm',
  gfg: 'https://www.geeksforgeeks.org/cpp/for-loop-in-cpp/',
  gfgErrors: 'https://www.geeksforgeeks.org/cpp/errors-demo/',
  javatpoint: 'https://www.javatpoint.com/cpp-for-loop'
};

const errorsPage = `<!doctype html><html><head><title>Errors and Java demo - GeeksforGeeks</title></head><body><article>
<pre id="compile">#include &lt;iostream&gt;
int main() { std::cout &lt;&lt; "x" &lt;&lt; std::endl return 0; }</pre>
<pre id="runtime">#include &lt;iostream&gt;
int main() { std::cout &lt;&lt; "Before crash" &lt;&lt; std::endl; volatile int z = 0; std::cout &lt;&lt; 10 / z; }</pre>
<pre id="loop">#include &lt;iostream&gt;
int main() { long long i = 0; while (true) i++; std::cout &lt;&lt; i; }</pre>
<pre id="java-gfg" class="language-java">// Java program (GfG style class name)
public class GFG {
    static int sq(int x) { return x * x; }
    public static void main(String[] args) {
        System.out.println("sq = " + GFG.sq(7));
    }
}</pre>
<pre id="py-err" class="language-python">print("start")
print(10 / 0)</pre>
</article></body></html>`;

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
      for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        const p = path.join(r, d, sub);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  throw new Error('Chromium not found. Set CHROMIUM_PATH.');
}

/** Copy the extension and allow it to call the local mock server (test build only). */
function testBuild() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oiq-ext-'));
  for (const item of ['manifest.json', 'src', 'icons']) fs.cpSync(path.join(ROOT, item), path.join(dir, item), { recursive: true });
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  m.host_permissions.push('http://127.0.0.1/*');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 2));
  return dir;
}

let passed = 0;
async function step(name, fn) {
  process.stdout.write('  ' + name + ' ... ');
  await fn();
  passed++;
  console.log('ok');
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await mock.start(0);
  const endpoint = 'http://127.0.0.1:' + server.address().port;
  const ext = testBuild();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'oiq-profile-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: findChromium(),
    headless: true,
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-sandbox'],
    viewport: { width: 1100, height: 900 }
  });
  const pageErrors = [];

  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 });
    const extId = new URL(sw.url()).host;
    console.log('Extension loaded: ' + extId);

    const pages = {
      'www.programiz.com': fx('programiz.html'),
      'www.w3schools.com': fx('w3schools.html'),
      'www.tutorialspoint.com': fx('tutorialspoint.html'),
      'www.geeksforgeeks.org': fx('gfg-like.html'),
      'www.javatpoint.com': fx('javatpoint.html')
    };
    await ctx.route(/https:\/\/www\.(programiz|w3schools|tutorialspoint|geeksforgeeks|javatpoint)\.(com|org)\/.*/, (route) => {
      const u = new URL(route.request().url());
      const body = u.href.startsWith(URLS.gfgErrors) ? errorsPage : pages[u.host];
      route.fulfill({ status: 200, contentType: 'text/html', body });
    });

    const open = async (url) => {
      const p = await ctx.newPage();
      p.on('pageerror', (e) => pageErrors.push(url + ': ' + e));
      await p.goto(url);
      await p.waitForSelector('[data-outputiq-host]');
      await p.waitForTimeout(250);
      return p;
    };
    const bar = (p, i) => p.locator('[data-outputiq-host]').nth(i);
    async function predict(p, i, answer, opts = {}) {
      const b = bar(p, i);
      if (!(await b.locator('.bar.open').count())) await b.locator('.logo').click();
      if (opts.stdin != null) await b.locator('textarea.stdin').fill(opts.stdin);
      await b.locator('textarea.answer').fill(answer);
      await b.locator('.check').click();
      await b.locator('.verdict:not(.busy)').waitFor({ timeout: 30000 });
      await b.locator('.check:not([disabled])').waitFor({ timeout: 30000 });
      return { symbol: await b.locator('.verdict').textContent(), msg: await b.locator('.msg .text').textContent() };
    }

    await step('options: saves custom server, "Test connection" runs C++, C, Java and Python', async () => {
      const p = await ctx.newPage();
      await p.goto(`chrome-extension://${extId}/src/options/options.html`);
      await p.selectOption('#preset', 'custom');
      await p.fill('#endpoint', endpoint);
      await p.selectOption('#authMode', 'none');
      await p.click('#test');
      await p.waitForSelector('#status.ok', { timeout: 40000 });
      const t = await p.textContent('#status');
      assert.match(t, /Connected/);
      ['C\\+\\+', 'C', 'Java', 'Python', 'MySQL'].forEach((l) => assert.match(t, new RegExp('✓ ' + l + ' ')));
      await p.screenshot({ path: path.join(SHOTS, '01-options.png'), fullPage: true });
      await p.close();
    });

    // ---------- Programiz: all four languages ----------
    const pz = await open(URLS.programiz);

    await step('Programiz: 4 logos (C++, C, Java, Python), collapsed = logo only', async () => {
      const langs = await pz.locator('[data-outputiq-host]').evaluateAll((els) => els.map((e) => e.getAttribute('data-outputiq-lang')));
      assert.deepEqual(langs, ['cpp', 'c', 'java', 'python']);
      await pz.locator('#ed-cpp-1').scrollIntoViewIfNeeded();
      await pz.screenshot({ path: path.join(SHOTS, '02-collapsed-logo.png'), clip: await clipAround(pz, '#ed-cpp-1', 70) });
    });

    await step('Programiz C++: wrong answer -> ✗ with one-line output', async () => {
      const r = await predict(pz, 0, '1 2 3 4');
      assert.equal(r.symbol, '✗');
      assert.match(r.msg, /Output: 1 2 3 4 5/);
      await bar(pz, 0).screenshot({ path: path.join(SHOTS, '03-bar-wrong.png') });
      await bar(pz, 0).locator('.msg .link').click();
      await bar(pz, 0).screenshot({ path: path.join(SHOTS, '04-bar-wrong-details.png') });
      await bar(pz, 0).locator('.msg .link').click();
    });

    await step('Programiz C++: correct answer (trailing space ignored) -> ✓', async () => {
      const r = await predict(pz, 0, '1 2 3 4 5');
      assert.equal(r.symbol, '✓');
      await bar(pz, 0).screenshot({ path: path.join(SHOTS, '05-bar-correct.png') });
    });

    await step('Next button opens the C example; C answer -> ✓', async () => {
      const nextBtn = bar(pz, 0).locator('button[aria-label="Next example"]');
      await nextBtn.click();
      await bar(pz, 1).locator('.bar.open').waitFor();
      const r = await predict(pz, 1, '1 2 3');
      assert.equal(r.symbol, '✓');
    });

    await step('Programiz Java -> ✓ ; Python -> ✓', async () => {
      assert.equal((await predict(pz, 2, 'Java is fun\nJava is fun\nJava is fun')).symbol, '✓');
      assert.equal((await predict(pz, 3, 'Swift\nPython\nGo')).symbol, '✓');
    });

    // ---------- W3Schools: wrapped snippet ----------
    const w3 = await open(URLS.w3s);
    await step('W3Schools: full program and wrapped snippet both run', async () => {
      assert.equal((await predict(w3, 0, 'Hello World!')).symbol, '✓');
      assert.equal((await predict(w3, 1, '0\n1\n2\n3\n4')).symbol, '✓');
      const src = server.submissions[server.submissions.length - 1].source;
      assert.match(src, /int main\(\) \{\n    for \(int i = 0;/);
    });

    // ---------- TutorialsPoint ----------
    const tp = await open(URLS.tp);
    await step('TutorialsPoint: Python and C++ demo blocks run', async () => {
      assert.equal((await predict(tp, 0, 'Current Letter : H\nCurrent Letter : i\nCurrent Letter : !')).symbol, '✓');
      assert.equal((await predict(tp, 1, 'value of a: 10\nvalue of a: 11\nvalue of a: 12')).symbol, '✓');
    });

    // ---------- GeeksforGeeks: stdin, errors, Java class rename ----------
    const gfg = await open(URLS.gfg);
    await step('GfG: input program uses the stdin box', async () => {
      assert.equal((await predict(gfg, 2, '15', { stdin: '5 10' })).symbol, '✓');
    });

    await step('GfG C++: concept chips appear only after answering, traps in details', async () => {
      await bar(gfg, 1).locator('.logo').click();
      assert.equal(await bar(gfg, 1).locator('.tags .chip').count(), 0, 'no hints before answering');
      const r = await predict(gfg, 1, 'Square: 16');
      assert.equal(r.symbol, '✓');
      assert.deepEqual(await bar(gfg, 1).locator('.tags .chip').allTextContents(), ['Functions']);
      await bar(gfg, 1).locator('.msg .link').click();
      assert.match(await bar(gfg, 1).locator('.details .concepts').textContent(), /Functions \(pass by value\) — Changing a parameter/);
      await bar(gfg, 1).screenshot({ path: path.join(SHOTS, '12-bar-concepts.png') });
      await bar(gfg, 1).locator('.msg .link').click();
    });

    const ge = await open(URLS.gfgErrors);
    await step('GfG: compile error, runtime error and timeout each get a symbol + short message', async () => {
      const c = await predict(ge, 0, 'x');
      assert.equal(c.symbol, '✗'); assert.match(c.msg, /Compilation error/);
      const r = await predict(ge, 1, 'Before crash');
      assert.equal(r.symbol, '✗'); assert.match(r.msg, /SIGFPE\) — division by zero/);
      await bar(ge, 1).screenshot({ path: path.join(SHOTS, '06-bar-runtime-error.png') });
      const t = await predict(ge, 2, '?');
      assert.equal(t.symbol, '⏱'); assert.match(t.msg, /Time limit/);
    });

    await step('GfG Java: class GFG renamed to Main and runs', async () => {
      const r = await predict(ge, 3, 'sq = 49');
      assert.equal(r.symbol, '✓');
      const sub = server.submissions.find((s) => s.language_id === 62 && /sq\(7\)/.test(s.source));
      assert.match(sub.source, /public class Main \{/);
      assert.match(sub.source, /Main\.sq\(7\)/);
    });

    await step('Python runtime error (ZeroDivisionError) -> ✗ with traceback in details', async () => {
      const r = await predict(ge, 4, 'start\n5.0');
      assert.equal(r.symbol, '✗');
      await bar(ge, 4).locator('.msg .link').click();
      assert.match(await bar(ge, 4).locator('.details').textContent(), /ZeroDivisionError/);
    });

    await step('dark mode bar renders', async () => {
      await gfg.emulateMedia({ colorScheme: 'dark' });
      await gfg.evaluate(() => { document.body.style.background = '#131417'; document.body.style.color = '#ddd'; });
      await bar(gfg, 0).locator('.logo').click();
      await predict(gfg, 0, '1 2 4');
      await bar(gfg, 0).screenshot({ path: path.join(SHOTS, '07-bar-dark.png') });
      await gfg.emulateMedia({ colorScheme: 'light' });
    });

    await step('polling fallback works when the server ignores wait=true', async () => {
      server.forcePolling = true;
      assert.equal((await predict(gfg, 1, 'Square: 16')).symbol, '✓');
      assert.ok(server.requests.some((r) => r.method === 'GET' && r.path.startsWith('/submissions/')));
      server.forcePolling = false;
    });

    const jt = await open(URLS.javatpoint);
    await step('Javatpoint: C++ and a MySQL query; MySQL table answer without header is accepted; concept chips', async () => {
      const langs = await jt.locator('[data-outputiq-host]').evaluateAll((els) => els.map((e) => e.getAttribute('data-outputiq-lang')));
      assert.deepEqual(langs, ['cpp', 'sql']);
      assert.equal(await jt.locator('[data-outputiq-host]').first().getAttribute('data-theme'), 'dark', 'in-page bar defaults to the dark theme');
      const r = await predict(jt, 1, 'Ravi');
      assert.equal(r.symbol, '✓');
      assert.deepEqual(await bar(jt, 1).locator('.tags .chip').allTextContents(), ['SELECT … WHERE']);
      await bar(jt, 1).locator('.msg .link').click();
      assert.match(await bar(jt, 1).locator('.details').textContent(), /Ran on SQLite[\s\S]*header row was not needed/);
    });

    await step('Settings → Appearance: Light / Night sky apply instantly to settings, dashboard and the in-page bar', async () => {
      const o = await ctx.newPage();
      await o.goto(`chrome-extension://${extId}/src/options/options.html`);
      assert.equal(await o.getAttribute('html', 'data-theme'), 'dark');
      await o.click('button[data-theme-choice="light"]');
      await o.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
      assert.equal(await o.getAttribute('button[data-theme-choice="light"]', 'aria-pressed'), 'true');
      await jt.waitForFunction(() => document.querySelector('[data-outputiq-host]').getAttribute('data-theme') === 'light');
      const d2 = await ctx.newPage();
      await d2.goto(`chrome-extension://${extId}/src/dashboard/dashboard.html`);
      await d2.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
      await d2.setViewportSize({ width: 1280, height: 900 });
      await d2.waitForTimeout(400);
      await d2.screenshot({ path: path.join(SHOTS, 'theme-light.png') });
      await bar(jt, 1).screenshot({ path: path.join(SHOTS, 'bar-light.png') });
      await o.screenshot({ path: path.join(SHOTS, 'settings-light.png'), fullPage: false });
      await o.click('button[data-theme-choice="night"]');
      await d2.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'night');
      await d2.waitForTimeout(400);
      await d2.screenshot({ path: path.join(SHOTS, 'theme-night.png') });
      await o.click('button[data-theme-choice="dark"]');
      await d2.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark');
      await d2.waitForTimeout(400);
      await d2.screenshot({ path: path.join(SHOTS, 'theme-dark.png') });
      await bar(jt, 1).screenshot({ path: path.join(SHOTS, 'bar-dark.png') });
      await d2.close(); await o.close();
    });

    await step('attempts saved with language + site', async () => {
      const attempts = await sw.evaluate(async () => (await chrome.storage.local.get('attempts')).attempts);
      const byLang = attempts.reduce((m, a) => ((m[a.language] = (m[a.language] || 0) + 1), m), {});
      assert.ok(byLang.c >= 1 && byLang.cpp >= 5 && byLang.java >= 2 && byLang.python >= 3 && byLang.sql >= 1, JSON.stringify(byLang));
      const sites = new Set(attempts.map((a) => a.site));
      ['programiz', 'w3schools', 'tutorialspoint', 'geeksforgeeks'].forEach((s) => assert.ok(sites.has(s), s));
      assert.ok(attempts.some((a) => a.wrapped === true));
    });

    await step('popup: accuracy, per-language chips, recent with symbols', async () => {
      const p = await ctx.newPage();
      await p.setViewportSize({ width: 340, height: 520 });
      await p.goto(`chrome-extension://${extId}/src/popup/popup.html`);
      await p.waitForSelector('#recent li');
      assert.match(await p.textContent('#accuracy'), /%$/);
      assert.ok((await p.locator('#langs span').count()) >= 4);
      await p.screenshot({ path: path.join(SHOTS, '08-popup.png') });
      await p.close();
    });

    await step('dashboard: KPIs, charts, filters, revision + inline retry', async () => {
      // seed some history on earlier days so the 14-day chart has shape
      await sw.evaluate(async () => {
        const { attempts } = await chrome.storage.local.get('attempts');
        const day = 86400000, now = Date.now();
        const mk = (d, result, language, site, concepts) => ({ id: 'seed' + d + result + language + concepts, ts: now - d * day, questionId: 'seed' + d + language + result + concepts, language, site,
          url: 'https://www.geeksforgeeks.org/seed', pageTitle: 'Seeded example', code: 'int main() {}', prediction: '1', result, actualOutput: '1',
          concepts: language === 'cpp' ? concepts : [] });
        const seed = [];
        [[9, 'correct', 'python'], [9, 'incorrect', 'cpp', ['loops', 'int-division']], [7, 'correct', 'java'], [7, 'correct', 'cpp', ['recursion', 'functions']],
         [7, 'incorrect', 'c'], [5, 'correct', 'python'], [5, 'incorrect', 'cpp', ['int-division']], [4, 'correct', 'cpp', ['pointers']], [4, 'incorrect', 'cpp', ['pointers', 'increment']],
         [4, 'correct', 'c'], [4, 'incorrect', 'java'], [3, 'incorrect', 'cpp', ['int-division', 'casting']], [2, 'correct', 'python'], [1, 'correct', 'cpp', ['loops', 'nested-loops']], [1, 'correct', 'java']]
          .forEach(([d, r, l, c]) => seed.push(mk(d, r, l, 'geeksforgeeks', c || [])));
        await chrome.storage.local.set({ attempts: seed.concat(attempts) });
      });
      const d = await ctx.newPage();
      d.on('pageerror', (e) => pageErrors.push('dashboard: ' + e));
      await d.setViewportSize({ width: 1280, height: 1000 });
      await d.goto(`chrome-extension://${extId}/src/dashboard/dashboard.html`);
      await d.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await d.reload();
      await d.waitForSelector('#homeRecent .att');

      // sidebar + home
      assert.equal(await d.locator('.side nav a.active').getAttribute('data-view'), 'home');
      assert.equal(await d.locator('#langTabs .ltab').count(), 6, 'compact switcher: All + 5 languages');
      assert.equal(await d.locator('#langCards').count(), 0, 'languages section removed');
      assert.equal(await d.locator('#homeRecent .att').count(), 4, 'recent on home shows the top 4');
      assert.match(await d.textContent('#kAccuracy'), /%$/);
      assert.equal(await d.locator('#siteList .site').count(), 4, 'websites compact by default');
      await d.locator('#siteMore').click();
      assert.equal(await d.locator('#siteList .site').count(), 8, 'View full shows all 8');
      await d.locator('#siteMore').click();
      assert.ok(await d.locator('#topConcepts tbody tr').count() <= 3, 'top concepts compact');
      await d.locator('#tcMore').click();
      assert.ok(await d.locator('#topConcepts tbody tr').count() > 3, 'View full shows every concept');
      await d.locator('#tcMore').click();
      assert.equal(await d.textContent('#viewTitle'), 'My Learning Hub');
      const order = await d.evaluate(() => ['homeRecent', 'vaultStrip', 'tcCard', 'chartWrap'].map((id) => document.getElementById(id).getBoundingClientRect().top));
      assert.ok(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], 'recent on top, daily activity at the bottom: ' + order);
      assert.equal(await d.locator('#actChart .hit').count(), 14);
      assert.ok(await d.locator('#topConcepts tbody tr').count() >= 1);
      await d.locator('#actChart .hit').nth(13).hover();
      assert.match(await d.textContent('#tip'), /correct/);

      // language switch: clicking C++ highlights it everywhere and filters
      await d.locator('#langTabs .ltab[data-l="cpp"]').click();
      assert.equal(await d.locator('#langTabs .ltab[data-l="cpp"]').getAttribute('aria-selected'), 'true');
      assert.equal(await d.locator('#langTabs .ltab[data-l="all"]').getAttribute('aria-selected'), 'false');
      assert.match(await d.textContent('#viewSub'), /C\+\+/);
      await d.screenshot({ path: path.join(SHOTS, 'dash-home.png'), fullPage: true });
      const langsShown = await d.locator('#homeRecent .att .lname').allTextContents();
      assert.ok(langsShown.length && langsShown.every((t) => t === 'C++'), langsShown.join(','));

      // attempt card: topic, then site · language; "Topics & output" -> outputs then subtopics
      await d.goto(`chrome-extension://${extId}/src/dashboard/dashboard.html#recent`);
      await d.waitForSelector('#recentList .att');
      const first = d.locator('#recentList .att', { hasText: 'For Loop in C++' }).first();
      assert.match(await first.locator('.att-sub').textContent(), /GeeksforGeeks.*C\+\+/);
      await first.locator('.toggle').click();
      const bodyText = await first.locator('.att-body').textContent();
      assert.ok(bodyText.indexOf('Your output') < bodyText.indexOf('Actual output') && bodyText.indexOf('Actual output') < bodyText.indexOf('Subtopics'), 'order: your output, actual output, subtopics');
      await first.screenshot({ path: path.join(SHOTS, 'dash-card.png') });
      assert.match(bodyText, /Subtopics in this example[\s\S]*(Loops|Functions)/);

      // site filter on the recent page
      await d.locator('#siteSeg button', { hasText: 'Programiz' }).click();
      const sites = await d.locator('#recentList .att .sname').allTextContents();
      assert.ok(sites.every((t) => t === 'Programiz'), sites.join(','));
      await d.locator('#siteSeg button', { hasText: 'All sites' }).click();

      // concepts page via sidebar
      await d.locator('.side nav a[data-view="concepts"]').click();
      await d.waitForSelector('#conceptList .concept');
      assert.match(await d.textContent('#conceptBody .focus'), /Focus on:.*Integer division/);
      await d.locator('#conceptBody .weakchip').first().click();
      await d.locator('.concept.open .explain .ex-grid').waitFor();
      const ex = await d.locator('.concept.open').textContent();
      assert.match(ex, /What it is[\s\S]*Common trap[\s\S]*Example[\s\S]*Prints 3 3 3\.5 1[\s\S]*Problems you did with Integer division & modulo \(\d+\)/);
      assert.ok(await d.locator('.concept.open .solved .att').count() >= 3);
      await d.screenshot({ path: path.join(SHOTS, 'dash-concepts.png'), fullPage: false });

      // other languages: designed "coming soon" page
      await d.locator('#langTabs .ltab[data-l="java"]').click();
      await d.waitForSelector('#conceptList .concept');
      assert.match(await d.textContent('#conceptBody'), /Java concepts[\s\S]*Comparing strings \(== vs equals\)/);
      await d.locator('#langTabs .ltab[data-l="sql"]').click();
      assert.match(await d.textContent('#conceptBody'), /MySQL concepts[\s\S]*LEFT JOIN/);
      await d.locator('#langTabs .ltab[data-l="cpp"]').click();

      // needs revision + retry inline (result survives the storage refresh)
      await d.locator('.side nav a[data-view="revision"]').click();
      const rev = d.locator('#revisionList .att', { hasText: 'For Loop in C++' }).first();
      await rev.locator('.toggle').click();
      await rev.locator('.att-body .btn', { hasText: 'Retry' }).click();
      await rev.locator('.retry textarea.answer').fill('1 2 3');
      await rev.locator('.retry .run').click();
      await rev.locator('.retry .sym.ok').waitFor({ timeout: 30000 });
      await d.waitForTimeout(300);
      assert.ok(await rev.locator('.retry .vd.ok').count(), 'retry result still visible after save');
      await d.close();
    });

    await step('Code Clipper: right-click menu, popup/shortcut path and bar bookmark save to the vault (GfG + W3Schools)', async () => {
      const menuOk = await sw.evaluate(() => new Promise((r) => chrome.contextMenus.update('codextent-clip', {}, () => r(!chrome.runtime.lastError))));
      assert.ok(menuOk, 'context menu "Save to My Revision Vault" exists');
      await sw.evaluate(() => chrome.storage.local.set({ vault: [] }));
      const clipIn = async (p, host, selectFn) => {
        await p.bringToFront();
        await p.evaluate(selectFn);
        // same path as the Alt+Shift+S shortcut / popup: the active tab is asked for its selection
        return sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return clipFromTab(t); });
      };
      const g = await open(URLS.gfg);
      let r = await clipIn(g, 'www.geeksforgeeks.org', () => { const e = document.getElementById('tab-c'); e.parentElement.style.display = 'block'; getSelection().selectAllChildren(e); });
      assert.ok(r.ok && !r.duplicate, JSON.stringify(r));
      assert.equal(r.clip.language, 'c');
      assert.match(r.clip.text, /printf\("Hello from C\\n"\);\n/);
      await g.locator('[data-outputiq-toast]').waitFor();
      assert.match(await g.locator('[data-outputiq-toast]').evaluate((h) => h.shadowRoot.textContent), /Saved to My Revision Vault/);
      r = await clipIn(g, 'www.geeksforgeeks.org', () => { const e = document.getElementById('tab-c'); e.parentElement.style.display = 'block'; getSelection().selectAllChildren(e); });
      assert.equal(r.duplicate, true, 'same code twice is not saved twice');
      r = await clipIn(g, 'www.geeksforgeeks.org', () => { const e = document.getElementById('tab-python'); e.parentElement.style.display = 'block'; getSelection().selectAllChildren(e); });
      assert.equal(r.clip.language, 'python', 'Python tab on a /cpp/ page');

      const w = await open(URLS.w3s);
      r = await clipIn(w, 'www.w3schools.com', () => getSelection().selectAllChildren([...document.querySelectorAll('.w3-code')].find((e) => /for \(/.test(e.textContent))));
      assert.ok(r.ok && r.clip.site === 'w3schools' && r.clip.text.split('\n').length > 2, JSON.stringify(r.clip));
      r = await clipIn(w, 'www.w3schools.com', () => { const p = document.createElement('p'); p.textContent = 'The for loop repeats a block of code a known number of times.'; document.body.prepend(p); getSelection().selectAllChildren(p); });
      assert.equal(r.clip.language, 'text', 'plain explanation saved as a text clip');
      r = await clipIn(w, 'www.w3schools.com', () => getSelection().removeAllRanges());
      assert.equal(r.ok, false, 'nothing selected');

      // bookmark button inside the < ⚡ > bar
      await bar(g, 0).locator('.logo').click();
      await bar(g, 0).locator('.icon.save').click();
      await g.waitForFunction(() => document.querySelector('[data-outputiq-host]').shadowRoot.querySelector('.icon.save.saved'));
      const vault = await sw.evaluate(async () => (await chrome.storage.local.get('vault')).vault);
      assert.equal(vault.length, 5, vault.map((c) => c.language).join());
      assert.ok(vault.every((c) => c.status === 'new' && c.url.startsWith('https://') && c.createdAt));
      await w.close();
      await g.close();
    });

    await step('My Revision Vault: search, filters, notes, status, revise, deep link; hub strip', async () => {
      const d = await ctx.newPage();
      d.on('pageerror', (e) => pageErrors.push('vault: ' + e));
      await d.setViewportSize({ width: 1280, height: 1000 });
      await d.goto(`chrome-extension://${extId}/src/dashboard/dashboard.html#vault`);
      await d.waitForSelector('#clipList .clip');
      assert.equal(await d.locator('.side nav a').first().getAttribute('data-view'), 'vault', 'vault is first in the sidebar');
      assert.equal(await d.textContent('#viewTitle'), 'My Revision Vault');
      await d.locator('#langTabs .ltab[data-l="all"]').click();
      assert.equal(await d.locator('#clipList .clip').count(), 5);
      assert.equal(await d.textContent('#navVault'), '5', 'due count in sidebar');

      // search
      await d.fill('#vQ', 'printf');
      await d.waitForFunction(() => document.querySelectorAll('#clipList .clip').length === 1);
      const card = d.locator('#clipList .clip').first();
      // notes autosave
      await card.locator('textarea.notearea').fill('\\n is a newline, so the next print starts on a new line');
      await card.locator('.clipnotes .saved', { hasText: 'Saved' }).waitFor();
      // status
      await card.locator('.stseg .st-difficult').click();
      await d.waitForFunction(() => document.querySelector('#clipList .clip.st-difficult'));
      // concept picker
      await d.locator('#clipList .clip select.mini').nth(1).selectOption('formatting');
      await d.waitForTimeout(200);
      let v = await sw.evaluate(async () => (await chrome.storage.local.get('vault')).vault.find((c) => /printf/.test(c.text)));
      assert.deepEqual([v.status, v.concept, /newline/.test(v.notes)], ['difficult', 'formatting', true]);
      await d.fill('#vQ', '');
      await d.waitForFunction(() => document.querySelectorAll('#clipList .clip').length === 5);

      // filters
      await d.selectOption('#vStatus', 'difficult');
      assert.equal(await d.locator('#clipList .clip').count(), 1);
      await d.selectOption('#vStatus', '');
      await d.selectOption('#vSite', 'w3schools');
      assert.equal(await d.locator('#clipList .clip').count(), 2);
      await d.selectOption('#vSite', '');
      await d.locator('#langTabs .ltab[data-l="python"]').click();
      assert.equal(await d.locator('#clipList .clip').count(), 1);
      await d.locator('#langTabs .ltab[data-l="all"]').click();
      assert.match(await d.textContent('#vRevisit'), /Revisit difficult:.*\(1\)/);
      await d.screenshot({ path: path.join(SHOTS, 'vault.png'), fullPage: true });

      // predict & run from a clip
      const cc = d.locator('#clipList .clip', { hasText: 'Hello from C' }).first();
      await cc.locator('.btn', { hasText: 'Predict & run' }).click();
      await cc.locator('.retry textarea.answer').fill('Hello from C');
      await cc.locator('.retry .run').click();
      await cc.locator('.retry .sym.ok').waitFor({ timeout: 30000 });

      // revise: difficult first, then the rest
      await d.reload();
      await d.waitForSelector('#clipList .clip');
      await d.locator('#startReview').click();
      await d.locator('#vReview .rv-card').waitFor();
      assert.match(await d.textContent('#vReview .rv-title'), /Output formatting|printf/i);
      assert.match(await d.textContent('#vReview'), /1 \/ 5/);
      await d.locator('#vReview .btn', { hasText: 'Got it' }).click();
      for (let i = 0; i < 4; i++) {
        await d.waitForFunction((n) => document.querySelector('#vReview') && document.querySelector('#vReview').textContent.includes((n + 2) + ' / 5') || document.querySelector('.rv-done'), i);
        if (await d.locator('.rv-done').count()) break;
        await d.locator('#vReview .btn', { hasText: i % 2 ? 'Still difficult' : 'Getting there' }).click();
      }
      await d.locator('.rv-done').waitFor();
      v = await sw.evaluate(async () => (await chrome.storage.local.get('vault')).vault);
      assert.equal(v.filter((c) => c.reviewCount === 1).length, 5);
      assert.equal(v.find((c) => /printf/.test(c.text)).status, 'mastered');
      assert.equal(v.filter((c) => c.nextReviewAt > Date.now()).length, 5, 'nothing due right after revising');
      await d.locator('#vReview .btn', { hasText: 'Close' }).click();

      // deep link from the toast's "Open vault"
      const id = v[1].id;
      await d.goto(`chrome-extension://${extId}/src/dashboard/dashboard.html#vault/${id}`);
      await d.waitForSelector('#clipList .clip.flash');
      assert.equal(await d.locator('#clipList .clip.flash').getAttribute('data-id'), id);

      // hub strip
      await d.locator('.side nav a[data-view="home"]').click();
      await d.waitForFunction(() => /clips/.test(document.getElementById('vsText').textContent)).catch(() => {});
      assert.match(await d.textContent('#vsText'), /5 clips · 0 due/);
      await d.close();
    });

    await step('no JavaScript errors on any page', async () => {
      assert.deepEqual(pageErrors, []);
    });

    console.log(`\n${passed} end-to-end checks passed. Screenshots: ${SHOTS}`);
  } finally {
    await ctx.close();
    server.close();
  }
})().catch((e) => {
  console.log('FAILED');
  console.error(e);
  process.exit(1);
});

async function clipAround(page, selector, extraBelow) {
  const b = await page.locator(selector).boundingBox();
  return { x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 10), width: Math.min(1080, b.width + 20), height: b.height + 20 + extraBelow };
}

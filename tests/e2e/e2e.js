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
  javatpoint: 'https://www.javatpoint.com/cpp-for-loop',
  gfgSnip: 'https://www.geeksforgeeks.org/java/switch-statement-in-java/'
};

const snippetsPage = `<!doctype html><html><head><title>Switch Statement in Java - GeeksforGeeks</title></head><body><article>
<pre class="language-java"><code>int day = 4;
switch (day) {
  case 6:
    System.out.println("Today is Saturday");
    break;
  case 7:
    System.out.println("Today is Sunday");
    break;
  default:
    System.out.println("Looking forward to the Weekend");
}</code></pre>
<pre class="language-cpp"><code>int x = 5;
int y = 3;
cout &lt;&lt; x + y;</code></pre>
<pre class="language-cpp"><code>for (int i = 0; i &lt; n; i++) {
    cout &lt;&lt; arr[i];
}</code></pre>
</article></body></html>`;

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
    // point the Wandbox runner at the local emulation (same server, /wandbox)
    await sw.evaluate(async (ep) => chrome.storage.local.set({ settings: Object.assign({}, (await chrome.storage.local.get('settings')).settings, { wandboxEndpoint: ep }) }), endpoint + '/wandbox');

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

    /** Time from clicking Check to the verdict, measured inside the page (Playwright's own waits excluded). */
    const checkMs = (p, i) => p.evaluate((idx) => new Promise((res) => {
      const sh = document.querySelectorAll('[data-outputiq-host]')[idx].shadowRoot;
      const v = sh.querySelector('.verdict'), t = performance.now();
      sh.querySelector('.check').click();
      const iv = setInterval(() => { if (!v.classList.contains('busy') && v.textContent) { clearInterval(iv); res(performance.now() - t); } }, 5);
    }), i);

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
      const src = server.wandbox[server.wandbox.length - 1].code;
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

    await step('GfG Java: class GFG runs on Wandbox (public dropped, name kept)', async () => {
      const r = await predict(ge, 3, 'sq = 49');
      assert.equal(r.symbol, '✓');
      const sub = server.wandbox.find((s) => s.compiler.startsWith('openjdk') && /sq\(7\)/.test(s.code));
      assert.match(sub.code, /\nclass GFG \{/);
      assert.match(sub.code, /GFG\.sq\(7\)/);
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

    await step('fast runner: Wandbox down -> Judge0 backup (token + polling); repeat is instant from cache', async () => {
      await sw.evaluate(() => self.OutputIQ.runner.clearCache());
      server.wandboxDown = true;
      server.forcePolling = true;
      const before = server.requests.filter((r) => r.method === 'GET').length;
      assert.equal((await predict(gfg, 1, 'Square: 16')).symbol, '✓');
      assert.ok(server.requests.filter((r) => r.method === 'GET' && r.path.startsWith('/submissions/')).length > before, 'Judge0 polled');
      await bar(gfg, 1).locator('.msg .link').click();
      assert.match(await bar(gfg, 1).locator('.details').textContent(), /Ran on Judge0/);
      server.wandboxDown = false;
      server.forcePolling = false;
      const n = server.wandbox.length + server.submissions.length;
      assert.equal((await predict(gfg, 1, 'Square: 16')).symbol, '✓');
      assert.ok(await checkMs(gfg, 1) < 500, 'cached result is instant');
      assert.equal(server.wandbox.length + server.submissions.length, n, 'no new run');
      assert.match(await bar(gfg, 1).locator('.details').textContent(), /Instant · saved result/);
    });

    await step('fast runner: opening the bar starts the run early (prerun), so Check reuses it', async () => {
      await sw.evaluate(() => self.OutputIQ.runner.clearCache());
      const b = bar(gfg, 0);
      if (await b.locator('.bar.open').count()) await b.locator('.logo').click(); // close it first
      const n = server.wandbox.length;
      await b.locator('.logo').click();
      await gfg.waitForFunction(() => true);
      for (let i = 0; i < 50 && server.wandbox.length === n; i++) await gfg.waitForTimeout(50);
      assert.equal(server.wandbox.length, n + 1, 'run started when the bar opened, before Check');
      await gfg.waitForTimeout(800);
      await bar(gfg, 0).locator('textarea.answer').fill('anything');
      assert.ok(await checkMs(gfg, 0) < 500, 'Check is near-instant');
      assert.equal(server.wandbox.length, n + 1, 'Check did not run it again');
    });

    await step('fast runner: Wandbox slow -> Judge0 joins after 4 s and wins', async () => {
      await sw.evaluate(() => self.OutputIQ.runner.clearCache());
      server.wandboxDelayMs = 9000;
      const r = await predict(ge, 4, 'start');
      assert.equal(r.symbol, '✗');
      assert.match(await bar(ge, 4).locator('.details').textContent(), /Ran on Judge0/);
      server.wandboxDelayMs = 0;
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
      await p.waitForFunction(() => /%$/.test(document.getElementById('accuracy').textContent));
      assert.equal(await p.locator('#recent, #langs, #vaultBadge, #revBadge').count(), 0, 'popup is minimal');
      assert.equal(await p.textContent('#clipMsg'), '', 'no hint line until you clip');
      assert.equal((await p.textContent('#openDashboard')).trim(), 'My Learning Hub');
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
      assert.equal(await d.locator('#clipList .clip').count(), 4, 'Code section: 4 code clips (the text clip is a key point)');
      assert.equal(await d.textContent('#navVault'), '5', 'due count in sidebar (code + key points)');

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
      assert.equal(await d.locator('#clipList .clip select').count(), 0, 'no language / concept pickers on cards');
      assert.equal(await d.locator('#clipList .clip .mark').count(), 0, 'no language icon on cards');
      await d.waitForTimeout(300);
      let v = await sw.evaluate(async () => (await chrome.storage.local.get('vault')).vault.find((c) => /printf/.test(c.text)));
      assert.deepEqual([v.status, /newline/.test(v.notes)], ['difficult', true]);
      await d.fill('#vQ', '');
      await d.waitForFunction(() => document.querySelectorAll('#clipList .clip').length === 4);

      // filters
      await d.selectOption('#vStatus', 'difficult');
      assert.equal(await d.locator('#clipList .clip').count(), 1);
      await d.selectOption('#vStatus', '');
      await d.selectOption('#vSite', 'w3schools');
      assert.equal(await d.locator('#clipList .clip').count(), 1);
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
      assert.match(await d.textContent('#vReview pre'), /printf/, 'difficult clip comes first');
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

    await step('GfG: Java and C++ snippets without main() are wrapped and run; fragments get no button', async () => {
      await ctx.route(URLS.gfgSnip, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: snippetsPage }));
      const p = await open(URLS.gfgSnip);
      assert.equal(await p.locator('[data-outputiq-host]').count(), 2, 'switch (Java) + sum (C++); fragment skipped');
      let r = await predict(p, 0, 'Looking forward to the Weekend');
      assert.equal(r.symbol, '✓');
      r = await predict(p, 1, '8');
      assert.equal(r.symbol, '✓');
      await p.close();
    });

    await step('Notes + key points on GfG: bar ✎ note, select text → Key point / Note, page note; vault sections', async () => {
      await sw.evaluate(() => chrome.storage.local.set({ vault: [] }));
      const g = await open(URLS.gfg);
      // 1) ✎ in the bar: note saved with the code
      await bar(g, 0).locator('.logo').click();
      await bar(g, 0).locator('.icon.note').click();
      await bar(g, 0).locator('.notebox textarea').fill('i <= 3 so it prints 1 2 3');
      await bar(g, 0).locator('.notebox .savenote').click();
      await bar(g, 0).locator('.notebox .notestatus', { hasText: 'Saved' }).waitFor();
      // 2) select a sentence → floating [Key point]
      const pick = async () => g.evaluate(() => {
        const p = [...document.querySelectorAll('article p, p')].find((x) => x.textContent.trim().split(/\s+/).length > 5) || (() => { const n = document.createElement('p'); n.textContent = 'A for loop repeats code a fixed number of times.'; document.body.prepend(n); return n; })();
        getSelection().selectAllChildren(p);
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        return p.textContent.trim();
      });
      const sentence = await pick();
      const tools = g.locator('[data-outputiq-seltools]');
      await tools.locator('.stool.point').waitFor();
      await tools.locator('.stool.point').click();
      await g.waitForFunction(() => document.querySelector('[data-outputiq-seltools]').style.display === 'none');
      // 3) select again → Note
      await pick();
      await tools.locator('.stool.note').click();
      await tools.locator('.notebox textarea').fill('my own words: loop = repeat');
      await tools.locator('.notebox .savenote').click();
      await tools.locator('.notestatus', { hasText: 'Saved' }).waitFor();
      // 4) popup ✎ → topic note (same message the popup sends)
      await g.bringToFront();
      const r = await sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return chrome.tabs.sendMessage(t.id, { type: 'NOTE_REQUEST', notes: 'Topic summary: init; condition; update' }, { frameId: 0 }); });
      assert.equal(r.ok, true);
      const v = await sw.evaluate(async () => (await chrome.storage.local.get('vault')).vault);
      const code = v.find((c) => c.kind === 'code'), pt = v.find((c) => c.kind === 'text'), note = v.find((c) => c.kind === 'note');
      assert.ok(code && /prints 1 2 3/.test(code.notes), 'code saved with its note');
      assert.ok(pt && pt.text === sentence && /my own words/.test(pt.notes), 'key point saved once, note added to it');
      assert.equal(v.filter((c) => c.kind === 'text').length, 1);
      assert.ok(note && /Topic summary/.test(note.text) && note.topic, 'topic note with heading');

      const d = await ctx.newPage();
      d.on('pageerror', (e) => pageErrors.push('vault-notes: ' + e));
      await d.setViewportSize({ width: 1280, height: 1000 });
      await d.goto(`chrome-extension://${extId}/src/dashboard/dashboard.html#vault`);
      await d.locator('#langTabs .ltab[data-l="all"]').click();
      await d.waitForSelector('#vKinds .ltab');
      assert.deepEqual(await d.locator('#vKinds .ltab').allTextContents(), ['Code1', 'My notes3', 'Key points1', 'LeetCode0']);
      assert.match(await d.locator('#clipList .clip textarea.notearea').first().inputValue(), /prints 1 2 3/, 'note shown under the code');
      await d.locator('#vKinds .ltab[data-kind="points"]').click();
      assert.equal(await d.locator('ul.points li').count(), 1);
      assert.match(await d.locator('.topicsec h3').first().textContent(), /\S/);
      assert.match(await d.locator('ul.points li').textContent(), /my own words/);
      await d.locator('#vKinds .ltab[data-kind="notes"]').click();
      assert.equal(await d.locator('.notecard').count(), 3);
      const ta = d.locator('.notecard textarea').first();
      await ta.fill('Topic summary (edited)');
      await d.locator('.notecard .saved', { hasText: 'Saved' }).waitFor();
      const edited = await sw.evaluate(async () => (await chrome.storage.local.get('vault')).vault.find((c) => c.kind === 'note').text);
      assert.equal(edited, 'Topic summary (edited)');
      await d.screenshot({ path: path.join(SHOTS, 'vault-notes.png'), fullPage: true });
      await d.locator('#vKinds .ltab[data-kind="points"]').click();
      await d.screenshot({ path: path.join(SHOTS, 'vault-points.png'), fullPage: true });
      await d.close();
      await g.close();
    });

    await step('Practice (dashboard): questions from wrong attempts + difficult clips in C++/Java/Python; wrong answer → Difficult', async () => {
      // a real wrong attempt (Java) and a C++ one, newest
      await sw.evaluate(async () => {
        const { attempts } = await chrome.storage.local.get('attempts');
        const now = Date.now();
        attempts.push({ id: 'pj1', ts: now, questionId: 'pj1', language: 'java', site: 'w3schools', url: 'https://www.w3schools.com/java/java_for_loop.asp', pageTitle: 'Java For Loop',
          code: 'public class Main {\n    public static void main(String[] args) {\n        for (int i = 0; i < 3; i++)\n            System.out.println(i);\n        System.out.println(7 / 2);\n    }\n}', prediction: '0 1 2', result: 'incorrect', actualOutput: '0\n1\n2\n3\n', concepts: ['loops'] });
        attempts.push({ id: 'pc1', ts: now + 1, questionId: 'pc1', language: 'cpp', site: 'geeksforgeeks', url: 'https://www.geeksforgeeks.org/cpp/cpp-for-loop/', pageTitle: 'for Loop in C++',
          code: '#include <iostream>\nusing namespace std;\nint main() {\n    int n = 3;\n    for (int i = 1; i <= n; i++)\n        cout << i << endl;\n    return 0;\n}', prediction: '1 2', result: 'incorrect', actualOutput: '1\n2\n3\n', concepts: ['loops'] });
        await chrome.storage.local.set({ attempts });
      });
      const d = await ctx.newPage();
      d.on('pageerror', (e) => pageErrors.push('practice: ' + e));
      await d.setViewportSize({ width: 1280, height: 1000 });
      await d.goto(`chrome-extension://${extId}/src/dashboard/dashboard.html#practice`);
      await d.locator('#langTabs .ltab[data-l="all"]').click();
      await d.waitForSelector('.pq-src');
      assert.equal(await d.locator('.side nav a[data-view="practice"]').count(), 1, 'Practice in the sidebar');
      assert.ok(Number(await d.locator('.pq-src[data-src="wrong"] b').textContent()) >= 1);
      await d.screenshot({ path: path.join(SHOTS, 'practice-start.png'), fullPage: true });
      const before = server.wandbox.length + server.submissions.length;
      await d.locator('#startPractice').click();
      await d.locator('.pq-opt').first().waitFor({ timeout: 60000 }).catch(async (e) => {
        console.log('\nBODY:', await d.locator('#practiceBody').textContent());
        console.log('WB:', JSON.stringify(server.wandbox.slice(-6).map((x) => x.compiler + ' ' + x.code.slice(0, 60))));
        throw e; });
      assert.ok(server.wandbox.length + server.submissions.length > before, 'changed programs were run');
      let n = 0, right = 0;
      for (let k = 0; k < 10; k++) {
        if (await d.locator('.pq-end').count()) break;
        assert.ok((await d.locator('.pq-prompt').textContent()).length > 10);
        // pick the right answer on odd questions, the first option on even ones
        await d.locator('.pq-opt').first().click();
        await d.locator('.pq-why.show').waitFor();
        if (k === 0) await d.screenshot({ path: path.join(SHOTS, 'practice-question.png'), fullPage: true });
        if (await d.locator('.pq-opt.wrong').count() === 0) right++;
        n++;
        await d.locator('.pq-next').click();
      }
      assert.ok(n >= 3, 'at least 3 questions: ' + n);
      assert.match(await d.locator('.pq-end h2').textContent(), new RegExp('Score ' + right + ' / ' + n));
      const log = await sw.evaluate(async () => (await chrome.storage.local.get('quizLog')).quizLog.filter((x) => x.where === 'dashboard'));
      assert.equal(log.length, n, 'answers logged');
      await d.screenshot({ path: path.join(SHOTS, 'practice-end.png'), fullPage: true });

      // Difficult clips source (Java snippet saved earlier is not code here; seed a difficult Python clip)
      await sw.evaluate(async () => {
        const { vault } = await chrome.storage.local.get('vault');
        vault.push({ id: 'pyd1', kind: 'code', language: 'python', text: 'x = 7\nfor i in range(3):\n    print(i)\nprint(x // 2)', concepts: ['loops'], concept: 'loops', topic: 'Loops in Python', site: 'geeksforgeeks', url: 'https://www.geeksforgeeks.org/python/loops-in-python/', pageTitle: 'Loops in Python', notes: '', status: 'difficult', createdAt: Date.now(), updatedAt: Date.now(), reviewedAt: null, reviewCount: 0, nextReviewAt: Date.now() });
        await chrome.storage.local.set({ vault });
      });
      await d.locator('.pq-end .btn', { hasText: 'Practice again' }).click();
      await d.locator('#langTabs .ltab[data-l="python"]').click();
      await d.locator('.pq-src[data-src="difficult"]').click();
      await d.locator('#startPractice').click();
      await d.locator('.pq-opt').first().waitFor({ timeout: 60000 }).catch(async (e) => { await d.screenshot({ path: path.join(SHOTS, 'practice-fail.png'), fullPage: true }); console.log(await d.locator('#practiceBody').textContent()); throw e; });
      assert.match(await d.locator('.pq-from').textContent(), /Loops.*Difficult clip/);
      await d.locator('#langTabs .ltab[data-l="all"]').click().catch(() => {});
      await d.close();
    });

    await step('LeetCode: Array problem → "Solve later" chip in the chip row, note saved to Chrome sync; non-Array → nothing; dashboard LeetCode tab', async () => {
      const page = (title) => `<!doctype html><html class="dark"><head><title>${title} - LeetCode</title></head><body style="background:#1a1a1a;color:#eee;font-family:sans-serif">
        <div style="padding:20px"><div class="flex items-start gap-2"><div class="text-title-large" style="font-size:24px;font-weight:600"><a href="#">${title}</a></div></div>
        <div class="flex gap-1" style="display:flex;gap:4px;margin-top:12px"><div class="text-difficulty-easy" style="padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.1);color:#46c6c2;font-size:12px">Easy</div>
        <div style="padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.1);font-size:12px">Topics</div><div style="padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.1);font-size:12px">Companies</div>
        <div style="padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.1);font-size:12px">Hint</div></div><p>Given an array of integers nums…</p></div></body></html>`;
      const Q = { 'two-sum': ['1', 'Two Sum', 'Easy', ['Array', 'Hash Table']], 'valid-parentheses': ['20', 'Valid Parentheses', 'Easy', ['String', 'Stack']] };
      await ctx.route(/https:\/\/leetcode\.com\/.*/, (route) => {
        const u = new URL(route.request().url());
        if (u.pathname.startsWith('/graphql')) {
          const slug = JSON.parse(route.request().postData()).variables.titleSlug, q = Q[slug];
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { question: { questionFrontendId: q[0], title: q[1], difficulty: q[2], topicTags: q[3].map((t) => ({ name: t, slug: t.toLowerCase() })) } } }) });
        }
        const slug = (u.pathname.match(/^\/problems\/([^/]+)/) || [])[1];
        route.fulfill({ status: 200, contentType: 'text/html', body: page(slug ? Q[slug][0] + '. ' + Q[slug][1] : 'LeetCode') });
      });
      const lc = await ctx.newPage();
      lc.on('pageerror', (e) => pageErrors.push('leetcode: ' + e));
      await lc.goto('https://leetcode.com/problems/two-sum/description/');
      const chip = lc.locator('[data-codextent-lc] .chip');
      await chip.waitFor({ timeout: 10000 });
      assert.equal(await lc.locator('[data-codextent-lc]').evaluate((h) => h.parentElement.className), 'flex gap-1');
      await chip.click();
      await lc.locator('[data-codextent-lc] textarea').fill('hash map value -> index, one pass');
      await lc.locator('[data-codextent-lc] button.save').click();
      await lc.locator('[data-codextent-lc] .chip.saved').waitFor();
      await lc.locator('[data-codextent-lc]').screenshot({ path: path.join(SHOTS, 'leetcode-chip.png') });
      await lc.waitForTimeout(900);
      await chip.click();
      await lc.locator('[data-codextent-lc] .pop.show').waitFor();
      await lc.screenshot({ path: path.join(SHOTS, 'leetcode-pop.png'), clip: { x: 0, y: 0, width: 720, height: 460 } });
      const synced = await sw.evaluate(async () => (await chrome.storage.sync.get('lc:two-sum'))['lc:two-sum']);
      assert.deepEqual([synced.t, synced.d, synced.n, synced.st], ['Two Sum', 'easy', 'hash map value -> index, one pass', 'todo']);
      // single-page navigation to a non-Array problem: chip goes away
      await lc.evaluate(() => history.pushState({}, '', '/problems/valid-parentheses/'));
      await lc.waitForFunction(() => !document.querySelector('[data-codextent-lc]'), null, { timeout: 5000 });
      await lc.close();

      const d = await ctx.newPage();
      d.on('pageerror', (e) => pageErrors.push('lc-dashboard: ' + e));
      await d.setViewportSize({ width: 1280, height: 900 });
      await d.goto(`chrome-extension://${extId}/src/dashboard/dashboard.html#vault/lc`);
      await d.locator('.lc-card').waitFor();
      assert.match(await d.locator('#vKinds .ltab[data-kind="leetcode"]').textContent(), /LeetCode\s*1/);
      assert.match(await d.locator('.lc-card').textContent(), /1\. Two Sum[\s\S]*Easy[\s\S]*Array/);
      assert.equal(await d.locator('.lc-card textarea').inputValue(), 'hash map value -> index, one pass');
      await d.screenshot({ path: path.join(SHOTS, 'vault-leetcode.png'), fullPage: true });
      await d.locator('.lc-card .btn', { hasText: 'Mark solved' }).click();
      await d.locator('.seg button', { hasText: 'Solved' }).click();
      await d.locator('.lc-card').waitFor();
      const where = await sw.evaluate(async () => [!!(await chrome.storage.sync.get('lc:two-sum'))['lc:two-sum'], !!((await chrome.storage.local.get('lcDone')).lcDone || {})['two-sum']]);
      assert.deepEqual(where, [false, true], 'solved problems move out of sync storage');
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

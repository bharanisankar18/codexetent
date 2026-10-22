/*
 * Codextent — My Learning Hub (v0.7) — monochrome, Apple-style; glow only on hover.
 *   Sidebar views: #vault  #home  #recent  #revision  #concepts   (hash routing; #vault/<clipId> focuses a clip)
 *   Home: recent attempts + needs revision on top, vault strip, overview, compact Top concepts / Websites
 *         ("View full" expands them), daily activity at the bottom.
 *   My Revision Vault: clips saved with the Code Clipper (search, filters, notes, status, revise mode).
 *   Language tabs in the header switch every view; the selected language glows.
 *   Attempt card: [language emblem]  topic / website · language · time  [✓/✗]
 *                 "Topics & output" -> your output vs actual output, then the subtopics (concepts)
 *   Concepts: C++ live (tags, weak spots, explanations, the problems you did per concept);
 *             every language (C, C++, Java, Python, MySQL) has its own concept catalog (lib/concepts*.js).
 */
(function () {
  'use strict';
  var OQ = globalThis.OutputIQ;
  var C = OQ.concepts;
  var $ = function (id) { return document.getElementById(id); };

  var LANGS = [
    { id: 'c', name: 'C', short: 'C' },
    { id: 'cpp', name: 'C++', short: 'C++' },
    { id: 'java', name: 'Java', short: 'J' },
    { id: 'python', name: 'Python', short: 'Py' },
    { id: 'sql', name: 'MySQL', short: 'SQL' }
  ];
  // Official logos are not bundled. If the owner drops files at icons/lang/<id>.svg they are used
  // automatically; otherwise a monochrome lettermark is shown.
  var LOGO = {};
  LANGS.forEach(function (l) {
    var img = new Image();
    img.onload = function () { LOGO[l.id] = img.src; render(); };
    img.src = '../../icons/lang/' + l.id + '.svg';
  });
  var LANG = {}; LANGS.forEach(function (l) { LANG[l.id] = l; });
  LANG.text = { id: 'text', name: 'Text', short: 'Aa' };
  var V = OQ.vault;
  var CONCEPTS_READY = { c: C.has('c'), cpp: C.has('cpp'), java: C.has('java'), python: C.has('python'), sql: C.has('sql') };
  var SITES = [
    { id: 'geeksforgeeks', name: 'GeeksforGeeks', mark: 'GfG' },
    { id: 'programiz', name: 'Programiz', mark: 'P' },
    { id: 'w3schools', name: 'W3Schools', mark: 'W3' },
    { id: 'tutorialspoint', name: 'TutorialsPoint', mark: 'TP' },
    { id: 'javatpoint', name: 'Javatpoint', mark: 'JT' },
    { id: 'scaler', name: 'Scaler Topics', mark: 'SC' },
    { id: 'studytonight', name: 'Studytonight', mark: 'ST' },
    { id: 'sanfoundry', name: 'Sanfoundry', mark: 'SF' }
  ];
  var SITE = {}; SITES.forEach(function (s) { SITE[s.id] = s; });
  var SYM = { correct: ['✓', 'ok', 'Correct'], incorrect: ['✗', 'bad', 'Wrong'], compile_error: ['!', 'warn', 'Compile error'],
              runtime_error: ['!', 'warn', 'Runtime error'], timeout: ['⏱', 'warn', 'Timeout'], error: ['!', 'warn', 'Runner error'] };
  var VIEWS = { vault: 'My Revision Vault', home: 'My Learning Hub', recent: 'Recent attempts', revision: 'Needs revision', concepts: 'Concepts' };
  var SUBS = { vault: 'Code you clipped from learning sites — add notes, mark what is hard, revise it later', home: 'Your learning summary', recent: 'Every check you made, newest first',
               revision: 'Questions whose latest check was wrong — open one, compare, retry', concepts: 'What each concept means and the problems you did' };

  var state = { lang: '', site: '', view: 'home', recentLimit: 15, openConcept: null, showAllConcepts: false, open: {},
                expand: { tc: false, sites: false }, vf: { q: '', status: '', site: '', concept: '', sort: 'newest' },
                focusClip: null, review: null, clipOpen: {} };
  var all = [];
  var clips = [];

  // ---------------------------------------------------------------- helpers
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function emblem(lang, size) {
    var l = LANG[lang] || { short: '?' };
    var e = h('span', 'mark' + (size ? ' ' + size : ''));
    e.setAttribute('data-l', lang || 'all');
    e.setAttribute('aria-hidden', 'true');
    if (LOGO[lang]) {
      var img = document.createElement('img');
      img.src = LOGO[lang];
      img.alt = '';
      e.classList.add('has-img');
      e.appendChild(img);
    } else e.textContent = l.short;
    return e;
  }
  function sym(result, big) {
    var s = SYM[result] || SYM.error;
    var e = h('span', 'sym ' + s[1] + (big ? ' big' : ''), s[0]);
    e.setAttribute('role', 'img');
    e.setAttribute('aria-label', s[2]);
    e.title = s[2];
    return e;
  }
  function topicOf(a) {
    var t = (a.pageTitle || '').replace(/\s*[-|–:]\s*(GeeksforGeeks|Programiz|W3Schools|Tutorialspoint|TutorialsPoint)\s*$/i, '').trim();
    return t || OQ.ui.shortTitle(a);
  }
  function save() {
    try { localStorage.setItem('oiq-dash', JSON.stringify({ lang: state.lang, site: state.site })); } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem('oiq-dash') || '{}');
      if (s.lang === '' || LANG[s.lang]) state.lang = s.lang || '';
      if (s.site === '' || SITE[s.site]) state.site = s.site || '';
    } catch (e) { /* defaults */ }
  }
  function byLang(list) { return list.filter(function (a) { return !state.lang || OQ.stats.languageOf(a) === state.lang; }); }
  function bySite(list) { return list.filter(function (a) { return !state.site || OQ.stats.siteOf(a) === state.site; }); }
  function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }

  // ---------------------------------------------------------------- routing + language tabs
  function route() {
    var parts = (location.hash || '#home').slice(1).split('/');
    var v = parts[0];
    state.view = VIEWS[v] ? v : 'home';
    state.focusClip = v === 'vault' && parts[1] ? decodeURIComponent(parts[1]) : null;
    if (state.focusClip) { state.vf = { q: '', status: '', site: '', concept: '', sort: state.vf.sort }; state.lang = ''; }
    document.querySelectorAll('.side nav a[data-view]').forEach(function (a) {
      var on = a.getAttribute('data-view') === state.view;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    Object.keys(VIEWS).forEach(function (k) { $('view-' + k).classList.toggle('hidden', k !== state.view); });
    $('viewTitle').textContent = VIEWS[state.view];
    $('viewSub').textContent = SUBS[state.view] + (state.lang ? ' · ' + LANG[state.lang].name : '');
    render();
  }

  function renderLangTabs() {
    var box = $('langTabs');
    box.textContent = '';
    [{ id: '', name: 'All' }].concat(LANGS).forEach(function (l) {
      var b = h('button', 'ltab' + (l.id ? '' : ' all'));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('data-l', l.id || 'all');
      b.setAttribute('aria-selected', String(state.lang === l.id));
      b.title = l.id ? 'Show ' + l.name + ' only' : 'Show all languages';
      b.appendChild(document.createTextNode(l.name));
      b.addEventListener('click', function () { setLang(l.id); });
      box.appendChild(b);
    });
  }

  function setLang(id) {
    state.lang = id;
    state.openConcept = null;
    save();
    route();
  }

  // ---------------------------------------------------------------- attempt card
  function attemptCard(a, opts) {
    opts = opts || {};
    var key = (opts.scope || '') + a.id;
    var lang = OQ.stats.languageOf(a);
    var site = OQ.stats.siteOf(a);
    var card = h('article', 'att');
    card.setAttribute('data-id', a.id);
    if (state.open[key]) card.classList.add('open');

    var head = h('div', 'att-head');
    head.appendChild(emblem(lang));
    var mid = h('div');
    var topic = h('div', 'att-topic', topicOf(a));
    topic.title = topicOf(a);
    mid.appendChild(topic);
    var sub = h('div', 'att-sub');
    sub.appendChild(h('span', 'sname', (SITE[site] && SITE[site].name) || site));
    sub.appendChild(h('span', 'dot', '•'));
    sub.appendChild(h('span', 'lname', (LANG[lang] && LANG[lang].name) || lang));
    sub.appendChild(h('span', 'dot', '•'));
    sub.appendChild(h('span', null, OQ.ui.timeAgo(a.ts)));
    mid.appendChild(sub);
    head.appendChild(mid);
    head.appendChild(sym(a.result, true));
    card.appendChild(head);

    var actions = h('div', 'att-actions');
    var toggle = h('button', 'toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', String(!!state.open[key]));
    toggle.appendChild(document.createTextNode('Topics & output '));
    toggle.appendChild(h('span', 'chev', '▾'));
    actions.appendChild(toggle);
    card.appendChild(actions);

    var body = h('div', 'att-body');
    card.appendChild(body);
    var built = false;
    function build() {
      if (built) return;
      built = true;
      // 1) your output vs actual output
      var io = h('div', 'io');
      var mine = h('div', 'mine' + (a.result === 'correct' ? ' right' : ''));
      var ml = h('div', 'lbl', 'Your output');
      ml.appendChild(sym(a.result));
      mine.appendChild(ml);
      mine.appendChild(h('pre', null, a.prediction === '' || a.prediction == null ? '(empty)' : a.prediction));
      var real = h('div', 'real');
      real.appendChild(h('div', 'lbl', a.result === 'compile_error' ? 'Actual result' : 'Actual output'));
      var actualText = a.result === 'compile_error' ? 'Compilation error — the program printed nothing.'
        : (a.actualOutput === '' ? '(nothing printed)' : a.actualOutput) + (a.result === 'runtime_error' ? '\n— then: ' + (a.statusDescription || 'runtime error') : '')
          + (a.result === 'timeout' ? '\n— then: time limit exceeded' : '');
      real.appendChild(h('pre', null, actualText));
      io.appendChild(mine);
      io.appendChild(real);
      body.appendChild(io);

      // 2) subtopics (concepts) below the outputs
      var st = h('div', 'subtopics');
      st.appendChild(h('div', 'lbl', 'Subtopics in this example'));
      var ids = C.conceptsOf(a);
      if (!CONCEPTS_READY[lang]) {
        st.appendChild(h('span', 'chip plain', 'Concept tags for ' + LANG[lang].name + ' are coming soon'));
      } else if (!ids.length) {
        st.appendChild(h('span', 'chip plain', 'No specific concept detected'));
      } else {
        var chips = h('div', 'chips');
        ids.forEach(function (id) {
          var c = C.get(lang, id);
          var b = h('button', 'chip');
          b.type = 'button';
          b.appendChild(emblem(lang));
          b.appendChild(document.createTextNode(c.name));
          b.title = 'Open "' + c.name + '" in Concepts';
          b.addEventListener('click', function () { openConceptPage(id, lang); });
          chips.appendChild(b);
        });
        st.appendChild(chips);
        var ul = h('ul', 'trap');
        ids.forEach(function (id) {
          var li = h('li');
          li.appendChild(h('b', null, C.get(lang, id).name + ': '));
          li.appendChild(document.createTextNode(C.get(lang, id).trap));
          ul.appendChild(li);
        });
        st.appendChild(ul);
      }
      body.appendChild(st);

      // 3) actions
      var fa = h('div', 'foot-actions');
      var retry = h('button', 'btn primary small', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', function () { openRetry(body, a); retry.disabled = true; });
      fa.appendChild(retry);
      var url = OQ.ui.safeUrl(a.url);
      if (url) {
        var link = h('a', 'btn small', 'Open page ↗');
        link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        fa.appendChild(link);
      }
      body.appendChild(fa);
    }
    if (state.open[key]) build();
    toggle.addEventListener('click', function () {
      var on = !card.classList.contains('open');
      card.classList.toggle('open', on);
      toggle.setAttribute('aria-expanded', String(on));
      if (on) { state.open[key] = true; build(); } else delete state.open[key];
    });
    return card;
  }

  function openRetry(body, a) {
    var el = $('retryTpl').content.firstElementChild.cloneNode(true);
    el.querySelector('pre.code').textContent = a.code;
    var stdin = el.querySelector('.stdin'), answer = el.querySelector('.answer'), run = el.querySelector('.run');
    var mark = el.querySelector('.sym'), out = el.querySelector('.out');
    var lang = OQ.stats.languageOf(a);
    var needsStdin = !!a.stdin || /\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\(|\binput\s*\(|new\s+Scanner\s*\(/.test(a.code);
    stdin.classList.toggle('hidden', !needsStdin);
    stdin.value = a.stdin || '';
    [stdin, answer].forEach(function (t) { t.addEventListener('input', function () { autoGrow(t); }); });
    answer.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run.click(); } });
    run.addEventListener('click', function () {
      if (run.disabled) return;
      run.disabled = true; run.textContent = 'Running…';
      out.textContent = '';
      var prediction = answer.value;
      chrome.runtime.sendMessage({
        type: 'CHECK_PREDICTION', language: lang, code: a.code, stdin: stdin.value, prediction: prediction,
        site: OQ.stats.siteOf(a), wrapped: !!a.wrapped, url: a.url, pageTitle: a.pageTitle
      }, function (response) {
        run.disabled = false; run.textContent = 'Check';
        if (chrome.runtime.lastError) response = { ok: false, error: chrome.runtime.lastError.message };
        var s = OQ.render.summarize(response);
        mark.className = 'sym big ' + s.state;
        mark.textContent = s.symbol;
        mark.setAttribute('aria-label', s.label);
        mark.title = s.label;
        out.appendChild(OQ.render.renderResult(document, response, prediction));
      });
    });
    body.appendChild(el);
    answer.focus();
  }

  function fillAtts(box, list, scope, emptyText) {
    box.textContent = '';
    if (!list.length) { box.appendChild(h('div', 'empty', emptyText)); return; }
    list.forEach(function (a) { box.appendChild(attemptCard(a, { scope: scope })); });
  }

  // ---------------------------------------------------------------- home
  function todayDelta(list) {
    var key = OQ.stats.dayKey(Date.now());
    var t = list.filter(function (a) { return OQ.stats.dayKey(a.ts) === key; });
    var c = t.filter(function (a) { return a.result === 'correct'; }).length;
    var w = t.filter(function (a) { return a.result === 'incorrect'; }).length;
    return { checked: c + w, correct: c, accuracy: c + w ? Math.round(c / (c + w) * 100) : null };
  }

  function renderHome() {
    var list = bySite(byLang(all));
    var s = OQ.stats.computeStats(list, 4);
    var d = todayDelta(list);
    var acc = s.accuracy;
    $('overviewSub').textContent = (state.lang ? LANG[state.lang].name : 'All languages') + ' · ' + (state.site ? SITE[state.site].name : 'all websites');
    $('kAccuracy').textContent = acc == null ? '–' : acc + '%';
    $('dAccuracy').textContent = d.accuracy == null ? 'no checks today' : d.accuracy + '% today';
    $('kChecked').textContent = s.graded;
    $('dChecked').textContent = '+' + d.checked + ' today';
    $('kCorrect').textContent = s.correct;
    $('dCorrect').textContent = '+' + d.correct + ' today';
    $('kStreak').textContent = s.streak;
    $('dStreak').textContent = s.streak ? 'in a row' : 'start one!';

    $('ringPct').textContent = acc == null ? '–' : acc + '%';
    $('kAccuracySub').textContent = s.graded ? s.correct + ' of ' + s.graded + ' correct' : 'no answers yet';
    $('ringFg').style.strokeDashoffset = (314.16 * (1 - (acc || 0) / 100)).toFixed(2) + 'px';
    $('rCorrect').textContent = s.correct;
    $('rWrong').textContent = s.incorrect;
    $('kErrors').textContent = s.errors;

    renderTopConcepts(list);
    renderSites();
    actChart(list);
    fillAtts($('homeRecent'), s.recent, 'hr', 'No attempts yet. Click the < ⚡ > logo under a code example to start.');
    renderVaultStrip();
    fillAtts($('homeRevision'), s.needsRevision.slice(0, 4), 'hv', 'Nothing to revise. Nice work!');
  }

  function renderTopConcepts(list) {
    var lang = state.lang || 'cpp';
    var tb = $('topConcepts').querySelector('tbody');
    tb.textContent = '';
    $('tcSub').textContent = LANG[lang].name + (CONCEPTS_READY[lang] ? ' · most practised' : ' · coming soon');
    if (!CONCEPTS_READY[lang]) {
      var tr0 = h('tr');
      var td0 = h('td', null, LANG[lang].name + ' concept tags are coming soon. C++ works now.');
      td0.colSpan = 4;
      td0.className = 'muted';
      tr0.appendChild(td0);
      tb.appendChild(tr0);
      return;
    }
    var stats = C.conceptStats(list, lang);
    var rows = stats.filter(function (x) { return x.graded; }).sort(function (a, b) { return b.graded - a.graded || a.accuracy - b.accuracy; });
    rows = rows.concat(stats.filter(function (x) { return !x.graded; }));
    var shown = state.expand.tc ? rows : rows.slice(0, 3);
    setViewFull($('tcMore'), 'tc', rows.length, shown.length, 'concepts');
    shown.forEach(function (x, i) {
      var c = C.get(lang, x.id);
      var tr = h('tr');
      tr.title = 'Open ' + c.name;
      tr.appendChild(h('td', null, ('0' + (i + 1)).slice(-2)));
      tr.appendChild(h('td', 'nm', c.name));
      var td = h('td');
      var tk = h('div', 'track' + (x.graded ? '' : ' none'));
      if (x.graded) { var f = h('i'); f.style.width = Math.max(2, x.accuracy) + '%'; tk.appendChild(f); }
      td.appendChild(tk);
      tr.appendChild(td);
      var tdp = h('td', 'r');
      tdp.appendChild(h('span', 'pill' + (x.weak ? ' weak' : ''), x.graded ? x.accuracy + '%' : '–'));
      tr.appendChild(tdp);
      tr.addEventListener('click', function () { openConceptPage(x.id, lang); });
      tb.appendChild(tr);
    });
  }

  function renderSites() {
    var sl = $('siteList');
    sl.textContent = '';
    var perSite = OQ.stats.computeStats(byLang(all)).bySite;
    var stat = function (id) { return perSite.filter(function (x) { return x.key === id; })[0] || { graded: 0, accuracy: null, errors: 0 }; };
    var used = function (id) { var g = stat(id); return g.graded + g.errors; };
    var order = SITES.slice().sort(function (a, b) {
      return (b.id === state.site) - (a.id === state.site) || used(b.id) - used(a.id) || SITES.indexOf(a) - SITES.indexOf(b);
    });
    var shown = state.expand.sites ? order : order.slice(0, 4);
    setViewFull($('siteMore'), 'sites', order.length, shown.length, 'websites');
    shown.forEach(function (st) {
      var g = stat(st.id);
      var b = h('button', 'site');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.site === st.id));
      b.appendChild(h('span', 'smark', st.mark));
      var t = h('span');
      t.appendChild(h('div', 'sn', st.name));
      var n = g.graded + g.errors;
      t.appendChild(h('div', 'ss', n ? n + (n === 1 ? ' attempt' : ' attempts') : 'Not used yet'));
      b.appendChild(t);
      b.appendChild(h('span', 'sv', g.accuracy == null ? '–' : g.accuracy + '%'));
      b.title = state.site === st.id ? 'Showing ' + st.name + ' only — click to show all' : 'Show only ' + st.name;
      b.addEventListener('click', function () { state.site = state.site === st.id ? '' : st.id; save(); render(); });
      sl.appendChild(b);
    });
  }

  function setViewFull(btn, key, total, shown, what) {
    btn.classList.toggle('hidden', total <= 3 && !state.expand[key]);
    btn.textContent = state.expand[key] ? 'Show less' : 'View full · ' + total + ' ' + what;
    btn.setAttribute('aria-expanded', String(!!state.expand[key]));
    btn.closest('.card').classList.toggle('compact', !state.expand[key]);
  }
  $('tcMore').addEventListener('click', function () { state.expand.tc = !state.expand.tc; renderTopConcepts(bySite(byLang(all))); });
  $('siteMore').addEventListener('click', function () { state.expand.sites = !state.expand.sites; renderSites(); });

  /** Two-line area chart (correct = white, wrong = grey dashed) with crosshair + tooltip on hover. */
  function actChart(list) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = $('actChart'), labels = $('dayLabels'), tip = $('tip'), wrap = $('chartWrap');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    labels.textContent = '';
    wrap.querySelectorAll('.ptc, .ptw').forEach(function (n) { n.remove(); });
    var days = OQ.stats.dailyActivity(list, 14);
    var W = 700, H = 200, top = 10, bottom = 190;
    var max = Math.max(4, Math.max.apply(null, days.map(function (d) { return Math.max(d.correct, d.incorrect); })));
    var step = W / (days.length - 1);
    var x = function (i) { return i * step; };
    var y = function (v) { return bottom - (v / max) * (bottom - top); };
    var el = function (tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; };

    var defs = el('defs', {});
    var grad = el('linearGradient', { id: 'areaC', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(el('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.28' }));
    grad.appendChild(el('stop', { offset: '1', 'stop-color': '#ffffff', 'stop-opacity': '0' }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    [0, 0.5, 1].forEach(function (f) { var gy = y(max * f); svg.appendChild(el('line', { x1: 0, x2: W, y1: gy, y2: gy, class: 'grid' })); });

    var smooth = function (key) {
      return days.map(function (d, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[key]).toFixed(1); }).join(' ');
    };
    var lc = smooth('correct');
    svg.appendChild(el('path', { d: lc + ' L' + W + ' ' + bottom + ' L0 ' + bottom + ' Z', class: 'ac' }));
    svg.appendChild(el('path', { d: smooth('incorrect'), class: 'lw' }));
    svg.appendChild(el('path', { d: lc, class: 'lc' }));
    var cross = el('line', { x1: 0, x2: 0, y1: top, y2: bottom, class: 'cross', visibility: 'hidden' });
    svg.appendChild(cross);

    var ptc = h('span', 'ptc hidden'), ptw = h('span', 'ptw hidden');
    wrap.appendChild(ptw); wrap.appendChild(ptc);
    var summary = [];
    days.forEach(function (d, i) {
      var label = d.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      if (d.correct + d.incorrect) summary.push(label + ': ' + d.correct + ' correct, ' + d.incorrect + ' wrong');
      var hit = el('rect', { x: Math.max(0, x(i) - step / 2), y: 0, width: step, height: H, class: 'hit' });
      hit.addEventListener('mouseenter', function () {
        var r = svg.getBoundingClientRect(), pr = wrap.getBoundingClientRect();
        var px = r.left - pr.left + (x(i) / W) * r.width;
        var py = function (v) { return r.top - pr.top + (y(v) / H) * r.height; };
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
        ptc.style.left = px + 'px'; ptc.style.top = py(d.correct) + 'px'; ptc.classList.remove('hidden');
        ptw.style.left = px + 'px'; ptw.style.top = py(d.incorrect) + 'px'; ptw.classList.remove('hidden');
        tip.textContent = '';
        tip.appendChild(h('b', null, label));
        tip.appendChild(document.createTextNode(d.correct + ' correct · ' + d.incorrect + ' wrong' + (d.errors ? ' · ' + d.errors + ' errors' : '')));
        tip.style.left = Math.min(Math.max(px, 80), pr.width - 80) + 'px';
        tip.style.top = Math.min(py(d.correct), py(d.incorrect)) + 'px';
        tip.classList.remove('hidden');
      });
      svg.appendChild(hit);
      labels.appendChild(h('span', null, (i % 2 === 1 || i === days.length - 1) ? String(d.date.getDate()) : ''));
    });
    svg.addEventListener('mouseleave', function () {
      cross.setAttribute('visibility', 'hidden'); tip.classList.add('hidden'); ptc.classList.add('hidden'); ptw.classList.add('hidden');
    });
    svg.setAttribute('aria-label', 'Activity, last 14 days. ' + (summary.join('; ') || 'No checked answers.'));
  }

  // ---------------------------------------------------------------- recent / revision
  function renderSiteSeg() {
    var seg = $('siteSeg');
    seg.textContent = '';
    [{ id: '', name: 'All sites' }].concat(SITES).forEach(function (st) {
      var b = h('button', null, st.name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.site === st.id));
      b.addEventListener('click', function () { state.site = st.id; save(); render(); });
      seg.appendChild(b);
    });
  }

  function renderRecent() {
    renderSiteSeg();
    var list = bySite(byLang(all));
    var s = OQ.stats.computeStats(list, state.recentLimit);
    fillAtts($('recentList'), s.recent, 'r', all.length ? 'No attempts match this language and website.' : 'No attempts yet.');
    $('recentCount').textContent = s.total ? 'Showing ' + s.recent.length + ' of ' + s.total : '';
    $('more').classList.toggle('hidden', s.total <= state.recentLimit);
  }

  function renderRevision() {
    var s = OQ.stats.computeStats(bySite(byLang(all)));
    fillAtts($('revisionList'), s.needsRevision, 'v', 'Nothing to revise. Nice work!');
  }

  // ---------------------------------------------------------------- concepts page
  function openConceptPage(id, lang) {
    state.openConcept = id;
    state.showAllConcepts = true;
    if (lang && state.lang && state.lang !== lang) state.lang = lang;
    if (location.hash !== '#concepts') location.hash = '#concepts';
    else route();
    setTimeout(function () {
      var el = document.querySelector('[data-concept="' + id + '"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function renderConcepts() {
    var box = $('conceptBody');
    box.textContent = '';
    var lang = state.lang || 'cpp';

    var head = h('div', 'cl-head');
    head.appendChild(emblem(lang, 'lg'));
    var ht = h('div');
    ht.appendChild(h('h2', null, LANG[lang].name + ' concepts'));
    ht.appendChild(h('p', null, CONCEPTS_READY[lang]
      ? 'Tagged automatically from the ' + LANG[lang].name + ' code you answer. Open a concept to learn it and see the problems you did.'
      : 'Choose a language above to switch.'));
    head.appendChild(ht);
    box.appendChild(head);

    if (!CONCEPTS_READY[lang]) {
      var soon = h('div', 'soon card');
      soon.appendChild(emblem(lang, 'lg'));
      soon.appendChild(h('h2', null, LANG[lang].name + ' concepts are coming soon'));
      var n = all.filter(function (a) { return OQ.stats.languageOf(a) === lang; }).length;
      soon.appendChild(h('p', null, 'Concept tags work for C++ first. Your ' + n + ' ' + LANG[lang].name +
        ' attempt' + (n === 1 ? ' is' : 's are') + ' saved and will be tagged automatically when ' + LANG[lang].name + ' concepts arrive.'));
      var go = h('button', 'btn primary', 'See C++ concepts');
      go.type = 'button';
      go.addEventListener('click', function () { setLang('cpp'); });
      soon.appendChild(go);
      box.appendChild(soon);
      return;
    }

    var list = bySite(all).filter(function (a) { return OQ.stats.languageOf(a) === lang; });
    var stats = C.conceptStats(list, lang);
    var tried = stats.filter(function (s) { return s.graded > 0; });
    var weak = stats.filter(function (s) { return s.weak; }).sort(function (a, b) { return a.accuracy - b.accuracy; });

    var focus = h('div', 'focus');
    if (weak.length) {
      focus.appendChild(h('span', 'lead', '✦ Focus on:'));
      weak.forEach(function (s) {
        var b = h('button', 'weakchip', C.get(lang, s.id).name + ' · ' + s.accuracy + '%');
        b.type = 'button';
        b.addEventListener('click', function () { openConceptPage(s.id); });
        focus.appendChild(b);
      });
    } else {
      focus.appendChild(h('span', 'muted', tried.length
        ? 'No weak spots right now. A concept is flagged when you have ' + C.MIN_FOR_WEAK + '+ checked answers on it and under ' + C.WEAK_BELOW + '% correct.'
        : 'Answer ' + LANG[lang].name + ' examples and your concepts will fill in here. Meanwhile, open any concept below to learn it.'));
    }
    box.appendChild(focus);

    var order = stats.slice().sort(function (a, b) {
      var ka = a.weak ? 0 : a.graded ? 1 : 2, kb = b.weak ? 0 : b.graded ? 1 : 2;
      if (ka !== kb) return ka - kb;
      if (ka < 2 && a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      var L = C.list(lang);
      return L.indexOf(C.get(lang, a.id)) - L.indexOf(C.get(lang, b.id));
    });
    var untried = order.filter(function (s) { return !s.graded; });
    var showAll = state.showAllConcepts || !tried.length || untried.some(function (s) { return s.id === state.openConcept; });

    var ul = h('div', 'concepts');
    ul.id = 'conceptList';
    order.forEach(function (s) {
      if (!s.graded && !showAll) return;
      ul.appendChild(conceptRow(C.get(lang, s.id), s, list, lang));
    });
    box.appendChild(ul);
    if (tried.length && untried.length) {
      var t = h('button', 'btn ghost fold', showAll ? 'Hide concepts not tried yet' : 'Show ' + untried.length + ' concepts not tried yet');
      t.type = 'button';
      t.addEventListener('click', function () { state.showAllConcepts = !showAll; renderConcepts(); });
      box.appendChild(t);
    }
  }

  function conceptRow(c, s, list, lang) {
    var el = h('div', 'concept');
    el.setAttribute('data-concept', c.id);
    var open = state.openConcept === c.id;
    if (open) el.classList.add('open');

    var btn = h('button', 'crow');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', String(open));
    btn.appendChild(emblem(lang, 'sm'));
    var left = h('span');
    var name = h('span', 'cname', c.name);
    if (s.weak) name.appendChild(h('span', 'weak', 'WEAK'));
    else if (s.graded >= C.MIN_FOR_WEAK && s.accuracy >= 80) name.appendChild(h('span', 'mastered', 'MASTERED'));
    left.appendChild(name);
    left.appendChild(h('span', 'cwhat', c.what));
    btn.appendChild(left);
    var bar = h('span', 'cbar' + (s.graded ? '' : ' none'));
    if (s.graded) { var f = h('i'); f.style.width = Math.max(2, s.accuracy) + '%'; bar.appendChild(f); }
    btn.appendChild(bar);
    var val = h('span', 'cval');
    if (s.graded) { val.appendChild(h('b', null, s.accuracy + '%')); val.appendChild(document.createTextNode(' ' + s.correct + '/' + s.graded)); }
    else val.textContent = 'not tried';
    btn.appendChild(val);
    btn.appendChild(h('span', 'cchev', '›'));
    btn.addEventListener('click', function () {
      state.openConcept = open ? null : c.id;
      renderConcepts();
    });
    el.appendChild(btn);

    var ex = h('div', 'explain');
    if (open) {
      var grid = h('div', 'ex-grid');
      var a = h('div');
      a.appendChild(h('h3', null, 'What it is'));
      a.appendChild(h('p', null, c.what));
      a.appendChild(h('h3', null, 'Common trap'));
      a.appendChild(h('p', 'trap', c.trap));
      grid.appendChild(a);
      var b = h('div');
      b.appendChild(h('h3', null, 'Example'));
      var cm = lang === 'python' ? '#' : lang === 'sql' ? '--' : '//';
      if (c.context) b.appendChild(h('p', 'ctx', c.context));
      var shown = lang === 'sql' ? c.body : (c.prelude ? c.prelude + '\n\n' + (lang === 'python' ? '' : cm + ' inside main()\n') : '') + c.body;
      b.appendChild(h('pre', null, shown));
      var out = h('div', 'outbox');
      out.appendChild(document.createTextNode(c.stdin ? 'Input "' + c.stdin + '" → prints ' : 'Prints '));
      out.appendChild(h('code', null, c.output.replace(/ $/, '·')));
      if (/ $/.test(c.output)) out.appendChild(h('span', 'muted', '  (· = trailing space)'));
      b.appendChild(out);
      grid.appendChild(b);
      ex.appendChild(grid);

      // the problems ("sums") you did that use this concept
      var mine = list.filter(function (x) { return C.conceptsOf(x).indexOf(c.id) !== -1; }).sort(function (p, q) { return q.ts - p.ts; });
      var solved = h('div', 'solved');
      var sh = h('h3', null, 'Problems you did with ' + c.name + ' (' + mine.length + ')');
      solved.appendChild(sh);
      if (!mine.length) solved.appendChild(h('div', 'empty', 'None yet. When you answer a ' + LANG[lang].name + ' example that uses this concept, it will appear here.'));
      else {
        var atts = h('div', 'atts');
        mine.slice(0, 12).forEach(function (x) { atts.appendChild(attemptCard(x, { scope: 'c-' + c.id })); });
        solved.appendChild(atts);
      }
      ex.appendChild(solved);
    }
    el.appendChild(ex);
    return el;
  }

  // ---------------------------------------------------------------- My Revision Vault
  var STATUS_SYM = { 'new': '○', learning: '↻', difficult: '!', mastered: '✓' };

  function conceptName(lang, id) { var c = id && C.has(lang) && C.get(lang, id); return c ? c.name : ''; }
  function clipTitle(c) { return conceptName(c.language, c.concept) || c.topic || (c.kind === 'text' ? 'Text clip' : 'Code clip'); }
  function vaultList() { return clips.filter(function (c) { return !state.lang || c.language === state.lang; }); }

  function renderVaultStrip() {
    var vs = V.vaultStats(vaultList());
    var t = $('vsText');
    if (!vs.total) t.textContent = 'Select code on a learning site, right-click it → Save to My Revision Vault.';
    else t.textContent = vs.total + (vs.total === 1 ? ' clip' : ' clips') + ' · ' + vs.due + ' due now · ' + vs.byStatus.difficult + ' difficult · ' + vs.byStatus.mastered + ' mastered';
    $('vsReview').disabled = !vs.due;
    $('vsReview').textContent = vs.due ? 'Start revising (' + vs.due + ')' : 'Nothing due';
  }
  $('vsReview').addEventListener('click', function () { location.hash = '#vault'; setTimeout(function () { startReview(); }, 0); });

  function option(sel, value, label, current) {
    var o = h('option', null, label);
    o.value = value;
    if (value === current) o.selected = true;
    sel.appendChild(o);
  }

  function renderVaultTools(list) {
    var vf = state.vf;
    var st = $('vStatus'); st.textContent = '';
    option(st, '', 'All statuses', vf.status);
    option(st, 'due', 'Due now', vf.status);
    V.STATUSES.forEach(function (k) { option(st, k, V.STATUS_LABEL[k], vf.status); });

    var si = $('vSite'); si.textContent = '';
    option(si, '', 'All websites', vf.site);
    SITES.forEach(function (x) { if (list.some(function (c) { return c.site === x.id; })) option(si, x.id, x.name, vf.site); });

    var co = $('vConcept'); co.textContent = '';
    option(co, '', 'All concepts', vf.concept);
    var seen = {};
    list.forEach(function (c) {
      [c.concept].concat(c.concepts || []).forEach(function (id) {
        var n = conceptName(c.language, id);
        if (!id || !n || seen[id]) return;
        seen[id] = n + (state.lang ? '' : ' (' + LANG[c.language].name + ')');
      });
    });
    Object.keys(seen).sort(function (a, b) { return seen[a].localeCompare(seen[b]); }).forEach(function (id) { option(co, id, seen[id], vf.concept); });
    if (vf.concept && !seen[vf.concept]) option(co, vf.concept, vf.concept, vf.concept);
    $('vSort').value = vf.sort;
    if ($('vQ') !== document.activeElement) $('vQ').value = vf.q;
  }

  function renderVault() {
    var list = vaultList();
    var vs = V.vaultStats(list);
    renderVaultTools(list);

    // stats + start revision
    var box = $('vStats'); box.textContent = '';
    [['Clips', vs.total, ''], ['Due now', vs.due, 'due'], ['Difficult', vs.byStatus.difficult, 'difficult'], ['Learning', vs.byStatus.learning, 'learning'], ['Mastered', vs.byStatus.mastered, 'mastered']]
      .forEach(function (x) {
        var b = h('button', 'vstat hov');
        b.type = 'button';
        b.setAttribute('aria-pressed', String(!!x[2] && state.vf.status === x[2]));
        b.appendChild(h('b', null, String(x[1])));
        b.appendChild(h('span', null, x[0]));
        b.title = x[2] ? 'Show ' + x[0].toLowerCase() + ' clips' : 'Show all clips';
        b.addEventListener('click', function () { state.vf.status = state.vf.status === x[2] ? '' : x[2]; renderVault(); });
        box.appendChild(b);
      });
    var go = h('button', 'btn primary', vs.due ? 'Start revision · ' + vs.due : 'Nothing due');
    go.type = 'button';
    go.id = 'startReview';
    go.disabled = !vs.due;
    go.addEventListener('click', function () { startReview(); });
    box.appendChild(go);

    // difficult concepts to revisit
    var rv = $('vRevisit'); rv.textContent = '';
    if (vs.difficultConcepts.length || vs.byStatus.difficult) {
      rv.appendChild(h('span', 'lead', 'Revisit difficult:'));
      vs.difficultConcepts.slice(0, 8).forEach(function (d) {
        var b = h('button', 'weakchip', conceptName(d.language, d.concept) + ' · ' + LANG[d.language].name + ' (' + d.count + ')');
        b.type = 'button';
        b.addEventListener('click', function () { state.vf.concept = d.concept; state.vf.status = 'difficult'; renderVault(); });
        rv.appendChild(b);
      });
      var all2 = h('button', 'btn small', 'Revise all difficult (' + vs.byStatus.difficult + ')');
      all2.type = 'button';
      all2.addEventListener('click', function () { startReview({ difficult: true }); });
      rv.appendChild(all2);
    }

    if (state.review) renderReview();
    $('vReview').classList.toggle('hidden', !state.review);

    var out = $('clipList'); out.textContent = '';
    out.classList.toggle('hidden', !!state.review);
    if (!clips.length) { out.appendChild(vaultEmpty()); return; }
    var f = Object.assign({}, state.vf, { due: state.vf.status === 'due', status: state.vf.status === 'due' ? '' : state.vf.status,
      conceptNames: function (c) { return (c.concepts || []).map(function (id) { return conceptName(c.language, id); }); } });
    var shown = V.filterClips(list, f);
    if (!shown.length) { out.appendChild(h('div', 'empty', 'No clips match. Clear the search or filters.')); return; }
    shown.forEach(function (c) { out.appendChild(clipCard(c)); });
    if (state.focusClip) {
      var el = out.querySelector('[data-id="' + CSS.escape(state.focusClip) + '"]');
      state.focusClip = null;
      if (el) { el.classList.add('flash'); setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 30); }
    }
  }

  function vaultEmpty() {
    var e = h('div', 'card vempty');
    e.appendChild(h('h2', null, 'Your Revision Vault is empty'));
    var ol = h('ol');
    ['Select code or text on GeeksforGeeks, W3Schools or any supported site.',
     'Right-click it → “Save to My Revision Vault”. (Or click the Codextent icon → Clip selection, or press Alt+Shift+S, or the bookmark in the < ⚡ > bar.)',
     'Come back here: add notes, mark it Difficult, and press Start revision later.'].forEach(function (t) { ol.appendChild(h('li', null, t)); });
    e.appendChild(ol);
    return e;
  }

  function statusSeg(c, onDone) {
    var seg = h('div', 'stseg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Revision status');
    V.STATUSES.forEach(function (k) {
      var b = h('button', 'st-' + k);
      b.type = 'button';
      b.appendChild(h('i', null, STATUS_SYM[k]));
      b.appendChild(document.createTextNode(V.STATUS_LABEL[k]));
      b.setAttribute('aria-pressed', String(c.status === k));
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        V.editClip(c.id, { status: k }).then(onDone || function () {});
      });
      seg.appendChild(b);
    });
    return seg;
  }

  function notesBox(c) {
    var wrap = h('div', 'clipnotes');
    var lb = h('label', 'lbl', 'My notes');
    var saved = h('span', 'saved', '');
    lb.appendChild(saved);
    wrap.appendChild(lb);
    var t = h('textarea', 'notearea');
    t.rows = 2;
    t.placeholder = 'Why is it tricky? What should you remember next time?';
    t.value = c.notes || '';
    t.setAttribute('aria-label', 'My notes');
    var timer = null;
    t.addEventListener('input', function () {
      autoGrow(t);
      saved.textContent = 'Saving…';
      clearTimeout(timer);
      timer = setTimeout(function () { V.editClip(c.id, { notes: t.value }).then(function () { saved.textContent = 'Saved ✓'; }); }, 450);
    });
    t.addEventListener('blur', function () {
      if (timer) { clearTimeout(timer); timer = null; V.editClip(c.id, { notes: t.value }).then(function () { saved.textContent = 'Saved ✓'; }); }
    });
    wrap.appendChild(t);
    setTimeout(function () { autoGrow(t); }, 0);
    return wrap;
  }

  function clipCard(c) {
    var lang = c.language;
    var card = h('article', 'clip st-' + c.status);
    card.setAttribute('data-id', c.id);

    var head = h('div', 'clip-head');
    head.appendChild(emblem(lang));
    var mid = h('div');
    var title = h('div', 'att-topic', clipTitle(c));
    title.title = clipTitle(c);
    mid.appendChild(title);
    var sub = h('div', 'att-sub');
    if (c.topic && c.topic !== clipTitle(c)) { var tp = h('span', 'tp', c.topic); tp.title = c.topic; sub.appendChild(tp); sub.appendChild(h('span', 'dot', '•')); }
    sub.appendChild(h('span', 'sname', (SITE[c.site] && SITE[c.site].name) || c.site || 'Website'));
    sub.appendChild(h('span', 'dot', '•'));
    sub.appendChild(h('span', 'lname', LANG[lang].name));
    sub.appendChild(h('span', 'dot', '•'));
    sub.appendChild(h('span', null, OQ.ui.timeAgo(c.createdAt)));
    if (c.reviewCount) { sub.appendChild(h('span', 'dot', '•')); sub.appendChild(h('span', null, 'revised ' + c.reviewCount + '×')); }
    mid.appendChild(sub);
    head.appendChild(mid);
    head.appendChild(h('span', 'stbadge st-' + c.status, STATUS_SYM[c.status] + ' ' + V.STATUS_LABEL[c.status]));
    card.appendChild(head);

    var code = h('pre', 'clipcode' + (c.kind === 'text' ? ' prose' : ''), c.text);
    var long = c.text.split('\n').length > 10 || c.text.length > 700;
    if (long && !state.clipOpen[c.id]) code.classList.add('folded');
    card.appendChild(code);
    if (long) {
      var more = h('button', 'link fold', state.clipOpen[c.id] ? 'Show less' : 'Show all ' + c.text.split('\n').length + ' lines');
      more.type = 'button';
      more.addEventListener('click', function () {
        state.clipOpen[c.id] = !state.clipOpen[c.id];
        code.classList.toggle('folded', !state.clipOpen[c.id]);
        more.textContent = state.clipOpen[c.id] ? 'Show less' : 'Show all ' + c.text.split('\n').length + ' lines';
      });
      card.appendChild(more);
    }

    // concept + language (editable) and auto-detected tags
    var meta = h('div', 'clipmeta');
    var ls = h('select', 'mini');
    ls.setAttribute('aria-label', 'Language');
    LANGS.concat([LANG.text]).forEach(function (l) { option(ls, l.id, l.name, lang); });
    ls.addEventListener('change', function () { V.editClip(c.id, { language: ls.value, concept: '' }); });
    meta.appendChild(ls);
    if (C.has(lang)) {
      var cs = h('select', 'mini');
      cs.setAttribute('aria-label', 'Concept');
      option(cs, '', 'Pick a concept…', c.concept);
      C.list(lang).forEach(function (k) { option(cs, k.id, k.name, c.concept); });
      cs.addEventListener('change', function () { V.editClip(c.id, { concept: cs.value }); });
      meta.appendChild(cs);
    }
    (c.concepts || []).filter(function (id) { return id !== c.concept && conceptName(lang, id); }).slice(0, 5).forEach(function (id) {
      var chip = h('button', 'chip', conceptName(lang, id));
      chip.type = 'button';
      chip.title = 'Also in this clip — click to filter by it';
      chip.addEventListener('click', function () { state.vf.concept = id; renderVault(); });
      meta.appendChild(chip);
    });
    card.appendChild(meta);
    var cc = c.concept && C.has(lang) && C.get(lang, c.concept);
    if (cc) {
      var trap = h('p', 'cliptrap');
      trap.appendChild(h('b', null, 'Trap: '));
      trap.appendChild(document.createTextNode(cc.trap));
      card.appendChild(trap);
    }

    card.appendChild(notesBox(c));

    var foot = h('div', 'clipfoot');
    foot.appendChild(statusSeg(c));
    var acts = h('div', 'clipacts');
    var run = runnable(c);
    if (run) {
      var pr = h('button', 'btn small primary', 'Predict & run');
      pr.type = 'button';
      pr.title = 'Guess the output, then run it';
      pr.addEventListener('click', function () {
        pr.disabled = true;
        openRetry(card, { code: run.code, language: lang, stdin: '', url: c.url, pageTitle: c.pageTitle, site: c.site, wrapped: run.wrapped });
      });
      acts.appendChild(pr);
    }
    var cp = h('button', 'btn small', 'Copy');
    cp.type = 'button';
    cp.addEventListener('click', function () {
      navigator.clipboard.writeText(c.text).then(function () { cp.textContent = 'Copied ✓'; setTimeout(function () { cp.textContent = 'Copy'; }, 1500); },
        function () { cp.textContent = 'Copy failed'; });
    });
    acts.appendChild(cp);
    var url = OQ.ui.safeUrl(c.url);
    if (url) {
      var link = h('a', 'btn small', 'Open page ↗');
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      acts.appendChild(link);
    }
    var del = h('button', 'btn small ghostdanger', 'Delete');
    del.type = 'button';
    del.addEventListener('click', function () {
      if (del.dataset.armed) { V.deleteClip(c.id); return; }
      del.dataset.armed = '1'; del.textContent = 'Sure? Delete';
      setTimeout(function () { delete del.dataset.armed; del.textContent = 'Delete'; }, 3000);
    });
    acts.appendChild(del);
    foot.appendChild(acts);
    card.appendChild(foot);
    return card;
  }

  /** Runnable code for "Predict & run" (W3Schools-style snippets are wrapped in main()). */
  function runnable(c) {
    if (!OQ.detector || c.kind === 'text' || V.LANGS.indexOf(c.language) === -1 || c.language === 'text') return null;
    var info = OQ.detector.classifyCode(c.text, c.language, { allowWrap: true });
    if (!info.isCode || !info.runnable || info.language !== c.language) return null;
    return { code: info.needsWrap ? OQ.detector.wrapSnippet(c.text, c.language) : c.text, wrapped: info.needsWrap };
  }

  // ---- revise mode: one clip at a time, the learner says how it went ----
  function startReview(opts) {
    opts = opts || {};
    var list = vaultList();
    var q = opts.difficult
      ? list.filter(function (c) { return c.status === 'difficult'; }).sort(function (a, b) { return (a.reviewedAt || 0) - (b.reviewedAt || 0); })
      : V.reviewQueue(list);
    if (!q.length) return;
    state.review = { ids: q.map(function (c) { return c.id; }), i: 0, counts: { difficult: 0, learning: 0, mastered: 0, skipped: 0 } };
    renderVault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function endReview() { state.review = null; renderVault(); }

  function renderReview() {
    var r = state.review, box = $('vReview');
    box.textContent = '';
    var top = h('div', 'rv-top');
    top.appendChild(h('b', null, 'Revision'));
    var prog = h('div', 'rv-prog');
    var fill = h('i');
    fill.style.width = Math.round(Math.min(r.i, r.ids.length) / r.ids.length * 100) + '%';
    prog.appendChild(fill);
    top.appendChild(prog);
    top.appendChild(h('span', 'muted', Math.min(r.i + 1, r.ids.length) + ' / ' + r.ids.length));
    var end = h('button', 'btn small', r.i >= r.ids.length ? 'Close' : 'End');
    end.type = 'button';
    end.addEventListener('click', endReview);
    top.appendChild(end);
    box.appendChild(top);

    if (r.i >= r.ids.length) {
      var done = h('div', 'rv-done');
      done.appendChild(h('h2', null, 'Revision done'));
      done.appendChild(h('p', null, r.counts.mastered + ' mastered · ' + r.counts.learning + ' still learning · ' + r.counts.difficult + ' still difficult' + (r.counts.skipped ? ' · ' + r.counts.skipped + ' skipped' : '') +
        '. Difficult clips come back tomorrow, learning ones in 3 days.'));
      box.appendChild(done);
      return;
    }
    var c = clips.filter(function (x) { return x.id === r.ids[r.i]; })[0];
    if (!c) { r.i++; renderReview(); return; }
    var lang = c.language;
    var card = h('div', 'rv-card');
    var head = h('div', 'clip-head');
    head.appendChild(emblem(lang, 'md'));
    var mid = h('div');
    mid.appendChild(h('div', 'rv-title', clipTitle(c)));
    mid.appendChild(h('div', 'att-sub', [c.topic, (SITE[c.site] && SITE[c.site].name) || c.site, LANG[lang].name].filter(Boolean).join(' • ')));
    head.appendChild(mid);
    head.appendChild(h('span', 'stbadge st-' + c.status, STATUS_SYM[c.status] + ' ' + V.STATUS_LABEL[c.status]));
    card.appendChild(head);
    card.appendChild(h('pre', 'clipcode' + (c.kind === 'text' ? ' prose' : ''), c.text));
    var cc = c.concept && C.has(lang) && C.get(lang, c.concept);
    if (cc) {
      var ex = h('details', 'rv-concept');
      ex.appendChild(h('summary', null, 'Recall “' + cc.name + '” — then open to check'));
      ex.appendChild(h('p', null, cc.what));
      var tp = h('p', 'cliptrap'); tp.appendChild(h('b', null, 'Trap: ')); tp.appendChild(document.createTextNode(cc.trap)); ex.appendChild(tp);
      card.appendChild(ex);
    }
    card.appendChild(notesBox(c));
    var acts = h('div', 'rv-acts');
    [['difficult', 'Still difficult', 'btn'], ['learning', 'Getting there', 'btn'], ['mastered', 'Got it ✓', 'btn primary']].forEach(function (x) {
      var b = h('button', x[2], x[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        r.counts[x[0]]++;
        V.reviewClip(c.id, x[0]).then(function () { r.i++; renderVault(); });
      });
      acts.appendChild(b);
    });
    var skip = h('button', 'link', 'Skip');
    skip.type = 'button';
    skip.addEventListener('click', function () { r.counts.skipped++; r.i++; renderVault(); });
    acts.appendChild(skip);
    card.appendChild(acts);
    box.appendChild(card);
  }

  // filters
  var qTimer = null;
  $('vQ').addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(function () { state.vf.q = $('vQ').value; renderVault(); }, 150); });
  $('vStatus').addEventListener('change', function () { state.vf.status = this.value; renderVault(); });
  $('vSite').addEventListener('change', function () { state.vf.site = this.value; renderVault(); });
  $('vConcept').addEventListener('change', function () { state.vf.concept = this.value; renderVault(); });
  $('vSort').addEventListener('change', function () { state.vf.sort = this.value; renderVault(); });

  // ---------------------------------------------------------------- render
  function renderNav() {
    var list = bySite(byLang(all));
    var s = OQ.stats.computeStats(list);
    $('navRecent').textContent = s.total ? String(s.total) : '';
    $('navRevision').textContent = s.needsRevision.length ? String(s.needsRevision.length) : '';
    var vs = V.vaultStats(clips);
    $('navVault').textContent = vs.due ? String(vs.due) : '';
    $('navVault').title = vs.due ? vs.due + ' clips due for revision' : '';
  }

  function render() {
    renderLangTabs();
    renderNav();
    if (state.view === 'home') renderHome();
    else if (state.view === 'recent') renderRecent();
    else if (state.view === 'revision') renderRevision();
    else if (state.view === 'concepts') renderConcepts();
    else if (state.view === 'vault') renderVault();
  }

  async function refresh() {
    var data = await chrome.storage.local.get(['attempts', 'vault']);
    all = data.attempts || [];
    clips = data.vault || [];
    // don't redraw the vault under the learner's cursor while they type notes
    var ae = document.activeElement;
    if (state.view === 'vault' && ae && ae.tagName === 'TEXTAREA' && ae.closest('#view-vault')) { renderNav(); return; }
    // keep an open retry box alive: only re-render when nothing is being typed in it
    if (document.querySelector('.retry')) { renderNav(); return; }
    render();
  }

  $('more').addEventListener('click', function () { state.recentLimit += 20; renderRecent(); });
  $('clear').addEventListener('click', async function () {
    if (!confirm('Delete all saved attempts? This cannot be undone.')) return;
    await chrome.storage.local.set({ attempts: [] });
    refresh();
  });
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && (changes.attempts || changes.vault)) refresh();
  });
  window.addEventListener('hashchange', route);

  load();
  chrome.storage.local.get(['attempts', 'vault']).then(function (data) {
    all = data.attempts || [];
    clips = data.vault || [];
    route();
  });
})();

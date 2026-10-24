/*
 * Codextent — Competitive programming template library (C++ first; CodeChef + LeetCode).
 *
 * A template has two forms:
 *   snippet  helper code you drop in at the cursor (works inside LeetCode's class Solution too)
 *   full     a whole contest program: header + snippet + main() with fast I/O and while (t--) { body }
 * Built-ins are verified by compiling and running them (tests/templates.test.js).
 * Your own templates, favorites and edits live in chrome.storage.local "templates".
 *   { custom: Template[], fav: [id], hidden: [id] }   Template = {id, name, lang, topics[], snippet, body, full?, desc, custom:true, ua}
 */
(function (root) {
  'use strict';

  var KEY = 'templates';
  var HEAD = '#include <bits/stdc++.h>\nusing namespace std;\n\nusing ll = long long;\n';
  var PLATFORMS = { codechef: 'CodeChef', leetcode: 'LeetCode' };

  function T(id, name, topics, desc, snippet, body, sample) {
    return { id: id, name: name, lang: 'cpp', topics: topics, desc: desc, snippet: snippet, body: body, sample: sample || null, builtin: true };
  }

  var BUILTIN = [
    T('cpp-contest-base', 'Contest base (fast I/O + test cases)', ['boilerplate', 'io'],
      'Fast input/output and a loop over T test cases. The starting point for CodeChef.',
      '',
      '    ll n;\n    cin >> n;\n    cout << n << "\\n";',
      { input: '2\n5\n7\n', output: '5\n7\n' }),
    T('cpp-read-array', 'Read an array', ['io', 'arrays'],
      'Read n numbers into a vector and print them back.',
      'vector<ll> readVec(int n) {\n    vector<ll> a(n);\n    for (auto &x : a) cin >> x;\n    return a;\n}',
      '    int n;\n    cin >> n;\n    vector<ll> a = readVec(n);\n    for (int i = 0; i < n; i++) cout << a[i] << " \\n"[i == n - 1];',
      { input: '1\n3\n4 5 6\n', output: '4 5 6\n' }),
    T('cpp-hashmap-count', 'Hash map: count frequencies', ['hash map', 'counting'],
      'unordered_map frequency count, then find the most frequent value.',
      'll mostFrequent(const vector<ll> &a) {\n    unordered_map<ll, int> freq;\n    ll best = a[0];\n    for (ll x : a) {\n        if (++freq[x] > freq[best] || (freq[x] == freq[best] && x < best)) best = x;\n    }\n    return best;\n}',
      '    int n;\n    cin >> n;\n    vector<ll> a(n);\n    for (auto &x : a) cin >> x;\n    cout << mostFrequent(a) << "\\n";',
      { input: '1\n6\n3 1 3 2 1 3\n', output: '3\n' }),
    T('cpp-sort-custom', 'Sorting with a custom order', ['sorting'],
      'Sort pairs by second value, then by first. Change the lambda to change the order.',
      'void sortBySecond(vector<pair<ll, ll>> &v) {\n    sort(v.begin(), v.end(), [](const pair<ll, ll> &a, const pair<ll, ll> &b) {\n        if (a.second != b.second) return a.second < b.second;\n        return a.first < b.first;\n    });\n}',
      '    int n;\n    cin >> n;\n    vector<pair<ll, ll>> v(n);\n    for (auto &p : v) cin >> p.first >> p.second;\n    sortBySecond(v);\n    for (auto &p : v) cout << p.first << " " << p.second << "\\n";',
      { input: '1\n3\n1 9\n2 3\n3 3\n', output: '2 3\n3 3\n1 9\n' }),
    T('cpp-binary-search', 'Binary search (first index >= x)', ['binary search', 'searching'],
      'Classic lower bound on a sorted array: the first index whose value is >= x (n if none).',
      'int lowerBound(const vector<ll> &a, ll x) {\n    int lo = 0, hi = (int)a.size();\n    while (lo < hi) {\n        int mid = lo + (hi - lo) / 2;\n        if (a[mid] >= x) hi = mid;\n        else lo = mid + 1;\n    }\n    return lo;\n}',
      '    int n; ll x;\n    cin >> n >> x;\n    vector<ll> a(n);\n    for (auto &v : a) cin >> v;\n    cout << lowerBound(a, x) << "\\n";',
      { input: '2\n5 4\n1 3 4 4 9\n3 10\n1 2 3\n', output: '2\n3\n' }),
    T('cpp-binary-search-answer', 'Binary search on the answer', ['binary search'],
      'Smallest value v in [lo, hi] where ok(v) is true. Write ok() for your problem (here: v * v >= n).',
      'bool ok(ll v, ll n) { return v * v >= n; }\n\nll firstTrue(ll lo, ll hi, ll n) {\n    while (lo < hi) {\n        ll mid = lo + (hi - lo) / 2;\n        if (ok(mid, n)) hi = mid;\n        else lo = mid + 1;\n    }\n    return lo;\n}',
      '    ll n;\n    cin >> n;\n    cout << firstTrue(0, 2000000000LL, n) << "\\n";',
      { input: '2\n16\n17\n', output: '4\n5\n' }),
    T('cpp-two-pointers', 'Two pointers: pair with sum in a sorted array', ['two pointers'],
      'Move left/right pointers inward until the pair adds up to the target.',
      'bool hasPairSum(const vector<ll> &a, ll target) {\n    int l = 0, r = (int)a.size() - 1;\n    while (l < r) {\n        ll s = a[l] + a[r];\n        if (s == target) return true;\n        if (s < target) l++;\n        else r--;\n    }\n    return false;\n}',
      '    int n; ll target;\n    cin >> n >> target;\n    vector<ll> a(n);\n    for (auto &x : a) cin >> x;\n    sort(a.begin(), a.end());\n    cout << (hasPairSum(a, target) ? "YES" : "NO") << "\\n";',
      { input: '2\n4 9\n2 7 11 15\n3 100\n1 2 3\n', output: 'YES\nNO\n' }),
    T('cpp-sliding-window', 'Sliding window: best sum of k in a row', ['sliding window'],
      'Keep a running window sum: add the new element, drop the one that left.',
      'll maxWindowSum(const vector<ll> &a, int k) {\n    ll cur = 0, best = LLONG_MIN;\n    for (int i = 0; i < (int)a.size(); i++) {\n        cur += a[i];\n        if (i >= k) cur -= a[i - k];\n        if (i >= k - 1) best = max(best, cur);\n    }\n    return best;\n}',
      '    int n, k;\n    cin >> n >> k;\n    vector<ll> a(n);\n    for (auto &x : a) cin >> x;\n    cout << maxWindowSum(a, k) << "\\n";',
      { input: '1\n6 3\n1 -2 3 4 -1 2\n', output: '6\n' }),
    T('cpp-prefix-sum', 'Prefix sums: range sum queries', ['prefix sum', 'arrays'],
      'pre[i] = sum of the first i numbers, so sum(l..r) = pre[r+1] - pre[l].',
      'vector<ll> prefixSums(const vector<ll> &a) {\n    vector<ll> pre(a.size() + 1, 0);\n    for (size_t i = 0; i < a.size(); i++) pre[i + 1] = pre[i] + a[i];\n    return pre;\n}',
      '    int n, q;\n    cin >> n >> q;\n    vector<ll> a(n);\n    for (auto &x : a) cin >> x;\n    vector<ll> pre = prefixSums(a);\n    while (q--) {\n        int l, r;\n        cin >> l >> r;\n        cout << pre[r + 1] - pre[l] << "\\n";\n    }',
      { input: '1\n5 2\n1 2 3 4 5\n0 2\n1 4\n', output: '6\n14\n' }),
    T('cpp-bfs', 'BFS: shortest path in an unweighted graph', ['bfs', 'graphs'],
      'Distances from a source in an adjacency list (-1 = unreachable).',
      'vector<int> bfs(int src, const vector<vector<int>> &adj) {\n    vector<int> dist(adj.size(), -1);\n    queue<int> q;\n    dist[src] = 0;\n    q.push(src);\n    while (!q.empty()) {\n        int u = q.front(); q.pop();\n        for (int v : adj[u]) {\n            if (dist[v] == -1) { dist[v] = dist[u] + 1; q.push(v); }\n        }\n    }\n    return dist;\n}',
      '    int n, m;\n    cin >> n >> m;\n    vector<vector<int>> adj(n);\n    for (int i = 0; i < m; i++) {\n        int u, v;\n        cin >> u >> v;\n        adj[u].push_back(v);\n        adj[v].push_back(u);\n    }\n    vector<int> d = bfs(0, adj);\n    for (int i = 0; i < n; i++) cout << d[i] << " \\n"[i == n - 1];',
      { input: '1\n5 4\n0 1\n1 2\n0 3\n3 2\n', output: '0 1 2 1 -1\n' }),
    T('cpp-dfs', 'DFS: count connected components', ['dfs', 'graphs'],
      'Recursive DFS marking visited nodes; each new start is a new component.',
      'void dfs(int u, const vector<vector<int>> &adj, vector<bool> &seen) {\n    seen[u] = true;\n    for (int v : adj[u]) if (!seen[v]) dfs(v, adj, seen);\n}\n\nint countComponents(const vector<vector<int>> &adj) {\n    vector<bool> seen(adj.size(), false);\n    int comps = 0;\n    for (int u = 0; u < (int)adj.size(); u++) if (!seen[u]) { comps++; dfs(u, adj, seen); }\n    return comps;\n}',
      '    int n, m;\n    cin >> n >> m;\n    vector<vector<int>> adj(n);\n    for (int i = 0; i < m; i++) {\n        int u, v;\n        cin >> u >> v;\n        adj[u].push_back(v);\n        adj[v].push_back(u);\n    }\n    cout << countComponents(adj) << "\\n";',
      { input: '1\n5 2\n0 1\n3 4\n', output: '3\n' }),
    T('cpp-dsu', 'DSU (union-find)', ['dsu', 'graphs'],
      'Union by size + path compression. unite() returns false when already joined.',
      'struct DSU {\n    vector<int> p, sz;\n    DSU(int n) : p(n), sz(n, 1) { iota(p.begin(), p.end(), 0); }\n    int find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }\n    bool unite(int a, int b) {\n        a = find(a); b = find(b);\n        if (a == b) return false;\n        if (sz[a] < sz[b]) swap(a, b);\n        p[b] = a; sz[a] += sz[b];\n        return true;\n    }\n};',
      '    int n, m;\n    cin >> n >> m;\n    DSU d(n);\n    int comps = n;\n    for (int i = 0; i < m; i++) {\n        int u, v;\n        cin >> u >> v;\n        if (d.unite(u, v)) comps--;\n    }\n    cout << comps << "\\n";',
      { input: '1\n4 3\n0 1\n1 2\n0 2\n', output: '2\n' }),
    T('cpp-dijkstra', 'Dijkstra: shortest paths with weights', ['graphs', 'shortest path'],
      'Min-heap Dijkstra on an adjacency list of {to, weight}. INF = unreachable.',
      'static constexpr ll INF = (ll)4e18;\n\nvector<ll> dijkstra(int src, const vector<vector<pair<int, ll>>> &adj) {\n    vector<ll> dist(adj.size(), INF);\n    priority_queue<pair<ll, int>, vector<pair<ll, int>>, greater<pair<ll, int>>> pq;\n    dist[src] = 0;\n    pq.push({0, src});\n    while (!pq.empty()) {\n        auto [d, u] = pq.top(); pq.pop();\n        if (d != dist[u]) continue;\n        for (auto [v, w] : adj[u]) {\n            if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; pq.push({dist[v], v}); }\n        }\n    }\n    return dist;\n}',
      '    int n, m;\n    cin >> n >> m;\n    vector<vector<pair<int, ll>>> adj(n);\n    for (int i = 0; i < m; i++) {\n        int u, v; ll w;\n        cin >> u >> v >> w;\n        adj[u].push_back({v, w});\n        adj[v].push_back({u, w});\n    }\n    vector<ll> d = dijkstra(0, adj);\n    cout << d[n - 1] << "\\n";',
      { input: '1\n4 4\n0 1 5\n1 3 1\n0 2 1\n2 3 10\n', output: '6\n' }),
    T('cpp-gcd-modpow', 'GCD, LCM and fast power (mod)', ['math', 'number theory'],
      'gcd/lcm with std::gcd, and binary exponentiation a^b mod m.',
      'static constexpr ll MOD = 1000000007LL;\n\nll lcmll(ll a, ll b) { return a / __gcd(a, b) * b; }\n\nll power(ll a, ll b, ll m = MOD) {\n    ll r = 1;\n    a %= m;\n    while (b > 0) {\n        if (b & 1) r = r * a % m;\n        a = a * a % m;\n        b >>= 1;\n    }\n    return r;\n}',
      '    ll a, b;\n    cin >> a >> b;\n    cout << __gcd(a, b) << " " << lcmll(a, b) << " " << power(a, b) << "\\n";',
      { input: '1\n4 6\n', output: '2 12 4096\n' }),
    T('cpp-sieve', 'Sieve of Eratosthenes', ['math', 'primes'],
      'All primes up to n in O(n log log n).',
      'vector<int> primesUpTo(int n) {\n    vector<bool> comp(n + 1, false);\n    vector<int> primes;\n    for (int i = 2; i <= n; i++) {\n        if (comp[i]) continue;\n        primes.push_back(i);\n        for (ll j = 1LL * i * i; j <= n; j += i) comp[j] = true;\n    }\n    return primes;\n}',
      '    int n;\n    cin >> n;\n    vector<int> p = primesUpTo(n);\n    cout << p.size() << "\\n";',
      { input: '2\n10\n100\n', output: '4\n25\n' })
  ];

  /** Whole contest program: header + snippet + main with fast I/O and while (t--). */
  function fullProgram(t) {
    if (t.full && t.full.trim()) return t.full;
    var body = t.body && t.body.trim() ? t.body : '    // solve one test case';
    return HEAD + (t.snippet && t.snippet.trim() ? '\n' + t.snippet.replace(/\s+$/, '') + '\n' : '') +
      '\nvoid solve() {\n' + body.replace(/\s+$/, '') + '\n}\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    int t = 1;\n    cin >> t;\n    while (t--) solve();\n    return 0;\n}\n';
  }

  /**
   * What to insert for this platform and editor.
   * CodeChef: empty editor (or its "//write code here..." placeholder) -> full program, else snippet at the cursor.
   * LeetCode: snippet only (helpers go inside class Solution; no main()).
   * @returns {{mode:'full'|'snippet', code:string}}
   */
  function forPlatform(t, platform, editorText, prefer) {
    var empty = !String(editorText || '').replace(/\/\/\s*write (your )?code here\.*/i, '').trim();
    var snippet = t.snippet && t.snippet.trim() ? t.snippet.replace(/\s+$/, '') + '\n' : '';
    if (platform === 'leetcode') {
      // LeetCode has no `ll`: add a class-level alias once (a second one in the same class would not compile)
      var hasLl = /using\s+ll\s*=|typedef\s+long\s+long\s+ll\b/.test(String(editorText || ''));
      if (snippet && /\bll\b/.test(snippet) && !hasLl) snippet = 'using ll = long long;\n\n' + snippet;
      return { mode: 'snippet', code: snippet || '' };
    }
    var mode = prefer === 'full' || prefer === 'snippet' ? prefer : (empty || !snippet ? 'full' : 'snippet');
    return { mode: mode, code: mode === 'full' ? fullProgram(t) : snippet };
  }
  function usableOn(t, platform) { return platform !== 'leetcode' || !!(t.snippet && t.snippet.trim()); }

  // ---------- library = built-ins + yours ----------
  function library(saved) {
    saved = saved || {};
    var hidden = saved.hidden || [], fav = saved.fav || [];
    return BUILTIN.filter(function (t) { return hidden.indexOf(t.id) === -1; }).concat(saved.custom || []).map(function (t) {
      return Object.assign({}, t, { fav: fav.indexOf(t.id) !== -1 });
    });
  }
  function topicsOf(list) {
    var seen = {};
    (list || []).forEach(function (t) { (t.topics || []).forEach(function (x) { seen[x] = (seen[x] || 0) + 1; }); });
    return Object.keys(seen).sort();
  }
  /** Search by words in the name, topics, description and code; favorites first. */
  function search(list, f) {
    f = f || {};
    var words = String(f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return (list || []).filter(function (t) {
      if (f.lang && t.lang !== f.lang) return false;
      if (f.topic && (t.topics || []).indexOf(f.topic) === -1) return false;
      if (f.fav && !t.fav) return false;
      if (f.platform && !usableOn(t, f.platform)) return false;
      if (!words.length) return true;
      var hay = [t.name, (t.topics || []).join(' '), t.desc, t.snippet, t.body].join('\n').toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    }).sort(function (a, b) {
      return (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (a.builtin ? 1 : 0) - (b.builtin ? 1 : 0) || a.name.localeCompare(b.name);
    });
  }
  function cleanTemplate(input, now) {
    var topics = (Array.isArray(input.topics) ? input.topics : String(input.topics || '').split(','))
      .map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean).slice(0, 8);
    return {
      id: input.id && /^my-/.test(input.id) ? input.id : 'my-' + (now || Date.now()).toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(input.name || 'Untitled template').trim().slice(0, 80),
      lang: 'cpp', topics: topics, desc: String(input.desc || '').slice(0, 300),
      snippet: String(input.snippet || '').slice(0, 20000), body: String(input.body || '').slice(0, 20000), full: String(input.full || '').slice(0, 40000),
      custom: true, ua: now || Date.now()
    };
  }

  // ---------- chrome.storage ----------
  async function load() { var d = await chrome.storage.local.get(KEY); return d[KEY] || { custom: [], fav: [], hidden: [] }; }
  async function store(s) { var o = {}; o[KEY] = s; await chrome.storage.local.set(o); }
  async function all() { return library(await load()); }
  async function saveTemplate(input) {
    var s = await load(), t = cleanTemplate(input);
    s.custom = (s.custom || []).filter(function (x) { return x.id !== t.id; }).concat([t]);
    await store(s);
    return t;
  }
  async function deleteTemplate(id) {
    var s = await load();
    if (/^my-/.test(id)) s.custom = (s.custom || []).filter(function (x) { return x.id !== id; });
    else s.hidden = (s.hidden || []).concat([id]).filter(function (x, i, a) { return a.indexOf(x) === i; });
    s.fav = (s.fav || []).filter(function (x) { return x !== id; });
    await store(s);
  }
  async function restoreBuiltins() { var s = await load(); s.hidden = []; await store(s); }
  async function toggleFav(id) {
    var s = await load(), fav = s.fav || [], on = fav.indexOf(id) === -1;
    s.fav = on ? fav.concat([id]) : fav.filter(function (x) { return x !== id; });
    await store(s);
    return on;
  }

  var api = {
    KEY: KEY, HEAD: HEAD, PLATFORMS: PLATFORMS, BUILTIN: BUILTIN,
    fullProgram: fullProgram, forPlatform: forPlatform, usableOn: usableOn, library: library, topicsOf: topicsOf, search: search, cleanTemplate: cleanTemplate,
    load: load, all: all, saveTemplate: saveTemplate, deleteTemplate: deleteTemplate, restoreBuiltins: restoreBuiltins, toggleFav: toggleFav
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.templates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

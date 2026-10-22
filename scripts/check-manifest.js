#!/usr/bin/env node
/* Verifies every file referenced by manifest.json (and by the HTML pages) exists. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const refs = new Set();
Object.values(m.icons).forEach((p) => refs.add(p));
Object.values(m.action.default_icon).forEach((p) => refs.add(p));
refs.add(m.action.default_popup);
refs.add(m.background.service_worker);
refs.add(m.options_page);
m.content_scripts.forEach((cs) => (cs.js || []).concat(cs.css || []).forEach((p) => refs.add(p)));

// importScripts in the service worker are relative to its folder
const swDir = path.dirname(m.background.service_worker);
const sw = fs.readFileSync(path.join(root, m.background.service_worker), 'utf8');
(sw.match(/importScripts\(([^)]*)\)/) || ['', ''])[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
  .forEach((p) => refs.add(path.join(swDir, p)));

// src/href in extension HTML pages
['src/popup/popup.html', 'src/dashboard/dashboard.html', 'src/options/options.html'].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    if (/^https?:/.test(ref)) { console.error('External reference not allowed in ' + page + ': ' + ref); process.exitCode = 1; continue; }
    refs.add(path.join(path.dirname(page), ref));
  }
});

let missing = 0;
for (const r of refs) {
  if (!fs.existsSync(path.join(root, r))) { console.error('MISSING: ' + r); missing++; }
}
if (m.manifest_version !== 3) { console.error('manifest_version must be 3'); missing++; }
console.log(missing ? `${missing} problem(s)` : `manifest OK — ${refs.size} referenced files exist`);
process.exit(missing || process.exitCode ? 1 : 0);

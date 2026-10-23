/* OutputIQ — styles for the compact Shadow-DOM bar (isolated from the host page). */
(function (root) {
  'use strict';
  root.OutputIQ = root.OutputIQ || {};
  root.OutputIQ.panelCss = `
:host {
  all: initial; display: block; margin: 6px 0 14px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", Inter, Roboto, sans-serif; font-size: 13.5px; line-height: 1.4;
  /* Dark (default): black & white */
  --ink: #f5f5f7; --muted: #8e8e93; --line: rgba(255,255,255,.12); --bg: #0d0d0f; --field: #050506; --code: #050506;
  --bg-grad: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.015));
  --shadow: inset 0 1px 0 rgba(255,255,255,.07), 0 10px 30px -12px rgba(0,0,0,.6);
  --glow: 0 0 0 1px rgba(255,255,255,.25), 0 0 22px rgba(255,255,255,.12);
  --brand: #ffffff; --brand-ink: #000000;
  --ok: #ffffff; --ok-ink: #000000; --bad: #f5f5f7; --warn: #8e8e93; --mark-bg: #ffffff; --mark-ink: #000000; --soft: rgba(255,255,255,.06);
  /* small accents (kept rare): green = correct, red = wrong, amber = error / timeout */
  --green: #34d399; --green-ink: #04140d; --green-soft: rgba(52,211,153,.14);
  --red: #f87171; --red-soft: rgba(248,113,113,.13); --amber: #fbbf24; --amber-soft: rgba(251,191,36,.12);
  --lc: #9ca3af; --field-line: rgba(255,255,255,.07);
  color: var(--ink);
}
:host([data-outputiq-lang="cpp"]) { --lc: #60a5fa; }
:host([data-outputiq-lang="c"]) { --lc: #a5b4c8; }
:host([data-outputiq-lang="java"]) { --lc: #f59e0b; }
:host([data-outputiq-lang="python"]) { --lc: #facc15; }
:host([data-outputiq-lang="sql"]) { --lc: #2dd4bf; }
:host([data-theme="light"]) {
  --ink: #1d1d1f; --muted: #6e6e73; --line: rgba(0,0,0,.12); --bg: #ffffff; --field: #f5f5f7; --code: #f5f5f7;
  --bg-grad: none; --shadow: 0 1px 2px rgba(0,0,0,.05), 0 8px 24px -12px rgba(0,0,0,.18);
  --glow: 0 0 0 1px rgba(0,0,0,.18), 0 8px 22px rgba(0,0,0,.12);
  --brand: #111113; --brand-ink: #ffffff; --ok: #111113; --ok-ink: #ffffff; --bad: #1d1d1f; --warn: #6e6e73;
  --mark-bg: #111113; --mark-ink: #ffffff; --soft: rgba(0,0,0,.04);
  --green: #15803d; --green-ink: #ffffff; --green-soft: rgba(21,128,61,.10); --red: #dc2626; --red-soft: rgba(220,38,38,.08);
  --amber: #b45309; --amber-soft: rgba(180,83,9,.08); --field-line: rgba(0,0,0,.08);
}
:host([data-theme="night"]) {
  --ink: #eef0ff; --muted: #9aa0c8; --line: rgba(199,210,254,.18); --bg: #0d1230; --field: rgba(0,0,0,.35); --code: rgba(0,0,0,.35);
  --bg-grad: radial-gradient(260px 80px at 90% 0, rgba(99,102,241,.35), transparent), linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.01));
  --shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 10px 30px -12px rgba(0,0,0,.6);
  --glow: 0 0 0 1px rgba(199,210,254,.4), 0 0 24px rgba(129,140,248,.3);
  --brand: #e0e7ff; --brand-ink: #0b1026; --ok: #e0e7ff; --ok-ink: #0b1026; --bad: #eef0ff; --warn: #9aa0c8;
  --mark-bg: #e0e7ff; --mark-ink: #0b1026; --soft: rgba(255,255,255,.06);
}
* { box-sizing: border-box; }
button { font-family: inherit; }
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* logo-only trigger */
.logo { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 8px; cursor: pointer; display: inline-flex;
        align-items: center; justify-content: center; background: none; flex: none; }
.logo svg { width: 30px; height: 30px; display: block; border-radius: 8px; transition: box-shadow .2s; }
.logo:hover svg { box-shadow: var(--glow); }


/* the horizontal bar */
.bar { display: flex; align-items: flex-start; gap: 8px; max-width: 780px; }
.bar.open .panel { display: flex; }
.panel { display: none; flex: 1; align-items: center; gap: 6px; min-width: 0; padding: 5px 5px 5px 6px;
         background: var(--bg); background-image: var(--bg-grad); border: 1px solid var(--line); border-radius: 14px;
         box-shadow: var(--shadow); transition: box-shadow .25s, border-color .25s; }
.panel:hover, .panel:focus-within { box-shadow: var(--glow); }
.lang { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px 0 9px; border-radius: 999px;
        font-size: 11.5px; font-weight: 700; letter-spacing: .01em; color: var(--ink); background: var(--soft); border: 1px solid var(--field-line); }
.lang::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--lc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--lc) 22%, transparent); }
.field { flex: 1; min-width: 120px; height: 32px; min-height: 32px; max-height: 132px; resize: none; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin;
         border: 1px solid var(--field-line); border-radius: 10px; background: var(--field); color: var(--ink); padding: 6px 11px; white-space: pre; tab-size: 4;
         font: 13px/18px ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Consolas, monospace; transition: border-color .2s, box-shadow .2s; }
.field:focus { outline: none; border-color: color-mix(in srgb, var(--ink) 35%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ink) 8%, transparent); }
.field.stdin { flex: 0 1 28%; }
.field::placeholder { color: var(--muted); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.check { flex: none; height: 32px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--brand); color: var(--brand-ink);
         font-weight: 650; font-size: 13px; letter-spacing: -.005em; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
         box-shadow: inset 0 -1px 0 rgba(0,0,0,.12); transition: transform .12s, box-shadow .2s; }
.check:hover { box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent); }
.check:active { transform: translateY(1px); }
.check[disabled] { opacity: .65; cursor: progress; }
.sep { flex: none; width: 1px; height: 20px; background: var(--line); margin: 0 2px; }
.icon { flex: none; width: 30px; height: 30px; border: 0; border-radius: 9px; background: transparent; color: var(--muted);
        cursor: pointer; font-size: 15px; display: inline-flex; align-items: center; justify-content: center; transition: background .15s, color .15s; }
.icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.icon:hover { background: var(--soft); color: var(--ink); }
.icon[disabled] { opacity: .35; cursor: default; }
.icon.close:hover { color: var(--red); background: var(--red-soft); }
.icon.save.saved, .icon.note.saved { color: var(--green); }
.icon.note[aria-expanded="true"] { background: var(--field); color: var(--ink); }
/* note editor (bar + selection tools) */
.notebox { display: none; margin: 6px 0 0 38px; max-width: 722px; padding: 8px; background: var(--bg); background-image: var(--bg-grad);
           border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); }
.notebox.show { display: grid; gap: 6px; }
.notebox .notearea { min-height: 64px; max-height: 180px; white-space: pre-wrap; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: 100%; resize: vertical; }
.noterow { display: flex; gap: 10px; align-items: center; }
.savenote { flex: none; height: 30px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--brand); color: var(--brand-ink); font-weight: 600; font-size: 13px; cursor: pointer; }
.savenote[disabled] { opacity: .65; cursor: progress; }

.notestatus { font-size: 12px; color: var(--muted); }
.icon.save.saved svg path { fill: currentColor; }

/* verdict symbol at the side: rounded-square boxes — filled ✓, outlined ✗, dashed ! */
.verdict { flex: none; width: 30px; height: 30px; border-radius: 9px; display: none; align-items: center; justify-content: center;
           font-size: 16px; font-weight: 800; color: #fff; }
.verdict.ok { display: inline-flex; background: var(--green); color: var(--green-ink); box-shadow: 0 0 0 4px var(--green-soft); }
.verdict.bad { display: inline-flex; background: var(--red-soft); color: var(--red); box-shadow: inset 0 0 0 2px var(--red); }
.verdict.warn { display: inline-flex; background: var(--amber-soft); color: var(--amber); outline: 2px dashed var(--amber); outline-offset: -2px; }
.verdict.busy { display: inline-flex; background: transparent; }
.spinner { width: 16px; height: 16px; border: 2px solid var(--line); border-top-color: var(--brand); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* one short line under the bar */
.msg { display: none; margin: 4px 0 0 38px; font-size: 12.5px; color: var(--muted); max-width: 722px; }
.msg.show { display: inline-flex; gap: 10px; align-items: center; flex-wrap: wrap; max-width: calc(100% - 38px);
            background: var(--bg); background-image: var(--bg-grad); border: 1px solid var(--line); border-radius: 10px; padding: 4px 10px; box-shadow: var(--shadow); }
.msg .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; font-family: ui-monospace, Menlo, Consolas, monospace; }
.msg.show::before { content: ""; flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
.msg.ok::before { background: var(--green); } .msg.bad::before { background: var(--red); } .msg.warn::before { background: var(--amber); }
.msg.ok .text { color: var(--green); font-family: inherit; font-weight: 600; }
.msg.bad .text { color: var(--ink); }
.msg.warn .text { color: var(--amber); }
.tags { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.tags:empty { display: none; }
.chip { font-size: 11px; font-weight: 600; color: var(--ink); background: var(--soft); border: 1px solid var(--line);
        border-radius: 999px; padding: 1px 8px; white-space: nowrap; font-family: system-ui, sans-serif; cursor: help; }
.chip.more { color: var(--muted); }
.details .concepts:empty { display: none; }
.details .concepts { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); }
.details .traps { margin: 4px 0 0; padding-left: 18px; font-size: 12.5px; }
.details .traps li { margin: 3px 0; }
.link { background: none; border: 0; padding: 0; color: var(--muted); cursor: pointer; font-size: 12.5px; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
.link:hover { color: var(--ink); }

/* details drawer (inside the page flow, never an overlay) */
.details { display: none; margin: 6px 0 0 38px; max-width: 722px; max-height: 320px; overflow: auto; padding: 12px;
           background: var(--bg); background-image: var(--bg-grad); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); }
.details.show { display: block; }
.details .result { margin-top: 0; }
.details pre { margin: 4px 0 0; padding: 8px; background: var(--code); border-radius: 6px; white-space: pre-wrap; word-break: break-word;
               max-height: 160px; overflow: auto; font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; color: var(--ink); }
.details .verdict-box, .details .verdict-line { display: none; }
.details .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
@media (max-width: 600px) { .details .cols { grid-template-columns: 1fr; } }
.details .colhead { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.details .diff { margin-top: 8px; border-left: 2px solid var(--ink); background: var(--soft); padding: 6px 8px; border-radius: 0 6px 6px 0; font-size: 12.5px; }
.details .diff code { font: 12px ui-monospace, Menlo, Consolas, monospace; background: var(--bg); padding: 1px 4px; border-radius: 4px; white-space: pre; }
.details .diff .mark { background: var(--mark-bg); color: var(--mark-ink); border-radius: 2px; }
.details .notes { margin: 6px 0 0; padding-left: 18px; font-size: 12px; color: var(--muted); }
.details .hint { font-size: 12px; color: var(--muted); margin: 4px 0 0; }
.details details { margin-top: 8px; font-size: 12.5px; }
.details summary { cursor: pointer; color: var(--muted); }
.details .vd { padding: 6px 8px; border-radius: 6px; font-weight: 700; font-size: 12.5px; }
.details .vd.ok { background: var(--green-soft); color: var(--green); box-shadow: inset 0 0 0 1px var(--green); }
.details .vd.bad { background: var(--red-soft); color: var(--red); box-shadow: inset 0 0 0 1px var(--red); }
.details .vd.warn { background: var(--amber-soft); color: var(--amber); box-shadow: inset 0 0 0 1px var(--amber); }
.details .vd small { display: block; font-weight: 500; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;
})(typeof globalThis !== 'undefined' ? globalThis : this);

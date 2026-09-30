import { homedir } from 'node:os';
import { join } from 'node:path';

export const recordingsRoot = () => process.env.RECORDINGS_DIR || join(homedir(), '.claude', 'recordings');

export const summarize = (log, extra = {}) => {
  const events = Array.isArray(log.log) ? log.log : [];
  return {
    suite: events.find(e => e.suite)?.suite ?? '',
    stamp: log.stamp ?? '',
    target: log.target ?? '',
    state: log.state,
    verdict: log.verdict,
    error: log.error ?? null,
    pass: log.pass ?? 0,
    fail: log.fail ?? 0,
    failed: log.failed ?? [],
    seconds: log.seconds ?? 0,
    bytes: log.bytes ?? 0,
    ...extra,
    checks: events.filter(e => e.check !== undefined).map(e => ({ t: e.t, label: e.check, ok: e.ok, expected: e.expected, actual: e.actual })),
    steps: events.filter(e => e.step !== undefined).map(e => ({ t: e.t, n: e.n, step: e.step, doing: e.doing ?? '' })),
  };
};

const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replaceAll(String.fromCharCode(0x2028), '\\u2028').replaceAll(String.fromCharCode(0x2029), '\\u2029');

export const ICONS = {
  ok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="m8 12.5 2.6 2.6L16 9.5"/></svg>',
  bad: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.4v.1"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>',
  file: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12M10 11v6M14 11v6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
};

export const baseStyle = `
:root { color-scheme: light dark; --font: ui-sans-serif, system-ui, -apple-system, "Segoe UI Variable Text", "Segoe UI", Roboto, sans-serif; --mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;
  --bg: #f4f5fa; --surface: #fff; --surface2: #f6f7fb; --ink: #131722; --muted: #5a6479; --line: rgba(19,23,34,.10); --shadow: 0 1px 2px rgba(19,23,34,.06), 0 10px 28px rgba(19,23,34,.07);
  --accent: #4b45e6; --on-accent: #fff; --pass: #0f7d58; --pass-bg: rgba(15,125,88,.10); --fail: #c5253a; --fail-bg: rgba(197,37,58,.09); --warn: #9a5a06; --warn-bg: rgba(154,90,6,.11); --radius: 14px; }
@media (prefers-color-scheme: dark) { :root { --bg: #0a0c13; --surface: #131722; --surface2: #191e2c; --ink: #eef0f7; --muted: #98a2b8; --line: rgba(255,255,255,.09); --shadow: 0 1px 2px rgba(0,0,0,.45), 0 14px 34px rgba(0,0,0,.4);
  --accent: #8d8dff; --on-accent: #0a0c13; --pass: #3fd09b; --pass-bg: rgba(63,208,155,.12); --fail: #ff6d80; --fail-bg: rgba(255,109,128,.12); --warn: #f2b24c; --warn-bg: rgba(242,178,76,.12); } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; color: var(--ink); font: 15px/1.55 var(--font); -webkit-font-smoothing: antialiased; background: radial-gradient(900px 420px at 8% -8%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%), radial-gradient(700px 380px at 100% 0%, color-mix(in srgb, var(--pass) 8%, transparent), transparent 70%), var(--bg); background-attachment: fixed; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 28px 20px 72px; }
a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
h1 { font-size: clamp(24px, 4vw, 34px); line-height: 1.15; letter-spacing: -.02em; margin: 0; overflow-wrap: anywhere; }
h2.section { font-size: 12px; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); font-weight: 650; margin: 0 0 12px; }
.muted { color: var(--muted); font-size: 13.5px; margin: 0; overflow-wrap: anywhere; }
.mono { font-family: var(--mono); }
.ico { display: inline-flex; vertical-align: middle; flex: none; }
.btn { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 600 14px var(--font); cursor: pointer; text-decoration: none; transition: transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease; }
.btn:hover { text-decoration: none; transform: translateY(-1px); box-shadow: var(--shadow); border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.btn.danger { color: var(--fail); } .btn.danger:hover { background: var(--fail-bg); border-color: var(--fail); }
.btn.icon { width: 38px; padding: 0; justify-content: center; }
.btn:disabled { opacity: .5; cursor: progress; transform: none; box-shadow: none; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 11px 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 750; letter-spacing: .05em; color: var(--pass); background: var(--pass-bg); }
.badge.fail { color: var(--fail); background: var(--fail-bg); } .badge.none, .badge.error { color: var(--warn); background: var(--warn-bg); }
.badge .ico svg { width: 15px; height: 15px; }
.surface { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0 26px; }
.tile { padding: 14px 16px; } .tile b { display: block; font-size: 22px; letter-spacing: -.02em; line-height: 1.2; } .tile span { font-size: 12.5px; color: var(--muted); }
.bar { display: flex; height: 6px; gap: 2px; border-radius: 99px; overflow: hidden; background: var(--surface2); }
.bar i { display: block; } .bar .p { background: var(--pass); } .bar .f { background: var(--fail); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

const RECEIPT_STYLE = `
.back { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; margin-bottom: 18px; }
.hero { display: flex; gap: 18px; align-items: flex-start; padding: 22px; border-radius: 18px; border: 1px solid var(--line); background: linear-gradient(135deg, var(--pass-bg), transparent 60%), var(--surface); box-shadow: var(--shadow); }
.hero.fail { background: linear-gradient(135deg, var(--fail-bg), transparent 60%), var(--surface); }
.hero.none, .hero.error { background: linear-gradient(135deg, var(--warn-bg), transparent 60%), var(--surface); }
.hero .big { width: 52px; height: 52px; flex: none; border-radius: 16px; display: grid; place-items: center; color: var(--pass); background: var(--pass-bg); }
.hero.fail .big { color: var(--fail); background: var(--fail-bg); } .hero.none .big, .hero.error .big { color: var(--warn); background: var(--warn-bg); }
.hero .big svg { width: 28px; height: 28px; }
.hero .txt { min-width: 0; flex: 1; } .hero .txt > .badge { margin-bottom: 8px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.chip { font: 500 12.5px var(--mono); color: var(--muted); background: var(--surface2); border: 1px solid var(--line); border-radius: 8px; padding: 3px 9px; overflow-wrap: anywhere; }
.layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
@media (max-width: 960px) { .layout { grid-template-columns: minmax(0, 1fr); } .sticky { position: static !important; } }
.sticky { position: sticky; top: 16px; }
.player { overflow: hidden; padding: 0; }
video { width: 100%; display: block; background: #000; max-height: 64vh; }
.track { position: relative; height: 96px; cursor: pointer; user-select: none; overflow: hidden; background: var(--surface2); border-top: 1px solid var(--line); }
.track .seg { position: absolute; top: 46px; height: 12px; border-radius: 4px; background: color-mix(in srgb, var(--accent) 22%, var(--surface2)); }
.track .seg.ok { background: color-mix(in srgb, var(--pass) 42%, var(--surface2)); } .track .seg.bad { background: color-mix(in srgb, var(--fail) 58%, var(--surface2)); }
.track .fill { position: absolute; top: 46px; left: 14px; height: 12px; width: 0; border-radius: 4px 0 0 4px; background: color-mix(in srgb, var(--ink) 22%, transparent); pointer-events: none; }
.track .stem { position: absolute; width: 2px; margin-left: -1px; background: color-mix(in srgb, var(--pass) 55%, transparent); pointer-events: none; } .track .stem.bad { background: color-mix(in srgb, var(--fail) 65%, transparent); }
.track .mark { position: absolute; width: 14px; height: 14px; margin-left: -7px; padding: 0; border-radius: 50%; border: 2px solid var(--surface2); background: var(--pass); cursor: pointer; box-shadow: 0 0 0 1px color-mix(in srgb, var(--pass) 45%, transparent); transition: transform .12s ease; }
.track .mark.bad { background: var(--fail); box-shadow: 0 0 0 1px color-mix(in srgb, var(--fail) 55%, transparent); } .track .mark:hover { transform: scale(1.3); }
.track .tick { position: absolute; top: 62px; width: 1px; height: 5px; background: var(--muted); opacity: .55; }
.track .tl { position: absolute; top: 70px; transform: translateX(-50%); font: 500 10.5px var(--mono); color: var(--muted); white-space: nowrap; }
.track .head { position: absolute; top: 6px; height: 56px; width: 2px; margin-left: -1px; border-radius: 2px; background: var(--ink); pointer-events: none; }
.track .head::before { content: ""; position: absolute; top: -3px; left: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--ink); }
.track .ghost { position: absolute; top: 6px; height: 56px; width: 1px; background: var(--muted); opacity: 0; pointer-events: none; }
.track .gt { position: absolute; top: 67px; transform: translateX(-50%); font: 600 10.5px var(--mono); padding: 1px 6px; border-radius: 6px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); opacity: 0; pointer-events: none; }
.hint { font-size: 12.5px; color: var(--muted); margin: 10px 4px 0; }
ul.checks, ol.steps { list-style: none; margin: 0; padding: 0; }
.check { padding: 14px 16px; border-bottom: 1px solid var(--line); } .check:last-child, .steps li:last-child { border-bottom: 0; }
.check.bad { background: var(--fail-bg); }
.check .row { display: flex; align-items: center; gap: 10px; } .check .row .ico { color: var(--pass); } .check.bad .row .ico { color: var(--fail); }
.check .label { flex: 1; font-weight: 620; overflow-wrap: anywhere; }
button.t { font: 600 12.5px var(--mono); padding: 3px 9px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--accent); cursor: pointer; white-space: nowrap; }
button.t:hover { border-color: var(--accent); }
.vals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; } .vals.one { grid-template-columns: 1fr; }
.val { font: 12.5px/1.45 var(--mono); padding: 8px 10px; border-radius: 9px; background: var(--surface2); border: 1px solid var(--line); overflow-wrap: anywhere; }
.val small { display: block; font: 700 10.5px var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
.val.exp { border-color: color-mix(in srgb, var(--pass) 40%, var(--line)); } .val.saw.wrong { border-color: color-mix(in srgb, var(--fail) 55%, var(--line)); background: var(--fail-bg); }
@media (max-width: 520px) { .vals { grid-template-columns: 1fr; } }
.steps li { display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); position: relative; }
.steps .what { flex: 1; overflow-wrap: anywhere; } .steps small { display: block; color: var(--muted); font-size: 13px; }
.empty { padding: 18px 16px; color: var(--muted); font-size: 14px; }
.downloads { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
details { margin-top: 26px; } summary { cursor: pointer; color: var(--muted); font-size: 13.5px; font-weight: 600; }
pre { margin: 12px 0 0; padding: 14px; overflow: auto; max-height: 440px; font: 12.5px/1.55 var(--mono); border-radius: var(--radius); background: var(--surface); border: 1px solid var(--line); }
`;

const SCRIPT = `
const D = JSON.parse(document.getElementById('data').textContent);
const ICON = JSON.parse(document.getElementById('icons').textContent);
const $ = id => document.getElementById(id);
const make = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const icon = name => { const s = make('span', 'ico'); s.innerHTML = ICON[name]; return s; };
const show = v => v === undefined ? 'undefined' : JSON.stringify(v);
const secs = s => Number(s || 0).toFixed(1) + ' s';
const LABEL = { pass: 'PASSED', fail: 'FAILED', none: 'NO CHECKS', error: 'ERROR' };
const GLYPH = { pass: 'ok', fail: 'bad', none: 'warn', error: 'warn' };
const video = $('video');
const seek = t => { video.currentTime = Math.max(0, t); video.play().catch(() => {}); };
const button = (label, onclick, cls) => { const b = make('button', cls || 't', label); b.type = 'button'; b.onclick = onclick; return b; };
const link = (href, text, iconName, name) => { const a = make('a', 'btn'); a.append(icon(iconName), document.createTextNode(text)); a.href = href; if (name) a.download = name; return a; };
const blobUrl = (text, type) => URL.createObjectURL(new Blob([text], { type }));

document.title = (D.suite || 'Browser test receipt') + ' - ' + (LABEL[D.verdict] || D.verdict);
$('hero').className = 'hero ' + D.verdict;
$('big').append(icon(GLYPH[D.verdict] || 'warn'));
const badge = $('badge'); badge.className = 'badge ' + D.verdict; badge.append(icon(GLYPH[D.verdict] || 'warn'), document.createTextNode(LABEL[D.verdict] || String(D.verdict).toUpperCase()));
$('title').textContent = D.suite || 'Browser test receipt';
for (const part of String(D.stamp).split('  \\u00b7  ').filter(Boolean)) $('chips').append(make('span', 'chip', part));
if (D.error) $('chips').append(make('span', 'chip', 'error: ' + D.error));
if (D.libraryUrl) { $('back').href = D.libraryUrl; $('back').hidden = false; }

const total = D.pass + D.fail;
const tiles = [[total ? D.pass + ' of ' + total : '0', total ? 'checks passed' : 'checks recorded'], [secs(D.seconds), D.dwell ? 'paced ' + D.dwell + ' ms per update' : 'real time'], [String(D.steps.length), 'steps shown'], [D.target ? new URL(D.target, 'http://x').host || D.target : 'n/a', 'target']];
for (const [value, label] of tiles) { const t = make('div', 'tile surface'); t.append(make('b', '', value), make('span', '', label)); $('tiles').append(t); }

const embedded = $('vid');
if (embedded) {
  const bin = atob(embedded.textContent.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  video.src = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
} else {
  video.src = D.media.src;
}
const videoHref = embedded ? video.src : (D.media.download || D.media.src);

const length = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : D.seconds || 1);
const track = $('track');
const PAD = 14;
const inner = () => Math.max(1, track.clientWidth - PAD * 2);
const x = t => PAD + Math.min(1, Math.max(0, t / length())) * inner();
const fill = make('div', 'fill'); const head = make('div', 'head'); const ghost = make('div', 'ghost'); const gt = make('div', 'gt');
const at = e => Math.min(1, Math.max(0, (e.clientX - track.getBoundingClientRect().left - PAD) / inner())) * length();
const paintHead = () => {
  head.style.left = x(video.currentTime) + 'px';
  fill.style.width = Math.max(0, x(video.currentTime) - PAD) + 'px';
};
const paintTrack = () => {
  track.replaceChildren();
  const total = length();
  const segs = D.steps.map((s, i) => ({ start: s.t, end: i + 1 < D.steps.length ? D.steps[i + 1].t : total, title: s.step })).filter(s => s.end - s.start >= 0.05);
  for (const s of segs) {
    const inside = D.checks.filter(c => c.t >= s.start && c.t < s.end);
    const seg = make('div', 'seg' + (inside.some(c => !c.ok) ? ' bad' : inside.length ? ' ok' : ''));
    seg.style.left = x(s.start) + 'px'; seg.style.width = Math.max(3, x(s.end) - x(s.start) - 2) + 'px'; seg.title = s.title + ' (' + secs(s.start) + ')';
    track.append(seg);
  }
  track.append(fill);
  const laneEnd = [-Infinity, -Infinity];
  for (const c of D.checks) {
    const px = x(c.t);
    const lane = laneEnd[0] + 16 <= px ? 0 : laneEnd[1] + 16 <= px ? 1 : 0;
    laneEnd[lane] = px;
    const top = lane ? 26 : 8;
    const stem = make('div', 'stem' + (c.ok ? '' : ' bad')); stem.style.left = px + 'px'; stem.style.top = (top + 14) + 'px'; stem.style.height = (46 - top - 14) + 'px';
    const mark = make('button', 'mark' + (c.ok ? '' : ' bad')); mark.type = 'button'; mark.style.left = px + 'px'; mark.style.top = top + 'px';
    mark.title = (c.ok ? 'PASS' : 'FAIL') + ': ' + c.label + ' at ' + secs(c.t);
    mark.onclick = e => { e.stopPropagation(); seek(c.t); };
    track.append(stem, mark);
  }
  const every = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(s => total / s <= 8) || 600;
  for (let t = 0; t <= total + 0.001; t += every) {
    const tick = make('div', 'tick'); tick.style.left = x(t) + 'px';
    const label = make('div', 'tl', every >= 60 ? Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0') : (Number.isInteger(t) ? t : t.toFixed(1)) + 's'); label.style.left = x(t) + 'px';
    track.append(tick, label);
  }
  track.append(head, ghost, gt);
  paintHead();
};
track.onclick = e => seek(at(e));
track.addEventListener('mousemove', e => { const t = at(e); ghost.style.left = x(t) + 'px'; ghost.style.opacity = '.6'; gt.textContent = secs(t); gt.style.left = x(t) + 'px'; gt.style.opacity = '1'; });
track.addEventListener('mouseleave', () => { ghost.style.opacity = '0'; gt.style.opacity = '0'; });
window.addEventListener('resize', paintTrack);
video.addEventListener('timeupdate', paintHead); video.addEventListener('seeked', paintHead);
video.addEventListener('loadedmetadata', paintTrack);
const loop = () => { paintHead(); if (!video.paused && !video.ended) requestAnimationFrame(loop); };
video.addEventListener('play', loop);
paintTrack();

const checks = $('checks');
if (!D.checks.length) checks.append(make('li', 'empty', 'No checks were recorded, so this run asserted nothing.'));
for (const c of D.checks) {
  const li = make('li', 'check' + (c.ok ? '' : ' bad'));
  const row = make('div', 'row'); row.append(icon(c.ok ? 'ok' : 'bad'), make('span', 'label', c.label), button(secs(c.t), () => seek(c.t)));
  const vals = make('div', 'vals' + (c.ok ? ' one' : ''));
  const expected = make('div', 'val exp'); expected.append(make('small', '', 'Expected'), document.createTextNode(show(c.expected)));
  const seen = make('div', 'val saw' + (c.ok ? '' : ' wrong')); seen.append(make('small', '', 'Seen'), document.createTextNode(show(c.actual)));
  if (c.ok) vals.append(seen); else vals.append(expected, seen);
  li.append(row, vals); checks.append(li);
}
const steps = $('steps');
if (!D.steps.length) steps.append(make('li', 'empty', 'No steps were recorded.'));
for (const s of D.steps) {
  const li = make('li'); const what = make('span', 'what', s.step); if (s.doing) what.append(make('small', '', s.doing));
  li.append(button(secs(s.t), () => seek(s.t)), what); steps.append(li);
}
const dl = $('downloads');
dl.append(link(videoHref, 'Video (.mp4)', 'down', 'recording.mp4'));
if (D.body) dl.append(link(blobUrl(D.body, 'text/javascript'), 'Script (.js)', 'file', 'body.js'));
const { libraryUrl, media, body, ...runData } = D;
dl.append(link(blobUrl(JSON.stringify(runData, null, 2), 'application/json'), 'Run data (.json)', 'file', 'run.json'));
if (D.body) $('body').textContent = D.body; else $('bodybox').hidden = true;
`;

export const renderReceipt = (run, media = {}) => {
  const data = { ...run, body: media.body ?? '', media: { src: media.src ?? '', download: media.download ?? '' }, libraryUrl: media.libraryUrl ?? '' };
  const embedded = media.base64 ? `<script id="vid" type="text/plain">${media.base64}</script>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Browser test receipt</title><style>${baseStyle}${RECEIPT_STYLE}</style></head>
<body><div class="wrap">
<a id="back" class="back" href="#" hidden><span class="ico">${ICONS.back}</span>All recordings</a>
<header id="hero" class="hero"><div id="big" class="big"></div><div class="txt"><span id="badge" class="badge"></span><h1 id="title"></h1><div id="chips" class="chips"></div></div></header>
<div id="tiles" class="tiles"></div>
<div class="layout">
  <section class="sticky"><h2 class="section">Recording</h2><div class="player surface"><video id="video" controls muted playsinline></video><div id="track" class="track"></div></div><p class="hint">Each block is a step, green when its checks passed and red when one failed. Dots are checks. Click anywhere to jump the video there.</p>
  <h2 class="section" style="margin-top:22px">Downloads</h2><div id="downloads" class="downloads"></div></section>
  <section><h2 class="section">Checks</h2><div class="surface"><ul id="checks" class="checks"></ul></div>
  <h2 class="section" style="margin-top:26px">Steps</h2><div class="surface"><ol id="steps" class="steps"></ol></div></section>
</div>
<details id="bodybox"><summary>The script that ran</summary><pre id="body"></pre></details>
</div>
<script id="data" type="application/json">${safeJson(data)}</script>
<script id="icons" type="application/json">${safeJson(ICONS)}</script>
${embedded}
<script${media.nonce ? ` nonce="${media.nonce}"` : ''}>${SCRIPT}</script>
</body></html>
`;
};

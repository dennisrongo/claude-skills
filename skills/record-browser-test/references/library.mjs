import { spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createReadStream, existsSync, lstatSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream';
import { parseArgs } from 'node:util';
import { ICONS, baseStyle, recordingsRoot, renderReceipt } from './receipt.mjs';

const fail = (message, code = 2) => { console.error('library: ' + message); process.exit(code); };
if (Number(process.versions.node.split('.')[0]) < 22) fail(`Node 22 or newer is required (found ${process.versions.node})`);

let opt;
try {
  ({ values: opt } = parseArgs({ options: { root: { type: 'string' }, port: { type: 'string', default: '0' }, idle: { type: 'string', default: '60' }, 'no-open': { type: 'boolean' } } }));
} catch (e) { fail(e.message); }
const port = Number(opt.port);
const idleMinutes = Number(opt.idle);
if (!Number.isInteger(port) || port < 0 || port > 65535) fail(`--port must be a whole number from 0 to 65535, got "${opt.port}"`);
if (!Number.isFinite(idleMinutes) || idleMinutes < 1) fail(`--idle must be a number of minutes, at least 1, got "${opt.idle}"`);

const root = resolve(opt.root ?? recordingsRoot());
const token = randomBytes(16).toString('hex');
const ID = /^\d{8}-\d{6}-[a-z0-9-]+$/;
const FILES = {
  'recording.mp4': 'video/mp4',
  'body.js': 'text/javascript; charset=utf-8',
  'recording.steps.json': 'application/json',
  'result.json': 'application/json',
  'run.json': 'application/json',
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const digest = s => createHash('sha256').update(s).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));
const fileSize = path => { try { return statSync(path).size; } catch { return 0; } };

const runDirOf = id => {
  if (!ID.test(id) || !existsSync(root)) return null;
  const dir = join(root, id);
  try {
    const entry = lstatSync(dir);
    if (!entry.isDirectory() || entry.isSymbolicLink()) return null;
    if (realpathSync(dir) !== join(realpathSync(root), id)) return null;
    return existsSync(join(dir, 'run.json')) ? dir : null;
  } catch { return null; }
};
const loadRun = dir => { try { return JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')); } catch { return null; } };
const listRuns = () => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && ID.test(d.name))
    .map(d => ({ id: d.name, dir: runDirOf(d.name) }))
    .filter(r => r.dir)
    .map(r => ({ ...r, run: loadRun(r.dir) }))
    .filter(r => r.run)
    .map(r => ({ ...r, size: fileSize(join(r.dir, 'recording.mp4')) }))
    .sort((a, b) => (a.id < b.id ? 1 : -1));
};
const megabytes = bytes => (bytes / 1048576).toFixed(1) + ' MB';

const PAGE_CSP = nonce => `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; media-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`;
const send = (res, status, type, body, extra = {}) => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
  res.end(body);
};
const sendPage = (res, html, nonce) => send(res, 200, 'text/html; charset=utf-8', html, { 'Content-Security-Policy': PAGE_CSP(nonce) });

const serveFile = (req, res, file, type, attachmentName) => {
  const size = statSync(file).size;
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (attachmentName) headers['Content-Disposition'] = `attachment; filename="${attachmentName}"`;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    const start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1]);
    const end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
    if (!(start <= end && start < size)) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    pipeline(createReadStream(file, { start, end }), res, () => {});
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  pipeline(createReadStream(file), res, () => {});
};

const LIBRARY_STYLE = `
.top { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; justify-content: space-between; margin-bottom: 6px; }
.top > div { flex: 1 1 320px; min-width: 0; } .top .muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--mono); font-size: 12.5px; }
.top .hud { margin-bottom: 10px; } .top .live i { background: var(--accent); box-shadow: 0 0 10px var(--accent); }
.top h1 { font-size: clamp(32px, 5vw, 46px); line-height: 1; background: linear-gradient(90deg, var(--ink), color-mix(in srgb, var(--ink) 40%, var(--accent)) 60%, var(--accent2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.search { position: relative; flex: 0 0 auto; } .search .ico { position: absolute; left: 13px; top: 11px; color: var(--muted); pointer-events: none; }
.search input { height: 42px; width: min(320px, 100%); padding: 0 14px 0 40px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 500 14px var(--font); transition: border-color .15s ease, box-shadow .2s ease; }
.search input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 0 24px color-mix(in srgb, var(--accent) 25%, transparent); }
#t-pass { color: var(--pass); } #t-fail { color: var(--fail); } #t-disk { color: var(--accent); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 22px; }
.fchip { height: 36px; padding: 0 16px; border-radius: 99px; border: 1px solid var(--line); background: var(--surface); color: var(--muted); font: 600 13px var(--font); cursor: pointer; transition: color .15s ease, border-color .15s ease, box-shadow .2s ease, background .15s ease; }
.fchip:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.fchip[aria-pressed="true"] { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 60%, transparent); box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 25%, transparent); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
.card { overflow: hidden; display: flex; flex-direction: column; animation: rs-rise .6s cubic-bezier(.2,.7,.2,1) backwards; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
.card:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--accent) 50%, var(--line)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent), 0 24px 70px color-mix(in srgb, var(--accent) 16%, transparent); }
.card.gone { animation: rs-out .26s ease forwards; } .card[hidden] { display: none; }
.thumbwrap { position: relative; display: block; aspect-ratio: 16 / 9; background: radial-gradient(circle at 50% 40%, #131c33, #04060a); overflow: hidden; }
.thumbwrap::after { content: ""; position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(94,231,255,.5), transparent); animation: rs-scan 3.5s linear infinite; pointer-events: none; }
.thumb { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s ease; } .card:hover .thumb { transform: scale(1.04); }
.thumbwrap .badge { position: absolute; right: 10px; top: 10px; background: color-mix(in srgb, var(--bg) 82%, transparent); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.dur { position: absolute; right: 10px; bottom: 10px; font: 600 12px var(--mono); color: #fff; background: rgba(0,0,0,.62); padding: 2px 8px; border-radius: 7px; }
.play { position: absolute; inset: 0; display: grid; place-items: center; color: #5ee7ff; opacity: 0; background: rgba(4,6,10,.4); transition: opacity .2s ease; } .thumbwrap:hover .play { opacity: 1; }
.play svg { width: 60px; height: 60px; padding: 16px; border-radius: 50%; border: 1px solid rgba(94,231,255,.5); background: rgba(94,231,255,.12); box-shadow: 0 0 40px rgba(94,231,255,.35); }
.body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.body h2 { margin: 0; font-size: 16.5px; line-height: 1.3; letter-spacing: -.01em; overflow-wrap: anywhere; } .body h2 a { color: var(--ink); }
.meta { display: flex; flex-wrap: wrap; gap: 2px 12px; font: 12.5px var(--mono); color: var(--muted); }
.sub { margin: 0; font-size: 13px; color: var(--muted); }
.acts { display: flex; gap: 8px; margin-top: auto; padding-top: 6px; } .acts .primary { flex: 1; justify-content: center; }
.emptybox { grid-column: 1 / -1; padding: 44px 20px; text-align: center; color: var(--muted); border: 1px dashed color-mix(in srgb, var(--accent) 35%, var(--line)); border-radius: var(--radius); background: var(--surface); }
dialog { border: 1px solid color-mix(in srgb, var(--fail) 35%, var(--line)); border-radius: 20px; background: var(--surface); color: var(--ink); padding: 24px; width: min(440px, calc(100vw - 32px)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--fail) 10%, transparent), 0 30px 80px rgba(0,0,0,.5), 0 0 60px color-mix(in srgb, var(--fail) 12%, transparent); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
dialog[open] { animation: rs-rise .25s ease backwards; }
dialog::backdrop { background: rgba(4,6,10,.66); backdrop-filter: blur(4px); }
dialog h3 { margin: 0 0 6px; font-size: 18px; overflow-wrap: anywhere; } dialog p { margin: 0 0 18px; color: var(--muted); font-size: 14px; }
dialog .row { display: flex; justify-content: flex-end; gap: 10px; } dialog .err { color: var(--fail); margin: -6px 0 14px; font-size: 13.5px; }
`;

const LIBRARY_SCRIPT = `
const base = __BASE__;
const $ = s => document.querySelector(s);
const cards = () => [...document.querySelectorAll('.card')];
let filter = 'all';
let pending = null;
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const ago = iso => {
  const ms = Date.parse(iso); if (!ms) return '';
  const s = (ms - Date.now()) / 1000, a = Math.abs(s);
  if (a < 60) return rtf.format(Math.round(s), 'second');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
};
const mb = bytes => (bytes / 1048576).toFixed(1) + ' MB';
const stats = () => {
  const all = cards();
  $('#t-total').textContent = all.length;
  $('#t-pass').textContent = all.filter(c => c.dataset.verdict === 'pass').length;
  $('#t-fail').textContent = all.filter(c => c.dataset.verdict === 'fail').length;
  $('#t-disk').textContent = mb(all.reduce((sum, c) => sum + Number(c.dataset.size), 0));
  $('#empty').hidden = all.length > 0;
};
const apply = () => {
  const q = $('#q').value.trim().toLowerCase();
  let shown = 0;
  for (const c of cards()) {
    const byVerdict = filter === 'all' || (filter === 'other' ? !['pass', 'fail'].includes(c.dataset.verdict) : c.dataset.verdict === filter);
    c.hidden = !(byVerdict && (!q || c.dataset.search.includes(q)));
    if (!c.hidden) shown++;
  }
  $('#nomatch').hidden = shown > 0 || cards().length === 0;
};
for (const [i, c] of cards().entries()) {
  c.style.animationDelay = Math.min(1, 0.2 + i * 0.06) + 's';
  const when = c.querySelector('.when');
  if (when) { when.textContent = ago(c.dataset.started); const d = new Date(c.dataset.started); if (!isNaN(d)) when.title = d.toLocaleString(); }
}
const seen = new IntersectionObserver(entries => {
  for (const e of entries) if (e.isIntersecting) { const v = e.target; if (v.dataset.src) { v.src = v.dataset.src; delete v.dataset.src; } seen.unobserve(v); }
}, { rootMargin: '200px' });
for (const v of document.querySelectorAll('video.thumb')) seen.observe(v);
$('#q').addEventListener('input', apply);
$('#filters').addEventListener('click', e => {
  const b = e.target.closest('button.fchip'); if (!b) return;
  filter = b.dataset.f;
  for (const x of document.querySelectorAll('.fchip')) x.setAttribute('aria-pressed', String(x === b));
  apply();
});
$('#list').addEventListener('click', e => {
  const b = e.target.closest('button.del'); if (!b) return;
  pending = b.closest('.card');
  $('#dtitle').textContent = 'Delete "' + pending.dataset.title + '"?';
  $('#dtext').textContent = 'This permanently removes the video, the receipt and the script (' + mb(Number(pending.dataset.size)) + ') from disk. It cannot be undone.';
  $('#derr').hidden = true;
  $('#go').disabled = false;
  $('#dlg').showModal();
  $('#cancel').focus();
});
$('#cancel').addEventListener('click', () => $('#dlg').close());
$('#go').addEventListener('click', async () => {
  const card = pending; if (!card) return;
  $('#go').disabled = true;
  try {
    const r = await fetch(base + 'run/' + card.dataset.id + '/delete', { method: 'POST', headers: { 'X-Recordings': 'delete' } });
    if (!r.ok) throw new Error('the server answered ' + r.status);
    $('#dlg').close();
    card.classList.add('gone');
    setTimeout(() => { card.remove(); stats(); apply(); }, 260);
  } catch (err) { $('#derr').textContent = 'Could not delete: ' + err.message; $('#derr').hidden = false; $('#go').disabled = false; }
});
stats(); apply();
`;

const hostOf = url => { try { return new URL(url).host; } catch { return url || ''; } };

const indexHtml = (base, nonce) => {
  const runs = listRuns();
  const cardHtml = ({ id, run, size }) => {
    const verdict = ['pass', 'fail', 'none', 'error'].includes(run.verdict) ? run.verdict : 'error';
    const label = { pass: 'PASSED', fail: 'FAILED', none: 'NO CHECKS', error: 'ERROR' }[verdict];
    const glyph = { pass: 'ok', fail: 'bad', none: 'warn', error: 'warn' }[verdict];
    const pass = Number(run.pass) || 0;
    const fail = Number(run.fail) || 0;
    const title = run.suite || 'Browser test';
    const view = `${base}run/${esc(id)}`;
    const files = `${base}run/${esc(id)}/file`;
    const summary = pass + fail ? `${pass} of ${pass + fail} checks passed` : 'No checks recorded';
    const checks = Array.isArray(run.checks) ? run.checks : [];
    const focus = checks.find(c => !c.ok) || checks[checks.length - 1];
    const frameAt = focus && Number.isFinite(Number(focus.t)) ? Math.max(0.5, Number(focus.t) + 0.25) : 1.5;
    return `
<article class="card surface" data-id="${esc(id)}" data-verdict="${verdict}" data-started="${esc(run.startedAt || '')}" data-size="${size}" data-title="${esc(title)}" data-search="${esc(`${title} ${hostOf(run.target)} ${run.stamp} ${verdict}`.toLowerCase())}">
  <a class="thumbwrap" href="${view}" aria-label="View receipt: ${esc(title)}"><video class="thumb" muted playsinline preload="metadata" data-src="${files}/recording.mp4#t=${frameAt.toFixed(2)}"></video><span class="badge ${verdict}"><span class="ico">${ICONS[glyph]}</span>${label}</span><span class="dur">${esc(Number(run.seconds || 0).toFixed(1))} s</span><span class="play">${ICONS.play}</span></a>
  <div class="body">
    <h2><a href="${view}">${esc(title)}</a></h2>
    <div class="meta"><span>${esc(hostOf(run.target))}</span><span class="when"></span></div>
    <div class="bar" title="${pass} passed, ${fail} failed"><i class="p" style="flex:${pass}"></i><i class="f" style="flex:${fail}"></i></div>
    <p class="sub">${esc(summary)} &middot; ${esc(megabytes(size))}</p>
    <div class="acts"><a class="btn primary" href="${view}">View receipt</a><a class="btn icon" href="${files}/recording.mp4?download=1" title="Download video" aria-label="Download video">${ICONS.down}</a><button type="button" class="btn icon danger del" title="Delete" aria-label="Delete recording">${ICONS.trash}</button></div>
  </div>
</article>`;
  };
  const tile = (id, label) => `<div class="tile surface"><b id="${id}">0</b><span>${label}</span></div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Browser test recordings</title><style>${baseStyle}${LIBRARY_STYLE}</style></head>
<body><div class="wrap">
<header class="top"><div><span class="hud live"><i></i>Local archive · loopback only</span><h1>Recordings</h1><p class="muted" style="margin-top:6px" title="${esc(root)}">${esc(root)}</p></div><label class="search"><span class="ico">${ICONS.search}</span><input id="q" type="search" placeholder="Search recordings" autocomplete="off" aria-label="Search recordings"></label></header>
<div class="tiles">${tile('t-total', 'recordings')}${tile('t-pass', 'passed')}${tile('t-fail', 'failed')}${tile('t-disk', 'on disk')}</div>
<div id="filters" class="filters"><button type="button" class="fchip" data-f="all" aria-pressed="true">All</button><button type="button" class="fchip" data-f="pass" aria-pressed="false">Passed</button><button type="button" class="fchip" data-f="fail" aria-pressed="false">Failed</button><button type="button" class="fchip" data-f="other" aria-pressed="false">Other</button></div>
<div id="list" class="grid">${runs.map(cardHtml).join('')}</div>
<div id="empty" class="emptybox" hidden>No recordings yet. Run a browser test with the record-browser-test skill and it will appear here.</div>
<div id="nomatch" class="emptybox" hidden>No recordings match that filter.</div>
</div>
<dialog id="dlg"><h3 id="dtitle"></h3><p id="dtext"></p><p id="derr" class="err" hidden></p><div class="row"><button type="button" id="cancel" class="btn">Cancel</button><button type="button" id="go" class="btn danger">Delete permanently</button></div></dialog>
<script nonce="${nonce}">${LIBRARY_SCRIPT.replace('__BASE__', JSON.stringify(base))}</script>
</body></html>`;
};

let lastRequest = Date.now();
const handle = (req, res) => {
  lastRequest = Date.now();
  const address = server.address();
  if (req.headers.host !== `127.0.0.1:${address.port}` && req.headers.host !== `localhost:${address.port}`) { send(res, 403, 'text/plain', 'forbidden'); return; }
  const url = new URL(req.url, 'http://127.0.0.1');
  const parts = url.pathname.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return ''; } });
  if (!parts.length || !same(parts[0], token)) { send(res, 404, 'text/plain', 'not found'); return; }
  const base = `/${token}/`;
  const route = parts.slice(1);

  if (!route.length) {
    if (req.method !== 'GET') { send(res, 405, 'text/plain', 'method not allowed'); return; }
    const nonce = randomBytes(12).toString('base64');
    sendPage(res, indexHtml(base, nonce), nonce);
    return;
  }
  if (route[0] !== 'run' || !route[1]) { send(res, 404, 'text/plain', 'not found'); return; }
  const dir = runDirOf(route[1]);
  if (!dir) { send(res, 404, 'text/plain', 'no such recording'); return; }

  if (route.length === 2) {
    if (req.method !== 'GET') { send(res, 405, 'text/plain', 'method not allowed'); return; }
    const run = loadRun(dir);
    if (!run) { send(res, 404, 'text/plain', 'no such recording'); return; }
    const nonce = randomBytes(12).toString('base64');
    const bodyFile = join(dir, 'body.js');
    const html = renderReceipt(run, {
      src: `${base}run/${route[1]}/file/recording.mp4`,
      download: `${base}run/${route[1]}/file/recording.mp4?download=1`,
      body: existsSync(bodyFile) ? readFileSync(bodyFile, 'utf8') : '',
      libraryUrl: base,
      nonce,
    });
    sendPage(res, html, nonce);
    return;
  }
  if (route.length === 4 && route[2] === 'file' && Object.hasOwn(FILES, route[3])) {
    if (req.method !== 'GET') { send(res, 405, 'text/plain', 'method not allowed'); return; }
    const file = join(dir, route[3]);
    if (!existsSync(file)) { send(res, 404, 'text/plain', 'no such file'); return; }
    serveFile(req, res, file, FILES[route[3]], url.searchParams.has('download') || route[3] !== 'recording.mp4' ? `${route[1]}-${route[3]}` : null);
    return;
  }
  if (route.length === 3 && route[2] === 'delete') {
    if (req.method !== 'POST') { send(res, 405, 'text/plain', 'method not allowed'); return; }
    if (req.headers['x-recordings'] !== 'delete' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) { send(res, 403, 'text/plain', 'forbidden'); return; }
    try {
      rmSync(dir, { recursive: true, force: true });
      send(res, 200, 'application/json', JSON.stringify({ deleted: route[1] }));
    } catch (e) { send(res, 500, 'application/json', JSON.stringify({ error: e.message })); }
    return;
  }
  send(res, 404, 'text/plain', 'not found');
};
const server = createServer((req, res) => {
  try { handle(req, res); }
  catch (e) {
    console.error(`library: request failed: ${e.message}`);
    if (res.headersSent) res.destroy(); else send(res, 500, 'text/plain', 'internal error');
  }
});
server.on('clientError', (e, socket) => socket.destroy());

await new Promise((ok, no) => { server.once('error', no); server.listen(port, '127.0.0.1', ok); }).catch(e => fail(`could not listen on port ${port}: ${e.message}`, 1));
const url = `http://127.0.0.1:${server.address().port}/${token}/`;
console.log(JSON.stringify({ url, root, recordings: listRuns().length, closesAfterIdleMinutes: idleMinutes }));
console.error(`library: ${url}\nlibrary: press Ctrl-C to stop; it closes itself after ${idleMinutes} idle minutes`);

if (!opt['no-open']) {
  const [command, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch {}
}

const stop = () => { server.close(); process.exit(0); };
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);
setInterval(() => { if (Date.now() - lastRequest > idleMinutes * 60000) stop(); }, 15000).unref?.();

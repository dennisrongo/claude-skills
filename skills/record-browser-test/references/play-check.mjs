import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { findChrome } from './chrome.mjs';

const fail = (message, code = 2) => { console.error('play-check: ' + message); process.exit(code); };
if (Number(process.versions.node.split('.')[0]) < 22) fail(`Node 22 or newer is required (found ${process.versions.node})`);

let parsed;
try { parsed = parseArgs({ allowPositionals: true, options: { chrome: { type: 'string' }, timeout: { type: 'string', default: '120' } } }); }
catch (e) { fail(e.message); }
const file = parsed.positionals[0] && resolve(parsed.positionals[0]);
if (!file || !existsSync(file)) fail('usage: node play-check.mjs <recording.mp4> [--chrome path] [--timeout s]');
const timeout = Number(parsed.values.timeout);
if (!Number.isFinite(timeout) || timeout < 1) fail(`--timeout must be a number of at least 1, got "${parsed.values.timeout}"`);
if (parsed.values.chrome && !existsSync(parsed.values.chrome)) fail(`--chrome not found: ${parsed.values.chrome}`);
const chromePath = findChrome(parsed.values.chrome);
if (!chromePath) fail('no Chrome found; pass --chrome <path> or set CHROME_PATH');

const wait = ms => new Promise(r => setTimeout(r, ms));
const server = createServer((req, res) => {
  if (req.url === '/v.mp4') {
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': statSync(file).size });
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><video id="v" src="/v.mp4" muted></video>');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const profile = mkdtempSync(join(tmpdir(), 'play-check-'));
let chrome = null;
let launchError = null;
try {
  chrome = spawn(chromePath, [`--user-data-dir=${profile}`, '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--use-mock-keychain', '--password-store=basic', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  chrome.on('error', e => { launchError = e; });
} catch (e) { launchError = e; }

let ws = null;
let result = { played: false, ended: false, error: 'did not finish' };
try {
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    if (launchError) throw new Error(`could not launch Chrome (${chromePath}): ${launchError.message}`);
    const portFile = join(profile, 'DevToolsActivePort');
    const value = existsSync(portFile) ? Number(readFileSync(portFile, 'utf8').split('\n')[0]) : 0;
    if (value) port = value; else await wait(150);
  }
  if (!port) throw new Error('Chrome did not open a debugging port within 15 s');
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('debugger connection failed')); });
  let nextId = 0;
  const pending = new Map();
  ws.onclose = () => { for (const p of pending.values()) p.no(new Error('the browser closed the connection')); pending.clear(); };
  ws.onmessage = e => { const m = JSON.parse(e.data); const p = pending.get(m.id); if (p) { pending.delete(m.id); p.ok(m.result); } };
  const send = (method, params = {}) => new Promise((ok, no) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); no(new Error(`${method} did not answer within 30 s`)); }, 30000);
    pending.set(id, { ok: v => { clearTimeout(timer); ok(v); }, no: e => { clearTimeout(timer); no(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const probe = async () => (await send('Runtime.evaluate', {
    expression: `(() => { const v = document.getElementById('v'); return v ? { ended: v.ended, t: v.currentTime, d: Number.isFinite(v.duration) ? v.duration : null, error: v.error ? v.error.message || 'code ' + v.error.code : null, visible: document.visibilityState === 'visible' } : null; })()`,
    returnByValue: true,
  })).result.value;

  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  for (let i = 0; i < 40 && !(await probe()); i++) await wait(150);
  await send('Runtime.evaluate', { expression: `document.getElementById('v').play().catch(() => {}); 0` });

  const deadline = Date.now() + timeout * 1000;
  let last = { t: -1 };
  let movedAt = Date.now();
  let snap = null;
  while (Date.now() < deadline) {
    await wait(300);
    snap = await probe();
    if (snap.error || snap.ended) break;
    if (snap.t !== last.t) movedAt = Date.now();
    if (Date.now() - movedAt > 10000) { snap.error = snap.visible ? 'playback stalled for 10 s' : 'the window is hidden, so the browser paused playback'; break; }
    last = snap;
  }
  if (!snap.ended && !snap.error) snap.error = `did not finish within ${timeout} s`;
  result = { played: snap.ended && !snap.error && snap.d > 0 && snap.t >= snap.d - 0.5, ended: snap.ended, position: Number(snap.t.toFixed(2)), duration: snap.d === null ? null : Number(snap.d.toFixed(2)), error: snap.error };
} catch (e) {
  result = { played: false, ended: false, error: String(e && e.message || e) };
} finally {
  if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify({ id: 999999, method: 'Browser.close' })); } catch {} }
  await wait(1500);
  try { chrome?.kill(); } catch {}
  server.close();
  for (let i = 0; i < 20; i++) {
    try { rmSync(profile, { recursive: true, force: true }); break; } catch { await wait(500); }
  }
}

console.log(JSON.stringify({ file, ...result }, null, 2));
process.exit(result.played ? 0 : 1);

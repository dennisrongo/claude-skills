import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { findChrome } from './chrome.mjs';
import { patchDuration } from './mp4.mjs';
import { recordingsRoot, renderReceipt, summarize } from './receipt.mjs';

const MAX_EMBED_BYTES = 25 * 1024 * 1024;
const here = dirname(fileURLToPath(import.meta.url));
const fail = (message, code = 2) => { console.error('record-run: ' + message); process.exit(code); };
if (Number(process.versions.node.split('.')[0]) < 22) fail(`Node 22 or newer is required (found ${process.versions.node})`);

let opt;
try {
  ({ values: opt } = parseArgs({
    options: {
      url: { type: 'string' },
      body: { type: 'string' },
      setup: { type: 'string' },
      out: { type: 'string' },
      result: { type: 'string' },
      dwell: { type: 'string', default: '600' },
      corner: { type: 'string', default: 'top-left' },
      timeout: { type: 'string', default: '600' },
      chrome: { type: 'string' },
      'allow-host': { type: 'string' },
      profile: { type: 'string' },
      mask: { type: 'string', multiple: true },
      rehearse: { type: 'boolean' },
      'no-open': { type: 'boolean' },
      'show-query': { type: 'boolean' },
    },
  }));
} catch (e) { fail(e.message); }

if (!opt.url || !opt.body) fail('usage: node record-run.mjs --url <page> --body <test-body.js> [--out file.mp4] [--result file.json] [--setup setup.js] [--dwell ms] [--corner top-left|bottom-left] [--timeout s] [--chrome path] [--allow-host host] [--profile dir] [--mask selector]... [--rehearse] [--no-open] [--show-query]');
for (const selector of opt.mask ?? []) if (!selector.trim() || /[{};<>\r\n]/.test(selector)) fail(`--mask needs a plain CSS selector with no braces, semicolons, angle brackets or newlines, got "${selector}"`);

const number = (name, min, max) => {
  const value = Number(opt[name]);
  if (!Number.isFinite(value) || value < min || value > max) fail(`--${name} must be a number from ${min} to ${max}, got "${opt[name]}"`);
  return value;
};
const dwell = number('dwell', 0, 60000);
const timeout = number('timeout', 1, 86400);
if (!['top-left', 'bottom-left'].includes(opt.corner)) fail(`--corner must be top-left or bottom-left, got "${opt.corner}"`);
for (const [flag, file] of [['body', opt.body], ['setup', opt.setup]]) if (file && !existsSync(file)) fail(`--${flag} file not found: ${file}`);
const bodySource = readFileSync(opt.body, 'utf8');

let target;
try { target = new URL(opt.url); } catch { fail(`--url is not a valid URL: ${opt.url}`); }
const loopback = target.hostname === 'localhost' || target.hostname.endsWith('.localhost') || target.hostname === '127.0.0.1' || target.hostname === '[::1]';
if (!loopback && target.hostname !== opt['allow-host']) fail(`refusing ${target.hostname}: only loopback targets run unattended. Pass --allow-host ${target.hostname} once you have checked the page shows no personal or regulated data.`);

if (opt.chrome && !existsSync(opt.chrome)) fail(`--chrome not found: ${opt.chrome}`);
const chromePath = findChrome(opt.chrome);
if (!chromePath) fail('no Chrome found; pass --chrome <path> or set CHROME_PATH');

const realProfile = /(google\/chrome|chromium|microsoft\/edge)\/user data|\.config\/(google-chrome|chromium)|application support\/(google\/chrome|microsoft edge|chromium|bravesoftware)/i;
if (opt.profile && realProfile.test(resolve(opt.profile).replaceAll('\\', '/'))) fail('refusing --profile ' + opt.profile + ': that is a real browser profile. Give a dedicated empty directory.');

const shownUrl = opt['show-query'] ? target.href : target.origin + target.pathname + (target.search ? '?<query redacted>' : '') + (target.hash ? '#<fragment redacted>' : '');
const startedAt = new Date();
const libraryMode = opt.out === undefined;
let runDir = null;
if (libraryMode && !opt.rehearse) {
  const root = recordingsRoot();
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const slug = target.hostname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'page';
  const base = `${startedAt.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')}-${slug}`;
  for (let n = 1; !runDir; n++) {
    const candidate = join(root, n === 1 ? base : `${base}-${n}`);
    try { mkdirSync(candidate, { mode: 0o700 }); runDir = candidate; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
}
const out = libraryMode ? join(runDir ?? resolve('.'), 'recording.mp4') : resolve(opt.out);
const resultPath = opt.result !== undefined ? resolve(opt.result) : libraryMode ? join(runDir ?? resolve('.'), 'result.json') : resolve('result.json');
const logPath = out.replace(/\.mp4$/i, '') + '.steps.json';
const rawPath = out + '.raw';
const openInBrowser = async (file) => {
  if (opt['no-open']) return 'skipped: --no-open';
  if (process.env.CI && !['0', 'false'].includes(process.env.CI.toLowerCase())) return 'skipped: CI environment';
  if (process.env.CLAUDE_CODE_SESSION_ATTENDED === '0') return 'skipped: unattended session';
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return 'skipped: no display';
  const [command, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', file]]
    : process.platform === 'darwin' ? ['open', [file]] : ['xdg-open', [file]];
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.once('error', (e) => done(`failed: ${e.message}`));
    child.once('spawn', () => { child.unref(); done('yes'); });
  });
};
const receiptPath = runDir ? join(runDir, 'receipt.html') : out.replace(/\.mp4$/i, '') + '.receipt.html';
if (!opt.rehearse) {
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(dirname(resultPath), { recursive: true });
  for (const stale of [out, resultPath, logPath, rawPath, receiptPath]) rmSync(stale, { force: true });
}

const inRepo = (() => {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    if (existsSync(join(dir, '.git'))) return true;
    if (dirname(dir) === dir) return false;
  }
})();
const git = args => (inRepo ? spawnSync('git', args, { encoding: 'utf8' }) : { status: 1, stdout: '' });
const head = git(['rev-parse', '--short', 'HEAD']);
const dirty = head.status === 0 && git(['status', '--porcelain']).stdout.trim() !== '';
const stamp = [target.origin, head.status === 0 ? 'commit ' + head.stdout.trim() + (dirty ? ' + uncommitted changes' : '') : null, new Date().toISOString()].filter(Boolean).join('  ·  ');
const wait = ms => new Promise(r => setTimeout(r, ms));

let uploadError = null;
const receiver = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', target.origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try { writeFileSync(rawPath, Buffer.concat(chunks)); res.writeHead(200).end('ok'); }
    catch (e) { uploadError = e; res.writeHead(500).end(); }
  });
});
await new Promise(r => receiver.listen(0, '127.0.0.1', r));
const uploadUrl = `http://127.0.0.1:${receiver.address().port}/upload`;

const persistent = Boolean(opt.profile);
const profile = persistent ? resolve(opt.profile) : mkdtempSync(join(tmpdir(), 'record-run-'));
mkdirSync(profile, { recursive: true });
rmSync(join(profile, 'DevToolsActivePort'), { force: true });
const flags = [
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
  '--auto-accept-this-tab-capture', '--window-size=1440,900', '--use-mock-keychain', '--password-store=basic',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
];
if (!loopback && target.protocol === 'http:') flags.push(`--unsafely-treat-insecure-origin-as-secure=${target.origin}`);

let launchError = null;
let gone = false;
let chrome = null;
try { chrome = spawn(chromePath, [...flags, 'about:blank'], { stdio: 'ignore' }); }
catch (e) { launchError = e; gone = true; }
if (chrome) chrome.on('error', e => { launchError = e; gone = true; });
let exitInfo = 'unknown';
const exited = chrome ? new Promise(r => chrome.on('exit', (code, signal) => { gone = true; exitInfo = signal ? `signal ${signal}` : `exit code ${code}`; r(); })) : Promise.resolve();

const removeProfile = async attempts => {
  if (persistent) return;
  for (let i = 0; i < attempts; i++) {
    try { rmSync(profile, { recursive: true, force: true }); return; } catch { await wait(500); }
  }
  console.error(`record-run: could not remove the temporary profile ${profile}`);
};
let closed = false;
const cleanup = () => {
  if (closed) return;
  closed = true;
  try { chrome?.kill(); } catch {}
  try { receiver.close(); } catch {}
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    cleanup();
    if (!persistent) { try { rmSync(profile, { recursive: true, force: true }); } catch {} }
    process.exit(130);
  });
}

let ws = null;
let outcome = { state: 'error', verdict: 'error', error: 'did not finish' };

try {
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    if (launchError) throw new Error(`could not launch Chrome (${chromePath}): ${launchError.message}`);
    if (gone) throw new Error(`Chrome exited before opening a debugging port (${exitInfo}; a locked --profile, no display, or another Chrome instance taking over)`);
    const file = join(profile, 'DevToolsActivePort');
    const value = existsSync(file) ? Number(readFileSync(file, 'utf8').split('\n')[0]) : 0;
    if (value) port = value; else await wait(150);
  }
  if (!port) throw new Error('Chrome did not open a debugging port within 15 s');

  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
  if (!page) throw new Error('Chrome opened no page to drive');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('debugger connection failed')); });

  let nextId = 0;
  const pending = new Map();
  ws.onclose = () => {
    for (const p of pending.values()) p.no(new Error('the browser closed the connection (was the Chrome window closed?)'));
    pending.clear();
  };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.error) p.no(new Error(m.error.message)); else p.ok(m.result);
  };
  const send = (method, params = {}, ms = 30000) => new Promise((ok, no) => {
    if (ws.readyState !== 1) { no(new Error('the browser connection is closed')); return; }
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); no(new Error(`${method} did not answer within ${ms / 1000} s`)); }, ms);
    pending.set(id, { ok: v => { clearTimeout(timer); ok(v); }, no: e => { clearTimeout(timer); no(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async (expression, userGesture = false, ms = 30000) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture }, ms);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const arrive = async () => {
    let seen = '';
    for (let i = 0; i < 200; i++) {
      seen = await run(`location.origin + '|' + document.readyState`).catch(() => '');
      if (seen === `${target.origin}|complete`) return;
      await wait(150);
    }
    throw new Error(`the page did not settle on ${target.origin} within 30 s (last seen: ${seen || 'nothing'}); is the server running, or did it redirect elsewhere?`);
  };

  const nav = await send('Page.navigate', { url: target.href });
  if (nav.errorText) throw new Error(`could not load ${shownUrl}: ${nav.errorText} (is the server running?)`);
  await arrive();
  if (opt.setup) {
    await run(`(${readFileSync(opt.setup, 'utf8')})()`, false, timeout * 1000);
    await arrive();
  }
  if (opt.mask?.length) {
    const rule = `${opt.mask.join(', ')} { filter: blur(10px) !important; }`;
    await run(`(() => { const s = document.createElement('style'); s.id = '__rec_mask'; s.textContent = ${JSON.stringify(rule)}; document.head.append(s); })()`);
  }
  await run(`(${readFileSync(join(here, 'record-tab-mp4.js'), 'utf8')})()`);

  if (opt.rehearse) {
    const rehearsal = await run(`(async () => {
      const rec = window.__rec;
      try { rec.result = await (${bodySource})(rec); } catch (e) { rec.error = String(e && e.message || e); }
      return {
        error: rec.error, pass: rec.pass, fail: rec.fail, failed: rec.failed, steps: rec.steps,
        checks: rec.log.filter(x => x.check !== undefined).map(x => x.ok ? { label: x.check, ok: true } : { label: x.check, ok: false, expected: x.expected, actual: x.actual }),
        result: rec.result === undefined ? null : rec.result,
      };
    })()`, false, timeout * 1000);
    outcome = { mode: 'rehearsal', state: rehearsal.error ? 'error' : 'done', verdict: rehearsal.error ? 'error' : rehearsal.pass + rehearsal.fail === 0 ? 'none' : rehearsal.fail ? 'fail' : 'pass', ...rehearsal };
  } else {
    await run(`Object.assign(window.__rec, { dwell: ${dwell}, corner: ${JSON.stringify(opt.corner)}, uploadUrl: ${JSON.stringify(uploadUrl)}, run: (${bodySource}) })`);
    await run(`__rec.show({ stamp: ${JSON.stringify(stamp)} })`);
    await run(`document.getElementById('__rec_start').click()`, true);

    const deadline = Date.now() + timeout * 1000;
    let snap = null;
    while (Date.now() < deadline) {
      if (gone) throw new Error(`Chrome exited during the run (${exitInfo}). Closing the Chrome window ends the run, so leave it open until this command prints its result; if nobody closed it, Chrome crashed and the run can be repeated.`);
      try {
        snap = await run(`({ state: __rec.state, verdict: __rec.verdict, error: __rec.error, seconds: __rec.seconds, bytes: __rec.bytes, steps: __rec.steps, pass: __rec.pass, fail: __rec.fail, failed: __rec.failed })`);
      } catch (e) {
        if (String(e.message).includes('__rec')) throw new Error('the page navigated or reloaded during the test; the recorder survives one page only');
        throw e;
      }
      if (snap.state === 'done' || snap.state === 'error') break;
      await wait(500);
    }
    if (!snap || (snap.state !== 'done' && snap.state !== 'error')) throw new Error(`no result after ${timeout} s (last state: ${snap && snap.state}); raise --timeout, or lower --dwell if the run is paced`);
    if (uploadError) throw new Error(`could not save the recording: ${uploadError.message}`);
    if (snap.state === 'done' && snap.bytes === 0) throw new Error('the recording is empty (0 bytes)');
    writeFileSync(resultPath, JSON.stringify((await run('__rec.result')) ?? null, null, 2));
    writeFileSync(logPath, JSON.stringify({ stamp, target: shownUrl, ...snap, log: await run('__rec.log') }, null, 2));
    outcome = snap;
  }
} catch (e) {
  let message = String(e && e.message || e);
  await Promise.race([exited, wait(1500)]);
  if (gone && exitInfo !== 'unknown' && !message.includes('Chrome exited')) message += ` (Chrome ended with ${exitInfo}; closing the Chrome window ends the run, so leave it open until this command prints its result)`;
  outcome = { state: 'error', verdict: 'error', error: message };
} finally {
  if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify({ id: 999999, method: 'Browser.close' })); } catch {} }
  await Promise.race([exited, wait(5000)]);
  cleanup();
  await removeProfile(20);
}

if (opt.rehearse) {
  if (outcome.state === 'done' && outcome.verdict === 'none') console.error('record-run: warning: the body reported no checks, so a recording of it would assert nothing');
  console.log(JSON.stringify({ ...outcome, stamp }, null, 2));
  process.exit(outcome.state !== 'done' ? 1 : outcome.fail > 0 ? 3 : 0);
}

let patched = false;
let patchError = 'no duration was recorded';
if (existsSync(rawPath)) {
  if (outcome.seconds) {
    try { writeFileSync(out, patchDuration(readFileSync(rawPath), outcome.seconds)); patched = true; rmSync(rawPath); }
    catch (e) { patchError = e.message; }
  }
  if (!patched) renameSync(rawPath, out);
}

if (existsSync(out) && !patched) console.error(`record-run: warning: the MP4 header was not patched (${patchError}); the file plays but reports a wrong duration`);
if (outcome.state === 'done' && outcome.verdict === 'none') console.error('record-run: warning: the run reported no checks, so nothing was asserted');

let receipt = null;
let opened = 'skipped: no receipt';
if (existsSync(out) && existsSync(logPath)) {
  try {
    const run = summarize(JSON.parse(readFileSync(logPath, 'utf8')), { id: runDir ? basename(runDir) : basename(out), startedAt: startedAt.toISOString(), dwell, headerPatched: patched, session: process.env.CLAUDE_CODE_SESSION_ID || null });
    const media = statSync(out).size <= MAX_EMBED_BYTES ? { base64: readFileSync(out).toString('base64'), body: bodySource } : { src: basename(out), body: bodySource };
    writeFileSync(receiptPath, renderReceipt(run, media));
    receipt = receiptPath;
    if (runDir) {
      writeFileSync(join(runDir, 'body.js'), bodySource);
      writeFileSync(join(runDir, 'run.json'), JSON.stringify(run, null, 2));
    }
    opened = await openInBrowser(receiptPath);
    if (opened.startsWith('failed')) console.error(`record-run: warning: could not open the receipt (${opened}); it is at ${receiptPath}`);
  } catch (e) {
    console.error(`record-run: warning: could not write the receipt files (${e.message}); the video is at ${out}`);
  }
} else if (runDir) {
  rmSync(runDir, { recursive: true, force: true });
}

console.log(JSON.stringify({ ...outcome, out: existsSync(out) ? out : null, headerPatched: patched, steps_log: existsSync(logPath) ? logPath : null, result: existsSync(resultPath) ? resultPath : null, receipt, opened, library: receipt && runDir ? `node ${join(here, 'library.mjs')}` : null, stamp }, null, 2));
process.exit(outcome.state !== 'done' ? 1 : outcome.fail > 0 ? 3 : 0);

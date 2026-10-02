'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');

const SKILL = path.join(__dirname, '..', 'skills', 'draw-options');
const OC = path.join(SKILL, 'scripts', 'oc.mjs');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const made = [];
const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-test-'));
  made.push(dir);
  return dir;
};
test.after(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const run = (args, env) =>
  new Promise((resolve) => {
    execFile(process.execPath, [OC, ...args], { env: { ...process.env, DRAW_OPTIONS_NO_LAUNCH: '1', ...env } }, (err, stdout) => {
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {}
      resolve({ code: err ? err.code : 0, json, stdout });
    });
  });

const startStub = (handler) =>
  new Promise((resolve) => {
    const calls = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const call = { method: req.method, url: req.url, body, auth: req.headers.authorization };
        calls.push(call);
        if (call.auth !== 'Bearer tok') {
          res.writeHead(401).end(JSON.stringify({ success: false, error: 'unauthorized' }));
          return;
        }
        const out = handler(call) || { status: 200, json: { success: true, result: null } };
        res.writeHead(out.status, { 'content-type': 'application/json' }).end(JSON.stringify(out.json));
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, calls, port: server.address().port }));
  });

const appData = (port, token = 'tok') => {
  const dir = tmp();
  if (port) fs.writeFileSync(path.join(dir, 'server.json'), JSON.stringify({ port, token }));
  return dir;
};

const fakeExe = () => {
  const file = path.join(tmp(), 'tldraw.exe');
  fs.writeFileSync(file, '');
  return file;
};

const ok = (result) => ({ status: 200, json: { success: true, result } });

test('check: no app, no server file -> not-installed (exit 2)', async () => {
  const r = await run(['check'], { TLDRAW_DATA_DIR: appData(), TLDRAW_EXE: path.join(tmp(), 'missing.exe') });
  assert.equal(r.code, 2);
  assert.equal(r.json.state, 'not-installed');
  assert.match(r.json.message, /not run/);
});

test('check: installed but no server file -> not-running (exit 3)', async () => {
  const r = await run(['check'], { TLDRAW_DATA_DIR: appData(), TLDRAW_EXE: fakeExe() });
  assert.equal(r.code, 3);
  assert.equal(r.json.state, 'not-running');
});

test('check: stale server file (connection refused) -> not-running', async () => {
  const stub = await startStub(() => null);
  const port = stub.port;
  await new Promise((r) => stub.server.close(r));
  const r = await run(['check'], { TLDRAW_DATA_DIR: appData(port), TLDRAW_EXE: path.join(tmp(), 'missing.exe') });
  assert.equal(r.code, 3);
  assert.equal(r.json.state, 'not-running');
});

test('check: token rejected (401) -> not-running with a restart hint', async () => {
  const stub = await startStub(() => null);
  const r = await run(['check'], { TLDRAW_DATA_DIR: appData(stub.port, 'wrong'), TLDRAW_EXE: fakeExe() });
  stub.server.close();
  assert.equal(r.code, 3);
  assert.match(r.json.message, /Quit tldraw offline/);
});

test('check: answering server -> ready (exit 0)', async () => {
  const stub = await startStub(() => ok(1));
  const r = await run(['check'], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 0);
  assert.equal(r.json.state, 'ready');
});

test('open: creates the folder, cleans the name, posts name and directory', async () => {
  const dir = path.join(tmp(), 'nested', 'diagrams');
  const stub = await startStub((c) => (c.url === '/api/docs/create' ? ok({ id: 'tldr:file:abc', filePath: path.join(dir, 'x.tldraw') }) : null));
  const r = await run(['open', '123 Report Export?!', '--dir', dir], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 0);
  assert.equal(r.json.created, true);
  assert.ok(fs.existsSync(dir));
  const posted = JSON.parse(stub.calls.find((c) => c.url === '/api/docs/create').body);
  assert.deepEqual(posted, { name: '123-report-export', directory: path.resolve(dir) });
});

test('open: rejects a name that cleans to nothing', async () => {
  const stub = await startStub(() => ok(1));
  const r = await run(['open', '???', '--dir', tmp()], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 1);
  assert.equal(r.json.state, 'bad-name');
});

test('open: Windows device names are refused as file names', async () => {
  const stub = await startStub(() => ok(1));
  const r = await run(['open', 'NUL', '--dir', tmp()], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 1);
  assert.equal(r.json.state, 'bad-name');
  assert.match(r.json.message, /reserved device name/);
});

test('check: a port that is not a plain number is treated as no server, and no request is made', async () => {
  const stub = await startStub(() => ok(1));
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'server.json'), JSON.stringify({ port: `${stub.port}@evil.example`, token: 'tok' }));
  const r = await run(['check'], { TLDRAW_DATA_DIR: dir, TLDRAW_EXE: path.join(tmp(), 'missing.exe') });
  stub.server.close();
  assert.equal(r.code, 2);
  assert.equal(stub.calls.length, 0);
});

test('open: on Windows a folder with cmd metacharacters is not handed to the opener', { skip: process.platform !== 'win32' }, async () => {
  const dir = path.join(tmp(), 'a&b');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'closed.tldraw'), '');
  const stub = await startStub((c) => (c.url === '/api/docs/create' ? { status: 409, json: { success: false } } : ok([])));
  const r = await run(['open', 'closed', '--dir', dir], { TLDRAW_DATA_DIR: appData(stub.port), DRAW_OPTIONS_OPEN_WAIT: '30' });
  stub.server.close();
  assert.equal(r.code, 4);
  assert.match(r.json.message, /cannot be opened safely/);
});

test('open: 409 and the file is already open -> returns it, created false', async () => {
  const dir = tmp();
  const target = path.join(dir, 'task-1.tldraw');
  fs.writeFileSync(target, '');
  const stub = await startStub((c) => {
    if (c.url === '/api/docs/create') return { status: 409, json: { success: false } };
    return ok([{ id: 'tldr:file:open', filePath: target }]);
  });
  const r = await run(['open', 'task-1', '--dir', dir], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 0);
  assert.equal(r.json.created, false);
  assert.equal(r.json.id, 'tldr:file:open');
});

test('open: 409 and the file does not exist -> create-failed', async () => {
  const stub = await startStub((c) => (c.url === '/api/docs/create' ? { status: 409, json: { success: false } } : ok([])));
  const r = await run(['open', 'ghost', '--dir', tmp()], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 1);
  assert.equal(r.json.state, 'create-failed');
});

test('open: 409, file exists but never opens -> exists-not-open (exit 4)', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'closed.tldraw'), '');
  const stub = await startStub((c) => (c.url === '/api/docs/create' ? { status: 409, json: { success: false } } : ok([])));
  const r = await run(['open', 'closed', '--dir', dir], { TLDRAW_DATA_DIR: appData(stub.port), DRAW_OPTIONS_OPEN_WAIT: '1' });
  stub.server.close();
  assert.equal(r.code, 4);
  assert.equal(r.json.state, 'exists-not-open');
});

test('open: names are cleaned (unicode dropped, 80 character cap, suffix stripped)', async () => {
  const stub = await startStub((c) => (c.url === '/api/docs/create' ? ok({ id: 'tldr:file:n', filePath: 'x' }) : null));
  const env = { TLDRAW_DATA_DIR: appData(stub.port) };
  await run(['open', 'Café Plan.tldraw', '--dir', tmp()], env);
  await run(['open', 'a'.repeat(100), '--dir', tmp()], env);
  const names = stub.calls.filter((c) => c.url === '/api/docs/create').map((c) => JSON.parse(c.body).name);
  stub.server.close();
  assert.equal(names[0], 'caf-plan');
  assert.equal(names[1].length, 80);
});

test('open: --dir without a value is a usage error, not a crash', async () => {
  const stub = await startStub(() => ok(1));
  const r = await run(['open', 'task-1', '--dir'], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.json.state, 'usage');
});

test('open: a second launch of the app overwrites server.json, and the helper puts the original back', async () => {
  const dir = tmp();
  const target = path.join(dir, 'clobbered.tldraw');
  fs.writeFileSync(target, '');
  const stub = await startStub((c) => {
    if (c.url === '/api/docs/create') return { status: 409, json: { success: false } };
    if (!c.body.includes('getDocs')) return ok(1);
    return ok(opened ? [{ id: 'tldr:file:c', filePath: target }] : []);
  });
  let opened = false;
  const data = appData(stub.port);
  const original = fs.readFileSync(path.join(data, 'server.json'), 'utf8');
  const opener = path.join(tmp(), 'opener.js');
  fs.writeFileSync(opener, `require('node:fs').writeFileSync(require('node:path').join(process.env.TLDRAW_DATA_DIR, 'server.json'), '{"port":1,"token":"dead"}')`);
  setTimeout(() => (opened = true), 1500);
  const r = await run(['open', 'clobbered', '--dir', dir], { TLDRAW_DATA_DIR: data, DRAW_OPTIONS_OPENER: opener, DRAW_OPTIONS_NO_LAUNCH: '', DRAW_OPTIONS_OPEN_WAIT: '8' });
  stub.server.close();
  assert.equal(r.code, 0);
  assert.equal(r.json.opened, true);
  assert.equal(fs.readFileSync(path.join(data, 'server.json'), 'utf8'), original);
});

test('open: a failed poll while the app restarts does not abort the wait', async () => {
  const dir = tmp();
  const target = path.join(dir, 'blip.tldraw');
  fs.writeFileSync(target, '');
  let polls = 0;
  const stub = await startStub((c) => {
    if (c.url === '/api/docs/create') return { status: 409, json: { success: false } };
    if (!c.body.includes('getDocs')) return ok(1);
    polls++;
    if (polls === 2) return { status: 500, json: { success: false } };
    return ok(polls >= 3 ? [{ id: 'tldr:file:blip', filePath: target }] : []);
  });
  const r = await run(['open', 'blip', '--dir', dir], { TLDRAW_DATA_DIR: appData(stub.port), DRAW_OPTIONS_OPEN_WAIT: '6' });
  stub.server.close();
  assert.equal(r.code, 0);
  assert.equal(r.json.opened, true);
});

test('open: 409, file exists and polls until the document appears -> opened true', async () => {
  const dir = tmp();
  const target = path.join(dir, 'late.tldraw');
  fs.writeFileSync(target, '');
  let docsCalls = 0;
  const stub = await startStub((c) => {
    if (c.url === '/api/docs/create') return { status: 409, json: { success: false } };
    if (!c.body.includes('getDocs')) return ok(1);
    docsCalls++;
    return ok(docsCalls >= 2 ? [{ id: 'tldr:file:late', filePath: target }] : []);
  });
  const r = await run(['open', 'late', '--dir', dir], { TLDRAW_DATA_DIR: appData(stub.port), DRAW_OPTIONS_OPEN_WAIT: '5' });
  stub.server.close();
  assert.equal(r.code, 0);
  assert.equal(r.json.opened, true);
});

const specFile = (spec) => {
  const f = path.join(tmp(), 'spec.json');
  fs.writeFileSync(f, JSON.stringify(spec));
  return f;
};
const goodColumns = {
  title: 'T',
  options: [
    { name: 'A', includes: ['i'], pros: ['p'], cons: ['c'] },
    { name: 'B', includes: ['i'], pros: ['p'], cons: ['c'] },
  ],
};

test('draw: an invalid spec is refused before anything reaches the app', async () => {
  const stub = await startStub(() => ok(1));
  const bad = { title: '', options: [{ name: 'only one' }] };
  const r = await run(['draw', 'tldr:file:x', 'columns', specFile(bad)], { TLDRAW_DATA_DIR: appData(stub.port) });
  const execCalls = stub.calls.filter((c) => c.url.includes('/exec'));
  stub.server.close();
  assert.equal(r.code, 1);
  assert.equal(r.json.state, 'bad-spec');
  assert.ok(r.json.problems.length >= 2);
  assert.equal(execCalls.length, 0);
});

test('draw: a mismatched matrix row is named in the problems', async () => {
  const stub = await startStub(() => ok(1));
  const mismatched = { title: 'T', options: ['a', 'b'], criteria: [{ name: 'c', values: ['only-one'] }] };
  const r = await run(['draw', 'tldr:file:x', 'matrix', specFile(mismatched)], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.match(r.json.problems.join(' '), /exactly 2 entries/);
});

const problemsFor = async (layout, spec) => {
  const r = await run(['draw', 'tldr:file:x', layout, specFile(spec)], { TLDRAW_DATA_DIR: tmp() });
  return r.json.problems || [];
};

test('draw: validation runs before the app is contacted, so a bad spec reports bad-spec with the app closed', async () => {
  const r = await run(['draw', 'tldr:file:x', 'columns', specFile({ title: '', options: [] })], {
    TLDRAW_DATA_DIR: tmp(),
    TLDRAW_EXE: path.join(tmp(), 'missing.exe'),
  });
  assert.equal(r.json.state, 'bad-spec');
});

test('draw: every limit is enforced and named', async () => {
  const opt = (name) => ({ name, pros: ['p'], cons: ['c'] });
  const five = await problemsFor('columns', { title: 'T', options: ['a', 'b', 'c', 'd', 'e'].map(opt) });
  assert.match(five.join(' '), /2 to 4 entries; got 5/);
  const many = await problemsFor('columns', { title: 'T', options: [{ ...opt('a'), pros: Array(13).fill('x') }, opt('b')] });
  assert.match(many.join(' '), /13 items/);
  const long = await problemsFor('columns', { title: 'T', options: [{ ...opt('a'), cons: ['x'.repeat(121)] }, opt('b')] });
  assert.match(long.join(' '), /121 characters/);
  const exact = await problemsFor('columns', { title: 'T', options: [{ ...opt('a'), cons: ['x'.repeat(120)] }, opt('b')] });
  assert.deepEqual(exact, []);
  const criteria = Array.from({ length: 9 }, (_, i) => ({ name: `c${i}`, values: ['1', '2'] }));
  assert.match((await problemsFor('matrix', { title: 'T', options: ['a', 'b'], criteria })).join(' '), /1 to 8 entries/);
  assert.match((await problemsFor('matrix', { title: 'T', options: ['a', 7], criteria: [] })).join(' '), /options\[1\] must be a non-empty string/);
  assert.match((await problemsFor('matrix', { title: 'T', options: ['a', 'b'], criteria: [{ name: 'c', values: ['1', '2'] }], recommendation: 3 })).join(' '), /recommendation must be a string/);
});

test('draw: a key the layout does not use, and a recommended that is not an option name, are errors', async () => {
  const opt = (name) => ({ name, pros: ['p'], cons: ['c'] });
  const wrongLayout = await problemsFor('tree', { title: 'T', options: [{ ...opt('a'), includes: ['i'] }, opt('b')], recommended: 'a' });
  assert.match(wrongLayout.join(' '), /unknown key "recommended"/);
  assert.match(wrongLayout.join(' '), /unknown key "includes"/);
  const index = await problemsFor('columns', { title: 'T', options: [opt('a'), opt('b')], recommended: 1 });
  assert.match(index.join(' '), /name of one option/);
  const named = await problemsFor('columns', { title: 'T', options: [opt('Emailed'), opt('b')], recommended: ' emailed ' });
  assert.deepEqual(named, []);
});

test('draw: an unreadable spec file and missing arguments are reported', async () => {
  const stub = await startStub(() => ok(1));
  const env = { TLDRAW_DATA_DIR: appData(stub.port) };
  const unreadable = await run(['draw', 'tldr:file:x', 'columns', path.join(tmp(), 'nope.json')], env);
  assert.equal(unreadable.json.state, 'bad-spec');
  const bare = await run(['draw'], env);
  assert.equal(bare.json.state, 'usage');
  const finishBare = await run(['finish'], env);
  assert.equal(finishBare.json.state, 'usage');
  const unknown = await run(['toString'], env);
  assert.equal(unknown.json.state, 'usage');
  stub.server.close();
});

test('draw: matrix and tree specs are posted with their own builder', async () => {
  const stub = await startStub((c) => (c.url.includes('/exec') ? ok({ shapes: 1 }) : ok(1)));
  const env = { TLDRAW_DATA_DIR: appData(stub.port) };
  const matrix = { title: 'T', options: ['a', 'b'], criteria: [{ name: 'c', values: ['1', '2'] }] };
  const tree = { title: 'T', options: [{ name: 'a', then: ['next'] }, { name: 'b' }] };
  assert.equal((await run(['draw', 'tldr:file:m', 'matrix', specFile(matrix)], env)).code, 0);
  assert.equal((await run(['draw', 'tldr:file:t', 'tree', specFile(tree)], env)).code, 0);
  const bodies = stub.calls.filter((c) => c.url.includes('/exec')).map((c) => c.body);
  stub.server.close();
  assert.match(bodies[0], /return complete\(\{ layout: 'matrix'/);
  assert.match(bodies[1], /return complete\(\{ layout: 'tree'/);
});

test('draw: a valid spec posts SPEC plus the builders to the unescaped doc route', async () => {
  const stub = await startStub((c) => (c.url.includes('/exec') ? ok({ shapes: 14, lints: 0 }) : ok(1)));
  const r = await run(['draw', 'tldr:file:abc', 'columns', specFile(goodColumns)], { TLDRAW_DATA_DIR: appData(stub.port) });
  const exec = stub.calls.find((c) => c.url.includes('/exec'));
  stub.server.close();
  assert.equal(r.code, 0);
  assert.equal(exec.url, '/api/doc/tldr:file:abc/exec');
  assert.match(exec.body, /^const SPEC = \{"title":"T"/);
  assert.match(exec.body, /const complete = /);
  assert.match(exec.body, /return complete\(\{ layout: 'columns'/);
});

test('draw: a layout failure reported by the app is surfaced, not swallowed', async () => {
  const stub = await startStub((c) =>
    c.url.includes('/exec') ? { status: 200, json: { success: false, error: 'layout lints remain (shorten the longest label)' } } : ok(1)
  );
  const r = await run(['draw', 'tldr:file:abc', 'columns', specFile(goodColumns)], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 1);
  assert.match(r.json.message, /layout lints remain/);
});

test('draw: an unknown layout is a usage error', async () => {
  const stub = await startStub(() => ok(1));
  const r = await run(['draw', 'tldr:file:x', 'pie', specFile(goodColumns)], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 1);
  assert.equal(r.json.state, 'usage');
});

const finishStub = (docs, screenshot = { filePath: 'shot.jpg' }) =>
  startStub((c) => {
    if (c.url === '/api/search') {
      if (c.body.includes('getDocs')) return ok(docs);
      if (c.body.includes('getScreenshot')) return ok(screenshot);
      return ok(1);
    }
    if (c.body.includes('getLints')) return ok(0);
    return ok(true);
  });

test('finish: saves, reports bytes, lints and the screenshot path', async () => {
  const file = path.join(tmp(), 'done.tldraw');
  fs.writeFileSync(file, 'x'.repeat(2048));
  const stub = await finishStub([{ id: 'tldr:file:d', filePath: file }]);
  const r = await run(['finish', 'tldr:file:d'], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.equal(r.code, 0);
  assert.equal(r.json.bytes, 2048);
  assert.equal(r.json.lints, 0);
  assert.equal(r.json.screenshot, 'shot.jpg');
  assert.equal(r.json.sizeWarning, null);
  assert.ok(stub.calls.some((c) => c.body.includes('saveDoc')));
});

test('finish: a file over 1 MB carries a size warning', async () => {
  const file = path.join(tmp(), 'big.tldraw');
  fs.writeFileSync(file, Buffer.alloc(1024 * 1024 + 1));
  const stub = await finishStub([{ id: 'tldr:file:b', filePath: file }]);
  const r = await run(['finish', 'tldr:file:b'], { TLDRAW_DATA_DIR: appData(stub.port) });
  stub.server.close();
  assert.match(r.json.sizeWarning, /over 1 MB/);
});

test('finish: a document that is gone, or never saved, is refused without saving', async () => {
  const gone = await finishStub([{ id: 'tldr:file:other', filePath: 'x' }]);
  const a = await run(['finish', 'tldr:file:d'], { TLDRAW_DATA_DIR: appData(gone.port) });
  gone.server.close();
  assert.equal(a.code, 5);
  const unsaved = await finishStub([{ id: 'tldr:untitled:u', filePath: null }]);
  const b = await run(['finish', 'tldr:untitled:u'], { TLDRAW_DATA_DIR: appData(unsaved.port) });
  unsaved.server.close();
  assert.equal(b.code, 6);
  assert.ok(!unsaved.calls.some((c) => c.body.includes('saveDoc')));
});

test('list and remove: oldest first, and remove refuses anything unsafe', async () => {
  const dir = tmp();
  const oldFile = path.join(dir, 'old.tldraw');
  fs.writeFileSync(oldFile, 'aa');
  fs.writeFileSync(path.join(dir, 'new.tldraw'), 'b');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'c');
  const past = new Date(Date.now() - 10 * 86400000);
  fs.utimesSync(oldFile, past, past);

  const listed = await run(['list', '--dir', dir], {});
  assert.deepEqual(listed.json.files.map((f) => f.file), ['old.tldraw', 'new.tldraw']);
  assert.equal(listed.json.files[0].ageDays, 10);
  assert.equal(listed.json.totalBytes, 3);

  const noYes = await run(['remove', 'old.tldraw', '--dir', dir], {});
  assert.equal(noYes.json.state, 'needs-yes');
  assert.ok(fs.existsSync(oldFile));
  const outside = await run(['remove', '../escape.tldraw', '--yes', '--dir', dir], {});
  assert.equal(outside.json.state, 'refused');
  const wrongExt = await run(['remove', 'notes.txt', '--yes', '--dir', dir], {});
  assert.equal(wrongExt.json.state, 'refused');
  assert.ok(fs.existsSync(path.join(dir, 'notes.txt')));

  const removed = await run(['remove', 'old.tldraw', '--yes', '--dir', dir], {});
  assert.equal(removed.code, 0);
  assert.ok(!fs.existsSync(oldFile));
});

test('remove: a link inside the folder that points outside it is refused', async () => {
  const dir = tmp();
  const outside = tmp();
  const victim = path.join(outside, 'keep.tldraw');
  fs.writeFileSync(victim, 'x');
  fs.symlinkSync(outside, path.join(dir, 'link'), 'junction');
  const r = await run(['remove', 'link/keep.tldraw', '--yes', '--dir', dir], {});
  assert.equal(r.json.state, 'refused');
  assert.ok(fs.existsSync(victim));
});

test('remove: a file whose name merely starts with two dots is allowed', async () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, '..odd.tldraw'), 'x');
  const r = await run(['remove', '..odd.tldraw', '--yes', '--dir', dir], {});
  assert.equal(r.code, 0);
});

test('remove: a missing file is reported, and --yes may come before the file name', async () => {
  const dir = tmp();
  const missing = await run(['remove', 'ghost.tldraw', '--yes', '--dir', dir], {});
  assert.equal(missing.json.state, 'missing');
  fs.writeFileSync(path.join(dir, 'real.tldraw'), 'x');
  const removed = await run(['remove', '--yes', 'real.tldraw', '--dir', dir], {});
  assert.equal(removed.code, 0);
});

test('list: a folder that does not exist yet is an empty list, not an error', async () => {
  const r = await run(['list', '--dir', path.join(tmp(), 'nope')], {});
  assert.equal(r.code, 0);
  assert.deepEqual(r.json.files, []);
});

const readAsset = (n) => fs.readFileSync(path.join(SKILL, 'assets', `${n}.js`), 'utf8');

const runLayout = async (layout, spec, { existing = [], lints = () => [], mermaidShapes = 3 } = {}) => {
  const shapes = existing.map((s) => ({ parentId: 'page:page', ...s }));
  let seq = 0;
  const boundsOf = (s) => ({ minX: s.x, minY: s.y, maxX: s.x + (s.props?.w ?? 300), maxY: s.y + (s.props?.h ?? 50) });
  const editor = {
    createShape: (s) => shapes.push({ parentId: 'page:page', ...s }),
    getCurrentPageShapes: () => shapes,
    getCurrentPageId: () => 'page:page',
    getShape: (id) => shapes.find((s) => s.id === id),
    getShapePageBounds: (id) => boundsOf(shapes.find((s) => s.id === id)),
    updateShapes: (updates) => updates.forEach((u) => Object.assign(shapes.find((s) => s.id === u.id).props, u.props)),
  };
  const helpers = {
    getLints: () => ({ lints: lints(shapes) }),
    mermaid: async (source) => {
      helpers.source = source;
      for (let i = 0; i < mermaidShapes; i++) {
        shapes.push({ id: `shape:tree${i}`, type: 'geo', parentId: 'page:page', x: 500 + i * 120, y: 900 + i * 60, props: { w: 100, h: 40 } });
      }
    },
    translateShapes: (ids, dx, dy) => ids.forEach((id) => {
      const s = shapes.find((x) => x.id === id);
      s.x += dx;
      s.y += dy;
    }),
  };
  const fakeTldraw = { toRichText: (t) => ({ text: t }), createShapeId: () => `shape:n${++seq}` };
  const code = `const SPEC = ${JSON.stringify(spec)}\n${readAsset('common')}\n${readAsset(layout)}`.replace("await import('tldraw')", 'FAKE_TLDRAW');
  const result = await new AsyncFunction('editor', 'helpers', 'FAKE_TLDRAW', code)(editor, helpers, fakeTldraw);
  return { result, shapes, helpers };
};

const overlaps = (a, b) => a.x < b.x + b.props.w && b.x < a.x + a.props.w && a.y < b.y + b.props.h && b.y < a.y + a.props.h;
const geoPairsOverlapping = (shapes) => {
  const geos = shapes.filter((s) => s.type === 'geo' && s.props.richText);
  const hits = [];
  geos.forEach((a, i) => geos.slice(i + 1).forEach((b) => overlaps(a, b) && hits.push([a.props.richText.text, b.props.richText.text])));
  return hits;
};

const colSpec = (n, pros = ['Short pro']) => ({
  title: 'T',
  question: 'Q?',
  options: Array.from({ length: n }, (_, i) => ({
    name: `Option ${i}`,
    includes: ['A fairly long line that has to wrap onto a second and a third line inside the card'],
    pros,
    cons: ['c'],
  })),
});

test('columns builder: 2, 3 and 4 options never overlap, whatever the text length', async () => {
  for (const n of [2, 3, 4]) {
    for (const pros of [['x'], Array.from({ length: 12 }, () => 'y'.repeat(100))]) {
      const { shapes, result } = await runLayout('columns', colSpec(n, pros));
      assert.deepEqual(geoPairsOverlapping(shapes), [], `${n} options overlap`);
      assert.equal(result.options, n);
    }
  }
});

test('columns builder: card heights are never below what the real app needed for the same text', async () => {
  const { shapes } = await runLayout('columns', {
    title: 'T',
    options: [
      { name: 'Short', includes: ['one', 'two', 'three'], pros: ['one'], cons: ['one'] },
      { name: 'Other', includes: ['one', 'two', 'three'], pros: ['one'], cons: ['one'] },
    ],
  });
  const card = (prefix) => shapes.find((s) => s.props.richText && s.props.richText.text.startsWith(prefix));
  assert.ok(card('1 · Short').props.h >= 62, 'a one-line medium header needed 62 in the app');
  assert.ok(card('Pros').props.h >= 2 * 24 + 32, 'two lines of small text need 80');
  const measured = {
    title: 'T',
    options: [
      { name: 'A', includes: ['Export button on the report page', 'CSV download in the browser', 'Respects the current filters'], pros: ['p'], cons: ['c'] },
      { name: 'B', includes: ['x'], pros: ['p'], cons: ['c'] },
    ],
  };
  const wrapped = await runLayout('columns', measured);
  const includes = wrapped.shapes.find((s) => s.props.richText && s.props.richText.text.startsWith('Includes'));
  assert.ok(includes.props.h >= 200, 'seven lines of small text fit exactly 200 in the app');
});

test('columns builder: a second layout stacks below what is already on the page, and recommended is matched by name', async () => {
  const existing = [{ id: 'shape:old', type: 'geo', x: 0, y: 0, props: { w: 400, h: 300 } }];
  const spec = { ...colSpec(2), recommended: 'option 1' };
  const { shapes } = await runLayout('columns', spec, { existing });
  const fresh = shapes.filter((s) => s.id !== 'shape:old');
  assert.ok(Math.min(...fresh.map((s) => s.y)) >= 300 + 140);
  const titles = fresh.filter((s) => s.props.richText).map((s) => s.props.richText.text);
  assert.ok(titles.includes('2 · Option 1 (recommended)'));
  assert.ok(!titles.some((t) => t.startsWith('1 · Option 0 (')));
});

test('matrix builder: rows and cells never overlap, with long cells and long labels', async () => {
  const spec = {
    title: 'T',
    options: ['One', 'Two', 'Three'],
    criteria: [
      { name: 'Handles very large reports without timing out', values: ['No', 'A value long enough to wrap onto several lines in its cell', 'Yes'] },
      { name: 'Cost', values: ['1', '2', '3'] },
    ],
    recommendation: 'A recommendation that is long enough to need a second line inside its box at this width.',
  };
  const { shapes, result } = await runLayout('matrix', spec);
  assert.deepEqual(geoPairsOverlapping(shapes), []);
  assert.equal(result.criteria, 2);
});

test('tree builder: leaves cover pro, con and then; the diagram lands left-aligned under its heading', async () => {
  const spec = { title: 'T', options: [{ name: 'A', pros: ['p'], cons: ['c'], then: ['n'] }, { name: 'B' }] };
  const { helpers, shapes } = await runLayout('tree', spec);
  assert.match(helpers.source, /O0 --> O0_0\["Pro: p"\]/);
  assert.match(helpers.source, /O0 --> O0_1\["Con: c"\]/);
  assert.match(helpers.source, /O0 --> O0_2\["Then: n"\]/);
  const tree = shapes.filter((s) => s.id.startsWith('shape:tree'));
  assert.equal(Math.min(...tree.map((s) => s.x)), 0);
});

test('tree builder: an engine that draws nothing is a failure, and angle brackets and quotes are removed from labels', async () => {
  const spec = { title: 'T', options: [{ name: 'A <b>"x"</b>' }, { name: 'B' }] };
  await assert.rejects(runLayout('tree', spec, { mermaidShapes: 0 }), /produced no shapes/);
  const { helpers } = await runLayout('tree', spec);
  assert.match(helpers.source, /O0\["A b'x'\/b"\]/);
});

test('builders: a lint on a shape they did not make is ignored, one on their own shape is a failure', async () => {
  const foreign = () => [{ type: 'overlapping-text', shapeIds: ['somebody-elses'], message: 'x' }];
  const ok = await runLayout('columns', colSpec(2), { lints: foreign });
  assert.equal(ok.result.lints, 0);
  const own = (shapes) => [{ type: 'overlapping-text', shapeIds: [shapes.find((s) => s.type === 'geo').id.replace('shape:', '')], message: 'mine' }];
  await assert.rejects(runLayout('columns', colSpec(2), { lints: own }), /layout lints remain/);
});

test('assets: common plus every layout parse as an async function body', () => {
  const common = fs.readFileSync(path.join(SKILL, 'assets', 'common.js'), 'utf8');
  for (const layout of ['columns', 'matrix', 'tree']) {
    const body = fs.readFileSync(path.join(SKILL, 'assets', `${layout}.js`), 'utf8');
    assert.doesNotThrow(() => new AsyncFunction('SPEC', 'editor', 'helpers', common + '\n' + body), `${layout} failed to parse`);
  }
});

test('skill: carries no comments in scripts and no machine-specific paths', () => {
  const files = [
    path.join(SKILL, 'scripts', 'oc.mjs'),
    ...['common', 'columns', 'matrix', 'tree'].map((n) => path.join(SKILL, 'assets', `${n}.js`)),
    path.join(SKILL, 'SKILL.md'),
    path.join(SKILL, 'references', 'protocol.md'),
  ];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /C:[\\/]+Users[\\/]/i, `${f} carries a user path`);
    assert.doesNotMatch(text, /tldraw-offline/, `${f} names another skill`);
    if (f.endsWith('.js') || f.endsWith('.mjs')) assert.doesNotMatch(text, /^\s*\/\/|\/\*/m, `${f} has a comment`);
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'skills', 'session-retro', 'scripts', 'retro.mjs');

const made = [];
const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-test-'));
  made.push(dir);
  return dir;
};
test.after(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const makeHome = () => {
  const home = path.join(tmp(), '.claude');
  fs.mkdirSync(path.join(home, 'projects'), { recursive: true });
  return home;
};

const retro = (home, args, input) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, SESSION_RETRO_HOME: home },
    input: input === undefined ? '' : typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });

const jsonl = (file, records) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
};

const userMsg = (text, extra = {}) => ({ type: 'user', cwd: '/work/app', message: { content: text }, ...extra });
const skillCall = (skill) => ({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill } }] },
});
const assistantText = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const toolResult = (text) => ({
  type: 'user',
  message: { content: [{ type: 'tool_result', content: text }] },
});

const link = (target, at) => {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at, process.platform === 'win32' ? 'junction' : 'dir');
};

const writeTranscript = (home, id, records, project = 'proj') => {
  const file = path.join(home, 'projects', project, `${id}.jsonl`);
  jsonl(file, records);
  return file;
};

const markers = (home) => JSON.parse(retro(home, ['pending']).stdout);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('hook-end writes no marker for a short session that used no skill', () => {
  const home = makeHome();
  const file = writeTranscript(home, 'short', [userMsg('hello'), assistantText('hi')]);
  const r = retro(home, ['hook-end'], { session_id: 'short', transcript_path: file, cwd: '/work/app' });
  assert.equal(r.status, 0);
  assert.deepEqual(markers(home), []);
});

test('hook-end writes a marker when a skill was used and stores names, never conversation text', () => {
  const home = makeHome();
  const sentinel = 'sentinel-phrase-zq81';
  const file = writeTranscript(home, 'abc', [
    userMsg(`please do the thing ${sentinel}`),
    skillCall('lint-and-stage'),
    skillCall('lint-and-stage'),
    toolResult(`rows: ${sentinel}`),
  ]);
  retro(home, ['hook-end'], { session_id: 'abc', transcript_path: file, cwd: '/work/app', reason: 'other' });
  const [marker] = markers(home);
  assert.equal(marker.sessionId, 'abc');
  assert.equal(marker.nudged, false);
  assert.equal(marker.skills[0].name, 'lint-and-stage');
  assert.equal(marker.skills[0].uses, 2);
  const raw = fs.readFileSync(path.join(home, 'session-retro-pending', 'abc.json'), 'utf8');
  assert.ok(!raw.includes(sentinel));
});

test('hook-end writes a marker for a long session with no skill, honoring SESSION_RETRO_MIN_TURNS', () => {
  const home = makeHome();
  const records = Array.from({ length: 9 }, (_, i) => userMsg(`turn ${i}`));
  const file = writeTranscript(home, 'long', records);
  retro(home, ['hook-end'], { session_id: 'long', transcript_path: file });
  assert.equal(markers(home).length, 1);

  const other = makeHome();
  const f2 = writeTranscript(other, 'long', records);
  spawnSync(process.execPath, [SCRIPT, 'hook-end'], {
    env: { ...process.env, SESSION_RETRO_HOME: other, SESSION_RETRO_MIN_TURNS: '20' },
    input: JSON.stringify({ session_id: 'long', transcript_path: f2 }),
    encoding: 'utf8',
  });
  assert.deepEqual(markers(other), []);
});

test('turn count ignores meta, sidechain, tool-result and injected-tag user entries', () => {
  const home = makeHome();
  const records = [
    ...Array.from({ length: 7 }, (_, i) => userMsg(`real ${i}`)),
    userMsg('meta text', { isMeta: true }),
    userMsg('side text', { isSidechain: true }),
    userMsg('<system-reminder>injected</system-reminder>'),
    toolResult('output'),
  ];
  const file = writeTranscript(home, 'turns', records);
  retro(home, ['hook-end'], { session_id: 'turns', transcript_path: file });
  assert.deepEqual(markers(home), []);
});

test('hook-end locates the transcript by session id when the path is missing', () => {
  const home = makeHome();
  writeTranscript(home, 'byid', [userMsg('x'), skillCall('lint-and-stage')], 'some-project');
  retro(home, ['hook-end'], { session_id: 'byid', transcript_path: path.join(home, 'gone.jsonl') });
  assert.equal(markers(home).length, 1);
});

test('hook-end refuses an unsafe session id and writes nothing outside the pending folder', () => {
  const home = makeHome();
  const file = writeTranscript(home, 'real-id', [userMsg('x'), skillCall('lint-and-stage')]);
  retro(home, ['hook-end'], { session_id: '../../escape', transcript_path: file });
  assert.equal(fs.existsSync(path.join(home, 'escape.json')), false);
  assert.deepEqual(markers(home).map((m) => m.sessionId), ['real-id']);
});

test('hooks exit 0 and write nothing on garbage or empty stdin', () => {
  const home = makeHome();
  for (const input of ['', 'not json', '{"transcript_path": 5}']) {
    assert.equal(retro(home, ['hook-end'], input).status, 0);
    const start = retro(home, ['hook-start'], input);
    assert.equal(start.status, 0);
    assert.equal(start.stdout, '');
  }
  assert.deepEqual(markers(home), []);
});

test('hook-end prunes markers older than 14 days', () => {
  const home = makeHome();
  const dir = path.join(home, 'session-retro-pending');
  fs.mkdirSync(dir, { recursive: true });
  const old = path.join(dir, 'old.json');
  fs.writeFileSync(old, JSON.stringify({ sessionId: 'old', skills: [], nudged: true }));
  const past = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  fs.utimesSync(old, past, past);
  const file = writeTranscript(home, 'new', [userMsg('x'), skillCall('lint-and-stage')]);
  retro(home, ['hook-end'], { session_id: 'new', transcript_path: file });
  assert.equal(fs.existsSync(old), false);
  assert.equal(markers(home).length, 1);
});

test('inventory classifies junctioned, standalone-copy, plugin-installed and not-found', () => {
  const home = makeHome();
  const source = path.join(tmp(), 'source-skill');
  fs.mkdirSync(source, { recursive: true });
  link(source, path.join(home, 'skills', 'linked-skill'));
  fs.mkdirSync(path.join(home, 'skills', 'copied-skill'), { recursive: true });
  const version = path.join(home, 'plugins', 'cache', 'mkt', 'tool', '1.2.0');
  fs.mkdirSync(path.join(version, 'skills', 'plug-skill'), { recursive: true });
  writeJson(path.join(home, 'plugins', 'known_marketplaces.json'), { mkt: { source: { path: '/repos/mkt' } } });
  const file = writeTranscript(home, 'inv', [
    skillCall('linked-skill'),
    skillCall('copied-skill'),
    skillCall('tool:plug-skill'),
    skillCall('missing-skill'),
    skillCall('../../etc/passwd'),
  ]);
  const out = JSON.parse(retro(home, ['inventory', '--transcript', file, '--cwd', os.tmpdir()]).stdout);
  const kind = Object.fromEntries(out.skills.map((s) => [s.name, s]));
  assert.equal(kind['linked-skill'].kind, 'junctioned');
  assert.ok(kind['linked-skill'].target);
  assert.equal(kind['copied-skill'].kind, 'standalone-copy');
  assert.equal(kind['tool:plug-skill'].kind, 'plugin-installed');
  assert.equal(kind['tool:plug-skill'].source, '/repos/mkt');
  assert.equal(kind['tool:plug-skill'].version, '1.2.0');
  assert.equal(kind['missing-skill'].kind, 'not-found');
  assert.equal(kind['../../etc/passwd'].kind, 'not-found');
});

test('inventory sees a project-scoped skill under the transcript cwd', () => {
  const home = makeHome();
  const project = tmp();
  fs.mkdirSync(path.join(project, '.claude', 'skills', 'local-skill'), { recursive: true });
  const file = writeTranscript(home, 'proj-skill', [{ ...skillCall('local-skill'), cwd: project }]);
  const out = JSON.parse(retro(home, ['inventory', '--transcript', file]).stdout);
  assert.equal(out.skills[0].kind, 'standalone-copy');
});

const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
};

test('hook-start nudges once, names the skills, and never on compact or for its own session', () => {
  const home = makeHome();
  const file = writeTranscript(home, 'old1', [userMsg('x'), skillCall('lint-and-stage')]);
  retro(home, ['hook-end'], { session_id: 'old1', transcript_path: file });

  assert.equal(retro(home, ['hook-start'], { source: 'compact', session_id: 'next' }).stdout, '');
  assert.equal(retro(home, ['hook-start'], { source: 'startup', session_id: 'old1' }).stdout, '');

  const first = retro(home, ['hook-start'], { source: 'startup', session_id: 'next' });
  const parsed = JSON.parse(first.stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(parsed.hookSpecificOutput.additionalContext, /lint-and-stage/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /unless the user says yes/);
  assert.equal(markers(home)[0].nudged, true);

  assert.equal(retro(home, ['hook-start'], { source: 'startup', session_id: 'later' }).stdout, '');
});

test('clear removes one marker, or all with --all, and refuses an unsafe id', () => {
  const home = makeHome();
  for (const id of ['a1', 'b2']) {
    const f = writeTranscript(home, id, [userMsg('x'), skillCall('lint-and-stage')]);
    retro(home, ['hook-end'], { session_id: id, transcript_path: f });
  }
  assert.equal(retro(home, ['clear', '--session', '../a1']).status, 1);
  retro(home, ['clear', '--session', 'a1']);
  assert.deepEqual(markers(home).map((m) => m.sessionId), ['b2']);
  retro(home, ['clear', '--all']);
  assert.deepEqual(markers(home), []);
});

test('digest keeps prose and tool names, drops tool output, and masks emails, ips and the home folder', () => {
  const home = makeHome();
  const file = writeTranscript(home, 'dig', [
    userMsg(`mail me at someone@example.com from 203.0.113.9 and look in ${os.homedir()}/notes`),
    assistantText('done'),
    toolResult('ROW-DATA-should-not-appear'),
    skillCall('lint-and-stage'),
    userMsg('<system-reminder>injected text</system-reminder>'),
  ]);
  const out = retro(home, ['digest', '--transcript', file]).stdout;
  assert.match(out, /USER: mail me at <email> from <ip> and look in ~/);
  assert.match(out, /ASSISTANT: done/);
  assert.match(out, /\[tool: Skill lint-and-stage\]/);
  assert.ok(!out.includes('ROW-DATA'));
  assert.ok(!out.includes('injected text'));
  assert.ok(!out.includes('someone@example.com'));
  assert.ok(!out.includes('203.0.113.9'));
});

test('inventory and digest fail with a message when there is no transcript', () => {
  const home = makeHome();
  const r = retro(home, ['digest', '--cwd', path.join(tmp(), 'nowhere')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no transcript found/);
});

const hooksOf = (data) => ({
  start: data.hooks.SessionStart,
  end: data.hooks.SessionEnd,
});

test('install-hooks is a dry run by default and writes nothing', () => {
  const home = makeHome();
  const settings = path.join(home, 'settings.json');
  const r = retro(home, ['install-hooks']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /dry run: nothing written/);
  assert.match(r.stdout, /SessionStart\s+add/);
  assert.match(r.stdout, /SessionEnd\s+add/);
  assert.equal(fs.existsSync(settings), false);
});

test('install-hooks --apply creates the file, uses forward slashes, and verifies by read-back', () => {
  const home = makeHome();
  const r = retro(home, ['install-hooks', '--apply']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /read-back: verified/);
  const data = readJson(path.join(home, 'settings.json'));
  const { start, end } = hooksOf(data);
  assert.equal(start[0].matcher, 'startup|resume|clear');
  assert.equal(end[0].matcher, undefined);
  const command = start[0].hooks[0].command;
  assert.match(command, /^node "[^"\\]+session-retro\/scripts\/retro\.mjs" hook-start$/);
  assert.match(end[0].hooks[0].command, / hook-end$/);
  assert.equal(start[0].hooks[0].type, 'command');
  assert.ok(start[0].hooks[0].timeout > 0);
});

test('install-hooks --apply keeps other settings and hooks, the existing CRLF and tab indentation, and backs up', () => {
  const home = makeHome();
  const settings = path.join(home, 'settings.json');
  const original = {
    model: 'x',
    hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'echo other' }] }], PreToolUse: [{ hooks: [{ type: 'command', command: 'guard' }] }] },
  };
  fs.writeFileSync(settings, JSON.stringify(original, null, '\t').replace(/\n/g, '\r\n') + '\r\n');
  const r = retro(home, ['install-hooks', '--apply']);
  assert.equal(r.status, 0);
  const raw = fs.readFileSync(settings, 'utf8');
  assert.ok(raw.includes('\r\n'));
  assert.ok(!/[^\r]\n/.test(raw));
  assert.match(raw, /\n\t"model"|\r\n\t"model"/);
  const data = JSON.parse(raw);
  assert.equal(data.model, 'x');
  assert.equal(data.hooks.PreToolUse[0].hooks[0].command, 'guard');
  assert.equal(data.hooks.SessionStart.length, 2);
  assert.equal(data.hooks.SessionStart[0].hooks[0].command, 'echo other');
  const backups = fs.readdirSync(home).filter((f) => f.startsWith('settings.json.session-retro.bak-'));
  assert.equal(backups.length, 1);
  assert.deepEqual(readJson(path.join(home, backups[0])), original);
});

test('install-hooks is idempotent and reports unchanged without writing a second backup', () => {
  const home = makeHome();
  retro(home, ['install-hooks', '--apply']);
  const before = fs.readFileSync(path.join(home, 'settings.json'), 'utf8');
  const r = retro(home, ['install-hooks', '--apply']);
  assert.match(r.stdout, /unchanged/);
  assert.match(r.stdout, /nothing to change/);
  assert.equal(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'), before);
  assert.equal(fs.readdirSync(home).filter((f) => f.includes('.bak-')).length, 0);
});

test('install-hooks updates the path in place when the skill folder moved', () => {
  const home = makeHome();
  const settings = path.join(home, 'settings.json');
  writeJson(settings, {
    hooks: {
      SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'node "/old/place/session-retro/scripts/retro.mjs" hook-start', timeout: 3 }] }],
    },
  });
  const r = retro(home, ['install-hooks', '--apply']);
  assert.match(r.stdout, /SessionStart\s+update/);
  const data = readJson(settings);
  assert.equal(data.hooks.SessionStart.length, 1);
  assert.ok(!data.hooks.SessionStart[0].hooks[0].command.includes('/old/place'));
  assert.equal(data.hooks.SessionEnd.length, 1);
});

test('install-hooks refuses invalid JSON and an unknown hooks shape and leaves the file untouched', () => {
  const home = makeHome();
  const settings = path.join(home, 'settings.json');
  fs.writeFileSync(settings, '{ "model": ');
  const bad = retro(home, ['install-hooks', '--apply']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /not valid JSON/);
  assert.equal(fs.readFileSync(settings, 'utf8'), '{ "model": ');

  fs.writeFileSync(settings, JSON.stringify({ hooks: { SessionEnd: 'nope' } }));
  const shape = retro(home, ['install-hooks', '--apply']);
  assert.equal(shape.status, 1);
  assert.match(shape.stderr, /shape/);
  assert.equal(fs.readFileSync(settings, 'utf8'), JSON.stringify({ hooks: { SessionEnd: 'nope' } }));
  assert.equal(fs.readdirSync(home).filter((f) => f.includes('.bak-')).length, 0);
});

test('uninstall-hooks removes only its own entries and prunes what it emptied', () => {
  const home = makeHome();
  const settings = path.join(home, 'settings.json');
  writeJson(settings, { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo other' }] }] } });
  retro(home, ['install-hooks', '--apply']);
  assert.equal(readJson(settings).hooks.SessionStart.length, 2);

  const dry = retro(home, ['uninstall-hooks']);
  assert.match(dry.stdout, /dry run/);
  assert.equal(readJson(settings).hooks.SessionStart.length, 2);

  const r = retro(home, ['uninstall-hooks', '--apply']);
  assert.match(r.stdout, /read-back: verified/);
  const data = readJson(settings);
  assert.deepEqual(data.hooks.SessionStart, [{ hooks: [{ type: 'command', command: 'echo other' }] }]);
  assert.equal(data.hooks.SessionEnd, undefined);

  const again = retro(home, ['uninstall-hooks', '--apply']);
  assert.match(again.stdout, /no session-retro hooks found/);
});

test('uninstall-hooks drops an emptied hooks section', () => {
  const home = makeHome();
  retro(home, ['install-hooks', '--apply']);
  retro(home, ['uninstall-hooks', '--apply']);
  assert.deepEqual(readJson(path.join(home, 'settings.json')), {});
});

test('--scope project targets .claude/settings.local.json under --cwd; --settings targets a named file; a bad scope fails', () => {
  const home = makeHome();
  const project = tmp();
  retro(home, ['install-hooks', '--apply', '--scope', 'project', '--cwd', project]);
  assert.ok(fs.existsSync(path.join(project, '.claude', 'settings.local.json')));
  assert.equal(fs.existsSync(path.join(home, 'settings.json')), false);

  const named = path.join(tmp(), 'named.json');
  retro(home, ['install-hooks', '--apply', '--settings', named]);
  assert.ok(fs.existsSync(named));

  const r = retro(home, ['install-hooks', '--scope', 'galaxy']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--scope must be/);
});

test('the script carries no comments and no machine-specific path', () => {
  const text = fs.readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(text, /(^|\s)\/\/\s/m);
  assert.doesNotMatch(text, /\/\*/);
  assert.doesNotMatch(text, /C:\\Users|\/Users\/|\/home\//);
});

test('a bare invocation or unknown command prints usage and exits 1', () => {
  const home = makeHome();
  const r = retro(home, ['nope']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: retro\.mjs/);
});

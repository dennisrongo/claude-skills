'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

process.env.CONTEXT_DIET_SETTLE_MS = '10';

const SKILL = path.join(__dirname, '..', 'skills', 'context-diet');
const DIET = path.join(SKILL, 'scripts', 'diet.mjs');
const lib = (name) => import(pathToFileURL(path.join(SKILL, 'scripts', 'lib', name)).href);

const made = [];
const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diet-test-'));
  made.push(dir);
  return dir;
};
test.after(() => made.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
};
const jsonl = (file, records) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
};

const makeHome = () => {
  const home = path.join(tmp(), '.claude');
  fs.mkdirSync(path.join(home, 'projects'), { recursive: true });
  process.env.CONTEXT_DIET_HOME = home;
  return home;
};

const attachment = (a) => ({ type: 'attachment', attachment: a });

const loaded = ({ skills = [], agents = [], mcp = [], hooks = [] } = {}) => [
  attachment({
    type: 'skill_listing',
    isInitial: true,
    skillCount: skills.length,
    names: skills.map((s) => s.name),
    content: skills.map((s) => (s.bare ? `- ${s.name}` : `- ${s.name}: ${s.desc || 'does a thing'}`)).join('\n'),
  }),
  attachment({
    type: 'agent_listing_delta',
    isInitial: true,
    addedTypes: agents.map((a) => a.name),
    addedLines: agents.map((a) => `- ${a.name}: ${a.desc || 'an agent'}`),
    removedTypes: [],
    builtInTypes: [],
  }),
  attachment({
    type: 'mcp_instructions_delta',
    addedNames: mcp.map((m) => m.name),
    addedBlocks: mcp.map((m) => m.block || `## ${m.name}\nhow to use`),
    removedNames: [],
  }),
  ...hooks.map((h) =>
    attachment({
      type: 'hook_success',
      hookEvent: h.event || 'SessionStart',
      hookName: `${h.event || 'SessionStart'}:startup`,
      command: h.command,
      stdout: h.out || '',
      content: '',
      exitCode: 0,
    })
  ),
];

const did = {
  skill: (name) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: name } }] } }),
  agent: (type) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: type } }] } }),
  mcp: (server) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: `mcp__${server}__do_thing`, input: {} }] } }),
  slash: (name) => ({ type: 'user', message: { content: `<command-name>/${name}</command-name>` } }),
};

const addSession = (home, { id, project = 'proj-a', cwd = path.join(home, 'work-a'), ts = '2026-09-01T10:00:00.000Z', records = [], sub = [] }) => {
  const stamp = (r) => ({ sessionId: id, cwd, timestamp: ts, ...r });
  jsonl(path.join(home, 'projects', project, `${id}.jsonl`), records.map(stamp));
  sub.forEach((recs, i) => jsonl(path.join(home, 'projects', project, id, 'subagents', `agent-${i}.jsonl`), recs.map(stamp)));
};

const addPlugin = (home, { id, short, hooks, manifestHooks, hooksJsonText }) => {
  const root = path.join(home, 'plugins', 'cache', id.replace('@', '-'), '1.0.0');
  writeJson(path.join(root, '.claude-plugin', 'plugin.json'), manifestHooks === undefined ? { name: short } : { name: short, hooks: manifestHooks });
  if (hooks) writeJson(path.join(root, 'hooks', 'hooks.json'), { hooks });
  if (hooksJsonText !== undefined) {
    fs.mkdirSync(path.join(root, 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(root, 'hooks', 'hooks.json'), hooksJsonText);
  }
  const file = path.join(home, 'plugins', 'installed_plugins.json');
  const current = fs.existsSync(file) ? readJson(file) : { version: 2, plugins: {} };
  current.plugins[id] = [{ scope: 'user', installPath: root, version: '1.0.0' }];
  writeJson(file, current);
  return root;
};

const writeSettings = (home, settings) => writeJson(path.join(home, 'settings.json'), settings);

const runDiet = (args, env = {}) =>
  new Promise((resolve) => {
    execFile(process.execPath, [DIET, ...args], { env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, stdout, stderr });
    });
  });

test('paths follow CONTEXT_DIET_HOME and keep state under the tool folder', async () => {
  const home = makeHome();
  const p = await lib('paths.mjs');
  assert.equal(p.claudeHome(), home);
  assert.equal(p.projectsDir(), path.join(home, 'projects'));
  assert.equal(p.stateDir(), path.join(home, 'context-diet'));
  assert.equal(p.quarantineDir(), path.join(home, 'context-diet', 'quarantine'));
});

test('transcripts: listing, bare-name lines, usage evidence and the subagent rule', async () => {
  const home = makeHome();
  addSession(home, {
    id: 's1',
    records: [
      ...loaded({
        skills: [{ name: 'skill-x', desc: 'x does x' }, { name: 'plug-a:skill-y' }, { name: 'trimmed-one', bare: true }],
        agents: [{ name: 'plug-a:agent-z' }, { name: 'Explore' }],
        mcp: [{ name: 'plugin:plug-a:server-q' }],
        hooks: [{ command: 'cat "${CLAUDE_PLUGIN_ROOT}/ctx.md"', out: 'twelve chars' }, { event: 'PreToolUse', command: 'guard.cmd', out: '' }],
      }),
      did.skill('skill-x'),
      did.slash('plug-a:skill-y'),
      did.agent('Explore'),
      did.mcp('plugin_plug_a_server_q'),
    ],
    sub: [[did.skill('trimmed-one')]],
  });
  const { readSessions, snapshotOf } = await lib('transcripts.mjs');
  const { sessions, skippedFiles } = await readSessions();
  assert.equal(skippedFiles, 0);
  assert.equal(sessions.length, 1, 'the subagent file must not count as a second session');
  const s = sessions[0];
  assert.deepEqual([...s.listing.skills.keys()].sort(), ['plug-a:skill-y', 'skill-x', 'trimmed-one']);
  assert.ok(s.listing.skills.get('skill-x') > s.listing.skills.get('trimmed-one'), 'a bare-name line costs less than a described one');
  assert.equal(s.used.skills.get('skill-x'), 1);
  assert.equal(s.used.skills.get('plug-a:skill-y'), 1, 'a slash command counts as use');
  assert.equal(s.used.skills.get('trimmed-one'), 1, 'a Skill call inside a subagent counts for the parent session');
  assert.equal(s.used.agents.get('Explore'), 1);
  assert.equal(s.used.mcp.get('plugin_plug_a_server_q'), 1, 'tool prefix and listed server name normalize to one key');
  assert.deepEqual([...s.listing.mcp.keys()], ['plugin_plug_a_server_q']);
  assert.equal(s.listing.hooks.get('cat "${CLAUDE_PLUGIN_ROOT}/ctx.md"'), 'twelve chars'.length);
  assert.equal(s.listing.hooks.has('guard.cmd'), false, 'only SessionStart output is context');
  assert.equal(s.hookFires.get('PreToolUse|guard.cmd'), 1);
  const snap = snapshotOf(s);
  assert.deepEqual(snap.agents, ['Explore', 'plug-a:agent-z']);
  assert.ok(snap.chars.skills > 0 && snap.chars.agents > 0);
});

test('transcripts: an MCP server with no instructions is listed through its deferred tools and costed once per tool', async () => {
  const home = makeHome();
  addSession(home, {
    id: 's3',
    records: [
      ...loaded({ skills: [{ name: 'skill-x' }] }),
      attachment({ type: 'deferred_tools_delta', addedNames: ['mcp__plugin_p_srv__tool_a', 'mcp__plugin_p_srv__tool_b', 'WebFetch'], addedLines: ['aaaa', 'bbbbbb', 'c'] }),
      attachment({ type: 'deferred_tools_delta', addedNames: ['mcp__plugin_p_srv__tool_a'], addedLines: ['aaaa'] }),
      did.mcp('plugin_p_srv'),
    ],
  });
  const { readSessions } = await lib('transcripts.mjs');
  const { sessions: [s] } = await readSessions();
  assert.equal(s.listing.mcp.get('plugin_p_srv'), 10, 'tool_a is counted once even when it is announced twice');
  assert.equal(s.listing.mcp.has('WebFetch'), false, 'built-in deferred tools are not servers');
  assert.equal(s.used.mcp.get('plugin_p_srv'), 1);
});

test('transcripts: invoked_skills, failed and needs-auth servers, malformed lines, excluded ids', async () => {
  const home = makeHome();
  addSession(home, {
    id: 's2',
    records: [
      ...loaded({ skills: [{ name: 'skill-x' }] }),
      attachment({ type: 'invoked_skills', skills: [{ name: 'skill-x' }, 'skill-w'] }),
      attachment({ type: 'deferred_tools_delta', needsAuthMcpServers: ['plugin:plug-b:srv'], failedMcpServers: [{ name: 'broken' }] }),
    ],
  });
  fs.appendFileSync(path.join(home, 'projects', 'proj-a', 's2.jsonl'), '{not json}\n\n');
  addSession(home, { id: 'probe-1', records: loaded({ skills: [{ name: 'skill-x' }] }) });
  const { readSessions } = await lib('transcripts.mjs');
  const { sessions } = await readSessions({ exclude: new Set(['probe-1']) });
  assert.deepEqual(sessions.map((s) => s.sessionId), ['s2']);
  const s = sessions[0];
  assert.equal(s.used.skills.get('skill-x'), 1);
  assert.equal(s.used.skills.get('skill-w'), 1);
  assert.equal(s.unavailable.get('plugin:plug-b:srv'), 'needs-auth');
  assert.equal(s.unavailable.get('broken'), 'failed');
});

const GUARD = 'node "${CLAUDE_PLUGIN_ROOT}/guard.js"';
const CTX = 'cat "${CLAUDE_PLUGIN_ROOT}/ctx.md"';

const buildScenario = (home, { sessions = 25 } = {}) => {
  addPlugin(home, { id: 'plug-a@market', short: 'plug-a' });
  addPlugin(home, { id: 'guard-p@market', short: 'guard-p', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: GUARD }] }] } });
  addPlugin(home, { id: 'hooky@market', short: 'hooky', hooks: { SessionStart: [{ hooks: [{ type: 'command', command: CTX }] }] } });
  addPlugin(home, { id: 'used-p@market', short: 'used-p' });
  addPlugin(home, { id: 'rare-p@market', short: 'rare-p' });
  addPlugin(home, { id: 'mcp-p@market', short: 'mcp-p' });
  addPlugin(home, { id: 'mcp-q@market', short: 'mcp-q' });
  writeSettings(home, {
    enabledPlugins: { 'plug-a@market': true, 'guard-p@market': true, 'hooky@market': true, 'used-p@market': true, 'rare-p@market': true, 'mcp-p@market': true, 'mcp-q@market': true },
  });

  const real = path.join(home, 'skills');
  for (const name of ['local-dead', 'local-live', 'azure', 'fresh']) {
    fs.mkdirSync(path.join(real, name), { recursive: true });
    fs.writeFileSync(path.join(real, name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  }
  const outside = path.join(tmp(), 'linked-target');
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'SKILL.md'), '---\nname: local-link\n---\n');
  fs.symlinkSync(outside, path.join(real, 'local-link'), 'junction');

  for (let i = 0; i < sessions; i++) {
    const id = `s${String(i).padStart(2, '0')}`;
    const skills = [
      { name: 'plug-a:skill-y' },
      { name: 'guard-p:g-skill' },
      { name: 'hooky:h' },
      { name: 'used-p:u' },
      { name: 'used-p:azure' },
      { name: 'rare-p:r' },
      { name: 'local-dead' },
      { name: 'local-live' },
      { name: 'local-link' },
      { name: 'azure' },
      { name: 'anthropic-skills:docx' },
      { name: 'mcp-p:probe-p' },
      { name: 'mcp-q:probe-q' },
    ];
    if (i < 5) skills.push({ name: 'fresh' });
    const records = [
      ...loaded({
        skills,
        agents: [{ name: 'plug-a:agent-z' }, { name: 'Explore' }],
        mcp: [{ name: 'plugin:plug-a:server-q' }],
        hooks: [{ command: CTX, out: 'x'.repeat(400) }, { event: 'PreToolUse', command: GUARD }],
      }),
      did.skill('used-p:u'),
    ];
    if (i < 10) records.push(did.skill('local-live'), did.skill('azure'));
    if (i === 3) records.push(did.skill('rare-p:r'));
    records.push(attachment({ type: 'deferred_tools_delta', addedNames: ['mcp__plugin_mcp_p_srv__go'], addedLines: ['go: does a thing'] }));
    if (i < 12) records.push(did.mcp('plugin_mcp_p_srv'), did.mcp('plugin_mcp_q_srv'));
    if (i < 3) records.push(attachment({ type: 'deferred_tools_delta', needsAuthMcpServers: ['plugin:other:srv'] }));
    addSession(home, { id, ts: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`, records });
  }
};

test('inventory: plugins, hooks, local skill classification', async () => {
  const home = makeHome();
  buildScenario(home, { sessions: 1 });
  const inv = await lib('inventory.mjs');
  const plugins = inv.installedPlugins();
  assert.deepEqual(plugins.map((p) => p.id).sort(), ['guard-p@market', 'hooky@market', 'mcp-p@market', 'mcp-q@market', 'plug-a@market', 'rare-p@market', 'used-p@market']);
  const guard = plugins.find((p) => p.id === 'guard-p@market');
  assert.deepEqual(guard.hooks, [{ event: 'PreToolUse', matcher: 'Bash', command: GUARD }]);
  assert.equal(inv.classifyPath(path.join(home, 'skills', 'local-dead')).kind, 'dir');
  assert.equal(inv.classifyPath(path.join(home, 'skills', 'local-link')).kind, 'link');
  assert.equal(inv.classifyPath(path.join(home, 'skills', 'nope')).kind, 'missing');
  assert.equal(inv.locateLocalSkill('local-link', []).scope, 'personal');
  assert.equal(inv.locateLocalSkill('nope', []), null);
  assert.deepEqual(inv.readKeep(), []);
});

test('report: candidates, rarely used, protection, review-by-hand, exposure window', async () => {
  const home = makeHome();
  buildScenario(home);
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  assert.equal(r.coverage.sessions, 25);
  assert.equal(r.format.status, 'ok');
  assert.deepEqual(r.candidates.sort(), ['plugin:plug-a@market', 'skill:local-dead', 'skill:local-link']);
  assert.deepEqual(r.rarely, ['plugin:rare-p@market']);
  const plugRows = Object.fromEntries(r.plugins.map((p) => [p.name, p]));
  assert.equal(plugRows['mcp-p@market'].used, 12, 'use of a plugin MCP tool counts as use of the plugin');
  assert.equal(plugRows['mcp-q@market'].used, 12, 'use counts even when the server was never listed in that session');
  assert.equal(plugRows['mcp-p@market'].candidate, false);
  assert.equal(plugRows['mcp-q@market'].candidate, false);

  const byId = (id) => [...r.plugins, ...r.items].find((x) => x.id === id);
  assert.equal(byId('plugin:guard-p@market').protected, 'plugin supplies a PreToolUse guard');
  assert.equal(byId('plugin:guard-p@market').candidate, false);
  assert.equal(byId('plugin:hooky@market').candidate, false);
  assert.match(byId('plugin:hooky@market').note, /no usage signal/);
  assert.equal(byId('skill:fresh').listed, 5);
  assert.equal(byId('skill:fresh').candidate, false, 'listed in too few sessions to judge');
  assert.equal(byId('skill:local-live').pct, 40);
  assert.equal(byId('skill:local-live').candidate, false);
  assert.equal(byId('skill:local-dead').local.kind, 'dir');
  assert.equal(byId('skill:local-link').local.kind, 'link');

  const plugA = byId('plugin:plug-a@market');
  assert.equal(plugA.members, 3, 'its skill, agent and mcp server roll up to the plugin');
  assert.equal(plugA.listed, 25);
  assert.equal(plugA.used, 0);
  assert.ok(plugA.tokens > 0);
  assert.equal(byId('mcp:plugin_plug_a_server_q').plugin, 'plug-a@market');
  assert.equal(byId('skill:anthropic-skills:docx').source, 'platform');
  assert.equal(byId('agent:Explore').source, 'unmanaged');
  assert.equal(byId('skill:anthropic-skills:docx').candidate, false, 'platform skills have no removal path');

  assert.equal(r.guards.length, 1);
  assert.deepEqual({ plugin: r.guards[0].plugin, fires: r.guards[0].fires }, { plugin: 'guard-p@market', fires: 25 });
  assert.deepEqual(r.duplicates, [{ base: 'azure', names: ['azure', 'used-p:azure'], used: { azure: 10, 'used-p:azure': 0 } }]);
  assert.deepEqual(r.unavailable, [{ name: 'plugin:other:srv', status: 'needs-auth', sessions: 3, lastSeen: '2026-09-03T10:00:00.000Z' }]);
});

test('report: keep.json protects, probe sessions are excluded, empty and unrecognized corpora', async () => {
  const home = makeHome();
  buildScenario(home);
  writeJson(path.join(home, 'context-diet', 'keep.json'), { keep: ['plugin:plug-a@market', 'skill:local-dead'] });
  const { registerProbe } = await lib('state.mjs');
  registerProbe('probe-9');
  addSession(home, { id: 'probe-9', records: loaded({ skills: [{ name: 'local-dead' }] }) });
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  assert.equal(r.coverage.sessions, 25, 'the registered probe session is not counted');
  assert.deepEqual(r.candidates, ['skill:local-link']);
  const kept = [...r.plugins, ...r.items].find((x) => x.id === 'plugin:plug-a@market');
  assert.equal(kept.protected, 'listed in keep.json');

  const empty = makeHome();
  assert.equal((await scan()).coverage.sessions, 0);
  addSession(empty, { id: 'old', records: [did.skill('x')] });
  assert.equal((await scan()).format.status, 'unrecognized', 'sessions without any skill listing are a format problem, not zero usage');
});

test('cli scan: text table, --json, thresholds, exit codes', async () => {
  const home = makeHome();
  buildScenario(home);
  const env = { CONTEXT_DIET_HOME: home };
  const text = await runDiet(['scan'], env);
  assert.equal(text.code, 0);
  assert.match(text.stdout, /Removal candidates/);
  assert.match(text.stdout, /plugin:plug-a@market\s+25\s+0\s+0%/);
  assert.match(text.stdout, /Protected \(never offered\)/);
  assert.match(text.stdout, /plugin:guard-p@market\s+plugin supplies a PreToolUse guard\s+\d+ entr(?:y|ies)/);
  assert.doesNotMatch(text.stdout, /skill:guard-p:g-skill/, 'members of a protected plugin are not listed one by one');
  assert.match(text.stdout, /azure: azure \(used in 10\), used-p:azure \(used in 0\)/);
  assert.doesNotMatch(text.stdout, /did not connect/, 'servers seen in fewer sessions than the threshold are not shown');

  const json = await runDiet(['scan', '--json'], env);
  assert.deepEqual(JSON.parse(json.stdout).candidates.sort(), ['plugin:plug-a@market', 'skill:local-dead', 'skill:local-link']);
  assert.deepEqual(readJson(path.join(home, 'context-diet', 'report.json')).candidates.sort(), ['plugin:plug-a@market', 'skill:local-dead', 'skill:local-link']);

  const block = (title) => {
    const start = text.stdout.indexOf(`\n${title}\n`);
    if (start === -1) return '';
    const end = text.stdout.indexOf('\n\n', start + 1);
    return text.stdout.slice(start, end === -1 ? undefined : end);
  };
  assert.match(block('Rarely used (not removal candidates)'), /plugin:rare-p@market\s+25\s+1\s+4%.*rarely used/);
  assert.doesNotMatch(block('Removal candidates'), /rare-p/, 'a rarely used row is not a removal candidate');

  const low = await runDiet(['scan', '--json', '--min-sessions', '5'], env);
  assert.ok(JSON.parse(low.stdout).candidates.includes('skill:fresh'));

  const zero = await runDiet(['scan', '--min-sessions', '999'], env);
  assert.equal(zero.code, 0);
  assert.match(zero.stdout, /Removal candidates\nnone: nothing meets the thresholds \(a valid result\)/);
  const zeroJson = await runDiet(['scan', '--json', '--min-sessions', '999'], env);
  assert.deepEqual(JSON.parse(zeroJson.stdout).candidates, []);

  const none = await runDiet(['scan'], { CONTEXT_DIET_HOME: tmp() });
  assert.equal(none.code, 2);
  assert.match(none.stdout, /No sessions found/);
  const bad = await runDiet(['scan', '--bogus'], env);
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /unknown flag --bogus/);
});

const ALL_SKILLS = ['plug-a:skill-y', 'guard-p:g-skill', 'hooky:h', 'used-p:u', 'used-p:azure', 'rare-p:r', 'local-dead', 'local-live', 'local-link', 'azure', 'anthropic-skills:docx'];
const FULL = { skills: ALL_SKILLS, agents: ['plug-a:agent-z', 'Explore'], mcp: ['plugin:plug-a:server-q'], hooks: [{ command: CTX, out: 'x'.repeat(400) }] };
const minus = (state, { skills = [], agents = [], mcp = [] }) => ({
  ...state,
  skills: state.skills.filter((n) => !skills.includes(n)),
  agents: state.agents.filter((n) => !agents.includes(n)),
  mcp: state.mcp.filter((n) => !mcp.includes(n)),
});
const PLUG_A = { skills: ['plug-a:skill-y'], agents: ['plug-a:agent-z'], mcp: ['plugin:plug-a:server-q'] };

const installStub = (sequence) => {
  const dir = tmp();
  const stateFile = path.join(dir, 'state.json');
  const logFile = path.join(dir, 'calls.log');
  const script = path.join(dir, 'fake-claude.js');
  writeJson(stateFile, { seq: sequence });
  fs.writeFileSync(
    script,
    `const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const id = argv[argv.indexOf('--session-id') + 1];
const PROBES = path.join(process.env.CONTEXT_DIET_HOME, 'context-diet', 'probes.json');
const probesAtStart = fs.existsSync(PROBES) ? fs.readFileSync(PROBES, 'utf8') : null;
const LOG = ${JSON.stringify(logFile)};
const calls = fs.existsSync(LOG) ? fs.readFileSync(LOG, 'utf8').split('\\n').filter(Boolean).length : 0;
fs.appendFileSync(LOG, JSON.stringify({ argv, cwd: process.cwd(), configDir: process.env.CLAUDE_CONFIG_DIR || null, probesAtStart }) + '\\n');
const seq = JSON.parse(fs.readFileSync(${JSON.stringify(stateFile)}, 'utf8')).seq;
const s = seq[Math.min(calls, seq.length - 1)];
if (s.crash) process.exit(1);
if (s.hang) {
  setInterval(() => {}, 1000);
  return;
}
const dir = path.join(process.env.CONTEXT_DIET_HOME, 'projects', 'probe-proj');
if (s.dirTranscript) {
  fs.mkdirSync(path.join(dir, id + '.jsonl'), { recursive: true });
  process.exit(0);
}
const att = (a) => JSON.stringify({ type: 'attachment', sessionId: id, attachment: a });
const lines = [];
if (!s.noListing) lines.push(att({ type: 'skill_listing', isInitial: true, names: s.skills, content: s.skills.map((n) => '- ' + n + ': desc').join('\\n') }));
lines.push(att({ type: 'agent_listing_delta', isInitial: true, addedTypes: s.agents, addedLines: s.agents.map((n) => '- ' + n + ': a') }));
lines.push(att({ type: 'mcp_instructions_delta', addedNames: s.mcp, addedBlocks: s.mcp.map((n) => '## ' + n) }));
for (const h of s.hooks || []) lines.push(att({ type: 'hook_success', hookEvent: 'SessionStart', command: h.command, stdout: h.out }));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, id + '.jsonl'), lines.join('\\n') + '\\n');
`
  );
  process.env.CONTEXT_DIET_CLAUDE = script;
  return { calls: () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []) };
};

test.afterEach(() => {
  delete process.env.CONTEXT_DIET_CLAUDE;
});

test('probe: a fresh headless session is read, registered, and its transcript removed', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const stub = installStub([FULL]);
  const { runProbe } = await lib('probe.mjs');
  const r = await runProbe({ cwd: work });
  assert.equal(r.ok, true);
  assert.deepEqual(r.snapshot.skills, [...ALL_SKILLS].sort());
  assert.deepEqual(r.snapshot.mcp, ['plugin_plug_a_server_q']);
  assert.equal(r.snapshot.chars.hooks, 400);
  const [call] = stub.calls();
  assert.equal(path.resolve(call.cwd), path.resolve(work), 'the probe runs in the requested directory');
  assert.ok(call.argv.includes('--session-id') && call.argv.includes('haiku'), call.argv.join(' '));
  assert.equal(call.configDir, home, 'with CONTEXT_DIET_HOME set the child writes its transcript under that home');
  const id = call.argv[call.argv.indexOf('--session-id') + 1];
  assert.ok(readJson(path.join(home, 'context-diet', 'probes.json')).includes(id));
  assert.equal(fs.existsSync(path.join(home, 'projects', 'probe-proj', `${id}.jsonl`)), false, 'the probe transcript is deleted');
});

test('probe: every failure is reported with a reason, never as an empty success', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const { runProbe } = await lib('probe.mjs');
  const fast = { cwd: work, timeoutMs: 60000, settleMs: 10 };

  installStub([{ crash: true }]);
  const crashed = await runProbe(fast);
  assert.equal(crashed.ok, false);
  assert.match(crashed.reason, /no transcript/);

  installStub([{ noListing: true, skills: [], agents: [], mcp: [] }]);
  const noListing = await runProbe(fast);
  assert.equal(noListing.ok, false);
  assert.match(noListing.reason, /no skill listing/);

  delete process.env.CONTEXT_DIET_CLAUDE;
  const realPath = process.env.PATH;
  process.env.PATH = tmp();
  try {
    const missing = await runProbe(fast);
    assert.equal(missing.ok, false);
    assert.match(missing.reason, /could not be started \(ENOENT\)/);
  } finally {
    process.env.PATH = realPath;
  }
});

const applyWorld = async () => {
  const home = makeHome();
  buildScenario(home);
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const { scan } = await lib('scan.mjs');
  await scan();
  return { home, work };
};

const PICKS = ['plugin:plug-a@market', 'skill:local-link', 'skill:local-dead'];
const GONE = minus(FULL, { skills: ['plug-a:skill-y', 'local-link', 'local-dead'], agents: PLUG_A.agents, mcp: PLUG_A.mcp });

test('apply then verify: plugin, link and folder are removed, and a fresh session proves it', async () => {
  const { home, work } = await applyWorld();
  const stub = installStub([FULL, GONE]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const linkedSkill = fs.readFileSync(path.join(home, 'skills', 'local-link', 'SKILL.md'));

  const a = await apply({ picks: PICKS, cwd: work });
  assert.equal(a.error, null);
  assert.deepEqual(a.changes.map((c) => [c.type, c.done]), [['plugin', true], ['link', true], ['dir', true]]);
  assert.equal(readJson(path.join(home, 'settings.json')).enabledPlugins['plug-a@market'], false);
  assert.equal(readJson(path.join(home, 'settings.json')).enabledPlugins['used-p@market'], true, 'other plugins are untouched');
  assert.equal(fs.existsSync(path.join(home, 'skills', 'local-link')), false);
  assert.equal(fs.existsSync(a.changes[1].target), true, 'removing the link leaves its target');
  assert.deepEqual(fs.readFileSync(path.join(a.changes[1].resolved, 'SKILL.md')), linkedSkill, 'the link target content is unchanged');
  assert.equal(fs.existsSync(path.join(home, 'skills', 'local-dead')), false);
  assert.ok(fs.existsSync(path.join(a.changes[2].quarantine, 'SKILL.md')), 'the folder is in quarantine, not deleted');
  assert.deepEqual([readJson(a.manifest).changes[2].partial, readJson(a.manifest).changes[2].done], [false, true]);
  assert.ok(a.checks.length === 3 && a.checks.every((c) => c.ok), JSON.stringify(a.checks));
  assert.deepEqual(a.guards.map((g) => [g.id, g.ok]), [['guard guard-p@market', true]]);
  assert.ok(fs.existsSync(path.join(home, 'context-diet', 'backups')), 'settings.json was backed up first');

  const v = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(v.verdict, 'pass');
  assert.deepEqual(v.items.map((i) => i.status), ['GONE', 'GONE', 'GONE']);
  assert.deepEqual(v.collateral, { observed: true, lost: [], unstable: [] });
  assert.ok(v.savings.measured.totalChars > 0 && v.savings.projectedTokens > 0);
  assert.equal(readJson(a.manifest).verdict, 'pass');
  assert.equal(stub.calls().length, 2, 'one probe before the change and one after');
});

test('verify: STILL PRESENT, collateral loss, project re-enable, broken guard and no fresh session', async () => {
  const { home, work } = await applyWorld();
  installStub([FULL, GONE]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const a = await apply({ picks: PICKS, cwd: work });

  installStub([minus(FULL, { skills: ['plug-a:skill-y', 'local-link'], agents: PLUG_A.agents, mcp: PLUG_A.mcp })]);
  const stuck = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(stuck.verdict, 'fail');
  const row = stuck.items.find((i) => i.id === 'skill:local-dead');
  assert.equal(row.status, 'STILL PRESENT');
  assert.match(row.names[0], /^skills:local-dead/);

  installStub([minus(GONE, { skills: ['used-p:u'] })]);
  const collateral = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(collateral.verdict, 'fail');
  assert.deepEqual(collateral.collateral.lost, ['skills:used-p:u']);

  installStub([GONE]);
  writeJson(path.join(work, '.claude', 'settings.local.json'), { enabledPlugins: { 'plug-a@market': true } });
  const reenabled = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(reenabled.verdict, 'fail');
  assert.match(reenabled.checks.find((c) => c.id === 'plugin:plug-a@market').detail, /re-enabled by/);
  fs.rmSync(path.join(work, '.claude'), { recursive: true, force: true });

  const settings = readJson(path.join(home, 'settings.json'));
  settings.enabledPlugins['guard-p@market'] = false;
  writeJson(path.join(home, 'settings.json'), settings);
  installStub([GONE]);
  const guard = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(guard.verdict, 'fail');
  assert.match(guard.guards[0].detail, /DISABLED/);
  settings.enabledPlugins['guard-p@market'] = true;
  writeJson(path.join(home, 'settings.json'), settings);

  installStub([{ crash: true }]);
  const dark = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(dark.verdict, 'not-observed');
  assert.ok(dark.items.every((i) => i.status === 'NOT OBSERVED'));
  assert.equal(dark.savings.measured, null);
});

test('apply: a failed before-snapshot is recorded and verify can only be incomplete', async () => {
  const { work } = await applyWorld();
  installStub([{ crash: true }, GONE]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const a = await apply({ picks: ['skill:local-dead'], cwd: work });
  assert.match(a.preReason, /no transcript/);
  const v = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(v.verdict, 'incomplete');
  assert.equal(v.collateral.observed, false);
  assert.equal(v.items[0].status, 'GONE');
});

test('apply: protected, plugin-supplied, platform, unknown and built-in picks are skipped with a reason', async () => {
  const { home, work } = await applyWorld();
  const stub = installStub([FULL, GONE]);
  const { apply } = await lib('apply.mjs');
  const a = await apply({
    picks: ['plugin:guard-p@market', 'skill:plug-a:skill-y', 'skill:anthropic-skills:docx', 'skill:nope', 'agent:Explore'],
    cwd: work,
  });
  assert.deepEqual(a.changes, []);
  const reason = Object.fromEntries(a.skipped.map((s) => [s.id, s.reason]));
  assert.match(reason['plugin:guard-p@market'], /^protected: plugin supplies a PreToolUse guard/);
  assert.match(reason['skill:plug-a:skill-y'], /supplied by plugin plug-a@market: pick plugin:plug-a@market instead/);
  assert.match(reason['skill:anthropic-skills:docx'], /source is platform/);
  assert.match(reason['skill:nope'], /not in the latest report/);
  assert.match(reason['agent:Explore'], /built in or unmanaged/);
  assert.equal(stub.calls().length, 0, 'nothing to change means no probe and no manifest');
  assert.equal(a.manifest, null);
  assert.equal(fs.existsSync(path.join(home, 'context-diet', 'manifests')), false);
});

test('apply: a git-tracked skill folder is refused and left exactly where it is', async (t) => {
  if (spawnSync('git', ['--version']).status !== 0) return t.skip('git is not available');
  const home = makeHome();
  const repo = path.join(tmp(), 'some-repo');
  fs.mkdirSync(path.join(repo, '.claude', 'skills', 'tracked-skill'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.claude', 'skills', 'tracked-skill', 'SKILL.md'), '---\nname: tracked-skill\n---\n');
  const git = (...args) => spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { encoding: 'utf8' });
  assert.equal(git('init', '-q').status, 0);
  assert.equal(git('add', '.').status, 0);
  assert.equal(git('commit', '-q', '-m', 'init').status, 0);
  for (let i = 0; i < 25; i++) {
    addSession(home, { id: `g${i}`, cwd: repo, ts: `2026-09-${String((i % 27) + 1).padStart(2, '0')}T10:00:00.000Z`, records: loaded({ skills: [{ name: 'tracked-skill' }] }) });
  }
  const { scan } = await lib('scan.mjs');
  const report = await scan();
  assert.deepEqual(report.candidates, ['skill:tracked-skill']);
  installStub([FULL]);
  const { apply } = await lib('apply.mjs');
  const a = await apply({ picks: ['skill:tracked-skill'], cwd: repo });
  assert.deepEqual(a.changes, []);
  assert.match(a.skipped[0].reason, /git-tracked: remove it with git yourself/);
  assert.ok(fs.existsSync(path.join(repo, '.claude', 'skills', 'tracked-skill', 'SKILL.md')));
});

test('restore: every kind of change is put back exactly, and a second restore does nothing', async () => {
  const { home, work } = await applyWorld();
  const actions = await lib('actions.mjs');
  const inv = await lib('inventory.mjs');
  const deadHash = actions.hashDir(path.join(home, 'skills', 'local-dead'));
  const linkBefore = inv.classifyPath(path.join(home, 'skills', 'local-link'));
  installStub([FULL, GONE]);
  const { apply } = await lib('apply.mjs');
  const { restore } = await lib('restore.mjs');
  const a = await apply({ picks: PICKS, cwd: work });

  const r = restore({ manifestPath: a.manifest });
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.restored.sort(), [...PICKS].sort());
  assert.equal(readJson(path.join(home, 'settings.json')).enabledPlugins['plug-a@market'], true);
  assert.deepEqual(inv.classifyPath(path.join(home, 'skills', 'local-link')), linkBefore);
  assert.equal(actions.hashDir(path.join(home, 'skills', 'local-dead')), deadHash);
  assert.equal(fs.existsSync(a.changes[2].quarantine), false, 'the quarantine copy is consumed by the restore');
  assert.equal(readJson(a.manifest).status, 'restored');
  assert.deepEqual(restore({ manifestPath: a.manifest }).restored, []);
});

test('restore: something reinstalled in the way is never overwritten, and the rest still restores', async () => {
  const { home, work } = await applyWorld();
  installStub([FULL, GONE]);
  const { apply } = await lib('apply.mjs');
  const { restore } = await lib('restore.mjs');
  const a = await apply({ picks: PICKS, cwd: work });
  fs.mkdirSync(path.join(home, 'skills', 'local-dead'));
  fs.writeFileSync(path.join(home, 'skills', 'local-dead', 'SKILL.md'), 'a newer copy');
  const r = restore({ manifestPath: a.manifest });
  assert.equal(r.failed.length, 1);
  assert.match(r.failed[0].reason, /exists again; not overwritten/);
  assert.equal(fs.readFileSync(path.join(home, 'skills', 'local-dead', 'SKILL.md'), 'utf8'), 'a newer copy');
  assert.ok(fs.existsSync(path.join(a.changes[2].quarantine, 'SKILL.md')), 'the quarantined copy is kept');
  assert.equal(readJson(path.join(home, 'settings.json')).enabledPlugins['plug-a@market'], true);
  assert.equal(readJson(a.manifest).status, 'partially-restored');
});

test('purge: needs --yes and a passing verify; afterwards only the purged folder cannot come back', async () => {
  const { home, work } = await applyWorld();
  installStub([FULL, GONE]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const { purge, restore } = await lib('restore.mjs');
  const a = await apply({ picks: PICKS, cwd: work });
  const quarantined = a.changes[2].quarantine;

  assert.match(purge({ manifestPath: a.manifest, yes: false }).refused, /needs --yes/);
  assert.match(purge({ manifestPath: a.manifest, yes: true }).refused, /verify has not passed.*never run/);
  assert.ok(fs.existsSync(quarantined));

  installStub([FULL]);
  assert.equal((await verify({ manifestPath: a.manifest, cwd: work })).verdict, 'fail');
  assert.match(purge({ manifestPath: a.manifest, yes: true }).refused, /verdict: fail/);
  assert.ok(fs.existsSync(quarantined));

  installStub([GONE]);
  assert.equal((await verify({ manifestPath: a.manifest, cwd: work })).verdict, 'pass');
  const p = purge({ manifestPath: a.manifest, yes: true });
  assert.deepEqual(p.deleted, [quarantined]);
  assert.equal(fs.existsSync(quarantined), false);

  const r = restore({ manifestPath: a.manifest });
  assert.deepEqual(r.restored.sort(), ['plugin:plug-a@market', 'skill:local-link']);
  assert.match(r.failed[0].reason, /purged/);
  assert.equal(fs.existsSync(path.join(home, 'skills', 'local-dead')), false);
});

test('settings hooks: a user-level hook is removed and restored, guards are never offered', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  writeSettings(home, {
    enabledPlugins: {},
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }, { type: 'command', command: 'echo keep' }] }],
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard-local' }, { type: 'command', command: 'guard-both' }] }],
    },
  });
  for (let i = 0; i < 25; i++) {
    addSession(home, {
      id: `h${i}`,
      records: loaded({
        skills: [{ name: 'only-skill' }],
        hooks: [{ command: 'echo hi', out: 'abc' }, { command: 'echo keep', out: 'def' }, { command: 'guard-both', out: 'gb' }, { event: 'PreToolUse', command: 'guard-local' }],
      }),
    });
  }
  const { scan } = await lib('scan.mjs');
  const report = await scan();
  const hook = report.items.find((i) => i.id === 'hook:echo hi');
  assert.equal(hook.source, 'settings');
  assert.equal(hook.candidate, false, 'hooks carry no usage signal, so they are never candidates');
  assert.deepEqual(report.guards.map((g) => [g.command, g.plugin]), [['guard-both', null], ['guard-local', null]]);
  const both = report.items.find((i) => i.id === 'hook:guard-both');
  assert.equal(both.protected, 'PreToolUse guard hook', 'a listed hook that is also a PreToolUse guard is protected');
  assert.equal(both.candidate, false);

  const only = { skills: ['only-skill'], agents: [], mcp: [] };
  const stub = installStub([{ ...only, hooks: [{ command: 'echo hi', out: 'abc' }, { command: 'echo keep', out: 'def' }] }, { ...only, hooks: [{ command: 'echo keep', out: 'def' }] }]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const { restore } = await lib('restore.mjs');
  const refused = await apply({ picks: ['hook:guard-local'], cwd: work });
  assert.match(refused.skipped[0].reason, /not in the latest report/);
  const guardRefused = await apply({ picks: ['hook:guard-both'], cwd: work });
  assert.deepEqual(guardRefused.changes, []);
  assert.match(guardRefused.skipped[0].reason, /^protected: PreToolUse guard hook/);
  const reportFile = path.join(home, 'context-diet', 'report.json');
  const forged = readJson(reportFile);
  Object.assign(forged.items.find((i) => i.id === 'hook:guard-both'), { protected: null });
  writeJson(reportFile, forged);
  const recomputed = await apply({ picks: ['hook:guard-both'], cwd: work });
  assert.deepEqual(recomputed.changes, []);
  assert.match(recomputed.skipped[0].reason, /^protected: PreToolUse guard hook/, 'apply recomputes protection instead of trusting the report');
  assert.equal(stub.calls().length, 0);
  assert.ok(readJson(path.join(home, 'settings.json')).hooks.PreToolUse[0].hooks.some((h) => h.command === 'guard-both'));

  const a = await apply({ picks: ['hook:echo hi'], cwd: work });
  assert.equal(a.error, null);
  const after = readJson(path.join(home, 'settings.json'));
  assert.deepEqual(after.hooks.SessionStart[0].hooks.map((h) => h.command), ['echo keep']);
  assert.equal(after.hooks.PreToolUse[0].hooks[0].command, 'guard-local');
  assert.equal((await verify({ manifestPath: a.manifest, cwd: work })).verdict, 'pass');

  assert.deepEqual(restore({ manifestPath: a.manifest }).failed, []);
  const back = readJson(path.join(home, 'settings.json'));
  assert.deepEqual(back.hooks.SessionStart[0].hooks.map((h) => h.command).sort(), ['echo hi', 'echo keep']);
});

test('cli: apply verifies on its own, exit codes follow the verdict, restore and purge work', async () => {
  const pass = await applyWorld();
  installStub([FULL, GONE]);
  const env = { CONTEXT_DIET_HOME: pass.home };
  const a = await runDiet(['apply', '--pick', PICKS.join(','), '--cwd', pass.work], env);
  assert.equal(a.code, 0, a.stderr + a.stdout);
  assert.match(a.stdout, /Verdict: PASS/);
  assert.match(a.stdout, /Changes/);
  const manifest = a.stdout.match(/Manifest: (.+)/)[1].trim();

  const refused = await runDiet(['purge', manifest], env);
  assert.equal(refused.code, 1);
  assert.match(refused.stdout, /Refused: .*--yes/);

  const r = await runDiet(['restore', manifest, '--json'], env);
  assert.equal(r.code, 0);
  assert.deepEqual(JSON.parse(r.stdout).failed, []);

  const fail = await applyWorld();
  installStub([FULL, FULL]);
  const f = await runDiet(['apply', '--pick', 'skill:local-dead', '--cwd', fail.work], { CONTEXT_DIET_HOME: fail.home });
  assert.equal(f.code, 3);
  assert.match(f.stdout, /Verdict: FAIL/);
  assert.match(f.stdout, /Restore with: restore /);

  const none = await runDiet(['apply', '--pick', 'skill:nope', '--cwd', fail.work], { CONTEXT_DIET_HOME: fail.home });
  assert.equal(none.code, 1);
  assert.match(none.stdout, /Nothing was changed/);

  const partial = await applyWorld();
  installStub([{ crash: true }, GONE]);
  const inc = await runDiet(['apply', '--pick', 'skill:local-dead', '--cwd', partial.work], { CONTEXT_DIET_HOME: partial.home });
  assert.equal(inc.code, 5, inc.stderr + inc.stdout);
  assert.match(inc.stdout, /Verdict: INCOMPLETE/);

  const missing = await runDiet(['verify', path.join(tmp(), 'nope.json')], env);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /cannot read manifest/);
  assert.equal((await runDiet([], env)).code, 1);
  assert.equal((await runDiet(['apply'], env)).code, 1);
});

test('inventory: a link records its absolute resolved target', async () => {
  const base = tmp();
  const target = path.join(base, 'code', 'skill-x');
  fs.mkdirSync(target, { recursive: true });
  const link = path.join(base, 'skills', 'skill-x');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, 'junction');
  const inv = await lib('inventory.mjs');
  const found = inv.classifyPath(link);
  assert.equal(found.kind, 'link');
  assert.ok(path.isAbsolute(found.resolved), found.resolved);
  assert.equal(fs.realpathSync(found.resolved), fs.realpathSync(target));
});

test('restore: a relative symlink is removed and put back with the same relative text', async (t) => {
  if (process.platform === 'win32') return t.skip('a junction is always absolute; relative symlinks are covered on other platforms');
  const home = makeHome();
  const target = path.join(home, 'code', 'rel-skill');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'SKILL.md'), '---\nname: rel-skill\n---\n');
  const link = path.join(home, 'skills', 'rel-skill');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  const rel = path.join('..', 'code', 'rel-skill');
  fs.symlinkSync(rel, link);
  for (let i = 0; i < 25; i++) addSession(home, { id: `r${i}`, records: loaded({ skills: [{ name: 'rel-skill' }, { name: 'skill-x' }] }) });
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const { scan } = await lib('scan.mjs');
  assert.ok((await scan()).candidates.includes('skill:rel-skill'));
  installStub([{ skills: ['rel-skill', 'skill-x'], agents: [], mcp: [] }, { skills: ['skill-x'], agents: [], mcp: [] }]);
  const { apply } = await lib('apply.mjs');
  const { restore } = await lib('restore.mjs');
  const a = await apply({ picks: ['skill:rel-skill'], cwd: work });
  assert.equal(a.error, null);
  assert.ok(a.checks[0].ok, a.checks[0].detail);
  assert.deepEqual(restore({ manifestPath: a.manifest }).failed, []);
  assert.equal(fs.readlinkSync(link), rel);
  assert.ok(fs.existsSync(path.join(link, 'SKILL.md')));
});

test('report: hooks declared in plugin.json or an unreadable hooks.json protect the plugin', async () => {
  const home = makeHome();
  const guardHook = (command) => ({ PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command }] }] });
  addPlugin(home, { id: 'inline-g@market', short: 'inline-g', manifestHooks: guardHook('inline-guard') });
  const pathRoot = addPlugin(home, { id: 'path-g@market', short: 'path-g', manifestHooks: './extra-hooks.json' });
  writeJson(path.join(pathRoot, 'extra-hooks.json'), { hooks: guardHook('path-guard') });
  addPlugin(home, { id: 'broken-h@market', short: 'broken-h', hooksJsonText: '{not json' });
  addPlugin(home, { id: 'plain-p@market', short: 'plain-p' });
  writeSettings(home, { enabledPlugins: { 'inline-g@market': true, 'path-g@market': true, 'broken-h@market': true, 'plain-p@market': true } });
  for (let i = 0; i < 25; i++) {
    addSession(home, { id: `p${i}`, records: loaded({ skills: [{ name: 'inline-g:s' }, { name: 'path-g:s' }, { name: 'broken-h:s' }, { name: 'plain-p:s' }] }) });
  }
  const inv = await lib('inventory.mjs');
  const plugins = Object.fromEntries(inv.installedPlugins().map((p) => [p.id, p]));
  assert.equal(plugins['broken-h@market'].hooksUnreadable, true);
  assert.equal('hooksUnreadable' in plugins['plain-p@market'], false);

  const { scan } = await lib('scan.mjs');
  const r = await scan();
  const row = (id) => r.plugins.find((p) => p.id === id);
  assert.equal(row('plugin:inline-g@market').protected, 'plugin supplies a PreToolUse guard');
  assert.equal(row('plugin:path-g@market').protected, 'plugin supplies a PreToolUse guard');
  assert.equal(row('plugin:broken-h@market').protected, 'plugin hooks could not be read');
  assert.deepEqual(r.candidates, ['plugin:plain-p@market']);
  assert.deepEqual(r.guards.map((g) => g.command), ['inline-guard', 'path-guard']);

  const { apply } = await lib('apply.mjs');
  const a = await apply({ picks: ['plugin:inline-g@market', 'plugin:broken-h@market'], cwd: home });
  assert.deepEqual(a.changes, []);
  assert.match(a.skipped.find((s) => s.id === 'plugin:broken-h@market').reason, /^protected: plugin hooks could not be read/);
});

test('verify: an item no probe ever listed is NOT OBSERVED, the verdict is incomplete, and purge stays locked', async () => {
  const { work } = await applyWorld();
  const without = minus(FULL, { skills: ['local-dead'] });
  installStub([without, without]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const { purge } = await lib('restore.mjs');
  const a = await apply({ picks: ['skill:local-dead'], cwd: work });
  const v = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(v.items[0].status, 'NOT OBSERVED');
  assert.match(v.items[0].detail, /nothing to verify/);
  assert.equal(v.verdict, 'incomplete');
  assert.match(purge({ manifestPath: a.manifest, yes: true }).refused, /verdict: incomplete/);
  assert.ok(fs.existsSync(a.changes[0].quarantine));
});

test('verify: a lost guard is a fail even when the fresh session cannot be observed', async () => {
  const { home, work } = await applyWorld();
  installStub([FULL, GONE]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const a = await apply({ picks: ['skill:local-dead'], cwd: work });
  const settings = readJson(path.join(home, 'settings.json'));
  settings.enabledPlugins['guard-p@market'] = false;
  writeJson(path.join(home, 'settings.json'), settings);
  installStub([{ crash: true }]);
  const v = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(v.verdict, 'fail');
  assert.notEqual(v.probe, 'ok');
});

test('verify: a manifest with no applied changes is an error, not a pass', async () => {
  const home = makeHome();
  const stub = installStub([FULL]);
  const manifestPath = path.join(home, 'context-diet', 'manifests', 'empty.json');
  writeJson(manifestPath, { version: 1, cwd: home, pre: null, changes: [{ id: 'plugin:plug-a@market', type: 'plugin', plugin: 'plug-a@market', done: false }] });
  const { verify } = await lib('verify.mjs');
  await assert.rejects(verify({ manifestPath }), /the manifest has no applied changes to verify/);
  assert.equal(stub.calls().length, 0, 'no probe is started');
  const cli = await runDiet(['verify', manifestPath], { CONTEXT_DIET_HOME: home });
  assert.equal(cli.code, 1);
  assert.match(cli.stderr, /the manifest has no applied changes to verify/);
});

test('quarantine: a failed removal of the original is rolled back and the copy discarded', async () => {
  makeHome();
  const actions = await lib('actions.mjs');
  const src = path.join(tmp(), 'skill-x');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'SKILL.md'), 'body');
  fs.writeFileSync(path.join(src, 'extra.md'), 'more');
  const before = actions.hashDir(src);
  const record = actions.copyToQuarantine(src, 'stamp-1', 'personal-skill-x');
  assert.equal(record.hash, before);
  const locked = (p) => {
    fs.rmSync(path.join(p, 'extra.md'));
    throw new Error('locked');
  };
  assert.throws(() => actions.removeOriginal(src, record, locked), (e) => e.message.startsWith('the original could not be removed (') && !e.partial);
  assert.equal(actions.hashDir(src), before);
  assert.equal(fs.existsSync(record.quarantine), false);
});

test('quarantine: a copy that does not match aborts with the original untouched and no copy left', async () => {
  makeHome();
  const actions = await lib('actions.mjs');
  const src = path.join(tmp(), 'skill-x');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'SKILL.md'), 'body');
  const before = actions.hashDir(src);
  let dest = null;
  const corrupting = (from, to, options) => {
    dest = to;
    fs.cpSync(from, to, options);
    fs.writeFileSync(path.join(to, 'SKILL.md'), 'changed');
  };
  assert.throws(() => actions.copyToQuarantine(src, 'stamp-2', 'personal-skill-x', corrupting), /did not match/);
  assert.equal(actions.hashDir(src), before);
  assert.equal(fs.existsSync(dest), false);
});

test('restore: a partial folder change is put back from its verified copy', async () => {
  const home = makeHome();
  const actions = await lib('actions.mjs');
  const { restore } = await lib('restore.mjs');
  const src = path.join(home, 'skills', 'skill-x');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'SKILL.md'), 'body');
  fs.writeFileSync(path.join(src, 'extra.md'), 'more');
  const record = actions.copyToQuarantine(src, 'stamp-3', 'personal-skill-x');
  fs.rmSync(path.join(src, 'extra.md'));
  const manifestPath = path.join(home, 'context-diet', 'manifests', 'partial.json');
  writeJson(manifestPath, {
    version: 1,
    changes: [{ id: 'skill:skill-x', type: 'dir', path: src, label: 'personal-skill-x', ...record, done: false, partial: true, error: 'the original could not be removed and could not be restored' }],
  });
  const r = restore({ manifestPath });
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.restored, ['skill:skill-x']);
  assert.equal(actions.hashDir(src), record.hash);
  assert.equal(fs.existsSync(record.quarantine), false);
  assert.equal(readJson(manifestPath).changes[0].undone, true);
});

const shape = (value, { indent, crlf, trailing, bom }) => {
  let text = JSON.stringify(value, null, indent) + (trailing ? '\n' : '');
  if (crlf) text = text.replace(/\n/g, '\r\n');
  return (bom ? '\uFEFF' : '') + text;
};
const baseSettings = () => ({
  enabledPlugins: { 'plug-a@market': true },
  hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo a' }, { type: 'command', command: 'echo b' }] }] },
});

test('settings: edits keep line endings, indent and the trailing newline as found', async () => {
  const home = makeHome();
  const actions = await lib('actions.mjs');
  const file = path.join(home, 'settings.json');
  const variants = [
    { name: 'CRLF, 2 spaces, trailing newline', indent: 2, crlf: true, trailing: true },
    { name: 'tab indent', indent: '\t', crlf: false, trailing: true },
    { name: '4 spaces', indent: 4, crlf: false, trailing: true },
    { name: 'no trailing newline', indent: 2, crlf: false, trailing: false },
  ];
  for (const v of variants) {
    fs.writeFileSync(file, shape(baseSettings(), v));
    const expected = baseSettings();
    actions.setPluginEnabled('plug-a@market', false);
    expected.enabledPlugins['plug-a@market'] = false;
    assert.equal(fs.readFileSync(file, 'utf8'), shape(expected, v), `${v.name}: setPluginEnabled`);
    actions.removeSettingsHook('echo a');
    expected.hooks.SessionStart[0].hooks.shift();
    assert.equal(fs.readFileSync(file, 'utf8'), shape(expected, v), `${v.name}: removeSettingsHook`);
  }
});

test('settings: a byte-order mark is read past and written back', async () => {
  const home = makeHome();
  const actions = await lib('actions.mjs');
  const inv = await lib('inventory.mjs');
  const file = path.join(home, 'settings.json');
  const v = { indent: 2, crlf: true, trailing: true, bom: true };
  fs.writeFileSync(file, shape(baseSettings(), v));
  assert.equal(inv.readSettings().enabledPlugins['plug-a@market'], true);
  actions.setPluginEnabled('plug-a@market', false);
  const expected = baseSettings();
  expected.enabledPlugins['plug-a@market'] = false;
  assert.equal(fs.readFileSync(file, 'utf8'), shape(expected, v));
});

test('settings hooks: restoring the same hook twice leaves one entry', async () => {
  const home = makeHome();
  const actions = await lib('actions.mjs');
  writeSettings(home, { ...baseSettings(), hooks: { ...baseSettings().hooks, PreCompact: [{ hooks: [{ type: 'command', command: 'echo only' }] }] } });
  const shared = actions.removeSettingsHook('echo a');
  const alone = actions.removeSettingsHook('echo only');
  for (let i = 0; i < 2; i++) {
    actions.restoreSettingsHook(shared);
    actions.restoreSettingsHook(alone);
  }
  const s = readJson(path.join(home, 'settings.json'));
  assert.deepEqual(s.hooks.SessionStart[0].hooks.map((h) => h.command).sort(), ['echo a', 'echo b']);
  assert.deepEqual(s.hooks.PreCompact.flatMap((g) => g.hooks.map((h) => h.command)), ['echo only']);
});

test('purge: a quarantine path outside the quarantine folder is never deleted', async () => {
  const home = makeHome();
  const { quarantineDir } = await lib('paths.mjs');
  const { purge } = await lib('restore.mjs');
  const { formatPurge } = await lib('render.mjs');
  const folder = (p) => {
    fs.mkdirSync(p, { recursive: true });
    fs.writeFileSync(path.join(p, 'SKILL.md'), 'keep me');
    return p;
  };
  const outside = folder(path.join(tmp(), 'not-quarantine'));
  const sibling = folder(`${quarantineDir()}-other`);
  const inside = folder(path.join(quarantineDir(), 'stamp-4', 'personal-skill-c'));
  const manifestPath = path.join(home, 'context-diet', 'manifests', 'edited.json');
  const dirChange = (id, quarantine) => ({ id, type: 'dir', path: path.join(home, 'skills', id), quarantine, hash: 'x', done: true });
  writeJson(manifestPath, { version: 1, verdict: 'pass', changes: [dirChange('skill:a', outside), dirChange('skill:b', sibling), dirChange('skill:c', inside)] });
  const p = purge({ manifestPath, yes: true });
  assert.equal(p.refused, null);
  assert.deepEqual(p.deleted, [inside]);
  assert.deepEqual(p.skipped.map((s) => s.id), ['skill:a', 'skill:b']);
  assert.ok(fs.existsSync(path.join(outside, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(sibling, 'SKILL.md')));
  assert.equal(fs.existsSync(inside), false);
  assert.match(formatPurge(p), /Skipped \(not deleted\)/);
});

test('paths: CLAUDE_CONFIG_DIR is the home when CONTEXT_DIET_HOME is unset', async () => {
  const saved = { CONTEXT_DIET_HOME: process.env.CONTEXT_DIET_HOME, CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR };
  const dir = tmp();
  try {
    delete process.env.CONTEXT_DIET_HOME;
    process.env.CLAUDE_CONFIG_DIR = dir;
    const p = await lib('paths.mjs');
    assert.equal(p.claudeHome(), dir);
    assert.equal(p.stateDir(), path.join(dir, 'context-diet'));
    process.env.CONTEXT_DIET_HOME = path.join(dir, 'override');
    assert.equal(p.claudeHome(), path.join(dir, 'override'), 'CONTEXT_DIET_HOME still wins');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

const pluginWorld = (home, specs) => {
  const enabled = {};
  for (const spec of specs) {
    addPlugin(home, spec);
    enabled[spec.id] = true;
  }
  writeSettings(home, { enabledPlugins: enabled });
  for (let i = 0; i < 25; i++) {
    addSession(home, { id: `w${i}`, records: loaded({ skills: specs.map((s) => ({ name: `${s.short}:s` })) }) });
  }
};

test('report: a malformed hook group marks the plugin unreadable instead of aborting the scan', async () => {
  const home = makeHome();
  pluginWorld(home, [
    { id: 'empty-g@market', short: 'empty-g', manifestHooks: { PreToolUse: [{ hooks: {} }] } },
    { id: 'five-g@market', short: 'five-g', manifestHooks: { PreToolUse: [{ matcher: 'Bash', hooks: 5 }] } },
    { id: 'plain-p@market', short: 'plain-p' },
  ]);
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  const row = (id) => r.plugins.find((p) => p.id === id);
  assert.equal(row('plugin:empty-g@market').protected, 'plugin hooks could not be read');
  assert.equal(row('plugin:five-g@market').protected, 'plugin hooks could not be read');
  assert.equal(row('plugin:plain-p@market').protected, null);
  assert.deepEqual(r.candidates, ['plugin:plain-p@market']);
});

test('report: a commandless PreToolUse hook and an array of hook paths each make a guard plugin', async () => {
  const home = makeHome();
  pluginWorld(home, [
    { id: 'prompt-g@market', short: 'prompt-g', manifestHooks: { PreToolUse: [{ hooks: [{ type: 'prompt', prompt: 'x' }] }] } },
    { id: 'array-g@market', short: 'array-g', manifestHooks: ['./a-hooks.json', './b-hooks.json'] },
    { id: 'plain-p@market', short: 'plain-p' },
  ]);
  const arrayRoot = path.join(home, 'plugins', 'cache', 'array-g-market', '1.0.0');
  writeJson(path.join(arrayRoot, 'a-hooks.json'), { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo a' }] }] } });
  writeJson(path.join(arrayRoot, 'b-hooks.json'), { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'array-guard' }] }] });
  const inv = await lib('inventory.mjs');
  const plugins = Object.fromEntries(inv.installedPlugins().map((p) => [p.id, p]));
  assert.deepEqual(plugins['prompt-g@market'].hooks, [{ event: 'PreToolUse', matcher: null, command: null }]);
  assert.deepEqual(plugins['array-g@market'].hooks.map((h) => h.command), ['echo a', 'array-guard']);
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  const row = (id) => r.plugins.find((p) => p.id === id);
  assert.equal(row('plugin:prompt-g@market').protected, 'plugin supplies a PreToolUse guard');
  assert.equal(row('plugin:array-g@market').protected, 'plugin supplies a PreToolUse guard');
  assert.deepEqual(r.candidates, ['plugin:plain-p@market']);
  assert.deepEqual(r.guards.map((g) => [g.command, g.plugin, g.fires]), [['array-guard', 'array-g@market', 0], ['(hook without a command)', 'prompt-g@market', 0]]);
});

test('settings hooks: a PreToolUse hook without a command does not crash scan or apply and adds no guard entry', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  writeSettings(home, {
    enabledPlugins: {},
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }],
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'prompt', prompt: 'x' }] }],
    },
  });
  for (let i = 0; i < 25; i++) {
    addSession(home, { id: `n${i}`, records: loaded({ skills: [{ name: 'only-skill' }], hooks: [{ command: 'echo hi', out: 'abc' }] }) });
  }
  const { scan } = await lib('scan.mjs');
  const report = await scan();
  assert.deepEqual(report.guards, []);
  const only = { skills: ['only-skill'], agents: [], mcp: [] };
  installStub([{ ...only, hooks: [{ command: 'echo hi', out: 'abc' }] }, { ...only, hooks: [] }]);
  const { apply } = await lib('apply.mjs');
  const a = await apply({ picks: ['hook:echo hi'], cwd: work });
  assert.equal(a.error, null);
  assert.ok(a.checks.every((c) => c.ok), JSON.stringify(a.checks));
  assert.deepEqual(a.guards, []);
  assert.deepEqual(readJson(a.manifest).guards.settings, []);
  assert.deepEqual(readJson(path.join(home, 'settings.json')).hooks.PreToolUse, [{ matcher: 'Bash', hooks: [{ type: 'prompt', prompt: 'x' }] }]);
});

test('restore: a folder change left mid-removal by a killed process is put back in full', async () => {
  const home = makeHome();
  const actions = await lib('actions.mjs');
  const { restore } = await lib('restore.mjs');
  const src = path.join(home, 'skills', 'skill-x');
  fs.mkdirSync(path.join(src, 'refs'), { recursive: true });
  fs.writeFileSync(path.join(src, 'SKILL.md'), 'body');
  fs.writeFileSync(path.join(src, 'refs', 'more.md'), 'more');
  const record = actions.copyToQuarantine(src, 'stamp-5', 'personal-skill-x');
  fs.rmSync(path.join(src, 'refs'), { recursive: true, force: true });
  const manifestPath = path.join(home, 'context-diet', 'manifests', 'killed.json');
  writeJson(manifestPath, { version: 1, status: 'applying', changes: [{ id: 'skill:skill-x', type: 'dir', path: src, label: 'personal-skill-x', ...record, done: false, partial: true }] });
  const r = restore({ manifestPath });
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.restored, ['skill:skill-x']);
  assert.equal(actions.hashDir(src), record.hash);
  assert.equal(fs.readFileSync(path.join(src, 'refs', 'more.md'), 'utf8'), 'more');
  assert.equal(fs.existsSync(record.quarantine), false);
});

test('report: no removal candidates while rarely used rows still print in their own section', async () => {
  const home = makeHome();
  buildScenario(home);
  writeJson(path.join(home, 'context-diet', 'keep.json'), { keep: ['plugin:plug-a@market', 'skill:local-dead', 'skill:local-link'] });
  const { scan } = await lib('scan.mjs');
  const { formatReport } = await lib('render.mjs');
  const r = await scan();
  assert.deepEqual(r.candidates, []);
  assert.deepEqual(r.rarely, ['plugin:rare-p@market']);
  const text = formatReport(r);
  assert.match(text, /\nRemoval candidates\nnone: nothing meets the thresholds \(a valid result\)\n/);
  const rare = text.slice(text.indexOf('\nRarely used (not removal candidates)\n'));
  assert.ok(text.includes('\nRarely used (not removal candidates)\n'), text);
  assert.match(rare.split('\n\n')[0], /plugin:rare-p@market\s+25\s+1\s+4%.*rarely used/);
  const candidates = text.slice(text.indexOf('\nRemoval candidates\n'), text.indexOf('\nRarely used (not removal candidates)\n'));
  assert.doesNotMatch(candidates, /rare-p/);
});

test('report: a hooks/hooks.json in another schema declares no hooks, a malformed hooks file is still unreadable', async () => {
  const home = makeHome();
  pluginWorld(home, [
    { id: 'mods-a@market', short: 'mods-a', hooksJsonText: JSON.stringify({ modules: [] }) },
    { id: 'mods-b@market', short: 'mods-b', hooksJsonText: JSON.stringify({ modules: [{ name: 'mod-1', enabled: true }] }) },
    { id: 'bad-h@market', short: 'bad-h', hooksJsonText: JSON.stringify({ hooks: { PreToolUse: [{ hooks: {} }] } }) },
  ]);
  const inv = await lib('inventory.mjs');
  const plugins = Object.fromEntries(inv.installedPlugins().map((p) => [p.id, p]));
  for (const id of ['mods-a@market', 'mods-b@market']) {
    assert.deepEqual(plugins[id].hooks, [], id);
    assert.equal('hooksUnreadable' in plugins[id], false, id);
  }
  assert.equal(plugins['bad-h@market'].hooksUnreadable, true);
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  const row = (id) => r.plugins.find((p) => p.id === id);
  assert.equal(row('plugin:mods-a@market').protected, null);
  assert.equal(row('plugin:mods-b@market').protected, null);
  assert.equal(row('plugin:bad-h@market').protected, 'plugin hooks could not be read');
  assert.deepEqual(r.candidates, ['plugin:mods-a@market', 'plugin:mods-b@market']);
});

test('verify: a guard plugin whose only hook has no command is tracked, and disabling it by hand fails verify', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  pluginWorld(home, [
    { id: 'prompt-g@market', short: 'prompt-g', manifestHooks: { PreToolUse: [{ hooks: [{ type: 'prompt', prompt: 'x' }] }] } },
    { id: 'plain-p@market', short: 'plain-p' },
  ]);
  const { scan } = await lib('scan.mjs');
  const { formatReport } = await lib('render.mjs');
  const r = await scan();
  assert.deepEqual(r.guards, [{ command: '(hook without a command)', plugin: 'prompt-g@market', fires: 0 }]);
  assert.match(formatReport(r), /Guard hooks \(kept\)\ncommand\s+plugin\s+fires\n\(hook without a command\)\s+prompt-g@market\s+0/);

  const both = { skills: ['plain-p:s', 'prompt-g:s'], agents: [], mcp: [] };
  const kept = { skills: ['prompt-g:s'], agents: [], mcp: [] };
  installStub([both, kept]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const a = await apply({ picks: ['plugin:plain-p@market'], cwd: work });
  assert.equal(a.error, null);
  const manifest = readJson(a.manifest);
  assert.deepEqual(manifest.guards, { plugins: ['prompt-g@market'], settings: [] });
  assert.deepEqual(a.guards.map((g) => [g.id, g.ok]), [['guard prompt-g@market', true]]);

  const settings = readJson(path.join(home, 'settings.json'));
  settings.enabledPlugins['prompt-g@market'] = false;
  writeJson(path.join(home, 'settings.json'), settings);
  const v = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(v.verdict, 'fail');
  assert.match(v.guards.find((g) => g.id === 'guard prompt-g@market').detail, /DISABLED/);
});

const FLAKY_BEFORE = { ...FULL, mcp: [...FULL.mcp, 'flaky-server'] };
const GONE_SKILLS = ['plug-a:skill-y', 'local-link', 'local-dead'];

test('verify: an MCP server outside the change that differs between the probes is unstable, not a failure, and a rerun settles it', async () => {
  const { work } = await applyWorld();
  const missing = minus(FLAKY_BEFORE, { skills: GONE_SKILLS, agents: PLUG_A.agents, mcp: [...PLUG_A.mcp, 'flaky-server'] });
  const back = minus(FLAKY_BEFORE, { skills: GONE_SKILLS, agents: PLUG_A.agents, mcp: PLUG_A.mcp });
  installStub([FLAKY_BEFORE]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const { formatVerify } = await lib('render.mjs');
  const { purge } = await lib('restore.mjs');
  const a = await apply({ picks: PICKS, cwd: work });

  installStub([missing]);
  const first = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(first.verdict, 'incomplete');
  assert.deepEqual(first.items.map((i) => i.status), ['GONE', 'GONE', 'GONE']);
  assert.deepEqual(first.collateral.lost, []);
  assert.deepEqual(first.collateral.unstable, ['mcp:flaky_server']);
  const text = formatVerify(first);
  assert.ok(text.includes('mcp:flaky_server  (unstable, rerun: '), text);
  assert.ok(text.includes(`Unstable, rerun: verify ${a.manifest}`), text);
  assert.match(purge({ manifestPath: a.manifest, yes: true }).refused, /verdict: incomplete/);

  installStub([back]);
  const second = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(second.verdict, 'pass');
  assert.deepEqual(second.collateral, { observed: true, lost: [], unstable: [] });
  assert.doesNotMatch(formatVerify(second), /unstable, rerun/i);
});

test('verify: a lost skill still fails even when an unstable MCP server is also missing', async () => {
  const { work } = await applyWorld();
  const after = minus(FLAKY_BEFORE, { skills: [...GONE_SKILLS, 'used-p:u'], agents: PLUG_A.agents, mcp: [...PLUG_A.mcp, 'flaky-server'] });
  installStub([FLAKY_BEFORE]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const a = await apply({ picks: PICKS, cwd: work });
  installStub([after]);
  const v = await verify({ manifestPath: a.manifest, cwd: work });
  assert.equal(v.verdict, 'fail');
  assert.deepEqual(v.collateral.lost, ['skills:used-p:u']);
  assert.deepEqual(v.collateral.unstable, ['mcp:flaky_server']);
});

const listFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true }).map(String).sort();
};

test('safety: a skill name must be a single path segment and a skill path must sit in a .claude/skills folder', async () => {
  const p = await lib('paths.mjs');
  for (const bad of ['../x', '..', '.', 'a/b', 'a\\b', '', 'c:x', 'nul\0x', 5, null]) assert.equal(p.isSafeSkillName(bad), false, String(bad));
  for (const good of ['skill-x', 'local-dead', 'a.b']) assert.equal(p.isSafeSkillName(good), true, good);
  const base = tmp();
  assert.equal(p.isSkillPath(path.join(base, '.claude', 'skills', 'skill-x')), true);
  assert.equal(p.isSkillPath(path.join(base, 'skills', 'skill-x')), false);
  assert.equal(p.isSkillPath(path.join(base, '.claude', 'projects')), false);
  assert.equal(p.isSkillPath(path.join(base, '.claude', 'skills', '..')), false);
});

test('safety: a listed skill named ../projects is never offered and apply never touches the transcripts folder', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  for (let i = 0; i < 25; i++) {
    addSession(home, { id: `t${i}`, records: loaded({ skills: [{ name: '../projects', desc: 'x' }, { name: 'skill-x' }] }) });
  }
  const before = listFiles(path.join(home, 'projects'));
  const stub = installStub([FULL]);
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  const item = r.items.find((i) => i.id === 'skill:../projects');
  assert.ok(item, 'the item is still reported');
  assert.equal(item.local, null);
  assert.equal(item.candidate, false);
  assert.deepEqual(r.candidates, []);

  const { apply } = await lib('apply.mjs');
  const a = await apply({ picks: ['skill:../projects'], cwd: work });
  assert.deepEqual(a.changes, []);
  assert.match(a.skipped[0].reason, /unsafe skill name/);

  const reportFile = path.join(home, 'context-diet', 'report.json');
  const stale = readJson(reportFile);
  const forged = stale.items.find((i) => i.id === 'skill:../projects');
  Object.assign(forged, { local: { scope: 'personal', path: path.join(home, 'skills', '..', 'projects'), kind: 'dir' }, via: 'local', candidate: true });
  writeJson(reportFile, stale);
  const b = await apply({ picks: ['skill:../projects'], cwd: work });
  assert.deepEqual(b.changes, []);
  assert.match(b.skipped[0].reason, /unsafe skill name/);

  assert.deepEqual(listFiles(path.join(home, 'projects')), before, 'the transcripts folder is untouched');
  assert.equal(fs.existsSync(path.join(home, 'context-diet', 'quarantine')), false, 'no quarantine was created');
  assert.equal(stub.calls().length, 0);
});

test('safety: names that are not one path segment are never candidates and apply refuses them', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const names = ['../x', '..', '.', 'a/b', 'a\\b', ''];
  fs.mkdirSync(path.join(home, 'x'), { recursive: true });
  fs.mkdirSync(path.join(home, 'skills', 'a', 'b'), { recursive: true });
  for (let i = 0; i < 25; i++) {
    addSession(home, { id: `u${i}`, records: loaded({ skills: [...names.map((name) => ({ name })), { name: 'skill-x' }] }) });
  }
  const stub = installStub([FULL]);
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  for (const name of names) {
    const item = r.items.find((i) => i.id === `skill:${name}`);
    assert.ok(item, `skill:${name} is reported`);
    assert.equal(item.local, null, name);
    assert.equal(item.candidate, false, name);
  }
  assert.deepEqual(r.candidates, []);

  const reportFile = path.join(home, 'context-diet', 'report.json');
  const forged = readJson(reportFile);
  for (const it of forged.items) {
    if (!names.includes(it.name)) continue;
    Object.assign(it, { local: { scope: 'personal', path: path.join(home, 'skills', it.name), kind: 'dir' }, via: 'local', candidate: true });
  }
  writeJson(reportFile, forged);
  const { apply } = await lib('apply.mjs');
  const a = await apply({ picks: names.map((n) => `skill:${n}`), cwd: work });
  assert.deepEqual(a.changes, []);
  assert.equal(a.skipped.length, names.length);
  for (const s of a.skipped) assert.match(s.reason, /unsafe skill name/, s.id);
  assert.ok(fs.existsSync(path.join(home, 'x')) && fs.existsSync(path.join(home, 'skills', 'a', 'b')));
  assert.equal(fs.existsSync(path.join(home, 'context-diet', 'quarantine')), false);
  assert.equal(stub.calls().length, 0);
});

test('safety: a forged report path outside a skills folder is refused even for a safe name', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  for (let i = 0; i < 25; i++) addSession(home, { id: `v${i}`, records: loaded({ skills: [{ name: 'skill-x' }, { name: 'projects' }] }) });
  const stub = installStub([FULL]);
  const { scan } = await lib('scan.mjs');
  await scan();
  const reportFile = path.join(home, 'context-diet', 'report.json');
  const forged = readJson(reportFile);
  Object.assign(forged.items.find((i) => i.id === 'skill:projects'), { local: { scope: 'personal', path: path.join(home, 'projects'), kind: 'dir' }, via: 'local', candidate: true });
  writeJson(reportFile, forged);
  const before = listFiles(path.join(home, 'projects'));
  const { apply } = await lib('apply.mjs');
  const a = await apply({ picks: ['skill:projects'], cwd: work });
  assert.deepEqual(a.changes, []);
  assert.match(a.skipped[0].reason, /not inside a skills folder/);
  assert.deepEqual(listFiles(path.join(home, 'projects')), before);
  assert.equal(stub.calls().length, 0);
});

test('apply order: the manifest and the settings backup are on disk before an original folder is removed', async () => {
  const { home, work } = await applyWorld();
  installStub([FULL, GONE]);
  const { manifestsDir } = await lib('paths.mjs');
  const { apply } = await lib('apply.mjs');
  const settingsBefore = fs.readFileSync(path.join(home, 'settings.json'));
  let snapshot = null;
  let backupBytes = null;
  const remove = (p) => {
    const files = fs.readdirSync(manifestsDir());
    assert.equal(files.length, 1);
    snapshot = readJson(path.join(manifestsDir(), files[0]));
    backupBytes = snapshot.settingsBackup && fs.existsSync(snapshot.settingsBackup) ? fs.readFileSync(snapshot.settingsBackup) : null;
    fs.rmSync(p, { recursive: true, force: true });
  };
  const a = await apply({ picks: ['skill:local-dead'], cwd: work, remove });
  assert.equal(a.error, null);
  assert.ok(snapshot, 'remove was called');
  assert.equal(snapshot.status, 'applying');
  const change = snapshot.changes.find((c) => c.id === 'skill:local-dead');
  assert.equal(change.type, 'dir');
  assert.ok(change.quarantine && change.hash, JSON.stringify(change));
  assert.equal(change.partial, true);
  assert.equal(change.done, false);
  assert.ok(backupBytes, 'the settings backup exists when the original is removed');
  assert.deepEqual(backupBytes, settingsBefore);
  assert.equal(fs.existsSync(path.join(home, 'skills', 'local-dead')), false);
});

test('apply order: the first failure stops the run, later changes are not made, and restore undoes the done ones', async () => {
  const { home, work } = await applyWorld();
  installStub([FULL, GONE]);
  const actions = await lib('actions.mjs');
  const { apply } = await lib('apply.mjs');
  const { restore } = await lib('restore.mjs');
  const deadHash = actions.hashDir(path.join(home, 'skills', 'local-dead'));
  fs.writeFileSync(path.join(home, 'settings.json'), '{"enabledPlugins": {"plug-a@market": true},');
  const a = await apply({ picks: ['skill:local-dead', 'plugin:plug-a@market', 'skill:local-link'], cwd: work });
  assert.ok(a.error, 'the run reports an error');
  assert.match(a.error, /^plugin:plug-a@market: /);
  const m = readJson(a.manifest);
  assert.equal(m.status, 'partial');
  const byId = Object.fromEntries(m.changes.map((c) => [c.id, c]));
  assert.equal(byId['skill:local-dead'].done, true);
  assert.equal(byId['plugin:plug-a@market'].done, false);
  assert.ok(byId['plugin:plug-a@market'].error);
  assert.equal(byId['skill:local-link'].done, false);
  assert.equal(byId['skill:local-link'].error, undefined);
  assert.ok(fs.lstatSync(path.join(home, 'skills', 'local-link')).isSymbolicLink(), 'the link was never touched');
  assert.equal(fs.existsSync(path.join(home, 'skills', 'local-dead')), false);

  const r = restore({ manifestPath: a.manifest });
  assert.deepEqual(r.restored, ['skill:local-dead']);
  assert.deepEqual(r.failed, []);
  assert.equal(actions.hashDir(path.join(home, 'skills', 'local-dead')), deadHash);
});

test('removeLink: a path that is not a link is refused', async () => {
  makeHome();
  const actions = await lib('actions.mjs');
  const dir = path.join(tmp(), 'skill-x');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), 'body');
  assert.throws(() => actions.removeLink(dir), /is not a link/);
  assert.ok(fs.existsSync(path.join(dir, 'SKILL.md')));
});

test('protection inputs: a malformed keep.json or settings.json stops scan with a message and no file content', async () => {
  const home = makeHome();
  buildScenario(home, { sessions: 2 });
  const env = { CONTEXT_DIET_HOME: home };
  const keepFile = path.join(home, 'context-diet', 'keep.json');
  fs.mkdirSync(path.dirname(keepFile), { recursive: true });
  fs.writeFileSync(keepFile, '{"keep": ["plugin:plug-a@market",]}');
  const badKeep = await runDiet(['scan'], env);
  assert.equal(badKeep.code, 1);
  assert.match(badKeep.stderr, /keep\.json is unreadable or not \{"keep": \[\.\.\.\]\}: fix or remove it/);
  assert.equal(fs.existsSync(path.join(home, 'context-diet', 'report.json')), false, 'no report is written');
  fs.writeFileSync(keepFile, JSON.stringify({ keep: ['plugin:plug-a@market', 5] }));
  assert.equal((await runDiet(['scan'], env)).code, 1, 'a non-string entry is not a valid keep list');
  fs.rmSync(keepFile);

  fs.writeFileSync(path.join(home, 'settings.json'), '{"env": {"API_TOKEN": "secret-value-123"}, "enabledPlugins": {');
  const badSettings = await runDiet(['scan'], env);
  assert.equal(badSettings.code, 1);
  assert.match(badSettings.stderr, /settings\.json is not valid JSON; nothing was changed/);
  assert.doesNotMatch(badSettings.stderr + badSettings.stdout, /secret-value-123|API_TOKEN/);
});

test('protection at apply time: keep.json entries added after the scan block the pick', async () => {
  const { home, work } = await applyWorld();
  const stub = installStub([FULL, GONE]);
  const settingsBefore = fs.readFileSync(path.join(home, 'settings.json'));
  writeJson(path.join(home, 'context-diet', 'keep.json'), { keep: ['plugin:plug-a@market', 'local-dead'] });
  const { apply } = await lib('apply.mjs');
  const a = await apply({ picks: ['plugin:plug-a@market', 'skill:local-dead', 'skill:plug-a:skill-y'], cwd: work });
  assert.deepEqual(a.changes, []);
  const reason = Object.fromEntries(a.skipped.map((s) => [s.id, s.reason]));
  assert.equal(reason['plugin:plug-a@market'], 'protected: listed in keep.json');
  assert.equal(reason['skill:local-dead'], 'protected: listed in keep.json', 'a bare-name keep entry blocks the item');
  assert.equal(reason['skill:plug-a:skill-y'], 'protected: listed in keep.json', 'a plugin: keep entry covers its member items');
  assert.deepEqual(fs.readFileSync(path.join(home, 'settings.json')), settingsBefore);
  assert.ok(fs.existsSync(path.join(home, 'skills', 'local-dead', 'SKILL.md')));
  assert.equal(stub.calls().length, 0);

  fs.writeFileSync(path.join(home, 'context-diet', 'keep.json'), '{"keep": [');
  await assert.rejects(apply({ picks: ['skill:local-dead'], cwd: work }), /keep\.json is unreadable/);
  assert.ok(fs.existsSync(path.join(home, 'skills', 'local-dead', 'SKILL.md')));
});

test('checks: an unreadable settings.json fails the static checks and every guard row', async () => {
  const home = makeHome();
  const { staticChecks, guardsIntact } = await lib('checks.mjs');
  const manifest = { cwd: home, changes: [], guards: { plugins: ['guard-p@market'], settings: ['guard-local'] } };
  writeSettings(home, { enabledPlugins: {}, hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'guard-local' }] }] } });
  assert.deepEqual(staticChecks(manifest), []);
  assert.ok(guardsIntact(manifest).every((g) => g.ok));
  fs.writeFileSync(path.join(home, 'settings.json'), '{"hooks": ');
  assert.deepEqual(staticChecks(manifest), [{ id: 'settings.json', ok: false, detail: 'settings.json cannot be read' }]);
  const guards = guardsIntact(manifest);
  assert.equal(guards.length, 2);
  assert.ok(guards.every((g) => !g.ok && g.detail === 'settings.json cannot be read'), JSON.stringify(guards));
});

test('scan reliability: wrongly shaped fields and non-object lines do not crash scan', async () => {
  const home = makeHome();
  const file = path.join(home, 'projects', 'proj-a', 'odd.jsonl');
  const lines = [
    { type: 'attachment', cwd: 42, timestamp: 7, attachment: { type: 'skill_listing', names: 5, content: '- skill-x: x' } },
    { type: 'attachment', attachment: { type: 'agent_listing_delta', addedTypes: 'x', addedLines: 3 } },
    { type: 'attachment', attachment: { type: 'mcp_instructions_delta', addedNames: [5, null, 'srv-a'], addedBlocks: 'nope' } },
    { type: 'attachment', attachment: { type: 'deferred_tools_delta', addedNames: { a: 1 }, needsAuthMcpServers: 'x', failedMcpServers: [3, { name: 4 }] } },
    { type: 'attachment', attachment: { type: 'invoked_skills', skills: 'skill-x' } },
    { type: 'attachment', attachment: { type: 'hook_success', hookEvent: 'SessionStart', command: 9, stdout: 12 } },
    { type: 'attachment', attachment: 'just a string' },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 3 } }, { type: 'tool_use', name: 'Skill', input: 'x' }] } },
  ];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [...lines.map((l) => JSON.stringify(l)), '5', 'null', '"text"', '[1,2]'].join('\n') + '\n');
  const { readSessions } = await lib('transcripts.mjs');
  const { sessions, skippedFiles } = await readSessions();
  assert.equal(skippedFiles, 0);
  assert.equal(sessions.length, 1);
  const s = sessions[0];
  assert.equal(s.cwd, null, 'a numeric cwd is ignored');
  assert.deepEqual([...s.listing.skills.keys()], ['skill-x']);
  assert.deepEqual([...s.listing.agents.keys()], []);
  assert.deepEqual([...s.listing.mcp.keys()], ['srv_a']);
  assert.equal(s.used.skills.size, 0, 'a non-array skills field is ignored');
  assert.deepEqual([...s.used.agents.entries()], [['general-purpose', 1]]);
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  assert.equal(r.coverage.sessions, 1);
});

test('scan reliability: an unreadable transcript is skipped and counted on the Coverage line', async () => {
  const home = makeHome();
  for (let i = 0; i < 3; i++) addSession(home, { id: `c${i}`, records: loaded({ skills: [{ name: 'skill-x' }] }) });
  fs.mkdirSync(path.join(home, 'projects', 'proj-a', 'x.jsonl'), { recursive: true });
  const { scan } = await lib('scan.mjs');
  const { formatReport } = await lib('render.mjs');
  const r = await scan();
  assert.equal(r.coverage.sessions, 3);
  assert.equal(r.coverage.skippedFiles, 1);
  assert.match(formatReport(r), /^Coverage: 3 sessions \(3 with a skill listing\), .* to .*, 1 item could not be read$/m);
  fs.rmSync(path.join(home, 'projects', 'proj-a', 'x.jsonl'), { recursive: true });
  const clean = await scan();
  assert.equal(clean.coverage.skippedFiles, 0);
  assert.doesNotMatch(formatReport(clean), /could not be read/);
  const { summarizeFile } = await lib('transcripts.mjs');
  fs.mkdirSync(path.join(home, 'projects', 'proj-a', 'y.jsonl'));
  await assert.rejects(summarizeFile(path.join(home, 'projects', 'proj-a', 'y.jsonl')));
});

test('cli: threshold flags are validated and duplicate picks make one change', async () => {
  const { home, work } = await applyWorld();
  const env = { CONTEXT_DIET_HOME: home };
  for (const args of [['--min-sessions', 'abc'], ['--min-sessions', '0'], ['--min-sessions', '-1'], ['--min-sessions', '1.5'], ['--rarely-pct', '101'], ['--rarely-pct', 'x'], ['--rarely-pct', '-1']]) {
    const r = await runDiet(['scan', ...args], env);
    assert.equal(r.code, 1, args.join(' '));
    assert.equal(r.stderr.trim().split('\n').length, 1, r.stderr);
    assert.match(r.stderr, /must be/);
  }
  assert.equal((await runDiet(['scan', '--min-sessions', '3', '--rarely-pct', '0'], env)).code, 0);
  installStub([FULL, minus(FULL, { skills: ['local-dead'] })]);
  const a = await runDiet(['apply', '--pick', 'skill:local-dead,skill:local-dead', '--cwd', work, '--json'], env);
  const result = JSON.parse(a.stdout);
  assert.deepEqual(result.changes.map((c) => c.id), ['skill:local-dead']);
  assert.equal(result.verification.verdict, 'pass', a.stdout);
});

test('probes.json: an unparsable file is set aside, never silently overwritten', async () => {
  const home = makeHome();
  const { registerProbe, readProbeIds } = await lib('state.mjs');
  const file = path.join(home, 'context-diet', 'probes.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '["p0",');
  registerProbe('p1');
  assert.equal(fs.readFileSync(`${file}.corrupt`, 'utf8'), '["p0",');
  assert.deepEqual(readProbeIds(), ['p1']);
  registerProbe('p2');
  assert.deepEqual(readProbeIds(), ['p1', 'p2']);
});

test('settings edits: invalid JSON is refused without echoing content, and a failed rename leaves the original', async () => {
  const home = makeHome();
  const actions = await lib('actions.mjs');
  const state = await lib('state.mjs');
  const file = path.join(home, 'settings.json');
  const broken = '{"env": {"API_TOKEN": "secret-value-123"}, "enabledPlugins": {';
  fs.writeFileSync(file, broken);
  assert.throws(
    () => actions.setPluginEnabled('plug-a@market', false),
    (e) => e.message === 'settings.json is not valid JSON; nothing was changed' && !/secret-value-123/.test(e.message)
  );
  assert.equal(fs.readFileSync(file, 'utf8'), broken);

  writeSettings(home, baseSettings());
  const before = fs.readFileSync(file);
  const nodeFs = require('node:fs');
  const realRename = nodeFs.renameSync;
  nodeFs.renameSync = () => {
    throw new Error('simulated rename failure');
  };
  try {
    assert.throws(() => actions.setPluginEnabled('plug-a@market', false), /simulated rename failure/);
    const manifest = path.join(home, 'context-diet', 'manifests', 'm.json');
    assert.throws(() => state.writeJsonFile(manifest, { a: 1 }), /simulated rename failure/);
  } finally {
    nodeFs.renameSync = realRename;
  }
  assert.deepEqual(fs.readFileSync(file), before);
  assert.deepEqual(fs.readdirSync(home).filter((n) => n.includes('.tmp-')), []);
  assert.deepEqual(fs.readdirSync(path.join(home, 'context-diet', 'manifests')), []);
  actions.setPluginEnabled('plug-a@market', false);
  assert.equal(readJson(file).enabledPlugins['plug-a@market'], false);
  assert.deepEqual(fs.readdirSync(home).filter((n) => n.includes('.tmp-')), []);
});

test('state files are owner-only where the OS supports it', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX modes do not apply on Windows');
  const { work, home } = await applyWorld();
  installStub([FULL, GONE]);
  const { apply } = await lib('apply.mjs');
  const a = await apply({ picks: PICKS, cwd: work });
  const mode = (p) => fs.statSync(p).mode & 0o777;
  assert.equal(mode(a.manifest), 0o600);
  assert.equal(mode(path.join(home, 'context-diet', 'report.json')), 0o600);
  assert.equal(mode(readJson(a.manifest).settingsBackup), 0o600);
  assert.equal(mode(path.join(home, 'context-diet', 'manifests')) & 0o077, 0);
});

test('cli errors: one line by default, a stack with CONTEXT_DIET_DEBUG=1', async () => {
  const home = makeHome();
  const missing = path.join(tmp(), 'nope.json');
  const plain = await runDiet(['verify', missing], { CONTEXT_DIET_HOME: home, CONTEXT_DIET_DEBUG: '' });
  assert.equal(plain.code, 1);
  assert.equal(plain.stderr.trim().split('\n').length, 1, plain.stderr);
  assert.match(plain.stderr, /cannot read manifest/);
  assert.doesNotMatch(plain.stderr, /^\s+at /m);
  const debug = await runDiet(['verify', missing], { CONTEXT_DIET_HOME: home, CONTEXT_DIET_DEBUG: '1' });
  assert.equal(debug.code, 1);
  assert.match(debug.stderr, /cannot read manifest/);
  assert.match(debug.stderr, /^\s+at /m);
});

test('cli apply: a verify that throws keeps the apply result, prints the restore command and exits 3', async () => {
  const { home, work } = await applyWorld();
  installStub([FULL, { dirTranscript: true }]);
  const env = { CONTEXT_DIET_HOME: home };
  const a = await runDiet(['apply', '--pick', 'skill:local-dead', '--cwd', work], env);
  assert.equal(a.code, 3, a.stderr + a.stdout);
  const manifest = a.stdout.match(/Manifest: (.+)/)[1].trim();
  assert.ok(fs.existsSync(manifest));
  assert.match(a.stdout, /skill:local-dead\s+dir\s+done/);
  assert.ok(a.stdout.includes(`Verification failed: `), a.stdout);
  assert.ok(a.stdout.includes(`. Restore with: restore ${manifest}`), a.stdout);
  installStub([FULL, { dirTranscript: true }]);
  const j = await runDiet(['apply', '--pick', 'skill:local-link', '--cwd', work, '--json'], env);
  assert.equal(j.code, 3);
  assert.ok(JSON.parse(j.stdout).verificationError);
});

test('quarantine: the empty stamp folder is removed after purge and after restore', async () => {
  const { home, work } = await applyWorld();
  installStub([FULL, minus(FULL, { skills: ['local-dead'] })]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const { purge, restore } = await lib('restore.mjs');
  const a = await apply({ picks: ['skill:local-dead'], cwd: work });
  const stampDir = path.dirname(a.changes[0].quarantine);
  assert.equal((await verify({ manifestPath: a.manifest, cwd: work })).verdict, 'pass');
  assert.deepEqual(purge({ manifestPath: a.manifest, yes: true }).deleted, [a.changes[0].quarantine]);
  assert.equal(fs.existsSync(stampDir), false, 'the stamp folder is gone after purge');
  assert.ok(fs.existsSync(path.join(home, 'context-diet', 'quarantine')), 'the quarantine root stays');

  installStub([FULL, minus(FULL, { skills: ['local-link'] })]);
  fs.mkdirSync(path.join(home, 'skills', 'local-dead'), { recursive: true });
  fs.writeFileSync(path.join(home, 'skills', 'local-dead', 'SKILL.md'), 'again');
  const b = await apply({ picks: ['skill:local-dead'], cwd: work });
  const stampB = path.dirname(b.changes[0].quarantine);
  assert.ok(fs.existsSync(stampB));
  assert.deepEqual(restore({ manifestPath: b.manifest }).failed, []);
  assert.equal(fs.existsSync(stampB), false, 'the stamp folder is gone after restore');
  assert.equal(fs.readFileSync(path.join(home, 'skills', 'local-dead', 'SKILL.md'), 'utf8'), 'again');
});

test('restore confinement: a tampered quarantine or original path is refused and nothing is touched', async () => {
  const home = makeHome();
  const actions = await lib('actions.mjs');
  const { restore } = await lib('restore.mjs');
  const src = path.join(home, 'skills', 'skill-x');
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(src, 'SKILL.md'), 'body');
  const record = actions.copyToQuarantine(src, 'stamp-6', 'personal-skill-x');
  fs.rmSync(src, { recursive: true });

  const outside = path.join(tmp(), 'elsewhere');
  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'SKILL.md'), 'not ours');
  const outsideHash = actions.hashDir(outside);
  const notSkills = path.join(home, 'projects', 'skill-x');
  const target = path.join(tmp(), 'link-target');
  fs.mkdirSync(target, { recursive: true });
  const manifestPath = path.join(home, 'context-diet', 'manifests', 'tampered.json');
  writeJson(manifestPath, {
    version: 1,
    changes: [
      { id: 'skill:a', type: 'dir', path: src, quarantine: outside, hash: outsideHash, done: true },
      { id: 'skill:b', type: 'dir', path: notSkills, quarantine: record.quarantine, hash: record.hash, done: true },
      { id: 'skill:c', type: 'link', path: path.join(home, 'projects', 'c'), target, resolved: target, done: true },
    ],
  });
  const r = restore({ manifestPath });
  assert.deepEqual(r.restored, []);
  const reason = Object.fromEntries(r.failed.map((f) => [f.id, f.reason]));
  assert.equal(reason['skill:a'], `refusing: ${outside} is outside the expected folders`);
  assert.equal(reason['skill:b'], `refusing: ${notSkills} is outside the expected folders`);
  assert.match(reason['skill:c'], /^refusing: .* is outside the expected folders$/);
  assert.equal(actions.hashDir(outside), outsideHash, 'the outside folder is untouched');
  assert.equal(fs.existsSync(src), false);
  assert.equal(fs.existsSync(notSkills), false);
  assert.equal(fs.existsSync(path.join(home, 'projects', 'c')), false);
  assert.equal(actions.hashDir(record.quarantine), record.hash, 'the quarantined copy is kept');
});

test('apply: when claude cannot be started nothing is changed unless allowUnverified is set', async () => {
  const { home, work } = await applyWorld();
  const { apply } = await lib('apply.mjs');
  const settingsFile = path.join(home, 'settings.json');
  const settingsBefore = fs.readFileSync(settingsFile);
  const skillsBefore = listFiles(path.join(home, 'skills'));
  delete process.env.CONTEXT_DIET_CLAUDE;
  const realPath = process.env.PATH;
  process.env.PATH = tmp();
  try {
    const a = await apply({ picks: ['plugin:plug-a@market', 'skill:local-link'], cwd: work });
    assert.deepEqual(a.changes, []);
    assert.match(a.error, /^claude could not be started \(ENOENT\).*; verify cannot run, so nothing was changed$/);
    assert.deepEqual(fs.readFileSync(settingsFile), settingsBefore);
    assert.deepEqual(listFiles(path.join(home, 'skills')), skillsBefore);
    assert.ok(fs.lstatSync(path.join(home, 'skills', 'local-link')).isSymbolicLink());
    assert.equal(a.manifest, null);
    assert.equal(fs.existsSync(path.join(home, 'context-diet', 'manifests')), false);
    assert.equal(fs.existsSync(path.join(home, 'context-diet', 'backups')), false);
    assert.equal(fs.existsSync(path.join(home, 'context-diet', 'probes.json')), false, 'a probe that never started registers no id');
    const { formatApply } = await lib('render.mjs');
    assert.match(formatApply(a), /Refused: claude could not be started/);
    assert.doesNotMatch(formatApply(a), /Restore with/);

    const b = await apply({ picks: ['plugin:plug-a@market', 'skill:local-link'], cwd: work, allowUnverified: true });
    assert.equal(b.error, null);
    assert.match(b.preReason, /claude could not be started/);
    assert.deepEqual(b.changes.map((c) => c.done), [true, true]);
    assert.equal(readJson(settingsFile).enabledPlugins['plug-a@market'], false);
    assert.ok(fs.existsSync(b.manifest));
    assert.equal(fs.existsSync(path.join(home, 'context-diet', 'probes.json')), false);
  } finally {
    process.env.PATH = realPath;
  }
});

test('cli apply: claude that cannot be started is a refusal with exit 1', async () => {
  const { home, work } = await applyWorld();
  const settingsBefore = fs.readFileSync(path.join(home, 'settings.json'));
  const env = { CONTEXT_DIET_HOME: home, CONTEXT_DIET_CLAUDE: '', PATH: tmp() };
  const r = await runDiet(['apply', '--pick', 'plugin:plug-a@market', '--cwd', work], env);
  assert.equal(r.code, 1, r.stderr + r.stdout);
  assert.match(r.stdout, /Refused: claude could not be started/);
  assert.deepEqual(fs.readFileSync(path.join(home, 'settings.json')), settingsBefore);
});

test('probe: a session that never ends is killed and reported as a timeout', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  installStub([{ hang: true }]);
  const { runProbe } = await lib('probe.mjs');
  const r = await runProbe({ cwd: work, timeoutMs: 1500, settleMs: 10 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'the probe timed out after 1.5 s');
});

test('probe: the model comes from CONTEXT_DIET_MODEL', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const stub = installStub([FULL]);
  const { runProbe } = await lib('probe.mjs');
  process.env.CONTEXT_DIET_MODEL = 'model-x';
  try {
    assert.equal((await runProbe({ cwd: work })).ok, true);
  } finally {
    delete process.env.CONTEXT_DIET_MODEL;
  }
  const argv = stub.calls()[0].argv;
  assert.equal(argv[argv.indexOf('--model') + 1], 'model-x');
});

test('usage edges: a local skill used where it was not listed is credited with uses but not with used sessions', async () => {
  const home = makeHome();
  for (const name of ['skill-x', 'skill-z']) {
    fs.mkdirSync(path.join(home, 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(home, 'skills', name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
  }
  for (let i = 0; i < 25; i++) addSession(home, { id: `e${i}`, records: loaded({ skills: [{ name: 'skill-x' }, { name: 'skill-z' }] }) });
  addSession(home, { id: 'e-other', records: [...loaded({ skills: [{ name: 'skill-y' }] }), did.skill('skill-x'), did.skill('never-listed')] });
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  const x = r.items.find((i) => i.id === 'skill:skill-x');
  assert.equal(x.listed, 25);
  assert.equal(x.used, 0, 'used sessions count only where the item was listed');
  assert.equal(x.pct, 0);
  assert.equal(x.uses, 1);
  assert.equal(x.candidate, false);
  assert.deepEqual(r.candidates, ['skill:skill-z']);
  assert.equal(r.items.some((i) => i.id === 'skill:never-listed'), false, 'a use never creates an item');
});

test('usage edges: a plugin skill used by its bare name credits the plugin, and no percentage exceeds 100', async () => {
  const home = makeHome();
  addPlugin(home, { id: 'plug-b@market', short: 'plug-b' });
  addPlugin(home, { id: 'plug-c@market', short: 'plug-c' });
  addPlugin(home, { id: 'plug-d@market', short: 'plug-d' });
  writeSettings(home, { enabledPlugins: { 'plug-b@market': true, 'plug-c@market': true, 'plug-d@market': true } });
  for (let i = 0; i < 25; i++) {
    const skills = [{ name: 'plug-b:solo' }, { name: 'plug-c:other' }, { name: 'skill-x' }];
    if (i < 3) skills.push({ name: 'plug-d:s' });
    const records = [...loaded({ skills }), did.mcp('plugin_plug_d_srv')];
    if (i < 4) records.push(did.skill('solo'));
    addSession(home, { id: `b${i}`, records });
  }
  const { scan } = await lib('scan.mjs');
  const r = await scan();
  const row = (id) => r.plugins.find((p) => p.id === id);
  assert.equal(row('plugin:plug-b@market').used, 4);
  assert.equal(row('plugin:plug-b@market').candidate, false);
  assert.equal(r.items.find((i) => i.id === 'skill:plug-b:solo').used, 0, 'the item itself is not credited by a bare name');
  assert.equal(row('plugin:plug-c@market').candidate, true);
  assert.equal(row('plugin:plug-d@market').listed, 3);
  assert.equal(row('plugin:plug-d@market').used, 25);
  assert.equal(row('plugin:plug-d@market').pct, 100);
  for (const x of [...r.plugins, ...r.items]) assert.ok(x.pct <= 100, `${x.id} ${x.pct}`);
  assert.deepEqual(r.candidates, ['plugin:plug-c@market']);
});

test('settings hooks: malformed hook trees are skipped, never thrown', async () => {
  const home = makeHome();
  const inv = await lib('inventory.mjs');
  const actions = await lib('actions.mjs');
  const hooks = {
    SessionStart: 5,
    Stop: { hooks: [] },
    PreCompact: [null, 'x', { hooks: 7 }, { hooks: [null, 3, { type: 'command', command: 'echo a' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: { a: 1 } }, { matcher: 'Bash', hooks: [{ type: 'command', command: 'guard-x' }] }],
  };
  assert.deepEqual(inv.flattenHooks(hooks), [
    { event: 'PreCompact', matcher: null, command: 'echo a' },
    { event: 'PreToolUse', matcher: 'Bash', command: 'guard-x' },
  ]);
  assert.deepEqual(inv.flattenHooks(5), []);
  assert.deepEqual(inv.flattenHooks([1, 2]), []);
  writeSettings(home, { hooks });
  const removed = actions.removeSettingsHook('echo a');
  assert.deepEqual(removed, { event: 'PreCompact', matcher: null, hook: { type: 'command', command: 'echo a' } });
  assert.equal(actions.removeSettingsHook('not there'), null);
  actions.restoreSettingsHook(removed);
  const s = readJson(path.join(home, 'settings.json'));
  assert.equal(s.hooks.SessionStart, 5, 'malformed values are left as found');
  assert.deepEqual(inv.flattenHooks(s.hooks).map((h) => h.command), ['echo a', 'guard-x']);
  actions.restoreSettingsHook({ event: 'PreToolUse', matcher: 'Bash', hook: { type: 'command', command: 'guard-y' } });
  assert.deepEqual(readJson(path.join(home, 'settings.json')).hooks.PreToolUse[1].hooks.map((h) => h.command), ['guard-x', 'guard-y']);
  assert.throws(() => actions.restoreSettingsHook({ event: 'SessionStart', matcher: null, hook: { command: 'echo b' } }), /is not a list; the hook was not restored/);
  assert.equal(readJson(path.join(home, 'settings.json')).hooks.SessionStart, 5);
});

test('tokens: one helper, ceiling for sizes and sign-preserving for deltas', async () => {
  const { tokens, CHARS_PER_TOKEN } = await lib('tokens.mjs');
  assert.equal(CHARS_PER_TOKEN, 4);
  assert.deepEqual([0, 1, 4, 5, 2560].map(tokens), [0, 1, 1, 2, 640]);
  assert.deepEqual([-1, -4, -5].map(tokens), [-1, -1, -2]);
});

const makeAltHome = () => {
  const home = path.join(tmp(), 'alt-home');
  fs.mkdirSync(path.join(home, 'projects'), { recursive: true });
  process.env.CONTEXT_DIET_HOME = home;
  return home;
};

const altWorld = async () => {
  const home = makeAltHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const dir = path.join(home, 'skills', 'alt-dir');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: alt-dir\n---\n');
  const target = path.join(tmp(), 'alt-target');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'SKILL.md'), '---\nname: alt-link\n---\n');
  fs.symlinkSync(target, path.join(home, 'skills', 'alt-link'), 'junction');
  for (let i = 0; i < 25; i++) {
    addSession(home, { id: `a${i}`, cwd: work, records: loaded({ skills: [{ name: 'alt-dir' }, { name: 'alt-link' }, { name: '../projects' }, { name: 'skill-x' }] }) });
  }
  const { scan } = await lib('scan.mjs');
  return { home, work, target, report: await scan() };
};

const ALT_FULL = { skills: ['alt-dir', 'alt-link', 'skill-x'], agents: [], mcp: [] };

test('follow-up: personal skills under a home not named .claude are located, applied and restored', async () => {
  const { home, work, target, report } = await altWorld();
  assert.equal(path.basename(home), 'alt-home');
  const p = await lib('paths.mjs');
  assert.equal(p.isSkillPath(path.join(home, 'skills', 'alt-dir')), true);
  assert.deepEqual(report.candidates.sort(), ['skill:alt-dir', 'skill:alt-link']);
  const byId = (id) => report.items.find((i) => i.id === id);
  assert.equal(byId('skill:alt-dir').local.kind, 'dir');
  assert.equal(byId('skill:alt-link').local.kind, 'link');

  const actions = await lib('actions.mjs');
  const dirHash = actions.hashDir(path.join(home, 'skills', 'alt-dir'));
  const targetBytes = fs.readFileSync(path.join(target, 'SKILL.md'));
  installStub([ALT_FULL, { skills: ['skill-x'], agents: [], mcp: [] }]);
  const { apply } = await lib('apply.mjs');
  const { verify } = await lib('verify.mjs');
  const { restore } = await lib('restore.mjs');
  const a = await apply({ picks: ['skill:alt-dir', 'skill:alt-link'], cwd: work });
  assert.equal(a.error, null);
  assert.deepEqual(a.changes.map((c) => [c.type, c.done]), [['dir', true], ['link', true]]);
  assert.equal(a.changes[0].label, 'personal-alt-dir');
  assert.ok(fs.existsSync(path.join(a.changes[0].quarantine, 'SKILL.md')), 'the folder is quarantined');
  assert.equal(fs.existsSync(path.join(home, 'skills', 'alt-dir')), false);
  assert.equal(fs.lstatSync(path.join(home, 'skills', 'alt-link'), { throwIfNoEntry: false }), undefined);
  assert.deepEqual(fs.readFileSync(path.join(target, 'SKILL.md')), targetBytes, 'the link target is untouched');
  assert.equal((await verify({ manifestPath: a.manifest, cwd: work })).verdict, 'pass');

  const r = restore({ manifestPath: a.manifest });
  assert.deepEqual(r.failed, []);
  assert.deepEqual(r.restored.sort(), ['skill:alt-dir', 'skill:alt-link']);
  assert.equal(actions.hashDir(path.join(home, 'skills', 'alt-dir')), dirHash);
  assert.ok(fs.lstatSync(path.join(home, 'skills', 'alt-link')).isSymbolicLink());
  assert.deepEqual(fs.readFileSync(path.join(home, 'skills', 'alt-link', 'SKILL.md')), targetBytes);
  assert.deepEqual(fs.readFileSync(path.join(target, 'SKILL.md')), targetBytes);
});

test('follow-up: traversal names and shared-prefix sibling paths stay refused under a home not named .claude', async () => {
  const { home, work, report } = await altWorld();
  const p = await lib('paths.mjs');
  const evil = path.join(home, 'skills-evil', 'x');
  const dotted = [home, 'skills', '..', 'skills-evil', 'x'].join(path.sep);
  for (const bad of [evil, dotted, path.join(home, 'x'), path.join(home, 'skills', 'sub', 'x'), [home, 'skills', 'sub', '..', 'x'].join(path.sep)]) {
    assert.equal(p.isSkillPath(bad), false, bad);
  }
  const trav = report.items.find((i) => i.id === 'skill:../projects');
  assert.equal(trav.local, null);
  assert.equal(trav.candidate, false);
  assert.equal(report.candidates.includes('skill:../projects'), false);

  fs.mkdirSync(evil, { recursive: true });
  fs.writeFileSync(path.join(evil, 'SKILL.md'), 'evil');
  const stub = installStub([ALT_FULL]);
  const reportFile = path.join(home, 'context-diet', 'report.json');
  const forged = readJson(reportFile);
  const it = forged.items.find((i) => i.id === 'skill:alt-dir');
  const projectsBefore = listFiles(path.join(home, 'projects'));
  const { apply } = await lib('apply.mjs');
  for (const where of [evil, dotted]) {
    Object.assign(it, { name: 'x', local: { scope: 'personal', path: where, kind: 'dir' } });
    writeJson(reportFile, forged);
    const a = await apply({ picks: ['skill:alt-dir'], cwd: work });
    assert.deepEqual(a.changes, [], where);
    assert.match(a.skipped[0].reason, /not inside a skills folder/, where);
  }
  const travApply = await apply({ picks: ['skill:../projects'], cwd: work });
  assert.match(travApply.skipped[0].reason, /unsafe skill name/);
  assert.equal(fs.readFileSync(path.join(evil, 'SKILL.md'), 'utf8'), 'evil');
  assert.deepEqual(listFiles(path.join(home, 'projects')), projectsBefore);
  assert.equal(stub.calls().length, 0);

  const actions = await lib('actions.mjs');
  const src = path.join(home, 'skills', 'alt-dir');
  const record = actions.copyToQuarantine(src, 'stamp-f1', 'personal-alt-dir');
  const target = path.join(tmp(), 'some-target');
  fs.mkdirSync(target, { recursive: true });
  fs.rmSync(path.join(home, 'skills-evil'), { recursive: true });
  const manifestPath = path.join(home, 'context-diet', 'manifests', 'tampered-f1.json');
  writeJson(manifestPath, {
    version: 1,
    changes: [
      { id: 'skill:d1', type: 'dir', path: evil, quarantine: record.quarantine, hash: record.hash, done: true },
      { id: 'skill:d2', type: 'dir', path: dotted, quarantine: record.quarantine, hash: record.hash, done: true },
      { id: 'skill:l1', type: 'link', path: evil, target, resolved: target, done: true },
      { id: 'skill:l2', type: 'link', path: dotted, target, resolved: target, done: true },
    ],
  });
  const { restore } = await lib('restore.mjs');
  const r = restore({ manifestPath });
  assert.deepEqual(r.restored, []);
  assert.equal(r.failed.length, 4);
  for (const f of r.failed) assert.match(f.reason, /^refusing: .* is outside the expected folders$/, f.id);
  assert.equal(fs.existsSync(path.join(home, 'skills-evil')), false, 'nothing was created at the sibling folder');
  assert.equal(actions.hashDir(record.quarantine), record.hash);
});

test('follow-up: project-scope skills under a cwd .claude/skills folder still work', async () => {
  const home = makeAltHome();
  const work = path.join(tmp(), 'proj-work');
  const skill = path.join(work, '.claude', 'skills', 'proj-skill');
  fs.mkdirSync(skill, { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), '---\nname: proj-skill\n---\n');
  for (let i = 0; i < 25; i++) addSession(home, { id: `p${i}`, cwd: work, records: loaded({ skills: [{ name: 'proj-skill' }, { name: 'skill-x' }] }) });
  const { scan } = await lib('scan.mjs');
  const report = await scan();
  assert.deepEqual(report.candidates, ['skill:proj-skill']);
  assert.equal(report.items.find((i) => i.id === 'skill:proj-skill').local.scope, 'project');
  const actions = await lib('actions.mjs');
  const hash = actions.hashDir(skill);
  installStub([{ skills: ['proj-skill', 'skill-x'], agents: [], mcp: [] }, { skills: ['skill-x'], agents: [], mcp: [] }]);
  const { apply } = await lib('apply.mjs');
  const { restore } = await lib('restore.mjs');
  const a = await apply({ picks: ['skill:proj-skill'], cwd: work });
  assert.equal(a.error, null);
  assert.equal(a.changes[0].label, 'project-proj-skill');
  assert.equal(fs.existsSync(skill), false);
  assert.deepEqual(restore({ manifestPath: a.manifest }).failed, []);
  assert.equal(actions.hashDir(skill), hash);
});

test('follow-up 2: an apply that changes nothing or is refused prints no Manifest line and returns manifest null', async () => {
  const { home, work } = await applyWorld();
  const env = { CONTEXT_DIET_HOME: home };
  const none = await runDiet(['apply', '--pick', 'skill:nope', '--cwd', work], env);
  assert.equal(none.code, 1);
  assert.doesNotMatch(none.stdout, /Manifest:/);
  assert.match(none.stdout, /Nothing was changed\./);
  const noneJson = await runDiet(['apply', '--pick', 'skill:nope', '--cwd', work, '--json'], env);
  assert.equal(JSON.parse(noneJson.stdout).manifest, null);

  const refusedEnv = { CONTEXT_DIET_HOME: home, CONTEXT_DIET_CLAUDE: '', PATH: tmp() };
  const refused = await runDiet(['apply', '--pick', 'plugin:plug-a@market', '--cwd', work], refusedEnv);
  assert.equal(refused.code, 1);
  assert.doesNotMatch(refused.stdout, /Manifest:/);
  assert.match(refused.stdout, /Nothing was changed\./);
  assert.match(refused.stdout, /Refused: claude could not be started/);
  const refusedJson = await runDiet(['apply', '--pick', 'plugin:plug-a@market', '--cwd', work, '--json'], refusedEnv);
  assert.equal(JSON.parse(refusedJson.stdout).manifest, null);
  assert.equal(fs.existsSync(path.join(home, 'context-diet', 'manifests')), false);
});

test('follow-up 2: a probe whose claude never starts registers no id', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const { runProbe } = await lib('probe.mjs');
  const { registerProbe } = await lib('state.mjs');
  const probes = path.join(home, 'context-diet', 'probes.json');
  delete process.env.CONTEXT_DIET_CLAUDE;
  const realPath = process.env.PATH;
  process.env.PATH = tmp();
  try {
    assert.match((await runProbe({ cwd: work, settleMs: 10 })).reason, /could not be started/);
    assert.equal(fs.existsSync(probes), false, 'probes.json is not created');
    registerProbe('earlier');
    const before = fs.readFileSync(probes);
    assert.match((await runProbe({ cwd: work, settleMs: 10 })).reason, /could not be started/);
    assert.deepEqual(fs.readFileSync(probes), before, 'probes.json is unchanged');
  } finally {
    process.env.PATH = realPath;
  }
});

test('follow-up 2: a project folder that cannot be listed is counted on the Coverage line', async () => {
  const home = makeHome();
  for (let i = 0; i < 2; i++) addSession(home, { id: `k${i}`, records: loaded({ skills: [{ name: 'skill-x' }] }) });
  const gone = path.join(tmp(), 'gone-project');
  fs.mkdirSync(gone);
  fs.symlinkSync(gone, path.join(home, 'projects', 'linked-project'), 'junction');
  fs.rmSync(gone, { recursive: true });
  fs.writeFileSync(path.join(home, 'projects', 'stray-file.txt'), 'not a project');
  const { scan } = await lib('scan.mjs');
  const { formatReport } = await lib('render.mjs');
  const r = await scan();
  assert.equal(r.coverage.sessions, 2);
  assert.equal(r.coverage.skippedFiles, 1);
  assert.match(formatReport(r), /^Coverage: 2 sessions .*, 1 item could not be read$/m);
  fs.writeFileSync(path.join(home, 'projects', 'proj-a', 'k9.jsonl'), '');
  fs.mkdirSync(path.join(home, 'projects', 'proj-a', 'k8.jsonl'));
  assert.match(formatReport(await scan()), /^Coverage: 3 sessions .*, 2 items could not be read$/m);
});

test('follow-up 2: a settings edit keeps the file mode exactly', async (t) => {
  if (process.platform === 'win32') return t.skip('POSIX modes do not apply on Windows');
  const home = makeHome();
  const actions = await lib('actions.mjs');
  const file = path.join(home, 'settings.json');
  writeSettings(home, baseSettings());
  fs.chmodSync(file, 0o664);
  const umask = process.umask(0o077);
  try {
    actions.setPluginEnabled('plug-a@market', false);
  } finally {
    process.umask(umask);
  }
  assert.equal(fs.statSync(file).mode & 0o777, 0o664);
  assert.equal(readJson(file).enabledPlugins['plug-a@market'], false);
});

const renameFailing = (codes) => {
  const calls = [];
  const rename = (from, to) => {
    calls.push([from, to]);
    const code = codes[calls.length - 1];
    if (code) {
      const e = new Error(`simulated ${code}`);
      e.code = code;
      throw e;
    }
    fs.renameSync(from, to);
  };
  return { rename, calls };
};

test('follow-up 2: the atomic rename is retried on transient Windows errors and gives up cleanly', async () => {
  makeHome();
  const state = await lib('state.mjs');
  const dir = tmp();
  const file = path.join(dir, 'target.json');
  fs.writeFileSync(file, 'original');
  const temps = () => fs.readdirSync(dir).filter((n) => n.includes('.tmp-'));

  const flaky = renameFailing(['EPERM', 'EPERM']);
  state.writeAtomic(file, 'new content', { rename: flaky.rename });
  assert.equal(flaky.calls.length, 3);
  assert.equal(fs.readFileSync(file, 'utf8'), 'new content');
  assert.deepEqual(temps(), []);

  fs.writeFileSync(file, 'original');
  const before = fs.readFileSync(file);
  const stuck = renameFailing(Array(10).fill('EBUSY'));
  assert.throws(() => state.writeAtomic(file, 'never', { rename: stuck.rename }), (e) => e.code === 'EBUSY');
  assert.equal(stuck.calls.length, 6, 'one try and five retries');
  assert.deepEqual(fs.readFileSync(file), before);
  assert.deepEqual(temps(), []);

  const denied = renameFailing(Array(10).fill('EACCES'));
  assert.throws(() => state.writeAtomic(file, 'never', { rename: denied.rename }), (e) => e.code === 'EACCES');
  assert.equal(denied.calls.length, 6);

  const missing = renameFailing(['ENOENT']);
  assert.throws(() => state.writeAtomic(file, 'never', { rename: missing.rename }), (e) => e.code === 'ENOENT');
  assert.equal(missing.calls.length, 1, 'a non-retryable code is not retried');
  assert.deepEqual(fs.readFileSync(file), before);
  assert.deepEqual(temps(), []);
});

test('follow-up 3: the probe id is registered once the child has started, before it exits', async () => {
  const home = makeHome();
  const work = path.join(home, 'work-a');
  fs.mkdirSync(work, { recursive: true });
  const stub = installStub([FULL]);
  const { runProbe } = await lib('probe.mjs');
  const r = await runProbe({ cwd: work });
  assert.equal(r.ok, true);
  const [call] = stub.calls();
  const id = call.argv[call.argv.indexOf('--session-id') + 1];
  assert.ok(call.probesAtStart, 'probes.json existed when the child started');
  assert.ok(JSON.parse(call.probesAtStart).includes(id), 'the running probe was already listed in probes.json');
  assert.deepEqual(readJson(path.join(home, 'context-diet', 'probes.json')), [id]);
});

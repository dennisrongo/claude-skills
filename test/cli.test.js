'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const CLI = path.resolve(__dirname, '..', 'bin', 'claude-skills.js');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('CLI --version prints package version', () => {
  const result = run(['--version']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('CLI --help prints usage', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /USAGE/);
  assert.match(result.stdout, /install/);
});

test('CLI list runs without error and shows at least one skill', () => {
  const result = run(['list']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Available skills/);
});

test('CLI rejects unknown command', () => {
  const result = run(['definitely-not-a-command']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown command/);
});

test('CLI rejects combining --global and --project', () => {
  const result = run(['list', '--global', '--project']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cannot use --global and --project together/);
});

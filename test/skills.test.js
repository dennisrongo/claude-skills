'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseFrontmatter,
  listLibrarySkills,
  findLibrarySkill,
} = require('../lib/skills');
const { getLibraryDir, getInstallDir } = require('../lib/paths');

test('parseFrontmatter extracts name and description', () => {
  const input = [
    '---',
    'name: my-skill',
    'description: A multi-line',
    '  description that wraps onto a second line.',
    '---',
    '',
    '# body',
  ].join('\n');

  const fm = parseFrontmatter(input);
  assert.equal(fm.name, 'my-skill');
  assert.match(fm.description, /^A multi-line description that wraps/);
});

test('parseFrontmatter returns empty object when no frontmatter', () => {
  assert.deepEqual(parseFrontmatter('# just a heading'), {});
});

test('listLibrarySkills finds every skill folder shipped in the package', () => {
  const skills = listLibrarySkills();
  assert.ok(skills.length > 0, 'expected at least one skill in the library');

  const libDir = getLibraryDir();
  const folders = fs
    .readdirSync(libDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .filter((e) => fs.existsSync(path.join(libDir, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();

  const slugs = skills.map((s) => s.slug).sort();
  assert.deepEqual(slugs, folders, 'every SKILL.md directory should be listed');
});

test('listLibrarySkills skips entries with leading underscore (e.g. _template)', () => {
  const skills = listLibrarySkills();
  assert.equal(
    skills.find((s) => s.slug.startsWith('_')),
    undefined
  );
});

test('every shipped skill has a non-empty name and description', () => {
  for (const skill of listLibrarySkills()) {
    assert.ok(skill.name && skill.name.length > 0, `${skill.slug} has empty name`);
    assert.ok(
      skill.description && skill.description !== '(no description)',
      `${skill.slug} has missing description`
    );
  }
});

test('findLibrarySkill resolves by slug', () => {
  const [first] = listLibrarySkills();
  assert.ok(first);
  const found = findLibrarySkill(first.slug);
  assert.equal(found.slug, first.slug);
});

test('getInstallDir validates scope', () => {
  assert.ok(getInstallDir('global').endsWith(path.join('.claude', 'skills')));
  assert.ok(getInstallDir('project').endsWith(path.join('.claude', 'skills')));
  assert.throws(() => getInstallDir('nope'), /Unknown scope/);
});

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const kleur = require('kleur');
const { getInstallDir } = require('./paths');
const { listInstalledSkills } = require('./skills');

/**
 * Remove one or more installed skills.
 * @param {string[]} identifiers
 * @param {object} options - { scope }
 */
function remove(identifiers, options) {
  const { scope = 'global' } = options;
  const installDir = getInstallDir(scope);
  const installed = listInstalledSkills(installDir);

  if (identifiers.length === 0) {
    console.error(kleur.red('Specify at least one skill to remove (or use --all).'));
    process.exitCode = 1;
    return;
  }

  for (const id of identifiers) {
    const match = installed.find((s) => s.name === id || s.slug === id);
    if (!match) {
      console.error(kleur.yellow(`⊘ Not installed: ${id}`));
      continue;
    }
    fs.rmSync(match.dir, { recursive: true, force: true });
    console.log(kleur.green(`✓ removed`) + `  ${match.name}`);
  }
}

function removeAll(options) {
  const { scope = 'global' } = options;
  const installDir = getInstallDir(scope);
  const installed = listInstalledSkills(installDir);

  if (installed.length === 0) {
    console.log(kleur.yellow('No skills installed.'));
    return;
  }

  for (const skill of installed) {
    fs.rmSync(skill.dir, { recursive: true, force: true });
    console.log(kleur.green(`✓ removed`) + `  ${skill.name}`);
  }
}

module.exports = { remove, removeAll };

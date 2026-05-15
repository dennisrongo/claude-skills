'use strict';

const fs = require('node:fs');
const path = require('node:path');
const kleur = require('kleur');
const { getInstallDir, ensureDir } = require('./paths');
const { findLibrarySkill, listLibrarySkills } = require('./skills');

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(srcPath);
      fs.symlinkSync(link, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Install one skill into the target install dir.
 * @param {object} skill - { name, slug, dir }
 * @param {string} installDir
 * @param {object} opts - { force }
 * @returns {'installed'|'skipped'|'updated'}
 */
function installOne(skill, installDir, opts = {}) {
  ensureDir(installDir);
  const target = path.join(installDir, skill.slug);
  const exists = fs.existsSync(target);

  if (exists && !opts.force) {
    return 'skipped';
  }

  if (exists) {
    fs.rmSync(target, { recursive: true, force: true });
    copyDirRecursive(skill.dir, target);
    return 'updated';
  }

  copyDirRecursive(skill.dir, target);
  return 'installed';
}

/**
 * Install multiple skills by identifier.
 * @param {string[]} identifiers
 * @param {object} options - { scope, force, all }
 */
function install(identifiers, options) {
  const { scope = 'global', force = false, all = false } = options;
  const installDir = getInstallDir(scope);

  let toInstall;
  if (all) {
    toInstall = listLibrarySkills();
  } else {
    toInstall = [];
    for (const id of identifiers) {
      const skill = findLibrarySkill(id);
      if (!skill) {
        console.error(kleur.red(`✗ Skill not found in library: ${id}`));
        continue;
      }
      toInstall.push(skill);
    }
  }

  if (toInstall.length === 0) {
    console.error(kleur.yellow('No skills to install.'));
    return { installed: 0, updated: 0, skipped: 0 };
  }

  console.log(
    kleur.bold(
      `Installing ${toInstall.length} skill${toInstall.length === 1 ? '' : 's'} to ${kleur.cyan(installDir)}`
    )
  );
  console.log();

  const counts = { installed: 0, updated: 0, skipped: 0 };

  for (const skill of toInstall) {
    const result = installOne(skill, installDir, { force });
    counts[result]++;
    const label = {
      installed: kleur.green('✓ installed'),
      updated: kleur.cyan('↻ updated  '),
      skipped: kleur.yellow('⊘ skipped  '),
    }[result];
    const suffix = result === 'skipped' ? kleur.dim(' (use --force to overwrite)') : '';
    console.log(`  ${label}  ${skill.name}${suffix}`);
  }

  console.log();
  const summary = [];
  if (counts.installed) summary.push(kleur.green(`${counts.installed} installed`));
  if (counts.updated) summary.push(kleur.cyan(`${counts.updated} updated`));
  if (counts.skipped) summary.push(kleur.yellow(`${counts.skipped} skipped`));
  console.log(summary.join(', ') || 'No changes.');

  return counts;
}

module.exports = { install, installOne, copyDirRecursive };

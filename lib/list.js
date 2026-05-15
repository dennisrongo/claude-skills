'use strict';

const kleur = require('kleur');
const { getInstallDir } = require('./paths');
const { listLibrarySkills, listInstalledSkills } = require('./skills');

function truncate(s, max) {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function printSkillTable(skills, { installedSet } = {}) {
  if (skills.length === 0) {
    console.log(kleur.dim('  (none)'));
    return;
  }
  const nameWidth = Math.min(
    28,
    Math.max(...skills.map((s) => s.name.length), 4)
  );
  for (const s of skills) {
    const marker = installedSet
      ? installedSet.has(s.slug)
        ? kleur.green('●')
        : kleur.dim('○')
      : ' ';
    const name = s.name.padEnd(nameWidth);
    const desc = kleur.dim(truncate(s.description.replace(/\s+/g, ' '), 80));
    console.log(`  ${marker} ${kleur.bold(name)}  ${desc}`);
  }
}

function listLibrary(options = {}) {
  const skills = listLibrarySkills();
  const { scope = 'global' } = options;
  const installed = listInstalledSkills(getInstallDir(scope));
  const installedSet = new Set(installed.map((s) => s.slug));

  console.log();
  console.log(kleur.bold(`Available skills`) + kleur.dim(`  (${scope} scope)`));
  console.log();
  printSkillTable(skills, { installedSet });
  console.log();
  console.log(
    kleur.dim(
      `  ${kleur.green('●')} installed   ${kleur.dim('○')} available`
    )
  );
  console.log();
}

function listInstalled(options = {}) {
  const { scope = 'global' } = options;
  const installDir = getInstallDir(scope);
  const skills = listInstalledSkills(installDir);
  console.log();
  console.log(kleur.bold(`Installed skills`) + kleur.dim(`  (${installDir})`));
  console.log();
  printSkillTable(skills);
  console.log();
}

module.exports = { listLibrary, listInstalled };

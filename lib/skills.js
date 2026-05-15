'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getLibraryDir } = require('./paths');

/**
 * Parse YAML-ish frontmatter from a SKILL.md.
 * We only need `name` and `description`, so a tiny parser is fine —
 * no need to pull in a yaml dependency.
 */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return {};
  const end = content.indexOf('\n---', 3);
  if (end === -1) return {};
  const block = content.slice(3, end).trim();

  const out = {};
  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (currentKey) {
      out[currentKey] = buffer.join(' ').trim().replace(/^["']|["']$/g, '');
    }
  };

  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (match) {
      flush();
      currentKey = match[1];
      buffer = [match[2]];
    } else if (currentKey && line.trim()) {
      // continuation line for multi-line values
      buffer.push(line.trim());
    }
  }
  flush();
  return out;
}

/**
 * List all skills bundled in this package's `skills/` directory.
 * Returns: [{ name, description, dir }]
 */
function listLibrarySkills() {
  const libDir = getLibraryDir();
  if (!fs.existsSync(libDir)) return [];

  const entries = fs.readdirSync(libDir, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;

    const skillDir = path.join(libDir, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf8');
    const fm = parseFrontmatter(content);

    skills.push({
      name: fm.name || entry.name,
      description: fm.description || '(no description)',
      dir: skillDir,
      slug: entry.name,
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List skills installed at a given directory.
 */
function listInstalledSkills(installDir) {
  if (!fs.existsSync(installDir)) return [];

  const entries = fs.readdirSync(installDir, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(installDir, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf8');
    const fm = parseFrontmatter(content);

    skills.push({
      name: fm.name || entry.name,
      description: fm.description || '(no description)',
      dir: skillDir,
      slug: entry.name,
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find a skill in the library by either its `name` frontmatter or its directory slug.
 */
function findLibrarySkill(identifier) {
  const skills = listLibrarySkills();
  return skills.find(
    (s) => s.name === identifier || s.slug === identifier
  );
}

module.exports = {
  parseFrontmatter,
  listLibrarySkills,
  listInstalledSkills,
  findLibrarySkill,
};

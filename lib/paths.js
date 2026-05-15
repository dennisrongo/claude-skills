'use strict';

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const GLOBAL_DIR = path.join(os.homedir(), '.claude', 'skills');
const PROJECT_DIR = path.join(process.cwd(), '.claude', 'skills');

/**
 * Return the install target directory based on a scope flag.
 * @param {'global'|'project'} scope
 */
function getInstallDir(scope) {
  if (scope === 'project') return PROJECT_DIR;
  if (scope === 'global') return GLOBAL_DIR;
  throw new Error(`Unknown scope: ${scope}`);
}

/**
 * Path to the bundled skills library (inside this package).
 * Resolves relative to the package root so it works whether run via npx,
 * a global install, or a local checkout.
 */
function getLibraryDir() {
  return path.resolve(__dirname, '..', 'skills');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  GLOBAL_DIR,
  PROJECT_DIR,
  getInstallDir,
  getLibraryDir,
  ensureDir,
};

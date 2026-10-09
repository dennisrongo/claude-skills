import os from 'node:os'
import path from 'node:path'

export const claudeHome = () => process.env.CONTEXT_DIET_HOME || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
export const stateDir = () => path.join(claudeHome(), 'context-diet')
export const projectsDir = () => path.join(claudeHome(), 'projects')
export const settingsPath = () => path.join(claudeHome(), 'settings.json')
export const pluginsFile = () => path.join(claudeHome(), 'plugins', 'installed_plugins.json')
export const personalSkillsDir = () => path.join(claudeHome(), 'skills')
export const reportPath = () => path.join(stateDir(), 'report.json')
export const keepPath = () => path.join(stateDir(), 'keep.json')
export const probesPath = () => path.join(stateDir(), 'probes.json')
export const manifestsDir = () => path.join(stateDir(), 'manifests')
export const backupsDir = () => path.join(stateDir(), 'backups')
export const quarantineDir = () => path.join(stateDir(), 'quarantine')

const fold = (s) => (process.platform === 'win32' ? s.toLowerCase() : s)

export const inside = (dir, p) => {
  const root = fold(path.resolve(dir) + path.sep)
  const target = fold(path.resolve(p) + path.sep)
  return target !== root && target.startsWith(root)
}

export const isSafeSkillName = (name) =>
  typeof name === 'string' &&
  name !== '' &&
  name !== '.' &&
  name !== '..' &&
  name === path.basename(name) &&
  !/[/\\:\0]/.test(name)

export const isSkillPath = (p) => {
  if (typeof p !== 'string' || p === '' || p.split(/[\\/]/).includes('..')) return false
  const parent = path.dirname(path.resolve(p))
  if (fold(parent) === fold(path.resolve(personalSkillsDir()))) return true
  return fold(path.basename(parent)) === 'skills' && fold(path.basename(path.dirname(parent))) === '.claude'
}

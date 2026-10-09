import path from 'node:path'
import { backupSettings, copyToQuarantine, gitState, removeLink, removeOriginal, removeSettingsHook, setPluginEnabled } from './actions.mjs'
import { buildProtection } from './aggregate.mjs'
import { guardsIntact, staticChecks } from './checks.mjs'
import { classifyPath, installedPlugins, readKeep, readSettings } from './inventory.mjs'
import { isSafeSkillName, isSkillPath, manifestsDir } from './paths.mjs'
import { NOT_STARTED, runProbe } from './probe.mjs'
import { readReport, writeJsonFile } from './state.mjs'

const expectOf = (members) => ({
  skills: members.filter((m) => m.kind === 'skill').map((m) => m.name),
  agents: members.filter((m) => m.kind === 'agent').map((m) => m.name),
  mcp: members.filter((m) => m.kind === 'mcp').map((m) => m.name),
  hooks: members.filter((m) => m.kind === 'hook').map((m) => m.name),
})

const plan = (report, it, protect) => {
  const reason = it.protected || protect(it.id, it.name, it.plugin || null)
  if (reason) return { skipped: `protected: ${reason}` }
  if (it.kind === 'plugin') {
    if (it.enabled === false) return { skipped: 'already disabled' }
    const members = report.items.filter((i) => i.plugin === it.name)
    return { change: { type: 'plugin', plugin: it.name, tokens: it.tokens, expect: expectOf(members) } }
  }
  if (it.plugin) return { skipped: `supplied by plugin ${it.plugin}: pick plugin:${it.plugin} instead` }
  if (it.kind === 'skill') {
    if (it.source === 'local' && !isSafeSkillName(it.name)) return { skipped: 'unsafe skill name' }
    if (!it.local) return { skipped: it.source === 'local' ? 'no skill folder was found for it' : `source is ${it.source}: it cannot be removed here` }
    const where = it.local.path
    if (!isSafeSkillName(it.name) || !isSkillPath(where) || path.basename(where) !== it.name) return { skipped: 'not inside a skills folder' }
    const scope = it.local.scope === 'project' ? 'project' : 'personal'
    const now = classifyPath(where)
    if (now.kind === 'link') {
      return { change: { type: 'link', path: where, target: now.target, resolved: now.resolved, tokens: it.tokens, expect: expectOf([it]) } }
    }
    if (now.kind === 'dir') {
      const git = gitState(where)
      if (git === 'tracked') return { skipped: 'git-tracked: remove it with git yourself' }
      if (git !== 'untracked') return { skipped: 'could not tell whether it is git-tracked; not touched' }
      return { change: { type: 'dir', path: where, label: `${scope}-${it.name}`, tokens: it.tokens, expect: expectOf([it]) } }
    }
    return { skipped: 'its folder is gone already' }
  }
  if (it.kind === 'hook') {
    if (it.source !== 'settings') return { skipped: `source is ${it.source}: remove it through its owner` }
    return { change: { type: 'hook', command: it.name, tokens: it.tokens, expect: expectOf([it]) } }
  }
  return { skipped: `${it.kind} ${it.name} is built in or unmanaged: nothing to remove here` }
}

const perform = (change, stamp, save, remove) => {
  if (change.type === 'plugin') change.prior = setPluginEnabled(change.plugin, false)
  else if (change.type === 'link') removeLink(change.path)
  else if (change.type === 'dir') {
    Object.assign(change, copyToQuarantine(change.path, stamp, change.label))
    change.partial = true
    save()
    try {
      removeOriginal(change.path, change, remove)
    } catch (e) {
      change.partial = Boolean(e.partial)
      throw e
    }
    change.partial = false
  } else if (change.type === 'hook') {
    change.removed = removeSettingsHook(change.command)
    if (!change.removed) throw new Error('the hook was not found in settings.json')
  }
}

export const apply = async ({ picks, cwd, probe = runProbe, remove, allowUnverified = false }) => {
  const report = readReport()
  if (!report) throw new Error('no report found: run scan first')
  const protect = buildProtection({ plugins: installedPlugins(), settings: readSettings(), keep: readKeep() })
  const byId = new Map([...report.plugins, ...report.items].map((x) => [x.id, x]))
  const changes = []
  const skipped = []
  for (const id of new Set(picks)) {
    const it = byId.get(id)
    if (!it) {
      skipped.push({ id, reason: 'not in the latest report: run scan again' })
      continue
    }
    const out = plan(report, it, protect)
    if (out.skipped) skipped.push({ id, reason: out.skipped })
    else changes.push({ id, ...out.change, done: false })
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const manifestPath = path.join(manifestsDir(), `${stamp}.json`)
  const result = { manifest: manifestPath, changes, skipped, error: null, checks: [], guards: [] }
  if (changes.length === 0) return { ...result, manifest: null }

  const pre = await probe({ cwd })
  if (!pre.ok && String(pre.reason).startsWith(NOT_STARTED) && !allowUnverified) {
    return { ...result, manifest: null, changes: [], error: `${pre.reason}; verify cannot run, so nothing was changed` }
  }
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    cwd,
    stamp,
    settingsBackup: backupSettings(stamp),
    pre: pre.ok ? pre.snapshot : null,
    preReason: pre.ok ? null : pre.reason,
    guards: {
      plugins: [...new Set(report.guards.map((g) => g.plugin).filter(Boolean))],
      settings: report.guards.filter((g) => !g.plugin).map((g) => g.command),
    },
    projectedTokens: changes.reduce((a, c) => a + (c.tokens || 0), 0),
    changes,
    skipped,
    status: 'applying',
    verdict: null,
  }
  writeJsonFile(manifestPath, manifest)
  for (const change of changes) {
    try {
      perform(change, stamp, () => writeJsonFile(manifestPath, manifest), remove)
      change.done = true
    } catch (e) {
      change.error = e.message
      result.error = `${change.id}: ${e.message}`
    }
    writeJsonFile(manifestPath, manifest)
    if (result.error) break
  }
  manifest.status = result.error ? 'partial' : 'applied'
  writeJsonFile(manifestPath, manifest)
  result.checks = staticChecks(manifest)
  result.guards = guardsIntact(manifest)
  result.preReason = manifest.preReason
  return result
}

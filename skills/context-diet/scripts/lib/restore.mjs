import fs from 'node:fs'
import path from 'node:path'
import { copyBack, restoreLink, restorePlugin, restoreSettingsHook } from './actions.mjs'
import { readJson } from './inventory.mjs'
import { inside, isSkillPath, quarantineDir } from './paths.mjs'
import { writeJsonFile } from './state.mjs'

const refuse = (p) => {
  throw new Error(`refusing: ${p} is outside the expected folders`)
}

const pruneStamp = (quarantine) => {
  const stampDir = path.dirname(path.resolve(quarantine))
  if (!inside(quarantineDir(), stampDir) || inside(quarantineDir(), path.dirname(stampDir))) return
  try {
    if (fs.readdirSync(stampDir).length === 0) fs.rmdirSync(stampDir)
  } catch {}
}

const undo = (c) => {
  if (c.type === 'plugin') restorePlugin(c.plugin, c.prior)
  else if (c.type === 'link') {
    if (!isSkillPath(c.path)) refuse(c.path)
    restoreLink(c.path, c.target, c.resolved)
  } else if (c.type === 'dir') {
    if (c.purged) throw new Error('the quarantined copy was purged: it cannot be restored')
    if (typeof c.quarantine !== 'string' || !inside(quarantineDir(), c.quarantine)) refuse(c.quarantine)
    if (!isSkillPath(c.path)) refuse(c.path)
    copyBack(c, { overwrite: !c.done })
    pruneStamp(c.quarantine)
  } else if (c.type === 'hook') restoreSettingsHook(c.removed)
}

const load = (manifestPath) => {
  const manifest = readJson(manifestPath)
  if (!manifest) throw new Error(`cannot read manifest ${manifestPath}`)
  return manifest
}

export const restore = ({ manifestPath }) => {
  const manifest = load(manifestPath)
  const restored = []
  const failed = []
  for (const c of [...manifest.changes].reverse()) {
    if (!(c.done || c.partial) || c.undone) continue
    try {
      undo(c)
      c.undone = true
      restored.push(c.id)
    } catch (e) {
      failed.push({ id: c.id, reason: e.message })
    }
  }
  manifest.status = failed.length ? 'partially-restored' : 'restored'
  manifest.restoredAt = new Date().toISOString()
  writeJsonFile(manifestPath, manifest)
  return { manifest: manifestPath, restored, failed }
}

export const purge = ({ manifestPath, yes }) => {
  const manifest = load(manifestPath)
  if (!yes) return { manifest: manifestPath, deleted: [], skipped: [], refused: 'purge permanently deletes quarantined skills and needs --yes' }
  if (manifest.verdict !== 'pass') {
    return { manifest: manifestPath, deleted: [], skipped: [], refused: `verify has not passed on this manifest (verdict: ${manifest.verdict || 'never run'})` }
  }
  const deleted = []
  const skipped = []
  for (const c of manifest.changes) {
    if (c.type !== 'dir' || !c.done || c.undone || c.purged) continue
    if (!c.quarantine || !inside(quarantineDir(), c.quarantine)) {
      skipped.push({ id: c.id, path: c.quarantine || null, reason: 'not inside the quarantine folder: not deleted' })
      continue
    }
    fs.rmSync(c.quarantine, { recursive: true, force: true })
    pruneStamp(c.quarantine)
    c.purged = true
    deleted.push(c.quarantine)
  }
  writeJsonFile(manifestPath, manifest)
  return { manifest: manifestPath, deleted, skipped, refused: null }
}

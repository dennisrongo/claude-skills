import fs from 'node:fs'
import path from 'node:path'
import { hashDir } from './actions.mjs'
import { flattenHooks, readJson, settingsState } from './inventory.mjs'

const UNREADABLE = 'settings.json cannot be read'

const projectOverride = (cwd, id) => {
  for (const name of ['settings.json', 'settings.local.json']) {
    const file = path.join(cwd, '.claude', name)
    const json = readJson(file)
    if (json && json.enabledPlugins && json.enabledPlugins[id] === true) return file
  }
  return null
}

export const staticChecks = (manifest) => {
  const out = []
  const { settings, unreadable } = settingsState()
  if (unreadable) out.push({ id: 'settings.json', ok: false, detail: UNREADABLE })
  const commands = flattenHooks(settings.hooks).map((h) => h.command).filter(Boolean)
  for (const c of manifest.changes) {
    if (!c.done || c.undone) continue
    if (c.type === 'plugin') {
      const over = projectOverride(manifest.cwd, c.plugin)
      const off = settings.enabledPlugins && settings.enabledPlugins[c.plugin] === false
      out.push({ id: c.id, ok: off && !over, detail: !off ? 'settings.json does not read false' : over ? `re-enabled by ${over}` : 'disabled in settings.json' })
    } else if (c.type === 'link') {
      const gone = !fs.lstatSync(c.path, { throwIfNoEntry: false })
      const targetKept = fs.existsSync(c.resolved || c.target)
      out.push({ id: c.id, ok: gone && targetKept, detail: !gone ? 'the link is still there' : !targetKept ? 'the link target is missing' : 'link removed, target intact' })
    } else if (c.type === 'dir') {
      const gone = !fs.lstatSync(c.path, { throwIfNoEntry: false })
      const kept = fs.existsSync(c.quarantine) && hashDir(c.quarantine) === c.hash
      out.push({ id: c.id, ok: gone && kept, detail: !gone ? 'the original is still there' : !kept ? 'the quarantined copy does not match' : 'moved to quarantine, copy verified' })
    } else if (c.type === 'hook') {
      const gone = !commands.includes(c.command)
      out.push({ id: c.id, ok: gone, detail: gone ? 'hook entry removed' : 'hook entry still in settings.json' })
    }
  }
  return out
}

export const guardsIntact = (manifest) => {
  const out = []
  const { settings, unreadable } = settingsState()
  const commands = flattenHooks(settings.hooks).map((h) => h.command).filter(Boolean)
  for (const id of (manifest.guards && manifest.guards.plugins) || []) {
    const on = !unreadable && !(settings.enabledPlugins && settings.enabledPlugins[id] === false)
    out.push({ id: `guard ${id}`, ok: on, detail: unreadable ? UNREADABLE : on ? 'still enabled' : 'DISABLED: restore it' })
  }
  for (const command of (manifest.guards && manifest.guards.settings) || []) {
    const there = !unreadable && commands.includes(command)
    out.push({ id: `guard ${command}`, ok: there, detail: unreadable ? UNREADABLE : there ? 'still in settings.json' : 'REMOVED: restore it' })
  }
  return out
}

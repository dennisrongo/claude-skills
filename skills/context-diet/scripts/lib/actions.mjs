import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { eachHook, isPlain } from './inventory.mjs'
import { backupsDir, quarantineDir, settingsPath } from './paths.mjs'
import { writeAtomic } from './state.mjs'

export const hashDir = (dir) => {
  const h = crypto.createHash('sha256')
  const walk = (d, rel) => {
    const entries = fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const e of entries) {
      const p = path.join(d, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isSymbolicLink()) h.update(`L:${r}:${fs.readlinkSync(p)}\n`)
      else if (e.isDirectory()) {
        h.update(`D:${r}\n`)
        walk(p, r)
      } else {
        h.update(`F:${r}:`)
        h.update(fs.readFileSync(p))
        h.update('\n')
      }
    }
  }
  walk(dir, '')
  return h.digest('hex')
}

export const gitState = (dir) => {
  const r = spawnSync('git', ['-C', path.dirname(dir), 'ls-files', '--', path.basename(dir)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } })
  if (r.error) return 'unknown'
  if (r.status !== 0) return /not a git repository/i.test(r.stderr || '') ? 'untracked' : 'unknown'
  return r.stdout.trim() ? 'tracked' : 'untracked'
}

export const backupSettings = (stamp) => {
  if (!fs.existsSync(settingsPath())) return null
  const dest = path.join(backupsDir(), `settings-${stamp}.json`)
  fs.mkdirSync(backupsDir(), { recursive: true, mode: 0o700 })
  fs.copyFileSync(settingsPath(), dest)
  try {
    fs.chmodSync(dest, 0o600)
  } catch {}
  return dest
}

const NOT_JSON = 'settings.json is not valid JSON; nothing was changed'

const editSettings = (mutate) => {
  const target = fs.realpathSync(settingsPath())
  const original = fs.readFileSync(target, 'utf8')
  const bom = original.startsWith('\uFEFF')
  const raw = bom ? original.slice(1) : original
  let settings
  try {
    settings = JSON.parse(raw)
  } catch {
    throw new Error(NOT_JSON)
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error(NOT_JSON)
  const result = mutate(settings)
  const indent = (/^\{\r?\n([ \t]+)"/.exec(raw) || [])[1] || '  '
  let text = JSON.stringify(settings, null, indent) + (/\n$/.test(raw) ? '\n' : '')
  if (raw.includes('\r\n')) text = text.replace(/\r?\n/g, '\r\n')
  writeAtomic(target, (bom ? '\uFEFF' : '') + text, { mode: fs.statSync(target).mode & 0o777 })
  return result
}

export const setPluginEnabled = (id, value) =>
  editSettings((s) => {
    s.enabledPlugins = s.enabledPlugins || {}
    const prior = s.enabledPlugins[id]
    s.enabledPlugins[id] = value
    return prior === undefined ? null : prior
  })

export const restorePlugin = (id, prior) =>
  editSettings((s) => {
    s.enabledPlugins = s.enabledPlugins || {}
    if (prior === null || prior === undefined) delete s.enabledPlugins[id]
    else s.enabledPlugins[id] = prior
  })

const matcherOf = (group) => (group.matcher === undefined ? null : group.matcher)

export const removeSettingsHook = (command) =>
  editSettings((s) => {
    let found = null
    eachHook(s.hooks, ({ event, groups, gi, group, hi, hook }) => {
      if (hook.command !== command) return true
      group.hooks.splice(hi, 1)
      if (group.hooks.length === 0) groups.splice(gi, 1)
      if (groups.length === 0) delete s.hooks[event]
      found = { event, matcher: matcherOf(group), hook }
      return false
    })
    return found
  })

export const restoreSettingsHook = ({ event, matcher, hook }) =>
  editSettings((s) => {
    if (s.hooks !== undefined && !isPlain(s.hooks)) throw new Error('settings.json "hooks" is not an object; the hook was not restored')
    s.hooks = s.hooks || {}
    if (s.hooks[event] !== undefined && !Array.isArray(s.hooks[event])) throw new Error(`settings.json hooks.${event} is not a list; the hook was not restored`)
    s.hooks[event] = s.hooks[event] || []
    const group = s.hooks[event].find((g) => isPlain(g) && Array.isArray(g.hooks) && matcherOf(g) === matcher)
    if (group) {
      if (!group.hooks.some((h) => isPlain(h) && h.command === hook.command)) group.hooks.push(hook)
    } else s.hooks[event].push({ ...(matcher === null ? {} : { matcher }), hooks: [hook] })
  })

export const removeLink = (p) => {
  if (!fs.lstatSync(p).isSymbolicLink()) throw new Error(`${p} is not a link; not removed`)
  try {
    fs.unlinkSync(p)
  } catch {
    fs.rmdirSync(p)
  }
  if (fs.lstatSync(p, { throwIfNoEntry: false })) throw new Error(`${p} is still there after removal`)
}

export const restoreLink = (p, target, resolved = path.resolve(path.dirname(p), target)) => {
  if (fs.lstatSync(p, { throwIfNoEntry: false })) throw new Error(`${p} exists again; not overwritten`)
  if (!fs.existsSync(resolved)) throw new Error(`link target ${target} no longer exists`)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  if (process.platform === 'win32') fs.symlinkSync(resolved, p, 'junction')
  else fs.symlinkSync(target, p)
}

export const copyToQuarantine = (src, stamp, label, copy = fs.cpSync) => {
  const dest = path.join(quarantineDir(), stamp, label)
  fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 })
  const hash = hashDir(src)
  copy(src, dest, { recursive: true, force: false, errorOnExist: true })
  if (hashDir(dest) !== hash) {
    fs.rmSync(dest, { recursive: true, force: true })
    throw new Error(`the copy of ${src} did not match; the original was left untouched`)
  }
  return { quarantine: dest, hash }
}

export const removeOriginal = (src, record, remove = (p) => fs.rmSync(p, { recursive: true, force: true })) => {
  try {
    remove(src)
  } catch (e) {
    let back = false
    try {
      fs.cpSync(record.quarantine, src, { recursive: true, force: true })
      back = hashDir(src) === record.hash
    } catch {
      back = false
    }
    if (back) {
      fs.rmSync(record.quarantine, { recursive: true, force: true })
      throw new Error(`the original could not be removed (${e.message}); it was left complete and the quarantined copy was discarded`)
    }
    const err = new Error(`the original could not be removed and could not be restored; the verified copy is at ${record.quarantine}`)
    err.partial = true
    throw err
  }
}

export const copyBack = ({ path: original, quarantine: from, hash }, { overwrite }) => {
  if (!overwrite && fs.lstatSync(original, { throwIfNoEntry: false })) throw new Error(`${original} exists again; not overwritten`)
  if (!fs.existsSync(from)) throw new Error(`the quarantined copy is gone: ${from}`)
  if (hashDir(from) !== hash) throw new Error(`the quarantined copy of ${original} changed since it was moved; left in place at ${from}`)
  fs.mkdirSync(path.dirname(original), { recursive: true })
  fs.cpSync(from, original, overwrite ? { recursive: true, force: true } : { recursive: true, force: false, errorOnExist: true })
  if (hashDir(original) !== hash) {
    if (!overwrite) fs.rmSync(original, { recursive: true, force: true })
    throw new Error(`the restored copy of ${original} did not match; the quarantined copy was kept`)
  }
  fs.rmSync(from, { recursive: true, force: true })
}

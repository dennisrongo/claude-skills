import fs from 'node:fs'
import path from 'node:path'
import { inside, isSafeSkillName, isSkillPath, keepPath, personalSkillsDir, pluginsFile, settingsPath } from './paths.mjs'

export const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

export const settingsState = () => {
  if (!fs.existsSync(settingsPath())) return { settings: {}, unreadable: false }
  const json = readJson(settingsPath())
  return isPlain(json) ? { settings: json, unreadable: false } : { settings: {}, unreadable: true }
}

export const readSettings = () => settingsState().settings

export const readSettingsStrict = () => {
  const { settings, unreadable } = settingsState()
  if (unreadable) throw new Error('settings.json is not valid JSON; nothing was changed')
  return settings
}

export const isPlain = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

export const eachHook = (hooks, visit) => {
  if (!isPlain(hooks)) return
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi]
      if (!isPlain(group) || !Array.isArray(group.hooks)) continue
      for (let hi = 0; hi < group.hooks.length; hi++) {
        const hook = group.hooks[hi]
        if (isPlain(hook) && visit({ event, groups, gi, group, hi, hook }) === false) return
      }
    }
  }
}

export const flattenHooks = (hooks) => {
  const out = []
  eachHook(hooks, ({ event, group, hook }) => {
    out.push({ event, matcher: group.matcher || null, command: typeof hook.command === 'string' && hook.command ? hook.command : null })
  })
  return out
}
const isGroup = (g) => isPlain(g) && Array.isArray(g.hooks) && g.hooks.every(isPlain)
const isHookMap = (v) => isPlain(v) && Object.values(v).every((groups) => Array.isArray(groups) && groups.every(isGroup))
const hookMapOf = (v) => (isPlain(v) && isHookMap(v.hooks) ? v.hooks : isHookMap(v) ? v : null)
const isEventName = (key) => /^[A-Z][A-Za-z]*$/.test(key)
const declaresNoHooks = (v) => isPlain(v) && !Object.hasOwn(v, 'hooks') && !Object.keys(v).some(isEventName)

const pluginHooks = (root, manifest) => {
  const maps = []
  let unreadable = false
  const take = (v) => {
    const map = hookMapOf(v)
    if (map) maps.push(map)
    else unreadable = true
  }
  const fromValue = (v) => (typeof v === 'string' ? take(readJson(path.resolve(root, v.replace('${CLAUDE_PLUGIN_ROOT}', '.')))) : take(v))
  const standard = path.join(root, 'hooks', 'hooks.json')
  if (fs.existsSync(standard)) {
    const json = readJson(standard)
    if (!declaresNoHooks(json)) take(json)
  }
  if (!manifest && fs.existsSync(path.join(root, '.claude-plugin', 'plugin.json'))) unreadable = true
  const declared = manifest ? manifest.hooks : undefined
  if (Array.isArray(declared)) declared.forEach(fromValue)
  else if (declared !== undefined && declared !== null) fromValue(declared)
  const seen = new Set()
  const hooks = maps.flatMap((m) => flattenHooks(m)).filter((h) => {
    const key = `${h.event}|${h.matcher}|${h.command}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { hooks, unreadable }
}

export const installedPlugins = () => {
  const file = readJson(pluginsFile())
  const out = []
  for (const [id, entries] of Object.entries((file && file.plugins) || {})) {
    const entry = Array.isArray(entries) ? entries[0] : entries
    const root = entry && entry.installPath
    const manifest = root ? readJson(path.join(root, '.claude-plugin', 'plugin.json')) : null
    let found = { hooks: [], unreadable: false }
    try {
      if (root) found = pluginHooks(root, manifest)
    } catch {
      found = { hooks: [], unreadable: true }
    }
    out.push({
      id,
      short: (manifest && manifest.name) || id.split('@')[0],
      root: root || null,
      hooks: found.hooks,
      ...(found.unreadable ? { hooksUnreadable: true } : {}),
    })
  }
  return out
}

export const readKeep = () => {
  if (!fs.existsSync(keepPath())) return []
  const file = readJson(keepPath())
  if (!isPlain(file) || !Array.isArray(file.keep) || !file.keep.every((k) => typeof k === 'string')) {
    throw new Error('keep.json is unreadable or not {"keep": [...]}: fix or remove it')
  }
  return file.keep
}

export const classifyPath = (p) => {
  let st
  try {
    st = fs.lstatSync(p)
  } catch {
    return { kind: 'missing' }
  }
  if (st.isSymbolicLink()) {
    const target = fs.readlinkSync(p).replace(/^\\\\\?\\/, '')
    return { kind: 'link', target, resolved: path.resolve(path.dirname(p), target) }
  }
  if (st.isDirectory()) return { kind: 'dir' }
  return { kind: 'file' }
}

export const locateLocalSkill = (name, cwds = []) => {
  if (!isSafeSkillName(name)) return null
  const candidates = [
    { scope: 'personal', root: personalSkillsDir() },
    ...cwds.filter((cwd) => typeof cwd === 'string').map((cwd) => ({ scope: 'project', root: path.join(cwd, '.claude', 'skills') })),
  ].map((c) => ({ ...c, path: path.join(c.root, name) }))
  for (const c of candidates) {
    if (!isSkillPath(c.path) || !inside(c.root, c.path)) continue
    const found = classifyPath(c.path)
    if (found.kind === 'link' || found.kind === 'dir') return { scope: c.scope, path: c.path, ...found }
  }
  return null
}

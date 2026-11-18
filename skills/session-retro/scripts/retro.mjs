#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
const SAFE_ID = /^[A-Za-z0-9_-]+$/
const OURS = /session-retro\/scripts\/retro\.mjs" hook-(start|end)$/
const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES'])

const claudeDir = () => path.resolve(process.env.SESSION_RETRO_HOME || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'))
const pendingDir = () => path.join(claudeDir(), 'session-retro-pending')
const minTurns = () => Number(process.env.SESSION_RETRO_MIN_TURNS) || 8

const argv = process.argv.slice(3)
const arg = (flag) => {
  const i = argv.indexOf(flag)
  return i > -1 ? argv[i + 1] : undefined
}
const has = (flag) => argv.includes(flag)

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const readStdinJson = () => {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'))
  } catch {
    return {}
  }
}

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const writeAtomic = (file, data, mode) => {
  const temp = `${file}.tmp-${process.pid}`
  try {
    fs.writeFileSync(temp, data, { mode })
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(temp, file)
        return
      } catch (e) {
        if (!RETRYABLE.has(e && e.code) || attempt >= 5) throw e
        pause(20 * (attempt + 1))
      }
    }
  } catch (e) {
    fs.rmSync(temp, { force: true })
    throw e
  }
}

function* lines(file) {
  const fd = fs.openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(1 << 20)
    const decoder = new StringDecoder('utf8')
    let tail = ''
    for (;;) {
      const read = fs.readSync(fd, buffer, 0, buffer.length, null)
      if (!read) break
      const parts = (tail + decoder.write(buffer.subarray(0, read))).split('\n')
      tail = parts.pop()
      yield* parts
    }
    tail += decoder.end()
    if (tail) yield tail
  } finally {
    fs.closeSync(fd)
  }
}

function* entries(file) {
  for (const line of lines(file)) {
    if (!line) continue
    try {
      yield JSON.parse(line)
    } catch {
      continue
    }
  }
}

const textOf = (content) => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n')
}

const humanText = (entry) => {
  if (entry.type !== 'user' || entry.isMeta || entry.isSidechain) return ''
  const text = textOf(entry.message && entry.message.content).trim()
  return text.startsWith('<') ? '' : text
}

const redact = (text) => {
  const home = os.homedir()
  return [home, home.replaceAll('\\', '/')]
    .reduce((out, h) => (h ? out.replaceAll(h, '~') : out), text)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
}

const scanTranscript = (file) => {
  const skills = new Map()
  const cwds = new Set()
  let userTurns = 0
  for (const entry of entries(file)) {
    if (entry.cwd) cwds.add(entry.cwd)
    if (humanText(entry)) userTurns++
    const content = entry.message && entry.message.content
    if (entry.type !== 'assistant' || !Array.isArray(content)) continue
    for (const block of content) {
      if (block.type === 'tool_use' && block.name === 'Skill' && block.input && block.input.skill) {
        const name = String(block.input.skill).replace(/^\//, '')
        skills.set(name, (skills.get(name) || 0) + 1)
      }
    }
  }
  return { skills, userTurns, cwds: [...cwds] }
}

const linkInfo = (dir) => {
  let stat
  try {
    stat = fs.lstatSync(dir)
  } catch {
    return null
  }
  if (!stat.isSymbolicLink()) return stat.isDirectory() ? { kind: 'standalone-copy', path: dir } : null
  let target = ''
  try {
    target = fs.readlinkSync(dir)
  } catch {}
  return { kind: 'junctioned', path: dir, target }
}

const marketplaceSource = (marketplace) => {
  const known = readJson(path.join(claudeDir(), 'plugins', 'known_marketplaces.json'))
  const source = known && known[marketplace] && known[marketplace].source
  return source ? source.path || source.repo || source.url || '' : ''
}

const activeInstallPath = (plugin, marketplace) => {
  const installed = readJson(path.join(claudeDir(), 'plugins', 'installed_plugins.json'))
  const found = installed && installed.plugins && installed.plugins[`${plugin}@${marketplace}`]
  return found && found[0] ? found[0].installPath : null
}

const pluginSkillResult = (versionDir, marketplace, version, skill) => {
  const dir = path.join(versionDir, 'skills', skill)
  if (!fs.existsSync(dir)) return null
  const link = linkInfo(versionDir)
  if (link && link.kind === 'junctioned') {
    return { kind: 'junctioned', marketplace, version, via: 'plugin-cache', path: dir, target: path.join(link.target, 'skills', skill) }
  }
  return { kind: 'plugin-installed', marketplace, version, source: marketplaceSource(marketplace), path: dir }
}

const findPluginSkill = (plugin, skill) => {
  const cache = path.join(claudeDir(), 'plugins', 'cache')
  let marketplaces = []
  try {
    marketplaces = fs.readdirSync(cache)
  } catch {
    return null
  }
  for (const marketplace of marketplaces) {
    const active = activeInstallPath(plugin, marketplace)
    if (active) {
      const found = pluginSkillResult(active, marketplace, path.basename(active), skill)
      if (found) return found
    }
    const pluginDir = path.join(cache, marketplace, plugin)
    let versions = []
    try {
      versions = fs
        .readdirSync(pluginDir)
        .filter((v) => /^\d+(\.\d+)*$/.test(v))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    } catch {
      continue
    }
    for (const version of versions) {
      const found = pluginSkillResult(path.join(pluginDir, version), marketplace, version, skill)
      if (found) return found
    }
  }
  return null
}

const classify = (name, roots) => {
  const colon = name.indexOf(':')
  if (colon > 0) return findPluginSkill(name.slice(0, colon), name.slice(colon + 1)) || { kind: 'not-found' }
  if (!SAFE_ID.test(name)) return { kind: 'not-found' }
  const candidates = [path.join(claudeDir(), 'skills', name), ...roots.map((cwd) => path.join(cwd, '.claude', 'skills', name))]
  for (const dir of candidates) {
    const info = linkInfo(dir)
    if (info) return info
  }
  return { kind: 'not-found' }
}

const buildInventory = (file, cwd) => {
  const { skills, userTurns, cwds } = scanTranscript(file)
  const roots = [...new Set([...cwds, cwd].filter(Boolean))]
  const list = [...skills.entries()].map(([name, uses]) => ({ name, uses, ...classify(name, roots) }))
  return { transcriptPath: file, userTurns, skills: list }
}

const newestTranscript = (cwd) => {
  const dir = path.join(claudeDir(), 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'))
  let files = []
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
  } catch {
    return null
  }
  const dated = files.map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
  dated.sort((a, b) => b.t - a.t)
  return dated.length ? dated[0].f : null
}

const locateBySessionId = (sessionId) => {
  if (!SAFE_ID.test(sessionId)) return null
  const projects = path.join(claudeDir(), 'projects')
  let dirs = []
  try {
    dirs = fs.readdirSync(projects)
  } catch {
    return null
  }
  for (const d of dirs) {
    const candidate = path.join(projects, d, `${sessionId}.jsonl`)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

const listPending = () => {
  let files = []
  try {
    files = fs.readdirSync(pendingDir()).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  return files.map((f) => readJson(path.join(pendingDir(), f))).filter(Boolean)
}

const prunePending = () => {
  let files = []
  try {
    files = fs.readdirSync(pendingDir())
  } catch {
    return
  }
  for (const f of files) {
    const p = path.join(pendingDir(), f)
    if (Date.now() - fs.statSync(p).mtimeMs > MAX_AGE_MS) fs.rmSync(p, { force: true })
  }
}

const writeMarker = (marker) => {
  fs.mkdirSync(pendingDir(), { recursive: true, mode: 0o700 })
  writeAtomic(path.join(pendingDir(), `${marker.sessionId}.json`), JSON.stringify(marker, null, 2), 0o600)
}

const quiet = (fn) => {
  try {
    fn()
  } catch (e) {
    if (process.env.SESSION_RETRO_DEBUG) console.error(e.stack)
  }
}

const hookEnd = () => {
  const input = readStdinJson()
  const file =
    (typeof input.transcript_path === 'string' && fs.existsSync(input.transcript_path) && input.transcript_path) ||
    (typeof input.session_id === 'string' && locateBySessionId(input.session_id))
  if (!file) return
  const inventory = buildInventory(file, input.cwd)
  prunePending()
  if (!inventory.skills.length && inventory.userTurns < minTurns()) return
  const id = SAFE_ID.test(String(input.session_id || '')) ? input.session_id : path.basename(file, '.jsonl')
  if (!SAFE_ID.test(id)) return
  writeMarker({
    sessionId: id,
    endedAt: new Date().toISOString(),
    reason: input.reason || '',
    cwd: input.cwd || '',
    nudged: false,
    ...inventory,
  })
}

const tally = (skills) => {
  const counts = { junctioned: 0, 'plugin-installed': 0, 'standalone-copy': 0, 'not-found': 0 }
  for (const s of skills) counts[s.kind] = (counts[s.kind] || 0) + 1
  return counts
}

const hookStart = () => {
  const input = readStdinJson()
  if (input.source === 'compact') return
  const fresh = listPending().filter((m) => m.sessionId !== input.session_id && !m.nudged)
  if (!fresh.length) return
  const all = fresh.flatMap((m) => m.skills || [])
  const counts = tally(all)
  const names = [...new Set(all.map((s) => s.name))].join(', ') || 'none'
  for (const m of fresh) writeMarker({ ...m, nudged: true })
  const context =
    `Session retro pending for ${fresh.length} earlier session(s). Skills used: ${names}. ` +
    `Install types: ${counts.junctioned} junctioned, ${counts['plugin-installed']} plugin-installed, ` +
    `${counts['standalone-copy']} standalone copy, ${counts['not-found']} not found. ` +
    'Mention this once, in one line, at a natural pause and never mid-task: offer to run the session-retro skill. ' +
    'Do not read the old transcript or propose anything unless the user says yes.'
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }))
}

const digest = (file, maxChars) => {
  const out = []
  for (const entry of entries(file)) {
    const content = entry.message && entry.message.content
    const human = humanText(entry)
    if (human) out.push(`USER: ${redact(human.slice(0, maxChars))}`)
    if (entry.type !== 'assistant' || !Array.isArray(content) || entry.isSidechain) continue
    const text = textOf(content).trim()
    if (text) out.push(`ASSISTANT: ${redact(text.slice(0, maxChars))}`)
    for (const b of content) {
      if (b.type === 'tool_use') out.push(`[tool: ${b.name}${b.name === 'Skill' && b.input ? ` ${b.input.skill}` : ''}]`)
    }
  }
  return out.join('\n')
}

const resolveTranscript = () => arg('--transcript') || newestTranscript(arg('--cwd') || process.cwd())

const hookSpecs = (script) => {
  const base = script.replaceAll('\\', '/')
  return [
    { event: 'SessionStart', matcher: 'startup|resume|clear', suffix: 'hook-start', timeout: 10, command: `node "${base}" hook-start` },
    { event: 'SessionEnd', suffix: 'hook-end', timeout: 15, command: `node "${base}" hook-end` },
  ]
}

const settingsTarget = () => {
  const explicit = arg('--settings')
  if (explicit) return path.resolve(explicit)
  const scope = arg('--scope') || 'user'
  if (scope === 'user') return path.join(claudeDir(), 'settings.json')
  if (scope === 'project') return path.join(path.resolve(arg('--cwd') || process.cwd()), '.claude', 'settings.local.json')
  return fail(`--scope must be user or project, got "${scope}"`)
}

const readSettings = (file) => {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return { raw: '', data: {}, exists: false }
    throw e
  }
  const text = raw.replace(/^﻿/, '')
  if (!text.trim()) return { raw, data: {}, exists: true }
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return fail(`${file} is not valid JSON (${e.message}); nothing changed`)
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail(`${file} does not hold a JSON object; nothing changed`)
  return { raw, data, exists: true }
}

const isOurs = (hook) => Boolean(hook) && typeof hook.command === 'string' && OURS.test(hook.command)

const checkShape = (data, file) => {
  if (data.hooks === undefined) return
  const bad = () => fail(`${file} has a hooks section in a shape this tool does not recognize; nothing changed`)
  if (!data.hooks || typeof data.hooks !== 'object' || Array.isArray(data.hooks)) bad()
  for (const groups of Object.values(data.hooks)) {
    if (!Array.isArray(groups)) bad()
    for (const group of groups) if (!group || typeof group !== 'object' || (group.hooks !== undefined && !Array.isArray(group.hooks))) bad()
  }
}

const planInstall = (data, specs) => {
  const actions = []
  data.hooks = data.hooks || {}
  for (const spec of specs) {
    const groups = (data.hooks[spec.event] = data.hooks[spec.event] || [])
    const existing = groups.flatMap((g) => g.hooks || []).find((h) => isOurs(h) && h.command.endsWith(` ${spec.suffix}`))
    if (!existing) {
      const group = { ...(spec.matcher ? { matcher: spec.matcher } : {}), hooks: [{ type: 'command', command: spec.command, timeout: spec.timeout }] }
      groups.push(group)
      actions.push({ event: spec.event, action: 'add', command: spec.command })
    } else if (existing.command !== spec.command) {
      actions.push({ event: spec.event, action: 'update', command: spec.command, was: existing.command })
      existing.command = spec.command
    } else {
      actions.push({ event: spec.event, action: 'unchanged', command: spec.command })
    }
  }
  return actions
}

const planUninstall = (data) => {
  const actions = []
  if (!data.hooks) return actions
  for (const event of Object.keys(data.hooks)) {
    const kept = []
    for (const group of data.hooks[event]) {
      const inner = group.hooks || []
      const remaining = inner.filter((h) => !isOurs(h))
      for (const h of inner.filter(isOurs)) actions.push({ event, action: 'remove', command: h.command })
      if (!inner.length) kept.push(group)
      else if (remaining.length) kept.push({ ...group, hooks: remaining })
    }
    if (kept.length) data.hooks[event] = kept
    else delete data.hooks[event]
  }
  if (actions.length && !Object.keys(data.hooks).length) delete data.hooks
  return actions
}

const serialize = (data, raw) => {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const indent = (raw.match(/^([ \t]+)"/m) || [, '  '])[1]
  const trailing = !raw || /\r?\n$/.test(raw)
  return JSON.stringify(data, null, indent).replace(/\n/g, eol) + (trailing ? eol : '')
}

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-')

const configureHooks = (mode) => {
  const target = settingsTarget()
  const { raw, data, exists } = readSettings(target)
  checkShape(data, target)
  const script = path.resolve(process.argv[1])
  const actions = mode === 'install' ? planInstall(data, hookSpecs(script)) : planUninstall(data)
  const changes = actions.filter((a) => a.action !== 'unchanged')
  console.log(`settings file: ${target}${exists ? '' : ' (does not exist yet)'}`)
  for (const a of actions) console.log(`  ${a.event.padEnd(13)} ${a.action.padEnd(9)} ${a.command}${a.was ? `   (was ${a.was})` : ''}`)
  if (!actions.length) console.log('  no session-retro hooks found')
  if (!changes.length) return console.log('nothing to change')
  if (!has('--apply')) return console.log('dry run: nothing written. Re-run with --apply to write these changes.')
  const real = exists ? fs.realpathSync(target) : target
  fs.mkdirSync(path.dirname(real), { recursive: true })
  let backup = ''
  if (exists) {
    backup = `${real}.session-retro.bak-${timestamp()}`
    fs.copyFileSync(real, backup)
  }
  writeAtomic(real, serialize(data, raw), exists ? fs.statSync(real).mode & 0o777 : 0o600)
  const after = readSettings(target).data
  const present = hookSpecs(script).map((s) => ((after.hooks || {})[s.event] || []).some((g) => (g.hooks || []).some((h) => h.command === s.command)))
  const leftover = Object.values(after.hooks || {}).flat().flatMap((g) => g.hooks || []).some(isOurs)
  const ok = mode === 'install' ? present.every(Boolean) : !leftover
  console.log(`written: ${real}`)
  if (backup) console.log(`backup:  ${backup}`)
  console.log(`read-back: ${ok ? 'verified' : 'MISMATCH'}`)
  if (!ok) process.exit(1)
}

const commands = {
  'hook-end': () => quiet(hookEnd),
  'hook-start': () => quiet(hookStart),
  inventory() {
    const file = resolveTranscript()
    if (!file) return fail('no transcript found')
    console.log(JSON.stringify(buildInventory(file, arg('--cwd') || process.cwd()), null, 2))
  },
  digest() {
    const file = resolveTranscript()
    if (!file) return fail('no transcript found')
    console.log(digest(file, Number(arg('--max-chars')) || 600))
  },
  pending() {
    console.log(JSON.stringify(listPending(), null, 2))
  },
  clear() {
    if (has('--all')) return fs.rmSync(pendingDir(), { recursive: true, force: true })
    const id = arg('--session')
    if (!id || !SAFE_ID.test(id)) return fail('--session <id> or --all required')
    fs.rmSync(path.join(pendingDir(), `${id}.json`), { force: true })
  },
  'install-hooks': () => configureHooks('install'),
  'uninstall-hooks': () => configureHooks('uninstall'),
}

const run = commands[process.argv[2]]
if (!run) fail(`usage: retro.mjs <${Object.keys(commands).join('|')}> [--transcript <file>] [--cwd <dir>] [--session <id>|--all] [--scope user|project] [--settings <file>] [--apply]`)
try {
  run()
} catch (e) {
  fail(process.env.SESSION_RETRO_DEBUG ? e.stack : e.message)
}

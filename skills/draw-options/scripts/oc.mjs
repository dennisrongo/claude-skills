#!/usr/bin/env node
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets')
const LAYOUTS = ['columns', 'matrix', 'tree']
const BOOLEAN_FLAGS = new Set(['yes'])
const MIN_OPTIONS = 2
const MAX_OPTIONS = 4
const MAX_CRITERIA = 8
const MAX_ITEMS = 12
const MAX_ITEM_CHARS = 120
const MAX_NAME_CHARS = 80
const WARN_BYTES = 1024 * 1024
const REQUEST_TIMEOUT_MS = 90000
const DAY_MS = 86400000
const OPEN_WAIT_SECONDS = Number(process.env.DRAW_OPTIONS_OPEN_WAIT) > 0 ? Number(process.env.DRAW_OPTIONS_OPEN_WAIT) : 15
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/
const CMD_UNSAFE = /[&|^%<>()!"]/
const EXIT = { usage: 1, notInstalled: 2, notRunning: 3, exists: 4, docGone: 5, neverSaved: 6 }
const OPTION_KEYS = {
  columns: ['name', 'includes', 'pros', 'cons'],
  tree: ['name', 'pros', 'cons', 'then'],
}
const SPEC_KEYS = {
  columns: ['title', 'question', 'options', 'recommended'],
  matrix: ['title', 'question', 'options', 'criteria', 'recommendation'],
  tree: ['title', 'question', 'options'],
}

class Done extends Error {}

const out = (value, code = 0) => {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n')
  process.exitCode = code
  throw new Done()
}
const fail = (state, message, code = 1) => out({ ok: false, state, message }, code)
const exitFor = (state) => (state === 'not-installed' ? EXIT.notInstalled : EXIT.notRunning)

const flags = (argv) => {
  const positional = []
  const named = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) {
      positional.push(argv[i])
      continue
    }
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith('--')) named[key] = true
    else {
      named[key] = next
      i++
    }
  }
  return { positional, named }
}

const home = () => os.homedir()

const diagramsDir = (named) => {
  if (named.dir === true) fail('usage', '--dir needs a folder path', EXIT.usage)
  return path.resolve(named.dir || process.env.DRAW_OPTIONS_DIR || path.join(home(), '.claude', 'diagrams'))
}

const appDataDir = () => {
  if (process.env.TLDRAW_DATA_DIR) return process.env.TLDRAW_DATA_DIR
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home(), 'AppData', 'Roaming'), 'tldraw')
  if (process.platform === 'darwin') return path.join(home(), 'Library', 'Application Support', 'tldraw')
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home(), '.config'), 'tldraw')
}

const exePaths = () => {
  if (process.env.TLDRAW_EXE) return [process.env.TLDRAW_EXE]
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home(), 'AppData', 'Local')
    return [path.join(local, 'Programs', 'tldraw offline', 'tldraw offline.exe')]
  }
  if (process.platform === 'darwin') {
    return ['/Applications/tldraw offline.app', path.join(home(), 'Applications', 'tldraw offline.app')]
  }
  return []
}

const readServer = () => {
  const file = path.join(appDataDir(), 'server.json')
  if (!fs.existsSync(file)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const port = Number(parsed.port)
    return Number.isInteger(port) && port > 0 && port < 65536 && parsed.token ? { ...parsed, port } : null
  } catch {
    return null
  }
}

const call = async (server, route, { method = 'POST', json, text } = {}) => {
  const headers = { authorization: `Bearer ${server.token}` }
  let body
  if (json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (text !== undefined) {
    headers['content-type'] = 'text/plain'
    body = text
  }
  const res = await fetch(`http://localhost:${server.port}${route}`, {
    method,
    headers,
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const raw = await res.text()
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    data = { raw }
  }
  return { status: res.status, data }
}

const search = async (server, code) => {
  const r = await call(server, '/api/search', { json: { code } })
  if (r.status !== 200 || !r.data.success) throw new Error(`search failed (${r.status}): ${JSON.stringify(r.data).slice(0, 400)}`)
  return r.data.result
}

const openDocs = (server) => search(server, 'return await api.getDocs()')

const execIn = async (server, docId, code) => {
  const r = await call(server, `/api/doc/${encodeURIComponent(docId).replace(/%3A/gi, ':')}/exec`, { text: code })
  if (r.status !== 200 || !r.data.success) {
    throw new Error(`exec failed (${r.status}): ${JSON.stringify(r.data.error ?? r.data).slice(0, 800)}`)
  }
  return r.data.result
}

const preflight = async () => {
  const server = readServer()
  if (server) {
    try {
      const r = await call(server, '/api/search', { json: { code: 'return 1' } })
      if (r.status === 200 && r.data.success) return { state: 'ready', server }
      if (r.status === 401) {
        return { state: 'not-running', message: 'The app rejected the saved token. Quit tldraw offline completely and open it again.' }
      }
      return { state: 'not-running', message: `The app answered with status ${r.status}. Quit tldraw offline and open it again.` }
    } catch {}
  }
  if (server || exePaths().some((p) => fs.existsSync(p))) {
    return { state: 'not-running', message: 'tldraw offline is installed but its local server is not answering. Open the app, then rerun.' }
  }
  return {
    state: 'not-installed',
    message: 'tldraw offline (the desktop app) was not found. Install it, then rerun. Until then present the options as a Mermaid diagram or table in chat and report canvas: not run.',
  }
}

const needServer = async () => {
  const result = await preflight()
  if (result.state === 'ready') return result.server
  fail(result.state, result.message, exitFor(result.state))
}

const sanitize = (raw) => {
  const name = String(raw ?? '')
    .replace(/\.tldraw$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, MAX_NAME_CHARS)
    .replace(/-+$/g, '')
  if (!name) fail('bad-name', 'The file name is empty after cleaning. Pass <task#>-<short-desc>.', EXIT.usage)
  if (RESERVED_NAME.test(name)) fail('bad-name', `${name} is a reserved device name on Windows. Add a description after the task number.`, EXIT.usage)
  return name
}

const serverFile = () => path.join(appDataDir(), 'server.json')

const snapshotServerFile = () => {
  try {
    return fs.readFileSync(serverFile(), 'utf8')
  } catch {
    return null
  }
}

const restoreServerFile = async (original) => {
  if (original === null) return
  await new Promise((resolve) => setTimeout(resolve, 1000))
  try {
    if (fs.readFileSync(serverFile(), 'utf8') !== original) fs.writeFileSync(serverFile(), original)
  } catch {}
}

const launch = (file) => {
  if (process.platform === 'win32' && CMD_UNSAFE.test(file)) return false
  if (process.env.DRAW_OPTIONS_NO_LAUNCH) return true
  const [cmd, args] = process.env.DRAW_OPTIONS_OPENER
    ? [process.execPath, [process.env.DRAW_OPTIONS_OPENER, file]]
    : process.platform === 'win32'
      ? ['cmd.exe', ['/c', 'start', '', file]]
      : process.platform === 'darwin'
        ? ['open', [file]]
        : ['xdg-open', [file]]
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
  return true
}

const samePath = (a, b) => {
  if (!a || !b) return false
  const norm = (p) => path.resolve(p).replace(/\\/g, '/')
  return process.platform === 'linux' ? norm(a) === norm(b) : norm(a).toLowerCase() === norm(b).toLowerCase()
}

const findDoc = (docs, target) => docs.find((d) => samePath(d.filePath, target))

const checkList = (label, list, problems) => {
  if (list === undefined) return
  if (!Array.isArray(list)) return problems.push(`${label} must be an array of strings`)
  if (list.length > MAX_ITEMS) problems.push(`${label} has ${list.length} items; keep it to ${MAX_ITEMS} or fewer`)
  list.forEach((item, i) => {
    if (typeof item !== 'string' || !item.trim()) problems.push(`${label}[${i}] must be a non-empty string`)
    else if (item.length > MAX_ITEM_CHARS) problems.push(`${label}[${i}] is ${item.length} characters; keep it to ${MAX_ITEM_CHARS} or fewer`)
  })
}

const unknownKeys = (label, object, allowed, problems) => {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) problems.push(`${label} has an unknown key "${key}"; this layout accepts: ${allowed.join(', ')}`)
  }
}

const validate = (layout, spec) => {
  const problems = []
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return ['spec must be a JSON object']
  unknownKeys('spec', spec, SPEC_KEYS[layout], problems)
  if (typeof spec.title !== 'string' || !spec.title.trim()) problems.push('title is required')
  if (!Array.isArray(spec.options)) return [...problems, 'options must be an array']
  const n = spec.options.length
  if (n < MIN_OPTIONS || n > MAX_OPTIONS) problems.push(`options must have ${MIN_OPTIONS} to ${MAX_OPTIONS} entries; got ${n}`)
  if (layout === 'matrix') {
    spec.options.forEach((name, i) => {
      if (typeof name !== 'string' || !name.trim()) problems.push(`options[${i}] must be a non-empty string for the matrix`)
    })
    if (!Array.isArray(spec.criteria) || spec.criteria.length < 1 || spec.criteria.length > MAX_CRITERIA) {
      problems.push(`criteria must be an array of 1 to ${MAX_CRITERIA} entries`)
    } else {
      spec.criteria.forEach((c, i) => {
        if (!c || typeof c.name !== 'string' || !c.name.trim()) problems.push(`criteria[${i}].name is required`)
        else if (!Array.isArray(c.values) || c.values.length !== n) problems.push(`criteria[${i}].values must have exactly ${n} entries`)
        else checkList(`criteria[${i}].values`, c.values, problems)
      })
    }
    if (spec.recommendation !== undefined && typeof spec.recommendation !== 'string') problems.push('recommendation must be a string')
    return problems
  }
  spec.options.forEach((o, i) => {
    if (!o || typeof o.name !== 'string' || !o.name.trim()) return problems.push(`options[${i}].name is required`)
    unknownKeys(`options[${i}]`, o, OPTION_KEYS[layout], problems)
    for (const key of OPTION_KEYS[layout].slice(1)) checkList(`options[${i}].${key}`, o[key], problems)
  })
  if (layout === 'columns' && spec.recommended !== undefined) {
    const names = spec.options.map((o) => String(o?.name ?? '').trim().toLowerCase())
    if (typeof spec.recommended !== 'string' || !names.includes(spec.recommended.trim().toLowerCase())) {
      problems.push(`recommended must be the name of one option, exactly as written in options[].name`)
    }
  }
  return problems
}

const commands = {
  async check() {
    const result = await preflight()
    if (result.state === 'ready') out({ ok: true, state: 'ready', platformVerified: process.platform === 'win32' })
    fail(result.state, result.message, exitFor(result.state))
  },

  async open({ positional, named }) {
    const server = await needServer()
    const name = sanitize(positional[0])
    const dir = diagramsDir(named)
    fs.mkdirSync(dir, { recursive: true })
    const target = path.join(dir, `${name}.tldraw`)
    const r = await call(server, '/api/docs/create', { json: { name, directory: dir } })
    if (r.status === 200 && r.data.success) {
      const doc = r.data.result
      out({ ok: true, created: true, id: doc.id, filePath: doc.filePath })
    }
    if (r.status !== 409) fail('create-failed', `create answered ${r.status}: ${JSON.stringify(r.data).slice(0, 400)}`, EXIT.usage)
    const match = findDoc(await openDocs(server), target)
    if (match) out({ ok: true, created: false, id: match.id, filePath: match.filePath })
    if (!fs.existsSync(target)) fail('create-failed', `create answered 409 but ${target} does not exist`, EXIT.usage)
    const original = snapshotServerFile()
    try {
      if (!launch(target)) {
        fail('exists-not-open', `${target} already exists and its path has characters that cannot be opened safely from here. Open it in tldraw offline, then rerun.`, EXIT.exists)
      }
      for (let attempt = 0; attempt < OPEN_WAIT_SECONDS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const opened = findDoc(await openDocs(server).catch(() => []), target)
        if (opened) out({ ok: true, created: false, opened: true, id: opened.id, filePath: opened.filePath })
      }
      fail('exists-not-open', `${target} already exists and did not open by itself. Open it in tldraw offline, then rerun.`, EXIT.exists)
    } finally {
      await restoreServerFile(original)
    }
  },

  async draw({ positional }) {
    const [docId, layout, specFile] = positional
    if (!docId || !LAYOUTS.includes(layout) || !specFile) fail('usage', `usage: draw <docId> <${LAYOUTS.join('|')}> <spec.json>`, EXIT.usage)
    let spec
    try {
      spec = JSON.parse(fs.readFileSync(specFile, 'utf8'))
    } catch (e) {
      fail('bad-spec', `cannot read ${specFile}: ${e.message}`, EXIT.usage)
    }
    const problems = validate(layout, spec)
    if (problems.length) out({ ok: false, state: 'bad-spec', problems }, EXIT.usage)
    const server = await needServer()
    const code = [
      `const SPEC = ${JSON.stringify(spec)}`,
      fs.readFileSync(path.join(ASSETS, 'common.js'), 'utf8'),
      fs.readFileSync(path.join(ASSETS, `${layout}.js`), 'utf8'),
    ].join('\n')
    const result = await execIn(server, docId, code)
    out({ ok: true, layout, result })
  },

  async finish({ positional }) {
    const docId = positional[0]
    if (!docId) fail('usage', 'usage: finish <docId>', EXIT.usage)
    const server = await needServer()
    const doc = (await openDocs(server)).find((d) => d.id === docId)
    if (!doc) fail('doc-gone', 'That document is no longer open. Run open again; do not guess another document.', EXIT.docGone)
    if (!doc.filePath) fail('never-saved', 'This document has no file on disk, so it cannot be saved from here.', EXIT.neverSaved)
    const lints = await execIn(server, docId, 'return helpers.getLints().lints.length')
    await execIn(server, docId, 'await helpers.saveDoc(); return true')
    const bytes = fs.statSync(doc.filePath).size
    const shot = await search(server, `return await api.getScreenshot(${JSON.stringify(docId)}, { size: 'large' })`)
    out({
      ok: true,
      filePath: doc.filePath,
      bytes,
      sizeWarning: bytes > WARN_BYTES ? `file is over ${WARN_BYTES / 1024 / 1024} MB; check for pasted images or stray shapes` : null,
      lints,
      screenshot: shot.filePath,
    })
  },

  async list({ named }) {
    const dir = diagramsDir(named)
    if (!fs.existsSync(dir)) out({ ok: true, dir, files: [] })
    const now = Date.now()
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.tldraw'))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f))
        return { file: f, bytes: stat.size, ageDays: Math.floor((now - stat.mtimeMs) / DAY_MS), mtime: stat.mtimeMs }
      })
      .sort((a, b) => a.mtime - b.mtime)
      .map(({ mtime, ...rest }) => rest)
    out({ ok: true, dir, totalBytes: files.reduce((n, f) => n + f.bytes, 0), files })
  },

  async remove({ positional, named }) {
    const dir = diagramsDir(named)
    const target = path.resolve(dir, positional[0] || '')
    const inside = path.relative(dir, target)
    const escapes = inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)
    if (!positional[0] || escapes || !target.toLowerCase().endsWith('.tldraw')) {
      fail('refused', `remove only deletes a .tldraw file inside ${dir}`, EXIT.usage)
    }
    if (!fs.existsSync(target)) fail('missing', `${target} does not exist`, EXIT.usage)
    if (path.relative(fs.realpathSync(dir), fs.realpathSync(path.dirname(target))) !== '') {
      fail('refused', `remove only deletes a .tldraw file directly inside ${dir}`, EXIT.usage)
    }
    if (!named.yes) fail('needs-yes', 'Deleting needs --yes, and only after the user confirmed this exact file.', EXIT.usage)
    fs.rmSync(target)
    out({ ok: true, removed: target })
  },
}

const [cmd, ...rest] = process.argv.slice(2)
try {
  if (!Object.hasOwn(commands, cmd)) fail('usage', `usage: oc.mjs <${Object.keys(commands).join('|')}> [args]`, EXIT.usage)
  await commands[cmd](flags(rest))
} catch (e) {
  if (!(e instanceof Done)) {
    process.stdout.write(JSON.stringify({ ok: false, state: 'error', message: e.message }, null, 2) + '\n')
    process.exitCode = 1
  }
}

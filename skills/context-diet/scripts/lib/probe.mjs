import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { claudeHome, projectsDir } from './paths.mjs'
import { registerProbe } from './state.mjs'
import { snapshotOf, summarizeFile } from './transcripts.mjs'

export const NOT_STARTED = 'claude could not be started'
const WINDOWS_HINT = ' (on Windows an npm-installed claude is claude.cmd, which cannot be started without a shell; use the native claude.exe)'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const findTranscript = (id) => {
  const root = projectsDir()
  if (!fs.existsSync(root)) return null
  for (const proj of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, proj.name, `${id}.jsonl`)
    if (proj.isDirectory() && fs.existsSync(file)) return file
  }
  return null
}

const childEnv = () => (process.env.CONTEXT_DIET_HOME ? { ...process.env, CLAUDE_CONFIG_DIR: claudeHome() } : process.env)

const launch = (cwd, id, timeoutMs, onSpawn) =>
  new Promise((resolve) => {
    const stub = process.env.CONTEXT_DIET_CLAUDE
    const command = stub ? process.execPath : 'claude'
    const model = process.env.CONTEXT_DIET_MODEL || 'haiku'
    const argv = [...(stub ? [stub] : []), '-p', 'ok', '--session-id', id, '--model', model]
    let child
    try {
      child = spawn(command, argv, { cwd, stdio: 'ignore', windowsHide: true, env: childEnv() })
    } catch (e) {
      resolve({ error: e.code || e.message })
      return
    }
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)
    child.on('spawn', onSpawn)
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ error: e.code || e.message })
    })
    child.on('close', () => {
      clearTimeout(timer)
      resolve({ timedOut })
    })
  })

const notStarted = (code) => {
  const hint = process.platform === 'win32' && (code === 'ENOENT' || code === 'EINVAL') ? WINDOWS_HINT : ''
  return `${NOT_STARTED} (${code})${hint}`
}

export const runProbe = async ({ cwd, timeoutMs = 120000, settleMs = Number(process.env.CONTEXT_DIET_SETTLE_MS || 500) } = {}) => {
  const id = randomUUID()
  let registerError = null
  const res = await launch(cwd || process.cwd(), id, timeoutMs, () => {
    try {
      registerProbe(id)
    } catch (e) {
      registerError = e
    }
  })
  if (res.error) return { ok: false, reason: notStarted(res.error) }
  if (registerError) throw registerError
  if (res.timedOut) return { ok: false, reason: `the probe timed out after ${timeoutMs / 1000} s` }
  let file = findTranscript(id)
  for (let i = 0; !file && i < 6; i++) {
    await wait(settleMs)
    file = findTranscript(id)
  }
  if (!file) return { ok: false, reason: 'the probe session wrote no transcript' }
  const session = await summarizeFile(file, id)
  fs.rmSync(file, { force: true })
  fs.rmSync(path.join(path.dirname(file), id), { recursive: true, force: true })
  if (session.counts.skill_listing === 0) {
    return { ok: false, reason: 'the probe transcript has no skill listing (transcript format changed?)' }
  }
  return { ok: true, snapshot: snapshotOf(session) }
}

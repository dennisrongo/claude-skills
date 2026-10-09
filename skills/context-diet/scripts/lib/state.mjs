import fs from 'node:fs'
import path from 'node:path'
import { probesPath, reportPath } from './paths.mjs'
import { readJson } from './inventory.mjs'

const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RENAME_RETRIES = 5
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const renameWithRetry = (from, to, rename) => {
  for (let attempt = 0; ; attempt++) {
    try {
      rename(from, to)
      return
    } catch (e) {
      if (!RETRYABLE.has(e && e.code) || attempt >= RENAME_RETRIES) throw e
      pause(20 * (attempt + 1))
    }
  }
}

export const writeAtomic = (file, data, { mode = 0o600, rename = fs.renameSync } = {}) => {
  const temp = `${file}.tmp-${process.pid}`
  try {
    fs.rmSync(temp, { force: true })
    fs.writeFileSync(temp, data, { mode })
    try {
      fs.chmodSync(temp, mode)
    } catch {}
    renameWithRetry(temp, file, rename)
  } catch (e) {
    fs.rmSync(temp, { force: true })
    throw e
  }
}

export const writeJsonFile = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  writeAtomic(file, JSON.stringify(value, null, 2) + '\n')
}

export const readProbeIds = () => {
  const ids = readJson(probesPath())
  return Array.isArray(ids) ? ids : []
}

export const registerProbe = (id) => {
  const file = probesPath()
  if (fs.existsSync(file) && !Array.isArray(readJson(file))) fs.renameSync(file, `${file}.corrupt`)
  writeJsonFile(file, [...readProbeIds(), id])
}

export const readReport = () => readJson(reportPath())

export const writeReport = (report) => writeJsonFile(reportPath(), report)

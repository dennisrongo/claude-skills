import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { projectsDir } from './paths.mjs'

export const normalizeServer = (name) => String(name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const cleanName = (name) => String(name).trim().replace(/^\//, '')
const list = (v) => (Array.isArray(v) ? v : [])
const str = (v) => (typeof v === 'string' ? v : '')
const isText = (v) => typeof v === 'string' && v !== ''
const bump = (map, key, n = 1) => map.set(key, (map.get(key) || 0) + n)
const keepMax = (map, key, n) => {
  if (!map.has(key) || n > map.get(key)) map.set(key, n)
}
const sumValues = (map) => [...map.values()].reduce((a, b) => a + b, 0)

const skillLineName = (line) => {
  const m = /^- (\S+)/.exec(line)
  return m ? m[1].replace(/:$/, '') : null
}

const newSession = (sessionId, project) => ({
  sessionId,
  project,
  cwd: null,
  firstTs: null,
  lastTs: null,
  skillChars: 0,
  listing: { skills: new Map(), agents: new Map(), mcp: new Map(), hooks: new Map() },
  mcpInstructions: new Map(),
  mcpTools: new Map(),
  mcpToolSeen: new Set(),
  used: { skills: new Map(), agents: new Map(), mcp: new Map() },
  hookFires: new Map(),
  unavailable: new Map(),
  counts: { skill_listing: 0, agent_listing_delta: 0, mcp_instructions_delta: 0, hook_success: 0 },
})

const refreshMcp = (s, server) => {
  s.listing.mcp.set(server, (s.mcpInstructions.get(server) || 0) + (s.mcpTools.get(server) || 0))
}

const markUnavailable = (s, entry, status) => {
  const name = typeof entry === 'string' ? entry : entry && entry.name
  if (isText(name)) s.unavailable.set(name, status)
}

const absorbAttachment = (s, a) => {
  if (a.type === 'skill_listing') {
    s.counts.skill_listing++
    const content = str(a.content)
    s.skillChars = Math.max(s.skillChars, content.length)
    for (const line of content.split('\n')) {
      const name = line.startsWith('- ') ? skillLineName(line) : null
      if (name) keepMax(s.listing.skills, name, line.length)
    }
    for (const name of list(a.names)) if (typeof name === 'string' && !s.listing.skills.has(name)) s.listing.skills.set(name, 0)
  } else if (a.type === 'agent_listing_delta') {
    s.counts.agent_listing_delta++
    const lines = list(a.addedLines)
    list(a.addedTypes).forEach((type, i) => {
      if (isText(type)) keepMax(s.listing.agents, type, str(lines[i]).length)
    })
  } else if (a.type === 'mcp_instructions_delta') {
    s.counts.mcp_instructions_delta++
    const blocks = list(a.addedBlocks)
    list(a.addedNames).forEach((name, i) => {
      if (!isText(name)) return
      const server = normalizeServer(name)
      keepMax(s.mcpInstructions, server, str(blocks[i]).length)
      refreshMcp(s, server)
    })
  } else if (a.type === 'deferred_tools_delta') {
    const lines = list(a.addedLines)
    list(a.addedNames).forEach((name, i) => {
      const m = isText(name) ? /^mcp__(.+?)__/.exec(name) : null
      if (!m || s.mcpToolSeen.has(name)) return
      s.mcpToolSeen.add(name)
      const server = normalizeServer(m[1])
      s.mcpTools.set(server, (s.mcpTools.get(server) || 0) + str(lines[i]).length)
      refreshMcp(s, server)
    })
    for (const x of list(a.needsAuthMcpServers)) markUnavailable(s, x, 'needs-auth')
    for (const x of list(a.failedMcpServers)) markUnavailable(s, x, 'failed')
  } else if (a.type === 'hook_success') {
    s.counts.hook_success++
    const key = isText(a.command) ? a.command : isText(a.hookName) ? a.hookName : 'unknown'
    bump(s.hookFires, `${isText(a.hookEvent) ? a.hookEvent : '?'}|${key}`)
    if (a.hookEvent === 'SessionStart') keepMax(s.listing.hooks, key, str(a.stdout).length)
  } else if (a.type === 'invoked_skills') {
    for (const x of list(a.skills)) {
      const name = typeof x === 'string' ? x : x && x.name
      if (isText(name)) bump(s.used.skills, cleanName(name))
    }
  }
}

const absorbToolUse = (s, block) => {
  const input = block.input && typeof block.input === 'object' ? block.input : {}
  if (block.name === 'Skill' && typeof input.skill === 'string') bump(s.used.skills, cleanName(input.skill))
  else if (block.name === 'Agent' || block.name === 'Task') bump(s.used.agents, isText(input.subagent_type) ? input.subagent_type : 'general-purpose')
  else if (typeof block.name === 'string' && block.name.startsWith('mcp__')) {
    const m = /^mcp__(.+?)__/.exec(block.name)
    if (m) bump(s.used.mcp, normalizeServer(m[1]))
  }
}

const absorb = (s, o) => {
  if (!o || typeof o !== 'object') return
  if (isText(o.cwd) && !s.cwd) s.cwd = o.cwd
  if (isText(o.timestamp)) {
    if (!s.firstTs || o.timestamp < s.firstTs) s.firstTs = o.timestamp
    if (!s.lastTs || o.timestamp > s.lastTs) s.lastTs = o.timestamp
  }
  if (o.type === 'attachment' && o.attachment && typeof o.attachment === 'object') absorbAttachment(s, o.attachment)
  const content = o.message && o.message.content
  if (o.type === 'assistant' && Array.isArray(content)) {
    for (const block of content) if (block && block.type === 'tool_use') absorbToolUse(s, block)
  }
  if (o.type === 'user' && content) {
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('\n')
          : ''
    const m = /<command-name>\/?([^<\s]+)<\/command-name>/.exec(text)
    if (m) bump(s.used.skills, cleanName(m[1]))
  }
}

const readFile = async (file, s) => {
  const input = fs.createReadStream(file)
  const rl = readline.createInterface({ input, crlfDelay: Infinity })
  let failure = null
  input.on('error', (e) => {
    failure = e
    rl.close()
  })
  for await (const line of rl) {
    if (!line) continue
    let o
    try {
      o = JSON.parse(line)
    } catch {
      continue
    }
    absorb(s, o)
  }
  if (failure) throw failure
}

const readable = async (file, s) => {
  try {
    await readFile(file, s)
    return true
  } catch {
    return false
  }
}

export const summarizeFile = async (file, sessionId = path.basename(file, '.jsonl')) => {
  const s = newSession(sessionId, path.basename(path.dirname(file)))
  await readFile(file, s)
  return s
}

const entriesOf = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return null
  }
}

export const readSessions = async ({ exclude = new Set() } = {}) => {
  const root = projectsDir()
  const sessions = []
  let skippedFiles = 0
  if (!fs.existsSync(root)) return { sessions, skippedFiles }
  const projects = entriesOf(root)
  if (!projects) return { sessions, skippedFiles: 1 }
  for (const proj of projects) {
    if (!proj.isDirectory() && !proj.isSymbolicLink()) continue
    const dir = path.join(root, proj.name)
    const entries = entriesOf(dir)
    if (!entries) {
      skippedFiles++
      continue
    }
    for (const entry of entries) {
      if (!entry.name.endsWith('.jsonl')) continue
      const id = entry.name.slice(0, -'.jsonl'.length)
      if (exclude.has(id)) continue
      const s = newSession(id, proj.name)
      if (!(await readable(path.join(dir, entry.name), s))) {
        skippedFiles++
        continue
      }
      const subDir = path.join(dir, id, 'subagents')
      if (fs.existsSync(subDir)) {
        for (const f of entriesOf(subDir) || []) {
          if (f.name.endsWith('.jsonl') && !(await readable(path.join(subDir, f.name), s))) skippedFiles++
        }
      }
      sessions.push(s)
    }
  }
  return { sessions, skippedFiles }
}

export const snapshotOf = (s) => ({
  skills: [...s.listing.skills.keys()].sort(),
  agents: [...s.listing.agents.keys()].sort(),
  mcp: [...s.listing.mcp.keys()].sort(),
  hooks: Object.fromEntries(s.listing.hooks),
  chars: {
    skills: s.skillChars,
    agents: sumValues(s.listing.agents),
    mcp: sumValues(s.listing.mcp),
    hooks: sumValues(s.listing.hooks),
  },
})

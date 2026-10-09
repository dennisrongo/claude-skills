import { flattenHooks } from './inventory.mjs'
import { isSafeSkillName } from './paths.mjs'
import { tokens } from './tokens.mjs'
import { normalizeServer } from './transcripts.mjs'

export const DEFAULTS = { minSessions: 20, rarelyPct: 5 }

const baseOf = (name) => name.slice(name.lastIndexOf(':') + 1)
const sum = (list, pick) => list.reduce((a, x) => a + pick(x), 0)
const findPlugin = (plugins, prefix) => plugins.find((p) => p.short === prefix || p.id.split('@')[0] === prefix)

const attribute = (plugins, settingsCommands, kind, name) => {
  if (kind === 'skill' || kind === 'agent') {
    const i = name.indexOf(':')
    if (i <= 0) return { source: kind === 'skill' ? 'local' : 'unmanaged', plugin: null }
    const owner = findPlugin(plugins, name.slice(0, i))
    return owner ? { source: 'plugin', plugin: owner.id } : { source: 'platform', plugin: null }
  }
  if (kind === 'mcp') {
    const owner = plugins
      .filter((p) => name.startsWith(`plugin_${normalizeServer(p.short)}_`))
      .sort((a, b) => b.short.length - a.short.length)[0]
    return owner ? { source: 'plugin', plugin: owner.id } : { source: 'unmanaged', plugin: null }
  }
  const owners = plugins.filter((p) => p.hooks.some((h) => h.command === name)).map((p) => p.id)
  if (owners.length === 1) return { source: 'plugin', plugin: owners[0] }
  if (owners.length > 1) return { source: 'shared', plugin: null }
  return { source: settingsCommands.has(name) ? 'settings' : 'unknown', plugin: null }
}

const guardSets = (plugins, settings) => {
  const guardCommands = new Set()
  const guardPlugins = new Set()
  for (const p of plugins) {
    for (const h of p.hooks) {
      if (h.event === 'PreToolUse') {
        if (h.command) guardCommands.add(h.command)
        guardPlugins.add(p.id)
      }
    }
  }
  for (const h of flattenHooks(settings && settings.hooks)) if (h.event === 'PreToolUse' && h.command) guardCommands.add(h.command)
  return { guardCommands, guardPlugins }
}

export const buildProtection = ({ plugins, settings, keep = [] }) => {
  const { guardCommands, guardPlugins } = guardSets(plugins, settings)
  const unreadablePlugins = new Set(plugins.filter((p) => p.hooksUnreadable).map((p) => p.id))
  const keepSet = new Set(keep)
  return (id, name, pid) => {
    if (keepSet.has(id) || keepSet.has(name) || (pid && keepSet.has(`plugin:${pid}`))) return 'listed in keep.json'
    if (pid && guardPlugins.has(pid)) return 'plugin supplies a PreToolUse guard'
    if (pid && unreadablePlugins.has(pid)) return 'plugin hooks could not be read'
    if (String(id).startsWith('hook:') && guardCommands.has(name)) return 'PreToolUse guard hook'
    return null
  }
}

export const buildReport = ({ sessions, plugins, settings, keep = [], options = {}, locate = () => null, skippedFiles = 0 }) => {
  const { minSessions, rarelyPct } = { ...DEFAULTS, ...options }
  const settingsCommands = new Set(flattenHooks(settings && settings.hooks).map((h) => h.command).filter(Boolean))
  const { guardCommands, guardPlugins } = guardSets(plugins, settings)
  const protection = buildProtection({ plugins, settings, keep })

  const items = new Map()
  const rollup = new Map()
  const fireTotals = new Map()
  const unavailable = new Map()
  const unlistedUses = new Map()
  const cwds = [...new Set(sessions.map((s) => s.cwd).filter(Boolean))]

  const touch = (kind, name) => {
    const id = `${kind}:${name}`
    if (!items.has(id)) {
      items.set(id, {
        id,
        kind,
        name,
        ...attribute(plugins, settingsCommands, kind, name),
        listed: 0,
        used: 0,
        uses: 0,
        firstListed: null,
        lastUsed: null,
        chars: 0,
      })
    }
    return items.get(id)
  }
  const rollupFor = (pid) => {
    if (!rollup.has(pid)) rollup.set(pid, { pid, members: new Set(), listed: 0, used: 0, uses: 0 })
    return rollup.get(pid)
  }

  for (const s of sessions) {
    const listedPlugins = new Set()
    const usedPlugins = new Set()
    const pass = (kind, listing, used) => {
      for (const [name, chars] of listing) {
        const it = touch(kind, name)
        it.listed++
        it.chars = Math.max(it.chars, chars)
        if (s.firstTs && (!it.firstListed || s.firstTs < it.firstListed)) it.firstListed = s.firstTs
        const n = used ? used.get(name) || 0 : 0
        if (n) {
          it.used++
          it.uses += n
          if (s.lastTs && (!it.lastUsed || s.lastTs > it.lastUsed)) it.lastUsed = s.lastTs
        }
        if (it.plugin) {
          listedPlugins.add(it.plugin)
          rollupFor(it.plugin).members.add(it.id)
          if (n) {
            usedPlugins.add(it.plugin)
            rollupFor(it.plugin).uses += n
          }
        }
      }
    }
    pass('skill', s.listing.skills, s.used.skills)
    pass('agent', s.listing.agents, s.used.agents)
    pass('mcp', s.listing.mcp, s.used.mcp)
    pass('hook', s.listing.hooks, null)
    const credit = (owner, n) => {
      usedPlugins.add(owner)
      rollupFor(owner).uses += n
    }
    for (const [kind, listing, used] of [['skill', s.listing.skills, s.used.skills], ['agent', s.listing.agents, s.used.agents], ['mcp', s.listing.mcp, s.used.mcp]]) {
      for (const [name, n] of used) {
        if (listing.has(name)) continue
        const { source, plugin: owner } = attribute(plugins, settingsCommands, kind, name)
        if (owner) credit(owner, n)
        if (kind !== 'skill') continue
        if (source === 'local') unlistedUses.set(`skill:${name}`, (unlistedUses.get(`skill:${name}`) || 0) + n)
        const byBase = new Set()
        for (const listed of listing.keys()) {
          if (listed !== name && baseOf(listed) === name) {
            const other = attribute(plugins, settingsCommands, kind, listed).plugin
            if (other) byBase.add(other)
          }
        }
        for (const other of byBase) if (other !== owner) credit(other, n)
      }
    }
    for (const pid of listedPlugins) rollupFor(pid).listed++
    for (const pid of usedPlugins) rollupFor(pid).used++
    for (const [key, n] of s.hookFires) {
      const command = key.slice(key.indexOf('|') + 1)
      fireTotals.set(command, (fireTotals.get(command) || 0) + n)
    }
    for (const [name, status] of s.unavailable) {
      const cur = unavailable.get(name) || { name, status, sessions: 0, lastSeen: null }
      cur.status = status
      cur.sessions++
      if (s.lastTs && (!cur.lastSeen || s.lastTs > cur.lastSeen)) cur.lastSeen = s.lastTs
      unavailable.set(name, cur)
    }
  }

  for (const [id, n] of unlistedUses) if (items.has(id)) items.get(id).uses += n

  const pct = (used, listed) => (listed ? Math.min(100, Math.round((used / listed) * 1000) / 10) : 0)

  for (const it of items.values()) {
    it.tokens = tokens(it.chars)
    it.pct = pct(it.used, it.listed)
    it.protected = protection(it.id, it.name, it.plugin)
    it.local = it.source === 'local' && isSafeSkillName(it.name) ? locate(it.name, cwds) : null
    it.via = it.plugin ? `plugin:${it.plugin}` : it.local ? 'local' : it.source === 'settings' ? 'settings-hook' : null
    it.candidate =
      (it.kind === 'skill' || it.kind === 'agent' || it.kind === 'mcp') &&
      it.via === 'local' &&
      !it.protected &&
      it.listed >= minSessions &&
      it.uses === 0
    it.rarely = it.via === 'local' && !it.protected && it.used > 0 && it.listed >= minSessions && it.pct < rarelyPct
  }

  const pluginRows = [...rollup.values()]
    .map((r) => {
      const members = [...r.members].map((id) => items.get(id))
      const owner = plugins.find((p) => p.id === r.pid)
      const id = `plugin:${r.pid}`
      const reason = protection(id, r.pid, r.pid)
      const hasHooks = owner.hooks.length > 0
      const enabled = settings && settings.enabledPlugins ? settings.enabledPlugins[r.pid] : undefined
      const row = {
        id,
        kind: 'plugin',
        name: r.pid,
        plugin: r.pid,
        enabled,
        members: members.length,
        listed: r.listed,
        used: r.used,
        uses: r.uses,
        pct: pct(Math.min(r.used, r.listed), r.listed),
        chars: sum(members, (m) => m.chars),
        protected: reason,
        hasHooks,
      }
      row.tokens = tokens(row.chars)
      row.candidate = enabled !== false && !reason && !hasHooks && r.listed >= minSessions && r.used === 0
      row.rarely = enabled !== false && !reason && !hasHooks && r.used > 0 && r.listed >= minSessions && row.pct < rarelyPct
      row.note = hasHooks && !reason ? 'supplies hooks, which have no usage signal: judge by hand' : null
      return row
    })
    .sort((a, b) => a.id.localeCompare(b.id))

  const guards = [...guardCommands].sort().map((command) => ({
    command,
    plugin: (plugins.find((p) => p.hooks.some((h) => h.event === 'PreToolUse' && h.command === command)) || {}).id || null,
    fires: fireTotals.get(command) || 0,
  }))
  for (const p of plugins) {
    if (guardPlugins.has(p.id) && !p.hooks.some((h) => h.event === 'PreToolUse' && h.command)) {
      guards.push({ command: '(hook without a command)', plugin: p.id, fires: 0 })
    }
  }

  const byBase = new Map()
  for (const it of items.values()) {
    if (it.kind !== 'skill') continue
    const base = baseOf(it.name)
    byBase.set(base, [...(byBase.get(base) || []), it.name])
  }
  const duplicates = [...byBase.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([base, names]) => ({
      base,
      names: names.sort(),
      used: Object.fromEntries(names.map((n) => [n, items.get(`skill:${n}`).used])),
    }))
    .sort((a, b) => a.base.localeCompare(b.base))

  const stamps = sessions.flatMap((s) => [s.firstTs, s.lastTs]).filter(Boolean).sort()
  const withListing = sessions.filter((s) => s.counts.skill_listing > 0).length
  const all = [...items.values()].sort((a, b) => a.id.localeCompare(b.id))

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    thresholds: { minSessions, rarelyPct },
    coverage: { sessions: sessions.length, withListing, first: stamps[0] || null, last: stamps[stamps.length - 1] || null, skippedFiles },
    format: { status: sessions.length > 0 && withListing === 0 ? 'unrecognized' : 'ok' },
    items: all,
    plugins: pluginRows,
    guards,
    duplicates,
    unavailable: [...unavailable.values()].sort((a, b) => b.sessions - a.sessions),
    candidates: [...pluginRows.filter((r) => r.candidate), ...all.filter((i) => i.candidate)].map((x) => x.id),
    rarely: [...pluginRows.filter((r) => r.rarely), ...all.filter((i) => i.rarely)].map((x) => x.id),
  }
}

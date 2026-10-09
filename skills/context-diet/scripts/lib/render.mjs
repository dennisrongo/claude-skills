import { CHARS_PER_TOKEN } from './tokens.mjs'

const table = (heads, rows) => {
  const widths = heads.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)))
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ').trimEnd()
  return [line(heads), ...rows.map(line)].join('\n')
}

const section = (title, body) => ['', title, body]
const clip = (text, n = 70) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)

export const formatReport = (r) => {
  const c = r.coverage
  const skipped = c.skippedFiles > 0 ? `, ${c.skippedFiles} ${c.skippedFiles === 1 ? 'item' : 'items'} could not be read` : ''
  const out = [
    `Coverage: ${c.sessions} sessions (${c.withListing} with a skill listing), ${c.first || 'n/a'} to ${c.last || 'n/a'}${skipped}`,
    `Thresholds: candidate = listed in at least ${r.thresholds.minSessions} sessions with 0 uses; rarely used = under ${r.thresholds.rarelyPct}% of those sessions. Token figures are estimates (characters / ${CHARS_PER_TOKEN}).`,
  ]
  if (c.sessions === 0) return [...out, 'No sessions found: nothing to judge.'].join('\n')
  if (r.format.status === 'unrecognized') {
    return [...out, 'FORMAT UNRECOGNIZED: sessions exist but none carry a skill listing, so usage cannot be judged. See references/transcript-format.md.'].join('\n')
  }
  const heads = ['id', 'listed', 'used', 'used %', 'tokens/session', 'status']
  const rowsOf = (ids, status) => {
    const wanted = new Set(ids)
    return [...r.plugins, ...r.items]
      .filter((x) => wanted.has(x.id))
      .sort((a, b) => b.tokens - a.tokens)
      .map((x) => [x.id, x.listed, x.used, `${x.pct}%`, x.tokens, status])
  }
  const candidateRows = rowsOf(r.candidates, 'candidate')
  out.push(...section('Removal candidates', candidateRows.length ? table(heads, candidateRows) : 'none: nothing meets the thresholds (a valid result)'))
  const rareRows = rowsOf(r.rarely, 'rarely used')
  if (rareRows.length) out.push(...section('Rarely used (not removal candidates)', table(heads, rareRows)))
  const review = r.plugins.filter((p) => p.note)
  if (review.length) out.push(...section('Review by hand', table(['id', 'note'], review.map((p) => [p.id, p.note]))))
  const heldPlugins = new Set(r.plugins.filter((p) => p.protected).map((p) => p.name))
  const held = [
    ...r.plugins.filter((p) => p.protected).map((p) => [p.id, p.protected, p.members === 1 ? '1 entry' : `${p.members} entries`]),
    ...r.items.filter((i) => i.protected && !heldPlugins.has(i.plugin)).map((i) => [clip(i.id), i.protected, '1 entry']),
  ]
  if (held.length) out.push(...section('Protected (never offered)', table(['id', 'reason', 'covers'], held)))
  if (r.guards.length) {
    out.push(...section('Guard hooks (kept)', table(['command', 'plugin', 'fires'], r.guards.map((g) => [clip(g.command), g.plugin || 'settings', g.fires]))))
  }
  if (r.duplicates.length) {
    const lines = r.duplicates.map((d) => `${d.base}: ${d.names.map((n) => `${n} (used in ${d.used[n]})`).join(', ')}`)
    out.push(...section('Same skill under several names (sessions used)', lines.join('\n')))
  }
  const down = r.unavailable.filter((u) => u.sessions >= r.thresholds.minSessions)
  if (down.length) {
    out.push(...section('MCP servers that did not connect', table(['server', 'status', 'sessions', 'last seen'], down.map((u) => [clip(u.name), u.status, u.sessions, (u.lastSeen || '').slice(0, 10)]))))
  }
  const injected = r.items.filter((i) => i.kind === 'hook' && i.chars > 0).sort((a, b) => b.chars - a.chars).slice(0, 5)
  if (injected.length) {
    out.push(...section('Largest session-start injections', table(['command', 'owner', 'tokens'], injected.map((i) => [clip(i.name), i.plugin || i.source, i.tokens]))))
  }
  return out.join('\n')
}

const collateralText = (c) => {
  if (!c.observed) return 'not run: no before-snapshot or no fresh session'
  const lines = [...c.lost, ...(c.unstable || []).map((u) => `${u}  (unstable, rerun: an MCP server outside this change differed between the two sessions)`)]
  return lines.length ? lines.join('\n') : 'none: nothing else disappeared'
}

export const formatVerify = (v) => {
  const out = [`Verdict: ${v.verdict.toUpperCase()} (fresh session: ${v.probe})`]
  out.push(...section('Items', v.items.length ? table(['id', 'status', 'detail'], v.items.map((i) => [i.id, i.status, i.detail])) : 'no applied changes'))
  for (const i of v.items.filter((x) => x.status === 'STILL PRESENT')) out.push(`  ${i.id}: ${i.names.join('; ')}`)
  out.push(...section('Collateral loss', collateralText(v.collateral)))
  if (v.checks.length) out.push(...section('Static checks', table(['id', 'ok', 'detail'], v.checks.map((c) => [c.id, c.ok ? 'yes' : 'NO', c.detail]))))
  if (v.guards.length) out.push(...section('Guards', table(['id', 'ok', 'detail'], v.guards.map((g) => [g.id, g.ok ? 'yes' : 'NO', g.detail]))))
  const m = v.savings.measured
  out.push(
    ...section(
      'Savings',
      m
        ? `projected ~${v.savings.projectedTokens} tokens/session, measured ${m.tokens} tokens (${m.totalChars} characters). If the skill listing did not shrink it may be at its size cap: judge by the entries that are gone, not by characters.`
        : `projected ~${v.savings.projectedTokens} tokens/session, measured: not run`
    )
  )
  if (v.collateral.unstable && v.collateral.unstable.length) out.push('', `Unstable, rerun: verify ${v.manifest}`)
  if (v.verdict !== 'pass') out.push('', `Not done. Restore with: restore ${v.manifest}`)
  return out.join('\n')
}

export const formatApply = (r) => {
  const out = r.manifest ? [`Manifest: ${r.manifest}`] : []
  if (r.changes.length === 0) out.push('Nothing was changed.')
  else out.push(...section('Changes', table(['id', 'type', 'result'], r.changes.map((c) => [c.id, c.type, c.done ? 'done' : c.error ? `FAILED: ${c.error}` : 'not run']))))
  if (r.skipped.length) out.push(...section('Skipped', table(['id', 'reason'], r.skipped.map((s) => [s.id, s.reason]))))
  if (r.preReason) out.push('', `Before-snapshot: not run (${r.preReason}); collateral loss cannot be checked.`)
  if (r.error) out.push('', r.changes.length ? `Stopped early: ${r.error}. Restore with: restore ${r.manifest}` : `Refused: ${r.error}`)
  if (r.verificationError) out.push('', `Verification failed: ${r.verificationError}. Restore with: restore ${r.manifest}`)
  if (r.verification) out.push('', formatVerify(r.verification))
  return out.join('\n')
}

export const formatRestore = (r) => {
  const out = [`Manifest: ${r.manifest}`, `Restored: ${r.restored.length ? r.restored.join(', ') : 'nothing'}`]
  if (r.failed.length) out.push(...section('Could not restore', table(['id', 'reason'], r.failed.map((f) => [f.id, f.reason]))))
  return out.join('\n')
}

export const formatPurge = (r) => {
  if (r.refused) return `Refused: ${r.refused}`
  const out = [r.deleted.length ? `Permanently deleted:\n${r.deleted.join('\n')}` : 'Nothing to purge.']
  const skipped = r.skipped || []
  if (skipped.length) out.push(...section('Skipped (not deleted)', table(['id', 'path', 'reason'], skipped.map((s) => [s.id, s.path || 'none', s.reason]))))
  return out.join('\n')
}

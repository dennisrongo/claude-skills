import { guardsIntact, staticChecks } from './checks.mjs'
import { locateLocalSkill, readJson } from './inventory.mjs'
import { runProbe } from './probe.mjs'
import { writeJsonFile } from './state.mjs'
import { tokens } from './tokens.mjs'

const KINDS = ['skills', 'agents', 'mcp', 'hooks']

const present = (snapshot, kind, name) => (kind === 'hooks' ? Object.hasOwn(snapshot.hooks, name) : snapshot[kind].includes(name))

const why = (change, name, cwd) => {
  if (change.type === 'plugin') return 'the plugin still loads: check project-level settings and the plugin id'
  const found = locateLocalSkill(name, [cwd])
  return found ? `still found at ${found.path}` : 'still listed from a source this tool does not manage'
}

const judge = (change, manifest, post, cwd) => {
  if (!post.ok) return { id: change.id, status: 'NOT OBSERVED', detail: post.reason, names: [] }
  const names = []
  for (const kind of KINDS) {
    for (const name of (change.expect && change.expect[kind]) || []) {
      if (manifest.pre && !present(manifest.pre, kind, name)) continue
      names.push({ kind, name })
    }
  }
  if (manifest.pre && names.length === 0) {
    return { id: change.id, status: 'NOT OBSERVED', detail: 'it was not loaded in the probe directory, so there is nothing to verify', names: [] }
  }
  const stuck = names.filter((n) => present(post.snapshot, n.kind, n.name))
  if (stuck.length) {
    return { id: change.id, status: 'STILL PRESENT', detail: `${stuck.length} of ${names.length} still loaded`, names: stuck.map((n) => `${n.kind}:${n.name} (${why(change, n.name, cwd)})`) }
  }
  return {
    id: change.id,
    status: 'GONE',
    detail: names.length ? `${names.length} entries absent from the fresh session` : 'no before-snapshot, and none of its entries is in the fresh session',
    names: names.map((n) => `${n.kind}:${n.name}`),
  }
}

const collateralOf = (manifest, post) => {
  const expected = Object.fromEntries(KINDS.map((k) => [k, new Set()]))
  for (const c of manifest.changes) {
    if (!c.done || c.undone) continue
    for (const k of KINDS) for (const n of (c.expect && c.expect[k]) || []) expected[k].add(n)
  }
  const lost = []
  const unstable = []
  for (const k of ['skills', 'agents']) {
    for (const n of manifest.pre[k]) if (!post.snapshot[k].includes(n) && !expected[k].has(n)) lost.push(`${k}:${n}`)
  }
  for (const n of manifest.pre.mcp) if (!post.snapshot.mcp.includes(n) && !expected.mcp.has(n)) unstable.push(`mcp:${n}`)
  for (const n of Object.keys(manifest.pre.hooks)) if (!Object.hasOwn(post.snapshot.hooks, n) && !expected.hooks.has(n)) lost.push(`hooks:${n}`)
  return { lost, unstable }
}

const savingsOf = (manifest, post) => {
  const out = { projectedTokens: manifest.projectedTokens || 0, measured: null }
  if (!manifest.pre || !post.ok) return out
  const parts = {}
  let total = 0
  for (const k of ['skills', 'agents', 'mcp', 'hooks']) {
    parts[k] = { before: manifest.pre.chars[k], after: post.snapshot.chars[k], delta: manifest.pre.chars[k] - post.snapshot.chars[k] }
    total += parts[k].delta
  }
  out.measured = { chars: parts, totalChars: total, tokens: tokens(total) }
  return out
}

export const verify = async ({ manifestPath, cwd, probe = runProbe }) => {
  const manifest = readJson(manifestPath)
  if (!manifest) throw new Error(`cannot read manifest ${manifestPath}`)
  const done = manifest.changes.filter((c) => c.done && !c.undone)
  if (done.length === 0) throw new Error('the manifest has no applied changes to verify')
  const dir = cwd || manifest.cwd
  const post = await probe({ cwd: dir })
  const items = done.map((c) => judge(c, manifest, post, dir))
  const checks = staticChecks(manifest)
  const guards = guardsIntact(manifest)
  const collateralObserved = Boolean(manifest.pre) && post.ok
  const collateral = collateralObserved ? collateralOf(manifest, post) : { lost: [], unstable: [] }
  const failed =
    items.some((i) => i.status === 'STILL PRESENT') || collateral.lost.length > 0 || checks.some((c) => !c.ok) || guards.some((g) => !g.ok)
  let verdict = 'pass'
  if (failed) verdict = 'fail'
  else if (!post.ok) verdict = 'not-observed'
  else if (!collateralObserved || collateral.unstable.length > 0 || items.some((i) => i.status === 'NOT OBSERVED')) verdict = 'incomplete'
  const result = {
    manifest: manifestPath,
    verdict,
    probe: post.ok ? 'ok' : post.reason,
    items,
    collateral: { observed: collateralObserved, lost: collateral.lost, unstable: collateral.unstable },
    checks,
    guards,
    savings: savingsOf(manifest, post),
  }
  manifest.verifiedAt = new Date().toISOString()
  manifest.verdict = verdict
  writeJsonFile(manifestPath, manifest)
  return result
}

#!/usr/bin/env node
const USAGE =
  'usage: diet.mjs scan [--min-sessions N] [--rarely-pct N] [--json] | apply --pick <id,id,...> [--cwd <dir>] [--allow-unverified] [--json] | verify <manifest> [--cwd <dir>] [--json] | restore <manifest> [--json] | purge <manifest> --yes [--json]'
const VALUE_FLAGS = new Set(['pick', 'cwd', 'min-sessions', 'rarely-pct'])
const BOOLEAN_FLAGS = new Set(['json', 'yes', 'allow-unverified'])

const parse = (argv) => {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      args._.push(a)
      continue
    }
    const key = a.slice(2)
    if (BOOLEAN_FLAGS.has(key)) args[key] = true
    else if (VALUE_FLAGS.has(key)) {
      args[key] = argv[++i]
      if (args[key] === undefined) throw new Error(`--${key} needs a value`)
    } else throw new Error(`unknown flag --${key}`)
  }
  return args
}

const VERDICT_CODES = { pass: 0, fail: 3, 'not-observed': 4, incomplete: 5 }
const verdictCode = (verdict) => (Object.hasOwn(VERDICT_CODES, verdict) ? VERDICT_CODES[verdict] : 3)

const finish = (args, data, text, code = 0) => {
  process.stdout.write((args.json ? JSON.stringify(data, null, 2) : text) + '\n')
  process.exit(code)
}

const fail = (message) => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const main = async () => {
  let args
  try {
    args = parse(process.argv.slice(2))
  } catch (e) {
    fail(`${e.message}\n${USAGE}`)
  }
  const [command, target] = args._
  const cwd = args.cwd || process.cwd()

  if (command === 'scan') {
    const { scan } = await import('./lib/scan.mjs')
    const { formatReport } = await import('./lib/render.mjs')
    const options = {}
    if (args['min-sessions'] !== undefined) {
      const n = Number(args['min-sessions'])
      if (!/^\d+$/.test(args['min-sessions']) || n < 1) fail('--min-sessions must be a whole number of at least 1')
      options.minSessions = n
    }
    if (args['rarely-pct'] !== undefined) {
      const n = Number(args['rarely-pct'])
      if (args['rarely-pct'].trim() === '' || !Number.isFinite(n) || n < 0 || n > 100) fail('--rarely-pct must be a number from 0 to 100')
      options.rarelyPct = n
    }
    const report = await scan(options)
    const unreadable = report.coverage.sessions === 0 || report.format.status === 'unrecognized'
    return finish(args, report, formatReport(report), unreadable ? 2 : 0)
  }

  if (command === 'apply') {
    if (!args.pick) fail(`apply needs --pick\n${USAGE}`)
    const { apply } = await import('./lib/apply.mjs')
    const { formatApply } = await import('./lib/render.mjs')
    const { verify } = await import('./lib/verify.mjs')
    const result = await apply({ picks: [...new Set(args.pick.split(',').filter(Boolean))], cwd, allowUnverified: Boolean(args['allow-unverified']) })
    if (result.changes.some((c) => c.done)) {
      try {
        result.verification = await verify({ manifestPath: result.manifest, cwd })
      } catch (e) {
        result.verificationError = e.message
      }
    }
    const verdict = result.verification && result.verification.verdict
    const code = result.changes.length === 0 ? 1 : result.error || result.verificationError ? 3 : verdictCode(verdict)
    return finish(args, result, formatApply(result), code)
  }

  if (command === 'verify') {
    if (!target) fail(`verify needs a manifest path\n${USAGE}`)
    const { verify } = await import('./lib/verify.mjs')
    const { formatVerify } = await import('./lib/render.mjs')
    const result = await verify({ manifestPath: target, cwd: args.cwd })
    return finish(args, result, formatVerify(result), verdictCode(result.verdict))
  }

  if (command === 'restore') {
    if (!target) fail(`restore needs a manifest path\n${USAGE}`)
    const { restore } = await import('./lib/restore.mjs')
    const { formatRestore } = await import('./lib/render.mjs')
    const result = restore({ manifestPath: target })
    return finish(args, result, formatRestore(result), result.failed.length ? 3 : 0)
  }

  if (command === 'purge') {
    if (!target) fail(`purge needs a manifest path\n${USAGE}`)
    const { purge } = await import('./lib/restore.mjs')
    const { formatPurge } = await import('./lib/render.mjs')
    const result = purge({ manifestPath: target, yes: Boolean(args.yes) })
    return finish(args, result, formatPurge(result), result.refused ? 1 : 0)
  }

  fail(USAGE)
}

main().catch((e) => {
  const message = e && e.message ? e.message : String(e)
  fail(process.env.CONTEXT_DIET_DEBUG === '1' && e && e.stack ? e.stack : message.split('\n')[0])
})

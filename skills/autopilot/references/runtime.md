# Autopilot — runtime notes

Reference material for [SKILL.md](../SKILL.md): how sub-agent models are chosen and how to launch a run so the harness does not add prompts back.

## Sub-agent model routing

Resolve models from `routing.agent_tool` in `~/.claude/model-inventory.json`, under the same trust gate as `goal-runner`: the file counts only if it parses, `probed` is `true`, and `generated_at` is under 7 days old.

- **Gate fails** (missing, stale, unprobed) and `model-inventory` is present → run it **once at kickoff** (free scan plus its own probe discipline, a handful of one-line probes costing cents), then route from the fresh file and log the discovery run — what was probed, what it found — in the report.
- **Skill absent, or discovery fails** → spawn with no model override and log one line. A discovery failure is a report note, never a hard stop.
- **Never probe mid-run.** Mid-run model failures use the chain fallback below. The inventory file is written only by the `model-inventory` workflow.

Role → chain:

| Work | Chain | Notes |
|---|---|---|
| Phase 1 inspection explorers | `scout` | parallel `Explore` agents, one per layer |
| Phase 4 review sub-agents (e.g. `code-review` lenses) | `reviewer` | |
| Delegated coding | `coder` | `coder_high_risk` when the task touches auth, money, migrations, or 3+ layers |

Take each chain's first entry not marked `unavailable` / `blocked-by-auth` / `quota-exhausted`. Pass bare aliases only (`haiku` / `sonnet` / `opus` / `fable`) and skip anything else. A spawn rejected over its model falls to the next entry, then to no override — logged in the report, never a hard stop.

- ❌ Re-probing models mid-run because one spawn was rejected.
- ✅ "Spawn on `opus` rejected (entitlement) → fell to `sonnet` per the `reviewer` chain; logged."

## Launching autonomously (harness side)

The skill removes *its* gates; the harness must not add prompts back.

- **Interactive session, hands-off:** run with auto-accepting permissions (`--permission-mode acceptEdits`) or the project's pre-approved allowlist.
- **Headless:** `claude -p "autopilot task 12345" --permission-mode acceptEdits`. Elevate to `bypassPermissions` / `--dangerously-skip-permissions` only in a sandboxed or disposable environment — it removes the last safety net.
- **The never-commit rule lives in the skill, not in permissions.** Even a fully permissive run publishes nothing; that guardrail is contract item 3, and no flag turns it off.

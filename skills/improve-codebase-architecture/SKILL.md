---
name: improve-codebase-architecture
description: Surface architectural friction in a codebase and propose **deepening opportunities** — refactors that turn shallow modules into deep ones, informed by the project's `CONTEXT.md` glossary and `docs/adr/` decisions. Walks the codebase with an Explore sub-agent, applies the **deletion test** to suspected pass-through modules, presents a numbered list of candidates with files / problem / solution / benefits, and drops into a grilling loop once the user picks one — naming new concepts into `CONTEXT.md` inline and offering an ADR only when a rejection is load-bearing. Writes no production code. Use this skill whenever the user says "improve architecture", "improve the architecture", "architecture review", "find refactoring opportunities", "find deepening opportunities", "find shallow modules", "make this more testable", "this code is hard to navigate", or invokes `/improve-codebase-architecture` — even if they don't name the skill.
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability. This skill is _informed_ by the project's domain model: the domain language in `CONTEXT.md` gives names to good seams; the ADRs in `docs/adr/` record decisions the skill should not re-litigate.

## When to use this skill

Trigger on any of:

- "improve architecture" / "improve the architecture" / "architecture review"
- "find refactoring opportunities" / "find deepening opportunities" / "find shallow modules"
- "make this more testable" / "this code is hard to navigate" / "AI-navigable"
- `/improve-codebase-architecture`
- The user has an area of the codebase they want pressure-tested for refactor opportunities, ideally with the domain already documented (`CONTEXT.md`) and key decisions captured (`docs/adr/`), and wants a deliberate architecture-review pass rather than an ad-hoc code review.

Do **not** auto-trigger for:

- A request to *implement* a specific refactor — use [`task-executor`](../task-executor/SKILL.md).
- A bug or regression — use [`diagnose`](../diagnose/SKILL.md).
- A line-by-line review of a specific diff — use [`pr-review`](../pr-review/SKILL.md).

## Glossary

Use these terms exactly in every suggestion. Consistent language is the point — don't drift into "component," "service," "API," or "boundary." Full definitions in [LANGUAGE.md](LANGUAGE.md).

- **Module** — anything with an interface and an implementation (function, class, package, slice).
- **Interface** — everything a caller must know to use the module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — the code inside.
- **Depth** — leverage at the interface: a lot of behaviour behind a small interface. **Deep** = high leverage. **Shallow** = interface nearly as complex as the implementation.
- **Seam** — where an interface lives; a place behaviour can be altered without editing in place. (Use this, not "boundary.")
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get from depth: change, bugs, knowledge concentrated in one place.

Key principles (see [LANGUAGE.md](LANGUAGE.md) for the full list):

- **Deletion test** — imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.**
- **One adapter = hypothetical seam. Two adapters = real seam.**

## Process

### 1. Explore

Read the project's domain glossary (`CONTEXT.md`) and any ADRs in the area you're touching first.

Then use the Agent tool with `subagent_type=Explore` to walk the codebase. Don't follow rigid heuristics — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation?
- Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams?
- Which parts of the codebase are untested, or hard to test through their current interface?

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

**Evidence gates — both must hold before anything becomes a candidate:**

- **Friction must be observed, not theoretical.** Cite the pain: the awkward call sites (`file:line`), the shotgun-surgery pattern ("these 4 files change together — check `git log --oneline -- <dir>`"), the test that needs 40 lines of setup to exercise one branch. "This could be cleaner" with no cited pain is not a candidate.
- **Read before ruling.** A claim about a module you haven't opened this session is a hypothesis. Before ruling on the deletion test, read the module **and at least 2 of its call sites**. The operational form of the test: if every caller could call the layer below directly with no loss of clarity, the module fails — it's a pass-through. If deleting it would smear real logic (validation, ordering, error translation) across its callers, it passes.

### 2. Present candidates

Present a numbered list of deepening opportunities. For each candidate:

- **Files** — which files/modules are involved
- **Problem** — why the current architecture is causing friction
- **Evidence** — the observed friction, cited: the call sites you read (`file:line`), the co-changing files, the awkward tests. No citation, no candidate.
- **Solution** — plain English description of what would change
- **Benefits** — explained in terms of locality and leverage, and also in how tests would improve

**Zero candidates is a valid outcome.** A healthy codebase produces a short or empty list. Report "no deepening opportunities found — here's what I checked" rather than padding the list with theoretical refactors to appear thorough.

**Use `CONTEXT.md` vocabulary for the domain, and [LANGUAGE.md](LANGUAGE.md) vocabulary for the architecture.** If `CONTEXT.md` defines "Order," talk about "the Order intake module" — not "the FooBarHandler," and not "the Order service."

**ADR conflicts**: if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly (e.g. _"contradicts ADR-0007 — but worth reopening because…"_). Don't list every theoretical refactor an ADR forbids.

Do NOT propose interfaces yet. Ask the user: "Which of these would you like to explore?"

### 3. Grilling loop

Once the user picks a candidate, drop into a grilling conversation. Walk the design tree with them — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects happen inline as decisions crystallize:

- **Naming a deepened module after a concept not in `CONTEXT.md`?** Add the term to `CONTEXT.md` as a pure glossary entry. Create the file lazily if it doesn't exist.
- **Sharpening a fuzzy term during the conversation?** Update `CONTEXT.md` right there. Don't batch.
- **User rejects the candidate with a load-bearing reason?** Offer an ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer to avoid re-suggesting the same thing — skip ephemeral reasons ("not worth it right now") and self-evident ones.
- **Want to explore alternative interfaces for the deepened module?** See [INTERFACE-DESIGN.md](INTERFACE-DESIGN.md).
- **Need to choose how to test across a dependency?** See [DEEPENING.md](DEEPENING.md) for the four dependency categories and the test strategy each demands.

## Examples

### Example 1: A shallow validator cluster

**User:** `/improve-codebase-architecture` — focused on `src/orders/validation/`

**Claude:**
1. **Explore.** Reads `CONTEXT.md` (sees `Order`, `OrderLine`, `Cart`) and `docs/adr/0004-validation-pipeline.md`. Spawns Explore on `src/orders/validation/` and finds 11 single-function modules (`validateSku.ts`, `validateQty.ts`, …) each called from one place in `OrderIntake`.
2. **Candidates.** Presents one numbered candidate: "Collapse the `validate*` cluster into a deep `OrderIntakeValidator` module — current shallow validators have interface nearly as complex as implementation; the real bugs hide in how `OrderIntake` *composes* them, where no test exercises the seam." Files / Problem / Evidence (the `OrderIntake` call site read, plus the two `validate*` modules opened for the deletion test) / Solution / Benefits. Notes: does not contradict ADR-0004 (which is about *when* to validate, not *how* to compose validators).
3. **Grilling.** User picks the candidate. Walks the design tree: dependency category (in-process, [DEEPENING.md](DEEPENING.md) §1), seam placement (one external seam at `OrderIntakeValidator`, internal validators stay private), test surface (assert at `validate(order) → Result<Order, ValidationError[]>`, delete the 11 per-function tests). Adds `OrderIntakeValidator` to `CONTEXT.md`.

### Example 2: A candidate that contradicts an ADR — but worth reopening

**User:** `/improve-codebase-architecture`

**Claude:** Surfaces a candidate to merge `WebhookDispatcher` and `WebhookRetryQueue`. Notes _"contradicts ADR-0012 — but worth reopening because the original split was justified by sync delivery, and the codebase has since moved to async."_ User confirms ADR-0012 is stale. Hands off the actual merge to [`task-executor`](../task-executor/SKILL.md); updates `CONTEXT.md` with the unified `WebhookDelivery` term and notes that ADR-0012 needs a superseding ADR.

## Anti-patterns

- ❌ Proposing a refactor without applying the **deletion test** — leads to suggestions that just move complexity instead of concentrating it.
- ❌ Ruling on the deletion test from a module's name or the file listing. Read the module and ≥2 call sites first; until then it's a hypothesis, not a candidate.
- ❌ Manufacturing candidates from theoretical concerns: ❌ _"`OrderMapper` could be more flexible"_ (no cited pain) vs. ✅ _"`OrderMapper`'s 3 call sites each re-wrap its output (`intake.ts:41`, `sync.ts:88`, `api.ts:120`) — the seam is in the wrong place."_ The first pads the list; the second names the friction.
- ❌ Naming things "FooHandler" / "BarService" / "BazManager" when `CONTEXT.md` already names the concept. Use the domain term.
- ❌ Introducing a port + adapter for a dependency with only one implementation. **One adapter = hypothetical seam.**
- ❌ Re-litigating an ADR without explicit cause. ADRs are decisions the skill should _not_ reopen unless the constraint that drove them is gone.
- ❌ Proposing interfaces in Step 2. Step 2 is candidates only — interface design happens after the user picks one, and benefits from the parallel sub-agent process in [INTERFACE-DESIGN.md](INTERFACE-DESIGN.md).
- ❌ Letting old shallow-module tests survive alongside new deep-module tests. The interface is the test surface — replace, don't layer (see [DEEPENING.md](DEEPENING.md)).
- ✅ Architecture-language vocabulary used consistently, candidates measured by the deletion test, interfaces designed twice, tests at the new seam only.

## Notes

- **Composes with** [`task-executor`](../task-executor/SKILL.md): hand off the chosen candidate (with its decided interface) to `task-executor` for the implementation. This skill writes no production code.
- **Composes with** [`pr-review`](../pr-review/SKILL.md): use `pr-review` for line-by-line review of a specific diff; this skill is for surfacing architecture-level refactors *before* any diff exists.
- Adapted from Matt Pocock's [`improve-codebase-architecture`](https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture) — same architecture vocabulary, deletion test, deepening process, and parallel interface design. Adapted to compose with the other skills in this library.

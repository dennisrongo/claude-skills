---
name: grill-with-docs
description: Interview-driven design review. Stress-tests a plan, idea, RFC, or feature description against the project's existing domain model, terminology, and documented decisions — and crystallises the resolution into `CONTEXT.md` (glossary) and `docs/adr/` (ADRs) inline as terms settle. No production code is written. Use this skill whenever the user says "grill me", "grill this", "stress-test this plan", "challenge this design", "validate against the domain", "sharpen the terminology", "review the docs", "/grill-with-docs", or pastes a design / RFC / feature idea and wants it pressure-tested before any implementation — even if they don't name the skill.
---

# Grill with Docs

A pre-implementation design review. Sit across the table from the user, ask one sharp question at a time, cross-reference the answers against the codebase and the project's documented decisions, and update the canonical docs in-flight as terms harden. The output is a sharper plan and tightened documentation — not code.

## When to use this skill

Trigger on any of:

- "grill me" / "grill this plan" / "stress-test this"
- "challenge this design" / "validate against the domain"
- "sharpen the terminology" / "review the language"
- "/grill-with-docs"
- The user pastes a design doc, RFC, ticket, or feature spec and asks for review **before** building
- The user is exploring whether an approach fits the existing model and isn't ready to commit to implementation

Do **not** use this skill for:

- A request to actually build the feature — use [`plan-and-build`](../plan-and-build/SKILL.md) (its Phase 1 grills, then it implements).
- A bug or regression — use [`diagnose`](../diagnose/SKILL.md).
- A one-line clarification question. Just answer it.

If the user wants to build *after* grilling, hand off to `plan-and-build` and let it open Plan Mode with the sharpened spec.

## Core principles

- **One question at a time.** Always use `AskUserQuestion` with 2–4 concrete options and a recommended pick first (matches the convention used by [`plan-and-build`](../plan-and-build/SKILL.md)). Never stack three questions in one message — the user can only think clearly about one branch of the design tree at a time.
- **Every question must fork the design.** A question earns its slot only if different answers lead to different designs or documents. If every answer leads to the same next step, don't ask it — you're performing rigor, not applying it.
- **Explore before asking.** If the answer is in the code, read it. Don't ask the user what `OrderService.Cancel` does when you can open the file. Ask only the questions the code can't answer. A claim about code you haven't opened this session is a **hypothesis** — label it one ("I suspect `Cancel` soft-deletes; confirming…") and read the file before building a question or an objection on it.
- **Terminology rigor.** Surface conflicts between the user's words and the glossary on the spot. Challenge vague or overloaded terms with the canonical alternative. If the user says "account", check whether the glossary distinguishes `Customer` from `User` — and force a choice.
- **Probe with concrete scenarios.** Invent edge cases that make abstract language fail. "What happens when two users press *Cancel* on the same order within 50ms?"
- **Contradiction surfacing.** When stated intent contradicts what the code already does, name the discrepancy explicitly and ask which wins. Don't paper over it. An objection must cite the specific thing it conflicts with — the `CONTEXT.md` term, the ADR number, or the `file:line` you read this session. If you can't name the conflict, you don't have an objection. Zero real conflicts is a valid, reportable outcome — don't invent friction to look rigorous.
- **Fold on preference, not on facts.** If the user's answer contradicts a documented decision or code you've cited, present the conflict once more with the citation. If they still overrule you, defer and record their call. Capitulating the moment the user pushes back — while the cited evidence still stands — is as bad as stonewalling.
- **In-the-moment doc updates.** The moment a fuzzy term resolves, write the glossary entry into `CONTEXT.md`. Don't batch — batched updates get dropped.
- **No code.** This skill writes only to `CONTEXT.md`, `CONTEXT-MAP.md`, and `docs/adr/*.md`. Never edit source files, never run migrations, never run tests. If the conversation reveals a code-level bug, note it and stop — that's a separate task.

## Phase 1 — Locate the canonical docs

Before the first question, find the project's documentation seams. Use `Glob` / `Grep` / `Read` in parallel:

- `CONTEXT.md` at the repo root — the glossary of canonical domain terms.
- `CONTEXT-MAP.md` at the root — for multi-bounded-context repos: how contexts relate, which terms are translated at boundaries.
- `src/<context>/CONTEXT.md` — per-context glossaries when the repo is multi-context.
- `docs/adr/` (or `docs/decisions/`, `docs/architecture/decisions/`) — Architecture Decision Records.
- `README.md`, `ARCHITECTURE.md`, `CLAUDE.md` — secondary sources for project-specific language.

Record what exists. **Do not create any of these files yet.** Only create them when a Phase 2 conversation produces a definite entry to put in them.

If **none** of these exist, that's fine — flag it once to the user, propose the lightest-weight convention (`CONTEXT.md` at root), and proceed. Don't lecture.

## Phase 2 — Grill

Walk down the design tree one decision at a time, resolving dependencies before moving on. The areas below are a checklist — skip the ones the user's input has already nailed, and dig into the ones it hasn't.

- **Intent.** What problem does this solve, for whom, and what observable outcome proves it worked?
- **Terminology.** Every noun and every verb the user used. Does it match the glossary? If not — does the glossary need to change, or does the user's language?
- **Boundaries.** Which bounded context owns this? Does it cross a context boundary, and if so, what's the translation?
- **Domain shape.** Which entities, value objects, aggregates are involved. Existing or new. If new, why isn't it an extension of an existing one?
- **Behaviour vs. data.** Is the user describing a state change, a query, an event, or a process? "Cancel" is a verb that hides three different operations.
- **Authorization.** Who's allowed to do this, and under what conditions? Tenant scoping?
- **Side effects.** Emails, queue messages, audit log entries, cache invalidation, webhooks. Each is a design decision.
- **Concurrency.** What happens under simultaneous calls, retries, partial failure?
- **Edge cases.** Empty inputs, max sizes, unicode, timezones, deleted-but-referenced rows.
- **Observability.** What gets logged / traced / metricked, and what's the alert threshold?
- **Trade-offs.** For any choice with more than one defensible answer, name the alternative and the reason for the pick. This is what makes the conversation ADR-worthy.

### How to phrase the questions

Use `AskUserQuestion`. Lead with the recommendation, append "(Recommended)" to its label, and keep options mutually exclusive. Examples:

- "Is `priority` a boolean flag or an ordered priority (1–N)?" — options: *Boolean* (Recommended), *Ordered 1–N*, *Bucketed (low/med/high)*.
- "What does *cancel* mean for an order?" — options: *Status transition to `Cancelled`, row retained* (Recommended), *Soft-delete with `DeletedAt`*, *Hard-delete row*.
- "Which role can call this?" — options: *`Owner` only* (Recommended), *`Owner` or `Admin`*, *Anyone authenticated*.

If the user goes off-piste or picks "Other", absorb their answer, restate it in canonical terms, and continue.

A forking question vs. a checklist question:

- ❌ "Should we handle errors if the payment API fails?" — every answer is "yes"; the design doesn't move. Don't ask it.
- ✅ "When the payment API fails mid-checkout, does the order persist as `PaymentPending` (new status + retry worker) or roll back entirely (no schema change)?" — answer A adds a status and a background job, answer B adds nothing. The answers diverge, so the question earns its slot.

## Phase 3 — Update docs in-flight

As decisions crystallise, write them immediately. Two artefacts only.

### `CONTEXT.md` — pure glossary

`CONTEXT.md` is a **glossary**, not a spec. Each entry is a canonical term plus a one- or two-sentence definition. No implementation details, no API shapes, no diagrams.

```markdown
## Order

A customer's request for one or more SKUs at an agreed price. Distinct from a **Cart** (pre-confirmation) and a **Shipment** (post-fulfilment). An `Order` is identified by `OrderId` and is owned by exactly one `Customer`.

## Cancel (an Order)

A status transition from `Pending` → `Cancelled`. The row is retained for audit. Does not delete child `OrderLine` rows. Triggers an `OrderCancelled` domain event.
```

Rules for `CONTEXT.md`:

- Alphabetical or grouped by aggregate — pick one and stick with it.
- One sentence is plenty. Two if a contrast with another term is load-bearing.
- Cross-link related terms in **bold** when first introduced in another entry.
- Never restate code — if the reader needs the field list, they read the type.
- Add to it in the same response that resolves a fuzzy term. Don't queue updates.

### ADRs — only when all three conditions hold

Create an ADR only when **all** of:

1. **Hard to reverse.** Changing the decision later would require coordinated migration, data backfill, or breaking API consumers.
2. **Non-obvious.** A future reader, given only the code, would not see why this choice was made.
3. **Real trade-offs.** There was at least one defensible alternative that was rejected for a stated reason.

If any one of those is missing, don't write an ADR. A glossary entry or a code comment is enough.

Calibration:

- ❌ "Add an index on `Orders(CustomerId)`" — reversed in one migration, obvious from the query plan, no seriously-considered alternative. No ADR; it's just code.
- ✅ "Webhook delivery becomes at-least-once via queue" — consumers must be idempotent forever (hard to reverse), sync was the obvious default (non-obvious), and outbox / sync-with-retries were genuinely weighed (real trade-offs). Write the ADR.

#### ADR template

Drop into `docs/adr/NNNN-short-title-kebab.md`, numbered sequentially after the highest existing ADR:

```markdown
# NNNN. <Short imperative title>

- **Status:** Proposed | Accepted | Superseded by [ADR-XXXX](XXXX-other.md)
- **Date:** YYYY-MM-DD
- **Deciders:** <names / roles>

## Context

What forces are in play? What constraint, incident, or new requirement triggered this decision? Two to five sentences.

## Decision

The choice, stated in the active voice. "We will <do X>." One paragraph.

## Consequences

What becomes easier, what becomes harder, what we now have to maintain. Bullet points.

## Alternatives considered

- **<Option A>** — why rejected (one sentence).
- **<Option B>** — why rejected (one sentence).
```

Keep ADRs immutable once accepted. If the decision changes, write a new ADR that supersedes the old one and mark the old one `Superseded by`.

## Phase 4 — Exit criteria

Stop grilling when **any** of these are true. Don't pad the conversation.

- Further questions stop changing the design — the next question's answer wouldn't move a file or change a name. Operational check: **if the last two answers changed nothing** — no glossary entry, no renamed term, no design fork — the interview is done; summarise and move to crystallisation. Don't stop after two questions because the surface looks calm, and don't grill past the point where answers stop moving files.
- All terms in the user's spec have a matching `CONTEXT.md` entry (existing or just-added) and no contradictions remain.
- The user explicitly signals "good enough" — accept it, but quickly note any genuinely open questions you can see.
- The conversation has revealed that the right next step is **not** to grill further but to prototype, diagnose, or pick a different scope. Say so and stop.

When you stop, produce a short closing summary:

- **Decisions captured:** glossary entries added/updated (paths), ADRs created (paths and titles).
- **Resolved terminology:** a 1–2 line list of the terms that changed meaning during the session.
- **Open questions:** anything the user deferred — name them so they're not lost.
- **Suggested next step:** usually a handoff to [`plan-and-build`](../plan-and-build/SKILL.md), occasionally [`diagnose`](../diagnose/SKILL.md), occasionally "ship a spike first".

## Anti-patterns

- Asking three questions in one message. One at a time, with options.
- Asking the user something the codebase already answers. Read first, ask second.
- Asking questions whose every answer leads to the same next step. If the answer can't fork the design, cut the question.
- Raising an objection that cites nothing. Name the `CONTEXT.md` term, ADR, or `file:line` it conflicts with — or drop it. "No conflicts found" is a valid result.
- Folding on first pushback while the cited evidence still stands. Restate the conflict once with the citation, then defer.
- Asserting what code does without having read it this session. Unread-code claims are hypotheses — say so.
- Letting a vague term ("account", "user", "delete", "cancel", "process") slide because the user used it confidently.
- Adding code, tests, or migrations during this skill. Out of scope.
- Writing an ADR for a decision that's easily reversed, obvious from the code, or had no real alternative.
- Padding `CONTEXT.md` with field-by-field type breakdowns. It's a glossary, not a schema dump.
- Continuing to grill after the user has clearly signalled they have enough to proceed.
- Batching glossary updates "until the end". They get forgotten.

## Examples

### Example 1: Stress-testing a "priority orders" idea

**User:** "We want customers to mark orders as priority. Grill me before I build it."

**Claude:**
1. **Phase 1.** Reads `CONTEXT.md` (finds `Order`, `Customer`, no `Priority` term) and the most recent ADR (`docs/adr/0007-soft-delete-orders.md`).
2. **Phase 2.** Asks via `AskUserQuestion`: *"Is `priority` a boolean flag or an ordered priority (1–N)?"* — recommends *Boolean*. User picks Boolean. Next: *"What does 'priority' actually change — sort order in API responses, or routing in the background processor?"* User: *both*. Next: *"Can a non-Owner role set priority?"* — checks `[Authorize]` usage on `OrdersController`, sees `Owner`-only convention, recommends *Owner only*. User agrees. Next: *"Is setting priority idempotent — does setting it twice produce one audit row or two?"* — recommends *idempotent, one audit row*. User picks that. Surfaces contradiction: *"You said 'bump in the queue' but `BackgroundOrderProcessor` is FIFO with no priority hook — adding one is a separate change. In scope or out?"* User: out of scope for v1.
3. **Phase 3.** Adds `Priority` and `SetPriority` entries to `CONTEXT.md`. Decides *not* to write an ADR — the choice is easily reversed (drop the column) and the alternative (numeric priority) was a one-sentence rejection.
4. **Phase 4.** Closes with: glossary updated, no ADR needed, one open question (queue routing deferred), suggests handing off to `plan-and-build` for implementation.

### Example 2: A decision that *does* warrant an ADR

**User:** "We're thinking of moving from synchronous webhook delivery to a queue. Grill me."

**Claude:** Grills around: delivery guarantees, ordering, retry policy, poison-message handling, observability, cost. Discovers user wants at-least-once with idempotency keys. Surfaces that the existing `WebhookDispatcher` is synchronous and that consumers currently assume in-order delivery. Updates `CONTEXT.md` with `WebhookDelivery` and `IdempotencyKey` entries. Writes `docs/adr/0012-async-webhook-delivery-via-queue.md` — hard to reverse (consumers must handle out-of-order), non-obvious (sync was the obvious default), and there were genuine alternatives (sync with retries, outbox pattern, hosted webhook service). Hands off to `plan-and-build`.

### Example 3: User pushes back on the grilling

**User:** "I just want to add a `DeletedAt` column. You don't need to grill me."

**Claude:** Compresses to the questions whose answers actually change the design: *"Soft-delete or hard-delete?"*, *"Should existing queries opt in to seeing deleted rows or opt out?"*, *"Cascade to child entities?"* Adds the resolved `Delete (a User)` entry to `CONTEXT.md`. Skips the ADR (easily reversed). Closes in three turns and points to `plan-and-build`.

## Notes

- **Composes with** [`plan-and-build`](../plan-and-build/SKILL.md): grill first, then hand off the sharpened spec. `plan-and-build`'s Phase 1 self-contains a grill for small features; this skill is for the larger / fuzzier ones that deserve a standalone pass.
- **Composes with** [`diagnose`](../diagnose/SKILL.md) only loosely — if grilling reveals the real problem is "something is broken" rather than "we want to design something new", stop and switch skills.
- If `CONTEXT.md` doesn't exist yet and the user agrees to start one, seed it with the terms surfaced in the first session — don't dump every domain noun in the codebase. Glossaries earn their entries.
- ADRs are immutable once accepted. If the decision later changes, write a new ADR that supersedes it. Don't edit history.
- Adapted from Matt Pocock's [`grill-with-docs`](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md) — interview rigor, terminology focus, in-flight doc updates, selective ADRs — and extended with explicit triggers, `AskUserQuestion` conventions, exit criteria, an ADR template, and composition with this library's other skills.

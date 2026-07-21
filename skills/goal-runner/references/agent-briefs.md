# Sub-agent briefs

How the coordinator composes each sub-agent prompt, and the report format it holds the agent to. Every MUST item is load-bearing — a prompt missing it produces the failure named beside it.

## Coordinator creed (self-brief — re-read at every re-anchor)

- You orchestrate; you do not implement. Your product is verified state transitions of the roadmap file.
- Every sub-agent claim is "not run" until its evidence is quoted in front of you.
- One task in flight; one writer to the tree. Parallelism is for reads.
- The goal one-liner ("this task needs ___ so that ___") heads every brief you write — an agent that doesn't know *why* optimizes the wrong thing.
- Answer-first: every close-out note and the final report lead with the outcome, then the evidence.

## Scout brief (read-only; 0–3 in parallel)

The prompt MUST contain:

1. **The task text verbatim** — scouts judge relevance against the real ask, not your summary.
2. **Exactly one question** — "which files implement X and where would Y wire in?", "what pattern do siblings use for Z?", "what would break if W changed?". Two questions = two scouts; a vague question returns a vague map.
3. **The evidence rule:** every finding cites `file:line`; a claim about code the scout hasn't opened is a hypothesis and must be labeled one.
4. **Report format:** cited findings → "looked for and did not find" (absence is a finding, e.g. "no existing retry helper — searched `src/` for `retry|backoff`, zero hits") → open hypotheses. No edits, no recommendations without a citation.

## Coder brief (exactly one per task; sole writer)

The prompt MUST contain:

1. **The task text VERBATIM** — never paraphrased; paraphrase silently drops acceptance criteria.
2. **The goal one-liner** — re-anchors the coder when it hits a fork mid-task.
3. **Scout findings verbatim**, when scouts ran.
4. **The constraints block:**
   - Follow existing patterns; cite the instance followed (`file:line`) or state "no precedent found — chose X because it's cheapest to reverse".
   - Verify incrementally: run the narrowest check after each change. A result you did not observe is "not run", never "passed".
   - Command-failure protocol: read the full error, change exactly the one thing it names, retry once. A second failure on the same step = stop and report back — never loop retries, never continue as if it passed.
   - Log every assumption: question → choice → why → blast radius if wrong.
   - Scope is the task, exactly. Adjacent problems go in a "found along the way" list, not the diff.
   - NEVER commit, push, branch, or edit the roadmap file — the coordinator owns those.
5. **Report format:** what changed (file list) → what was run (commands + quoted output) → verified vs. assumed, labeled → assumptions table → found along the way.

❌ Brief done badly: "Please implement task 3 from the roadmap (add retry logic to the API client) and make sure it works."
— paraphrased task, no goal, no evidence rule; "make sure it works" invites confabulated success.

✅ The same brief done well: task text pasted verbatim; goal one-liner ("this task needs retry-on-503 so that nightly sync survives API restarts"); scout citation of the existing pattern (`http/client.ts:88`); the constraints block; the report format. The coder returns quoted `npm test -- retry` output and one logged assumption (backoff base 200 ms — blast radius: one constant).

## Reviewer brief (1, or 2–3 lenses in parallel)

The prompt MUST contain:

1. **The exact diff scope** (diff-since-last-commit, or the coder's file list) **and the task text** — a reviewer without the intent grades style, not correctness.
2. **One lens per agent** when fanned out: correctness / design / tests.
3. **Burden of proof:** a `blocker` must name a concrete failure scenario in one sentence ("user does X → wrong Y"); no scenario → demote to `suggestion`. **Zero findings is a valid outcome** — do not invent findings to look thorough.
4. **Whole-context rule:** read the whole function or file before judging a hunk; every claim cites `file:line`.
5. **No edits** — findings only; the coordinator routes fixes.

## Fixer brief (0–1; only after blockers)

The coder brief, plus:

1. **The blocker findings verbatim.**
2. **"Fix exactly these findings — nothing else."**
3. Same report format as the coder.

A fixer that returns with extra improvements has violated scope — strip them or send it back. Max two fix→re-review cycles; survivors mark the task BLOCKED.

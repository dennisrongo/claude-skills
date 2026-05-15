---
name: pr-review
description: Conduct a thorough, structured code review of a pull request or diff. Use this skill whenever the user asks to review a PR, asks for feedback on a diff or branch, mentions "review my changes", or pastes code asking what could be improved. Covers correctness, design, tests, security, performance, and readability in that priority order.
---

# Pull Request Review

A structured approach to reviewing code changes that catches real issues without nitpicking style.

## Priority order

Review in this order — earlier categories matter more, and finding issues there often makes later ones moot:

1. **Correctness** — does it do what it claims?
2. **Design** — is the approach sound? Will it cause problems later?
3. **Tests** — are behaviors covered? Are tests meaningful or just for coverage?
4. **Security** — any new attack surface? Input validation? Secrets?
5. **Performance** — obvious inefficiencies? Will it scale?
6. **Readability** — naming, structure, comments where non-obvious.
7. **Style** — only mention if the project lacks a formatter/linter.

## Workflow

1. **Read the PR description first.** What is this change trying to accomplish? Without this, "is the code correct" is unanswerable.
2. **Get the diff.** Run `git diff main...HEAD` (or the appropriate base branch). For a remote PR, use `gh pr diff <num>`.
3. **Skim once, top to bottom.** Get a mental model of what changed before commenting on specifics.
4. **Read again with the priority list in mind.** Note issues as you go.
5. **Look at the tests.** Do they test the new behavior or just exercise the new lines?
6. **Check what's *not* in the diff.** Missing error handling, missing tests for edge cases, missing migration for a schema change.

## How to phrase feedback

Categorize each comment so the author knows what's required vs optional:

- **`blocking`** — must fix before merge (bug, security issue, broken contract)
- **`suggestion`** — would improve the code, author can take or leave
- **`question`** — author may know something you don't; ask before asserting
- **`nit`** — minor style/preference; should not block merge
- **`praise`** — something done well, worth calling out

Lead with the *why*, not just the *what*. "This will deadlock if two callers hit it simultaneously" is more useful than "use a lock here".

## What to look for

### Correctness
- Off-by-one errors in loops and slicing
- Null/undefined handling at boundaries
- Concurrent access without synchronization
- Error paths that swallow exceptions silently
- Default values that change behavior unexpectedly

### Design
- New abstractions that don't pay for themselves
- Tight coupling that will be painful to undo
- Duplication that should be unified (or unification that should be duplication)
- Public API changes that aren't backwards-compatible
- State that should live elsewhere

### Tests
- Tests that pass even when the code is broken (assertion-free, mocked too aggressively)
- Missing edge cases: empty inputs, max sizes, unicode, timezones
- Tests that are flaky by design (timing, ordering, network)

### Security
- User input flowing into shell, SQL, or HTML without escaping
- Secrets in code, logs, or error messages
- Authn/authz checks missing on new endpoints
- Crypto: hand-rolled, weak algorithms, hardcoded keys/IVs

### Performance
- N+1 queries in loops
- Unbounded memory growth (caches without eviction, accumulating arrays)
- Synchronous I/O in hot paths
- Repeated work that could be hoisted out of a loop

## Output format

Group comments by file, then by line. End with a short summary verdict:

```
Overall: Approve with suggestions / Request changes / Comment

Strengths:
- ...

Blockers:
- ...

Suggestions:
- ...
```

## Anti-patterns

- ❌ Reviewing without understanding the goal of the change
- ❌ Reflexively requesting tests without saying what they should cover
- ❌ Drive-by style nits that derail the substantive discussion
- ❌ "I would have done it differently" without a concrete reason

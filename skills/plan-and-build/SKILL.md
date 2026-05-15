---
name: plan-and-build
description: Plan-first feature builder. Grills the user about the feature until the design is unambiguous, presents a plan, gates on `ExitPlanMode` approval, then builds the feature using the project's existing patterns — TDD-first with NUnit when the work touches a .NET API (appending to the matching test class if one already exists), and writing migration files but never executing SQL or `dotnet ef database update`. Use this skill whenever the user says "build a feature", "add a feature", "implement this feature", "/plan-and-build", "plan and build", "new feature", or pastes a feature spec and asks you to design + implement it — even if they don't name the skill.
---

# Plan and Build

Build a feature the way a careful senior engineer would: understand it first, design it against the existing codebase, get explicit sign-off on the plan, then implement it by reusing what's already there. Never start writing code on a fuzzy spec.

## When to use this skill

Trigger on any of:

- "build a feature" / "add a feature" / "implement this feature"
- "new feature" / "add `<X>` end-to-end" when a spec is attached or pasted
- `/plan-and-build` or "plan and build"
- The user pastes a feature description, ticket, or screenshot and asks for implementation
- Any request that will plausibly touch an API endpoint **and** a data model — the kind of change that needs tests and a migration

Do **not** use this skill for: one-line fixes, renames, single-file refactors, doc edits, or anything the user has already pre-designed in detail and explicitly asked you to just type in. Use [`diagnose`](../diagnose/SKILL.md) for bugs.

## Phases

The skill has six phases. Do **not** skip Phase 1 or Phase 3 — they're the value of this skill. Other phases compress naturally when the feature is small.

### Phase 1 — Grill

Interview the user relentlessly about every aspect of the feature until you reach a shared, unambiguous understanding. Walk down each branch of the design tree, resolving dependencies between decisions one at a time.

If the feature is large, fuzzy, or still in discovery — defer to [`grill-with-docs`](../grill-with-docs/SKILL.md) first to sharpen the spec and update `CONTEXT.md` / ADRs, then come back here to build. For smaller, well-scoped features keep grilling inline below.

Rules:

- **One question at a time.** Wait for the answer before the next one. Use `AskUserQuestion` with 2–4 concrete options and a recommended pick first.
- **Explore the codebase instead of asking** when the answer is already there. If a similar feature, entity, controller, or migration exists, read it before asking the user how a related thing should work.
- **Sharpen fuzzy language.** When the user says "account", ask: "Customer or User? Those are different things here." When they say "cancel", ask whether that means soft-delete, hard-delete, or a status transition.
- **Probe with concrete scenarios.** Invent edge cases that force the user to be precise. "What happens if the user submits twice while the first request is still in flight?"
- **Cross-reference with code.** If the user's stated behaviour contradicts what the code already does, surface it. "Your existing `OrderService.Cancel` cancels the whole order — you just described partial cancellation. Which wins?"
- **Look for a `CONTEXT.md` glossary** at repo root (or `CONTEXT-MAP.md` for multi-context repos) and at the relevant `src/<context>/CONTEXT.md`. If terminology conflicts with the glossary, call it out immediately and reconcile.

Topics to cover before leaving Phase 1 — pick the ones the spec hasn't already answered:

- **Intent.** What problem does this solve, for whom, and how do we know it worked?
- **Inputs / outputs.** Exact request shape, response shape, error cases.
- **Domain.** Which entities, value objects, and aggregates are touched. New ones vs. extensions to existing ones.
- **Authorization.** Who can call this? What claims/roles? Multi-tenant scoping?
- **Persistence.** Does it need schema changes? New columns, new tables, new indexes? Backfill required?
- **Side effects.** Emails, queue messages, audit log entries, cache invalidation, webhook calls.
- **Concurrency.** Idempotency keys, locking, retry behaviour.
- **Edge cases.** Empty inputs, max sizes, unicode, timezones, partial failure.
- **Observability.** What gets logged / traced / metricked.

Stop asking the moment further questions stop changing the design. Don't pad.

### Phase 2 — Detect stack and conventions

Before designing, look at what the repo already does so the plan reuses it. Run these in parallel with `Glob` / `Grep` / `Read`:

- **Backend stack.** Look for `*.sln`, `*.csproj`, `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`. Note framework (ASP.NET Core, Next.js API routes, Express, Django, etc.).
- **Test framework.** For .NET: check existing test `.csproj` for `NUnit`, `xunit`, or `MSTest` package references. **The user's standard for this skill is NUnit when the project is .NET** — but if the repo is already on xUnit or MSTest, surface that conflict to the user before writing tests in a different framework.
- **Existing patterns.** Find a recent feature slice resembling the requested one and read it end-to-end (entity, port/interface, service, controller, mapping, validator, repository, tests, migration). The new code must match its shape.
- **DI / wiring.** How are services registered? Scrutor auto-registration, hand-rolled `services.AddScoped<>`, `Microsoft.Extensions.DependencyInjection` modules, etc.
- **Persistence layer.** EF Core (look for `DbContext`), Dapper, raw ADO, or another ORM. Migration tool: EF Core migrations (`Migrations/` folder), FluentMigrator, DbUp, Flyway, Prisma, Knex, Alembic.
- **Validation, mapping, error responses.** FluentValidation vs. DataAnnotations; AutoMapper vs. hand-written; centralized exception middleware vs. controller-level try/catch.
- **Folder conventions.** Per-feature folders, ONION layering, vertical slices — match whatever's already there.

Record what you find. The plan will reference these directly so the user can see you're not inventing new patterns.

### Phase 3 — Plan

Enter Plan Mode (`EnterPlanMode`). The plan must include:

1. **Restatement of the feature** in one short paragraph, using the project's canonical terminology from `CONTEXT.md` (if present).
2. **Files to create**, grouped by layer, each with a one-line purpose.
3. **Files to modify**, with a one-line description of the change (e.g. "register `IOrderRepository → OrderRepository` in `DependencyInjection.cs`").
4. **Test plan.** For each new behaviour, list the NUnit test cases by name (or the project's actual test framework if different). Mark which existing test class each test will be **appended to** vs. which test class is new.
5. **Migration plan.** If the feature touches the schema:
   - The migration name (e.g. `AddPriorityToOrders`).
   - The columns / tables / indexes added, dropped, or altered.
   - Whether a backfill is required and how it's gated.
   - **Always end with:** "Migration file will be generated. No SQL, no `dotnet ef database update`, no `ExecuteSql*` calls will be run — the user runs the migration themselves."
6. **Pattern reuse table.** Two columns: "New code I'm about to write" and "Existing example it follows" with a path. If a row has no existing example, justify the new pattern.
7. **Open questions** still unresolved, if any. If there are any, loop back to Phase 1 — do not exit plan mode with open questions.

Then exit with `ExitPlanMode` and wait. **Do not write a single file until the user approves the plan.** If the user pushes back, revise and re-present; don't half-implement against an unapproved plan.

### Phase 4 — Build (test-first when an API changes)

Build in the order that gives you the fastest feedback loop.

**If the feature adds or changes an API endpoint, follow TDD:**

1. **Locate the test class.** For each API change, search for an existing test class that already covers that controller / service / use-case. Common patterns:
   - `tests/**/<Controller>Tests.cs` for `<Controller>Controller.cs`
   - `tests/**/<Service>Tests.cs` for `<Service>.cs`
   - `tests/**/<UseCase>Tests.cs` for a CQRS handler
   Use `Glob` with a broad pattern (`**/<Name>Tests.cs`, `**/*<Feature>*Tests.cs`) before deciding nothing exists.
2. **Append, don't duplicate.** If a test class already exists for that section, **add new `[Test]` / `[TestCase]` methods to it** rather than creating a parallel class. Reuse its `[SetUp]`, fixtures, `TestCaseSource`s, and helper builders. Never create `FooServiceTests2.cs`.
3. **Write the tests first**, covering at minimum:
   - Happy path (correct inputs → correct outputs, correct state change)
   - Validation failures (each rule that should reject input)
   - Authorization failures (when applicable)
   - Edge cases identified in Phase 1 (idempotency, concurrent calls, empty/max inputs)
   - Persistence side effects (entity saved, row count, foreign key set)
4. **Run the tests, watch them fail** for the right reason (not "class not found"). If they fail for the wrong reason, fix the test before writing production code.
5. **Implement just enough** to turn each test green, following the patterns from Phase 2.
6. **Refactor for DRY** once green. Extract helpers, builders, and parameterized cases. Reuse `TestCaseSource` / `[Values]` rather than copy-pasting near-identical tests.

**If the feature is non-API (worker, frontend page, internal job),** still write tests where the project has a precedent. Skip the "TDD by default" cycle only when there is no testable seam and the project itself doesn't test that layer — and call that out in the plan.

**Code rules during the build:**

- **Reuse existing patterns.** No new abstraction layers. No new base classes. No new DI container. If you need a helper that's almost identical to one that exists, use the existing one or extend it — don't fork.
- **DRY.** If you find yourself typing the same three-line block twice, extract it. If you're tempted to copy a controller's wiring code, find the existing extension method that does it.
- **Minimal comments.** Default to no comments. Only add one when the *why* is non-obvious (a workaround, a non-trivial invariant, a domain rule that isn't visible from the names). Never write block headers, never restate what the next line does, never leave `// TODO` without an issue link.
- **Match formatting.** Use the project's brace style, naming, file headers, `using` placement. Don't reformat unrelated code.
- **No dead code.** Don't commit commented-out lines or "for future use" stubs.

### Phase 5 — Migrations (generate only, never execute)

If the feature requires a schema change:

1. **Generate the migration file using the project's tool** — but only the file. Examples:
   - **EF Core:** Write the `Migrations/<Timestamp>_<Name>.cs` and `Migrations/<Timestamp>_<Name>.Designer.cs` (and update the model snapshot) **by hand from the existing migrations as templates**. Do not run `dotnet ef migrations add` if that would also write to a connected DB or trigger a connection. If running it locally is required to get the snapshot right, run it against an in-memory provider or document why.
   - **FluentMigrator / DbUp / Flyway / Knex / Alembic:** Create the migration script in the conventional location matching existing migrations' naming.
2. **Never run the migration.** Forbidden during this skill:
   - `dotnet ef database update`
   - `flyway migrate`, `knex migrate:latest`, `alembic upgrade`, `prisma migrate deploy`
   - Any `ExecuteSqlRaw` / `ExecuteSqlInterpolated` call that performs DDL
   - Raw `CREATE TABLE` / `ALTER TABLE` issued through a SQL client
3. **Never run ad-hoc queries against the user's database** as part of the build, even read-only. If a question requires data, ask the user to run it and paste results.
4. **Tell the user what to run.** End the build report with the exact command the user should run themselves, e.g.:
   > "Migration `20260515_AddPriorityToOrders` is generated. Run `dotnet ef database update -p src/Acme.Infrastructure -s src/Acme.Api` when you're ready."
5. **Flag destructive changes** in the report: `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN ... NOT NULL` without a default on existing data, renames that EF Core models as drop+add. Tell the user the data-loss risk before they run anything.

### Phase 6 — Verify and report

- Run the test suite for the affected project(s). Tests must pass.
- Run the build (`dotnet build`, `pnpm build`, `pytest --collect-only`, etc.) and confirm it's green.
- Re-grep for stray comments, debug logs, dead code, and undeleted scratch files.
- Report:
  - Files created, files modified (paths only — let the user open them).
  - Test summary: counts of tests added per class, classes appended-to vs. created.
  - Migration name + the exact command the user should run.
  - Anything the plan said you'd do but you ended up not doing, with a one-line reason.

## Test-class discovery rules (the "append vs. create" decision)

When you're about to write a test, decide where it goes using this order. Stop at the first match.

1. **Exact match on the unit under test.** `OrderService.cs` → look for `OrderServiceTests.cs`, `OrderServiceTest.cs`, `OrderService_Tests.cs` anywhere under `tests/`. Append there.
2. **Behavioural grouping.** Some codebases group by feature, not class: `tests/Orders/CancellationTests.cs` covers `OrderService.Cancel`, `CancellationPolicy.Evaluate`, and the controller endpoint together. If such a class exists for this feature area, append.
3. **Controller-level integration tests.** If the project uses `WebApplicationFactory` integration tests grouped per controller (`OrdersControllerTests.cs`), and the new endpoint is on `OrdersController`, append there as well as / instead of a service-level class — match the project's habit.
4. **Only create a new test class** when none of the above match. Name it to mirror the existing convention (don't introduce a new naming style).

When appending:

- Reuse the existing `[SetUp]` / fixtures / mocks rather than redeclaring them.
- Add to existing `TestCaseSource` arrays when the new case is the same shape.
- Don't reorder or reformat the existing tests in the class.

## Required patterns

- **Tests are first-class.** Test code follows the same DRY and minimal-comments rules as production code. Use builders / object mothers for fixtures rather than copy-pasted setup blocks.
- **One reason to change per file.** If you find yourself editing seven files for one logical concept and one of them is "unrelated cleanup", drop the cleanup.
- **CancellationToken plumbing** in async .NET code: every new async method takes `CancellationToken ct` as its last parameter and forwards it.
- **No new dependencies without asking.** If the feature seems to need a new NuGet/npm package, raise it in Phase 1 — don't quietly add one in Phase 4.

## Anti-patterns

- ❌ Skipping Phase 1 and going straight to "let me read the code and start building" — the whole point of this skill is the grill.
- ❌ Exiting plan mode while open questions remain. Loop back instead.
- ❌ Writing production code before the test it makes pass (when the feature touches an API).
- ❌ Creating `FooServiceTests2.cs` because `FooServiceTests.cs` already exists. Always append.
- ❌ Inventing a new pattern for something the codebase already has a pattern for. If you can't find the precedent, ask before forking.
- ❌ Running `dotnet ef database update`, `prisma migrate deploy`, or any DDL against the user's DB.
- ❌ Running ad-hoc `SELECT` / `UPDATE` queries against the user's DB to "check something" — ask the user instead.
- ❌ Block comments and "what this does" comments. Names should do that work.
- ❌ Leaving debug logs, `// TODO`s, or commented-out code in the final files.
- ❌ Reformatting unrelated code in the diff. Keep the change small.

## Examples

### Example 1: Add a feature to a .NET ONION API

**User:** "Plan and build a feature: customers can mark an order as 'priority'. It should bump the order in the queue and audit who set it."

**Claude:**
1. **Phase 1 — Grill.** Asks one question at a time: "Is 'priority' a boolean or an ordered priority (1–N)?" → recommends boolean for v1. Then: "Which roles can set it?" → checks existing `[Authorize(Roles=...)]` usage. Then: "What does 'bump in the queue' mean — sort order in the API response, or affect a background processor?" Continues until the spec is unambiguous, reading `OrderService.cs`, `OrdersController.cs`, and a recent `Migrations/*_AddX.cs` along the way to inform questions.
2. **Phase 2 — Detect.** Records: ASP.NET Core 8, EF Core 8, NUnit, FluentValidation, AutoMapper, Scrutor, FluentMigrator-style EF migrations under `src/Acme.Infrastructure/Migrations/`.
3. **Phase 3 — Plan.** Enters plan mode. Lists: new `IsPriority` column on `Orders` + `SetPriorityAsync` on `OrderService` + `[HttpPatch("{id}/priority")]` on `OrdersController` + `OrderAuditLog` row insert. Test plan: appends `SetPriority_HappyPath`, `SetPriority_Unauthorized`, `SetPriority_AlreadyPriority_IsIdempotent` to existing `OrderServiceTests.cs` (NUnit). Migration plan: `AddPriorityToOrders` adds a non-nullable `bit` with default `0`, no backfill needed. Pattern reuse table maps each new file to a precedent in the repo. Exits plan mode and waits.
4. **Phase 4 — Build (TDD).** Writes the three new `[Test]` methods inside the existing `OrderServiceTests.cs`, reusing its `[SetUp]`-injected mocks. Runs `dotnet test` — red for the right reason. Implements `OrderService.SetPriorityAsync` and the controller endpoint following the recent `OrderService.Cancel` shape. Reruns — green.
5. **Phase 5 — Migration.** Writes `Migrations/20260515120000_AddPriorityToOrders.cs` and the model snapshot update by hand from the previous migration as a template. Does **not** run `dotnet ef database update`.
6. **Phase 6 — Report.** Lists files, summarises tests (3 appended to `OrderServiceTests.cs`, 0 new test classes), quotes the exact migration command for the user.

### Example 2: Add a feature without a schema change

**User:** "Add an endpoint to export the customer list as CSV."

**Claude:** Grills (CSV format, columns, filter scope, auth). Detects stack. Plans: new `ExportAsync` on `CustomerService`, new `[HttpGet("export")]` on `CustomersController`, no schema change. Appends two `[Test]` methods to existing `CustomerServiceTests.cs`. Builds. No migration phase. Reports.

### Example 3: User asks to skip the plan

**User:** "Just add a `DeletedAt` column to Users and a soft-delete endpoint, you don't need to grill me."

**Claude:** Still asks the questions whose answers affect the design — "Hard-delete or soft-delete the underlying row? Does any query need to opt in to seeing deleted users? Cascading effect on Orders?" — but compresses Phase 1 to those questions only. Still enters plan mode with the migration plan. Still does not run the migration.

## Notes

- This skill **composes with** [`dotnet-onion-api`](../dotnet-onion-api/SKILL.md) and [`nextjs-app-router`](../nextjs-app-router/SKILL.md): if the user's repo was scaffolded with one of those, follow that skill's layout and forbidden-pattern list when generating new files.
- If the project uses `CONTEXT.md` / `docs/adr/`, prefer adding to those over inventing a new doc folder. Update `CONTEXT.md` inline when a Phase 1 conversation resolves a fuzzy term — it's a glossary, not a spec.
- If the feature seems to demand an ADR (hard-to-reverse choice, surprising to a future reader, a real trade-off with alternatives), offer it after the build, not before — you have more information once it's working.
- The "no SQL execution" rule is absolute. If the user explicitly asks you to run a migration, decline within this skill and tell them to run it themselves, then mention they can drop the skill if they want autonomous execution.
- Adapted in part from Matt Pocock's `grill-with-docs` skill (interview-relentlessly, sharpen-fuzzy-terms, cross-reference-with-code), extended with a build phase and explicit guardrails around tests and migrations. The standalone [`grill-with-docs`](../grill-with-docs/SKILL.md) in this library handles the discovery-only case.

---
name: nextjs-app-router
description: Scaffold a new Next.js (App Router) fullstack app with TypeScript, NextAuth (Auth.js v5), Prisma + PostgreSQL, Route Handlers, Redux Toolkit + RTK Query, Tailwind + shadcn/ui (Radix), React Hook Form + Zod. Pages are `'use client'` SPA-style — RTK Query talks to in-app `/api/**` Route Handlers; no `fetch()` in server components, no Server Actions, no async `page.tsx`. Use this skill whenever the user asks to "create a new Next.js project", "scaffold a Next.js app", "new Next app with auth", "Next.js + NextAuth", "RTK Query Next.js app", "Next.js + Prisma project", "shadcn project", or mentions "my Next.js conventions". Three modes — (1) full project scaffold, (2) add a feature slice (route + Route Handlers + RTK Query endpoints + Zod schema + form), (3) add an RTK Query API slice for an existing domain. Confirms the database (Postgres + Prisma) and NextAuth providers BEFORE writing any files. Codifies the good patterns (route groups, NextAuth `auth()` in Route Handlers, single base RTK Query + injected endpoints, Prisma singleton, schema-driven forms, per-feature `_components`/`_hooks`) and forbids the pitfalls (`fetch()` / `await db.*` in server components, Server Actions, async `page.tsx`, custom JWT cookies fighting NextAuth, `serializableCheck: false`, `@ts-ignore`, mixed date libraries, `dangerouslySetInnerHTML` without sanitization, multiple `createApi()` instances).
---

# Next.js App Router Fullstack Scaffolder (NextAuth + Prisma + RTK Query)

Generate a production-grade Next.js fullstack app where:

- **Pages are `'use client'` SPA-style.** All data goes through RTK Query. No `fetch()` in server components. No Server Actions. No async `page.tsx`. The root `app/layout.tsx` is the **only** server component that matters — it renders `<Providers>`. Per-feature `page.tsx` files are client components.
- **Backend lives in-app as Next.js Route Handlers** under `src/app/api/**/route.ts`. Each handler calls `await auth()` and queries Postgres via Prisma.
- **Auth is NextAuth (Auth.js v5)**, not a custom JWT-cookie scheme. `src/auth.ts` is the single source of auth truth. `middleware.ts` re-exports `auth` for route-level gating. Login UIs call `signIn()` from `next-auth/react`; logout calls `signOut()`. RTK Query reads the session cookie automatically via `credentials: 'include'`.
- **Database is PostgreSQL via Prisma.** NextAuth uses the Prisma adapter. The skill **confirms the database choice with the user before writing files** even though Postgres+Prisma is the only supported option — the connection string and host (local Docker, Neon, Supabase, etc.) need to be locked down up front.

The skill **forbids** the patterns it used to allow in an earlier frontend-only revision: server-side data fetching, `redirect()` from server pages, custom `httpOnly` JWT cookies, multi-`createApi` setups, and ad-hoc auth slices that duplicate NextAuth state.

## When to use this skill

Trigger on any of:

- "create a new Next.js project" / "scaffold a Next.js app" / "new Next app"
- "Next.js App Router project" / "Next.js + NextAuth" / "Next.js + Prisma"
- "RTK Query Next.js app" / "Redux Toolkit Next.js"
- "shadcn/ui project" / "Tailwind + shadcn + Radix scaffold" in a Next.js context
- "use my Next.js conventions" / "the Next.js patterns I like"
- "add a feature end-to-end" (route + Route Handler + RTK Query + form) in a Next.js context
- "add a new RTK Query API slice for `<domain>`"
- The user pastes a feature spec for a screen and asks you to wire it through routing + API + state + form

If unsure whether the user wants a brand-new project vs. an addition to an existing one, ask once — don't guess.

## Three operating modes

Pick the mode from the user's request. If ambiguous, ask.

| Mode | Trigger | Output |
|------|---------|--------|
| **`scaffold-project`** | "new project", "scaffold app", empty directory | Full Next.js App Router project: route groups, server root layout, client pages, NextAuth config, Prisma schema + migration, `/api/auth/[...nextauth]` handler, base RTK Query pointing at `/api`, shadcn/ui init, Vitest + Playwright, ESLint/Prettier/Husky, GitHub Actions CI. |
| **`add-feature`** | "add `<feature>` end-to-end", "wire up `<screen>` through routing + API + state + form" | New route folder under the appropriate group with a `'use client'` `page.tsx`, `_components/`, `_hooks/`, `loading.tsx`, Zod schema, RTK Query endpoint file, **and a matching `src/app/api/<feature>/route.ts` Route Handler** that calls `auth()` and Prisma. |
| **`add-api-slice`** | "add an API slice for `<domain>`", "new RTK Query endpoints for X" | New `src/redux/api/<domain>Api.ts` injecting endpoints into the base `api`, plus matching `src/app/api/<domain>/**/route.ts` handlers (one per endpoint) and Prisma model additions if needed. |

## Workflow

### Step 1 — Determine versions (don't hard-code)

Versions are resolved at scaffold time, never hard-pasted into the skill. Before writing `package.json`:

1. Check the user's environment first: run `node --version` and `npm --version` (or `pnpm --version` / `yarn --version`).
2. Resolve the latest stable versions of the core stack via context7 (`mcp__plugin_context7_context7__query-docs`) — never hand-paste. Resolve:
   - `next`, `react`, `react-dom`, `typescript`, `@types/react`, `@types/node`
   - `next-auth` (Auth.js v5 — current beta as of late 2025; verify via context7), `@auth/prisma-adapter`
   - `prisma`, `@prisma/client`, `bcryptjs` (and `@types/bcryptjs`) — or `@node-rs/argon2` if user prefers Argon2
   - `@reduxjs/toolkit`, `react-redux`
   - `tailwindcss`, `postcss`, `autoprefixer`
   - `@radix-ui/*` (only the primitives the templates need), `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`
   - `react-hook-form`, `@hookform/resolvers`, `zod`
   - `date-fns` (do **not** also add `moment`)
   - `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`
   - `eslint`, `eslint-config-next`, `@typescript-eslint/*`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `prettier`, `husky`, `lint-staged`
3. Quote the resolved versions back to the user before generating, so they can object.
4. Prefer the latest **stable** Next.js (App Router GA from 13.4; resolve current).
5. Default to **pnpm** if `pnpm` is present, otherwise **npm**. Match `packageManager` in `package.json`.

### Step 2 — Gather inputs (ask once, in one batch)

For `scaffold-project`, use `AskUserQuestion` to collect:

- **Project name** (kebab-case, used for the directory and `package.json` `name`).
- **Database connection**. Postgres + Prisma is the only ORM the skill emits, but the host varies. Offer: local Docker (the skill emits a `docker-compose.yml` with a `postgres:16` service), Neon, Supabase, Railway, "I'll paste my own `DATABASE_URL`". Confirm before writing `.env.example` and `prisma/schema.prisma`.
- **NextAuth providers**. Offer: Credentials (email + password, stored in the `User` table with a bcrypt-hashed `password` column), GitHub OAuth, Google OAuth, "all of the above". Default: Credentials. The chosen providers determine which `.env.example` keys get emitted (`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`, etc.).
- **Route groups**. Default offer: `(public)` for auth pages + `(app)` for authenticated content. Optionally add `(admin)` for role-gated routes (gated via NextAuth role claim in `middleware.ts`).
- **First feature/route** (optional, e.g. `dashboard`) — if provided, run `add-feature` for it after scaffold.
- **Optional extras**: Storybook? i18n? Sentry? Dockerfile? GitHub Actions CI? (Default: skip — only add if asked. CI defaults ON.)

For `add-feature`: feature name, route group it belongs to, list of fields (name + Zod type + required/optional), CRUD shape (list view + detail view, or just one screen). The skill generates **both** the client page/components and the matching Route Handler(s).

For `add-api-slice`: domain name (e.g. `customers`), list of endpoints (verb + path + request type + response type), invalidation tags. The skill generates the RTK Query slice **and** the Route Handlers it calls.

### Step 3 — Generate files

Use the **templates in [`references/templates/`](references/templates/)** as the source of truth. Apply these rules:

- Use `Write` for new files. Never `Edit` files you're creating fresh.
- Replace all `{{ProjectName}}`, `{{Feature}}`, `{{Domain}}` placeholders consistently. `{{project-name}}` is kebab-case for files/dirs; PascalCase where namespacing requires.
- Create directories before files. On Windows shell use PowerShell `New-Item -ItemType Directory -Force`.
- Do **not** run `create-next-app` to bootstrap — write files directly from templates so the layout matches [`references/folder-layout.md`](references/folder-layout.md). Use `npm`/`pnpm install` after `package.json` is written.
- Initialize shadcn/ui by writing `components.json` from [`references/templates/components-json.md`](references/templates/components-json.md) and `src/components/ui/` components incrementally as needed (button, input, form, label, dialog, toast, etc.) — don't blanket-install every Radix primitive.

### Step 4 — Database setup

After `package.json` and `prisma/schema.prisma` are written:

1. `pnpm install` (or chosen PM) — installs `prisma` and `@prisma/client`.
2. Confirm with the user that their `DATABASE_URL` is reachable before running any DB commands. If they picked local Docker, run `docker compose up -d postgres` first.
3. `pnpm exec prisma generate` — generates the typed client.
4. `pnpm exec prisma migrate dev --name init` — creates the initial migration covering NextAuth tables + sample domain models.
   - **Never run `prisma db push` against a production-shaped database.** Use migrations.
   - **Never run `prisma migrate reset` without explicit user confirmation** — it drops the DB.
5. Generate `AUTH_SECRET` for the user: `pnpm exec auth secret` (Auth.js CLI) or `openssl rand -base64 32`. Put it in `.env.local` (NOT `.env.example`).

### Step 5 — Verify and report

- `pnpm typecheck` (or `npx tsc --noEmit`). Must exit 0.
- `pnpm lint`. Must exit 0.
- `pnpm test` (Vitest) if any tests were generated. Must exit 0.
- `pnpm build`. Must succeed.
- Reply with a short summary: project path, versions chosen, route groups, env vars to set (especially `AUTH_SECRET` and `DATABASE_URL`), next steps (`pnpm dev`, log in with the seeded test user if Credentials was chosen).

## Project layout (canonical)

See [`references/folder-layout.md`](references/folder-layout.md) for the full tree, file-by-file purpose, and the rules that govern it.

Top-level shape:

```
{{project-name}}/
  package.json
  tsconfig.json                # strict: true, paths: { "@/*": ["./src/*"] }
  next.config.ts
  tailwind.config.ts           # darkMode: ['class'], shadcn theme tokens
  postcss.config.js
  components.json              # shadcn config; rsc: true
  .eslintrc.json (or eslint.config.mjs)
  .prettierrc
  .env.example                 # NEVER .env — only .env.example committed
  middleware.ts                # NextAuth-driven route gate; re-exports `auth`
  docker-compose.yml           # optional: only if user picked "local Docker"
  prisma/
    schema.prisma              # NextAuth tables + domain models
    migrations/                # generated; checked in
    seed.ts                    # optional: seeds test user for Credentials
  src/
    auth.ts                    # NextAuth (Auth.js v5) config — adapter, providers, callbacks
    auth.config.ts             # Edge-safe config (no DB/adapter imports) — used by middleware
    app/
      layout.tsx               # SERVER. <html><body><Providers>{children}
      globals.css
      error.tsx
      not-found.tsx
      api/
        auth/[...nextauth]/route.ts   # exports { GET, POST } from NextAuth handlers
        <domain>/route.ts             # list + create
        <domain>/[id]/route.ts        # get + update + delete
      (public)/                # unauthenticated routes (login, signup, reset)
        layout.tsx             # server; minimal chrome
        auth/login/
          page.tsx             # 'use client' — calls signIn('credentials', { ... })
      (app)/                   # authenticated routes
        layout.tsx             # server; renders <AppShell> ('use client' child)
        _components/AppShell.tsx
        loading.tsx
        error.tsx
        dashboard/
          page.tsx             # 'use client' — uses RTK Query hooks
      (admin)/                 # optional; role-gated
    components/
      ui/                      # shadcn primitives (button, input, form, ...)
      forms/                   # composed form fields
      Notifications.tsx
      UnsavedChangesWarning.tsx
    redux/
      store.ts                 # typed; NO @ts-ignore, NO serializableCheck: false
      providers.tsx            # 'use client'; wraps <SessionProvider><Provider><Toaster>
      hooks.ts                 # typed useAppDispatch, useAppSelector
      api/
        api.ts                 # base createApi pointing at '/api'; auth-aware baseQuery
        tags.ts                # tag-type union as const
        <domain>Api.ts         # one file per domain; injectEndpoints
    lib/
      db.ts                    # PrismaClient singleton
      utils.ts                 # cn() — clsx + tailwind-merge
      zod-utils.ts             # getDefaultValuesFromSchema, unwrapZodEffects, getMaxLengthsFromSchema
      api-auth.ts              # requireSession() helper for Route Handlers
      formatters/
    types/
      next-auth.d.ts           # module augmentation for Session.user.id, role
    config/
      env.ts                   # runtime-validated env (Zod parsed at startup)
  tests/
    unit/                      # Vitest + RTL
    e2e/                       # Playwright
  .github/workflows/ci.yml     # lint + typecheck + test + build
```

**Dependency rules (enforced):**

- `app/` routes import from `components/`, `redux/`, `lib/`, `config/` — never the reverse.
- `app/api/**/route.ts` files import `@/auth`, `@/lib/db`, `@/lib/api-auth`, and Zod schemas from feature folders — never from `redux/`.
- `redux/` never imports from `app/api/**` (handlers) or `prisma/` — RTK Query talks to handlers over HTTP, not through in-process function calls.
- `components/ui/` (shadcn primitives) must not import from `app/`, `redux/`, or feature code.
- Feature `_components/` and `_hooks/` are **private**: only routes inside the same feature folder may import them.

## Required code patterns

Full templates are in [`references/templates/`](references/templates/). Rationale for each Keep/Eliminate rule is in [`references/good-patterns.md`](references/good-patterns.md) and [`references/anti-patterns.md`](references/anti-patterns.md).

### Keep

- **Server root layout, client pages.** `src/app/layout.tsx` is a server component that renders `<html><body><Providers>{children}</Providers></body></html>`. **Every other `page.tsx` is `'use client'`** and uses RTK Query for data. Per-route metadata lives at the layout level (server) — pages can't export `metadata` because they're client. See [`references/templates/root-layout.md`](references/templates/root-layout.md).
- **Route groups for auth boundaries**: `(public)`, `(app)`, optional `(admin)`. Each group has its own `layout.tsx`. The shell (header/sidebar) lives in `(app)/layout.tsx` rendering an `'use client'` child from `_components/`.
- **NextAuth (Auth.js v5)** as the single source of auth truth. `src/auth.ts` exports `{ handlers, auth, signIn, signOut }`. `middleware.ts` re-exports `auth` (or wraps it for role/path logic) with an Edge-safe `src/auth.config.ts`. See [`references/templates/nextauth-config.md`](references/templates/nextauth-config.md).
- **Route Handlers as the backend**. Every `/api/<domain>/route.ts` calls `await auth()` first; unauthenticated requests 401. Inputs validated with the same Zod schema the form uses. Database access via the Prisma singleton in `src/lib/db.ts`. See [`references/templates/route-handler.md`](references/templates/route-handler.md).
- **One RTK Query base `api`** in `redux/api/api.ts` with `baseUrl: '/api'`, `credentials: 'include'`, and `endpoints: () => ({})`. Domain slices call `api.injectEndpoints(...)`. Tag types are a `const` array. See [`references/templates/api-base.md`](references/templates/api-base.md) and [`references/templates/api-slice.md`](references/templates/api-slice.md).
- **Auth-aware `baseQuery`**: on 401, dispatches NextAuth `signOut({ callbackUrl: '/auth/login' })`. No hard `window.location.href = ...`. The session cookie is sent automatically because `credentials: 'include'` is set and the API is same-origin.
- **Typed Redux hooks**: `useAppDispatch`/`useAppSelector` from `redux/hooks.ts`. Components never use the raw `useDispatch`/`useSelector`.
- **Strict store config**: `serializableCheck` left at the default. Targeted exceptions with comments are fine; blanket `false` is not. No `@ts-ignore`.
- **Prisma singleton** in `src/lib/db.ts` to avoid exhausting connections during dev hot-reload. See [`references/templates/db-client.md`](references/templates/db-client.md).
- **Prisma schema covers NextAuth + domain**. NextAuth tables (`User`, `Account`, `Session`, `VerificationToken`) plus a `password` column on `User` for Credentials. Domain models live in the same file. See [`references/templates/prisma-schema.md`](references/templates/prisma-schema.md).
- **shadcn/ui + Tailwind + Radix**: shadcn primitives in `components/ui/` (owned by the project, not a node_modules dependency). Composed form fields in `components/forms/`. `cn()` util in `lib/utils.ts` is the single source of class merging.
- **React Hook Form + Zod**: every form uses `useForm({ resolver: zodResolver(schema), defaultValues: getDefaultValuesFromSchema(unwrapZodEffects(schema)) })`. The same Zod schema validates request bodies in the matching Route Handler. See [`references/templates/form-with-zod.md`](references/templates/form-with-zod.md).
- **`UnsavedChangesWarning`** wired to React Hook Form's `formState.isDirty`.
- **Per-feature `_components/` and `_hooks/`** private to that route.
- **`error.tsx` and `loading.tsx` at every meaningful route segment**.
- **Runtime env validation** in `src/config/env.ts` using Zod. `AUTH_SECRET`, `DATABASE_URL`, `AUTH_URL` (production), and any OAuth provider keys are required.
- **Single date library: `date-fns`**. No `moment`.
- **Minimal comments in generated code.** Default to no comments. Only add one when the *why* is non-obvious — a workaround for a specific upstream issue (with a link), a subtle invariant the code depends on, a domain rule that isn't visible from the names. Never write block headers, never restate *what* the next line does, never leave `// TODO` without an issue link. One short line max — no multi-line comment blocks, no multi-paragraph JSDoc. Well-named identifiers carry the *what*; comments earn their place only when they carry *why*.
- **`tsconfig.json` strict + `@/*` path alias** — see [`references/templates/tsconfig.md`](references/templates/tsconfig.md).
- **Vitest + RTL for unit tests, Playwright for E2E**. At least: one reducer test, one schema test, one component test, one E2E auth-then-dashboard flow.
- **Husky + lint-staged** pre-commit: `prettier --write` + `eslint --fix` on staged files.
- **GitHub Actions CI** running install → lint → typecheck → test → build on every PR. Tests use a throwaway Postgres service container.

### Eliminate (anti-patterns)

Every one of these is forbidden in generated code. Rationale in [`references/anti-patterns.md`](references/anti-patterns.md).

- ❌ **`fetch()` or `await db.*` inside a server component** (server `page.tsx`, `layout.tsx`, or any non-`'use client'` file under `app/` that isn't `route.ts`). All data goes through RTK Query → Route Handlers. The app is "API-driven, not SSR" by deliberate choice.
- ❌ **Server Actions** (`'use server'` functions called from client components). The skill does not emit any. Mutations go through Route Handlers + RTK Query mutations.
- ❌ **`async page.tsx`** — pages are `'use client'` and synchronous. The body uses RTK Query hooks.
- ❌ **`redirect()` from a server `page.tsx`** as the auth-gate fallback. The auth gate is `middleware.ts`. The root `/` redirect is also middleware's job (e.g. send signed-in users to `/app/dashboard`, signed-out to `/auth/login`).
- ❌ **Custom JWT-in-`httpOnly`-cookie schemes alongside NextAuth.** Pick one. The default is NextAuth — don't generate a parallel `setCookie('session', ...)` flow in a Route Handler.
- ❌ **Decoding the NextAuth JWT manually on the client** to drive auth decisions. Use `useSession()` from `next-auth/react` (or call `await auth()` server-side in Route Handlers).
- ❌ **`serializableCheck: false`** on the store config without targeted `ignoredPaths`/`ignoredActions` and a comment explaining the exception.
- ❌ **`@ts-ignore` / `as any`** anywhere in the store, providers, API layer, or Route Handlers.
- ❌ **Commented-out reducers, endpoints, or imports** left in `store.ts`/`api.ts`.
- ❌ **Mixing `moment` and `date-fns`**. Pick `date-fns`.
- ❌ **`styled-components` (or Emotion) in a Tailwind project.**
- ❌ **Two folders or files that differ only by case** (breaks on Linux CI).
- ❌ **`dangerouslySetInnerHTML` with API-sourced content that hasn't been sanitized.**
- ❌ **`sessionStorage` / `localStorage` for state that isn't transient client-only UI state.** Tokens never go in `localStorage` — NextAuth handles cookies.
- ❌ **A `proxy.ts` (or similarly-named file)** at `src/` root standing in for `middleware.ts`.
- ❌ **Inline `fetch` calls in components for backend data.** All backend calls go through RTK Query.
- ❌ **Redux slices for state that should be local component state, URL state, or React Hook Form state.** Reach for `useState` / `useReducer` first, then `useSearchParams`, then Redux.
- ❌ **Many independent `createApi()` instances.** One base `api` + `injectEndpoints` per domain.
- ❌ **Hard `window.location.href = '/auth/login'` redirects from inside the base query** as the primary 401 handler. Dispatch `signOut({ callbackUrl: '/auth/login' })`.
- ❌ **Skipping `loading.tsx` / `error.tsx`** on authenticated route groups.
- ❌ **Multiple `PrismaClient` instances.** Use the singleton in `src/lib/db.ts`.
- ❌ **Route Handlers that skip the `await auth()` check.** Every handler authenticates first.
- ❌ **Route Handlers that trust client-sent user IDs** for ownership. Read the user ID from the session, not the request body.
- ❌ **`prisma db push` in CI or any non-dev environment.** Migrations only.
- ❌ **No tests at all.**
- ❌ **ESLint extending only `next/core-web-vitals`.**

## Operating-mode playbooks

### Mode 1 — `scaffold-project`

1. Resolve versions per **Step 1**. Quote them.
2. Ask the inputs per **Step 2** (database host, NextAuth providers, route groups, optional extras). Wait for answers.
3. Generate, in this order:
   1. `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `.eslintrc.json` (or `eslint.config.mjs`), `.prettierrc`, `.gitignore`, `.env.example`, `README.md`. Add `docker-compose.yml` if Docker was chosen.
   2. `prisma/schema.prisma` with NextAuth tables + sample domain model + (if Credentials) `password` column. `prisma/seed.ts` if a test user was requested.
   3. `src/auth.config.ts` (Edge-safe), `src/auth.ts` (full config with adapter + providers), `src/types/next-auth.d.ts`.
   4. `middleware.ts` at project root (re-exports / wraps `auth`).
   5. `src/app/api/auth/[...nextauth]/route.ts`.
   6. `src/lib/db.ts` (Prisma singleton), `src/lib/api-auth.ts` (`requireSession()` helper), `src/lib/utils.ts`, `src/lib/zod-utils.ts`.
   7. `src/app/layout.tsx` (server, renders Providers), `src/app/globals.css`, `src/app/error.tsx`, `src/app/not-found.tsx`. **No `src/app/page.tsx` that does `redirect()`** — middleware handles `/`. If a `/` page is needed (marketing landing), it's `'use client'`.
   8. Route groups: `src/app/(public)/layout.tsx` + `auth/login/page.tsx` ('use client', calls `signIn`), `src/app/(app)/layout.tsx` + `_components/AppShell.tsx` + `loading.tsx` + `error.tsx`, plus `(admin)/` if requested.
   9. `src/redux/store.ts`, `src/redux/providers.tsx` (wraps `<SessionProvider>` + `<Provider>`), `src/redux/hooks.ts`.
   10. `src/redux/api/api.ts` (base, `baseUrl: '/api'`), `src/redux/api/tags.ts`.
   11. `src/components/ui/` with shadcn primitives needed by templates (start with button, input, label, form, dialog, toast).
   12. `src/components/forms/` composed fields actually used by generated forms.
   13. `src/components/UnsavedChangesWarning.tsx`, `src/components/Notifications.tsx`.
   14. `src/config/env.ts` (Zod-validated runtime env).
   15. `tests/unit/` with one reducer test + one schema test + one component test. `tests/e2e/` with a Playwright spec that logs in and asserts the dashboard.
   16. `vitest.config.ts`, `playwright.config.ts`.
   17. `.husky/pre-commit`, `lint-staged` config in `package.json`.
   18. `.github/workflows/ci.yml` with a Postgres service container.
4. Install dependencies (`pnpm install`).
5. **Database setup per Step 4** (`prisma generate`, `prisma migrate dev --name init`).
6. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — must all pass.
7. If a first feature was requested, immediately run **Mode 2** for that feature.
8. Report.

### Mode 2 — `add-feature`

For feature `{{Feature}}` in route group `{{Group}}` (e.g. `(app)`):

1. **Schema** (shared between form and Route Handler): `src/app/{{Group}}/{{feature}}/schema.ts` — exports `{{feature}}Schema` (Zod) and inferred `{{Feature}}FormValues` type.
2. **Prisma model**: add a `{{Feature}}` model to `prisma/schema.prisma` if it doesn't exist. Run `pnpm exec prisma migrate dev --name add-{{feature}}`.
3. **Route Handlers**:
   - `src/app/api/{{feature}}s/route.ts` — `GET` (list) + `POST` (create). Both call `requireSession()`. `POST` validates the body with `{{feature}}Schema.safeParse`.
   - `src/app/api/{{feature}}s/[id]/route.ts` — `GET` + `PATCH` + `DELETE`. All call `requireSession()`. Ownership check: `where: { id, userId: session.user.id }`.
4. **RTK Query slice**: extend `src/redux/api/{{feature}}sApi.ts` with `getList`, `get`, `create`, `update`, `delete` endpoints. If the slice doesn't exist, run Mode 3 first.
5. **Routing**:
   - `src/app/{{Group}}/{{feature}}s/page.tsx` — `'use client'`. Uses `useGet{{Feature}}sQuery()`. Renders `{{Feature}}sTable` from `_components/`.
   - `src/app/{{Group}}/{{feature}}s/loading.tsx` (Suspense fallback).
   - `src/app/{{Group}}/{{feature}}s/error.tsx` (error boundary).
   - `src/app/{{Group}}/{{feature}}s/new/page.tsx` — `'use client'`. Renders `{{Feature}}Form mode="create"`.
   - `src/app/{{Group}}/{{feature}}s/[id]/page.tsx` — `'use client'`. Renders `{{Feature}}Form mode="edit" id={params.id}`.
6. **Private components**:
   - `_components/{{Feature}}sTable.tsx` — `'use client'`, uses `useGet{{Feature}}sQuery`.
   - `_components/{{Feature}}Form.tsx` — `'use client'`, uses `useForm` + `zodResolver`, wraps `<UnsavedChangesWarning>`, dispatches create/update mutation on submit.
7. **Tests**: `tests/unit/{{feature}}.schema.test.ts` (Zod schema valid + invalid). Optional handler test that mocks `db` and `auth`.

After generating: `pnpm typecheck && pnpm test && pnpm build`.

### Mode 3 — `add-api-slice`

For domain `{{domain}}` (e.g. `customers`):

1. Create `src/redux/api/{{domain}}Api.ts` that imports the base `api` and calls `api.injectEndpoints(...)`. Strongly typed request/response. `providesTags` on queries, `invalidatesTags` on mutations.
2. Add new tag types to `src/redux/api/tags.ts`. The `tagTypes` array on the base `api` reads from this constant.
3. Export generated hooks (`useGet{{Domain}}sQuery`, `useCreate{{Domain}}Mutation`, etc.).
4. **Create the matching Route Handlers** under `src/app/api/{{domain}}/...` — every endpoint needs a handler. See [`references/templates/route-handler.md`](references/templates/route-handler.md).
5. Add the Prisma model(s) and migrate if needed.
6. **Do not** create a new `createApi(...)`. One base `api`, many injected slices.

After generating: `pnpm typecheck && pnpm build` must pass.

## Verification checklist before reporting "done"

- [ ] `pnpm install` succeeds.
- [ ] `pnpm exec prisma generate` succeeds.
- [ ] `pnpm exec prisma migrate dev --name init` succeeds (or the user confirmed they ran it manually).
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` exits 0 (no warnings on a fresh scaffold).
- [ ] `pnpm test` exits 0.
- [ ] `pnpm build` succeeds.
- [ ] No file under `src/app/**` outside `route.ts` files imports `@/lib/db` or calls `await db.*` (server pages don't touch the DB). Grep: `grep -rn "from '@/lib/db'" src/app/ --include='*.tsx'` returns nothing.
- [ ] Every `route.ts` file in `src/app/api/**` (except `[...nextauth]`) calls `await auth()` or `await requireSession()`.
- [ ] No `'use server'` directive anywhere. Grep: `grep -rn "'use server'" src/` returns nothing.
- [ ] No `async function .*Page` in any `page.tsx`. Pages are sync `'use client'`.
- [ ] No `serializableCheck: false`, `@ts-ignore`, `as any` in `src/redux/**` or `src/app/api/**`.
- [ ] `middleware.ts` exists at project root; its `config.matcher` excludes `/api/auth` (NextAuth handles its own routes).
- [ ] `src/auth.ts` and `src/auth.config.ts` both exist. `auth.config.ts` has no `@/lib/db` import (Edge-safe).
- [ ] `.env` is **not** committed; `.env.example` is. `AUTH_SECRET` is **not** in `.env.example` (it's documented as required, with instructions to generate it).
- [ ] No duplicate-by-case folders.

If any check fails, fix before reporting.

## Examples

### Example 1: Fresh fullstack project

**User:** "Scaffold a new Next.js fullstack app with NextAuth and Prisma. Call it `acme-portal`. Add a `dashboard` feature too."

**Claude:**
1. Runs `node --version` / `pnpm --version`. Resolves Next.js, React, NextAuth v5, Prisma, RTK, Tailwind, Zod versions via context7. Quotes them.
2. Asks Step-2 questions: DB host (local Docker / Neon / Supabase / own), NextAuth providers (Credentials / GitHub / Google / all), route groups, extras.
3. Generates the full project + the `dashboard` feature slice in `(app)/dashboard/` with a matching `src/app/api/dashboard/route.ts`.
4. Runs install, `prisma generate`, `prisma migrate dev --name init`, typecheck, lint, test, build — all must pass.
5. Reports: project path, env vars to set (`AUTH_SECRET`, `DATABASE_URL`), seeded test credentials (if Credentials provider was chosen), `pnpm dev`.

### Example 2: Add a feature

**User:** "Add a `customers` feature end-to-end under the (app) group — list + create + edit."

**Claude:** Runs Mode 2. If no `customersApi` exists, runs Mode 3 first. Generates:
- `prisma/schema.prisma` model addition + migration.
- `src/app/api/customers/route.ts` (GET list, POST create — both `requireSession()`-gated, POST validates with `customerSchema`).
- `src/app/api/customers/[id]/route.ts` (GET / PATCH / DELETE — ownership-checked).
- `src/redux/api/customersApi.ts` with five endpoints injected.
- `src/app/(app)/customers/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `loading.tsx`, `error.tsx` — all `'use client'`.
- `src/app/(app)/customers/_components/CustomersTable.tsx`, `CustomerForm.tsx`.
- `src/app/(app)/customers/schema.ts` (Zod).
- `tests/unit/customer.schema.test.ts`.
- Adds `'Customer'` + `'Customers'` to `tags.ts`.

### Example 3: Add an API slice + handlers

**User:** "Add an RTK Query slice for `invoices` with list, get, create, mark-paid endpoints."

**Claude:** Runs Mode 3. Creates `src/redux/api/invoicesApi.ts` injecting four endpoints, adds `'Invoices'` + `'Invoice'` to `tags.ts`, generates `src/app/api/invoices/route.ts` (GET list + POST create), `src/app/api/invoices/[id]/route.ts` (GET + PATCH), `src/app/api/invoices/[id]/mark-paid/route.ts` (POST). Adds the `Invoice` Prisma model and runs `prisma migrate dev --name add-invoices`. Typechecks.

## Notes

- **Don't over-engineer.** No Storybook, i18n, Sentry, MSW, tRPC, or Server Actions wrappers unless the user asks. The default scaffold is intentionally lean.
- **Don't rewrite the user's existing project.** This skill is for *new* scaffolds (and additive feature/slice modes), not migrations.
- **Versions**: always quote the resolved package versions before writing `package.json`.
- **Naming**: kebab-case for files and folders inside `src/`, except React component files which match the component name in PascalCase (`CustomerForm.tsx`). Never two paths that differ only by case.
- **NextAuth Credentials caveat**: when Credentials is the only/primary provider, `session.strategy` must be `'jwt'` (database sessions don't work with Credentials). The Prisma adapter is still installed because the User table still lives in the DB — just the *session* is encoded in a JWT cookie. This is by NextAuth design; don't try to switch it to `'database'` for Credentials.
- **API-driven means API-driven.** If the user asks for SSR data fetching or Server Actions mid-scaffold, push back with the rationale (consistency, single mental model, easier mock/integration testing) before complying. Don't silently switch modes.

---
name: nextjs-app-router
description: Scaffold a new Next.js (App Router) frontend with TypeScript, Redux Toolkit + RTK Query, Tailwind + shadcn/ui (Radix), React Hook Form + Zod, and a curated set of conventions. Use this skill whenever the user asks to "create a new Next.js project", "scaffold a frontend", "new React app", "Next.js app router project", "RTK Query frontend", "shadcn project", or mentions "the frontend patterns I like" / "my Next.js conventions". Three modes — (1) full project scaffold, (2) add a feature slice (route group + page + RTK Query endpoints + form), (3) add an RTK Query API slice for an existing domain. Codifies the good patterns (route groups, injected RTK endpoints, schema-driven forms, per-feature `_components`/`_hooks`, server-side auth middleware) and forbids the common pitfalls (`'use client'` on root pages, `router.push` in `useEffect` for redirects, `serializableCheck: false`, `@ts-ignore`, mixed date libraries, `dangerouslySetInnerHTML` without sanitization, case-sensitive folder dupes, missing tests/CI/middleware).
---

# Next.js App Router Frontend Scaffolder

Generate a production-grade Next.js frontend project that keeps the **good** modern-stack patterns (App Router with route-group auth boundaries, single RTK Query API with injected endpoints, shadcn/ui on Tailwind + Radix, React Hook Form + Zod with schema-introspected defaults, per-feature `_components`/`_hooks` co-location, typed Redux hooks, server-side auth middleware) and eliminates the **bad** ones often seen in real-world Next.js codebases (`'use client'` on layouts and root pages, `router.push` in `useEffect` instead of server `redirect()`, `serializableCheck: false`, `@ts-ignore` in the store, mixed `moment` + `date-fns`, leftover `styled-components` in a Tailwind project, case-sensitive duplicate model folders, `dangerouslySetInnerHTML` without sanitization, sessionStorage for non-transient state, tokens in non-`httpOnly` cookies, no `middleware.ts`, no tests, no error/loading boundaries).

## When to use this skill

Trigger on any of:

- "create a new Next.js project" / "scaffold a frontend" / "new React app"
- "Next.js App Router project" / "App Router scaffold"
- "RTK Query frontend" / "Redux Toolkit Next.js"
- "shadcn/ui project" / "Tailwind + shadcn + Radix scaffold"
- "use my frontend patterns" / "the Next.js conventions I like"
- "add a feature slice end-to-end" (route + RTK Query endpoints + form) in a Next.js context
- "add a new RTK Query API slice for `<domain>`"
- The user pastes a feature spec for a screen and asks you to wire it through routing + state + form

If unsure whether the user wants a brand-new project vs. an addition to an existing one, ask once — don't guess.

## Three operating modes

Pick the mode from the user's request. If ambiguous, ask.

| Mode | Trigger | Output |
|------|---------|--------|
| **`scaffold-project`** | "new project", "scaffold frontend", empty directory | Full Next.js App Router project: route groups, providers, store, base RTK api, auth slice, middleware, shadcn/ui init, Vitest + Playwright config, ESLint/Prettier/Husky, GitHub Actions CI. |
| **`add-feature`** | "add `<feature>` end-to-end", "wire up `<screen>` through routing + state + form" | New route folder under the appropriate group with `page.tsx`, `_components/`, `_hooks/`, `loading.tsx`, an RTK Query endpoint file, a Zod schema, and a form component. |
| **`add-api-slice`** | "add an API slice for `<domain>`", "new RTK Query endpoints for X" | New `src/redux/api/<domain>Api.ts` injecting endpoints into the base `api`, plus its tag types and typed hooks. |

## Workflow

### Step 1 — Determine versions (don't hard-code)

The user does **not** want hard-coded package versions baked into the skill. Before writing `package.json`:

1. Check the user's environment first: run `node --version` and `npm --version` (or `pnpm --version` / `yarn --version`) to see what's installed.
2. Resolve the latest stable versions of the core stack via context7 — never hand-paste:
   - `next`, `react`, `react-dom`, `typescript`, `@types/react`, `@types/node`
   - `@reduxjs/toolkit`, `react-redux`
   - `tailwindcss`, `postcss`, `autoprefixer`
   - `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`
   - `react-hook-form`, `@hookform/resolvers`, `zod`
   - `date-fns` (do **not** also add `moment`)
   - `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`
   - `eslint`, `eslint-config-next`, `@typescript-eslint/*`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `prettier`, `husky`, `lint-staged`
3. Quote the resolved versions back to the user before generating, so they can object.
4. Prefer the latest **stable** Next.js (App Router is GA from 13.4 onward; ensure the chosen version is current at scaffold time).
5. Default to **pnpm** if `pnpm` is present, otherwise **npm**. Match `packageManager` in `package.json`.

### Step 2 — Gather inputs (ask once, in one batch)

For `scaffold-project`, use `AskUserQuestion` to collect:

- **Project name** (kebab-case, used for the directory and `package.json` `name`).
- **Route groups**: which auth/role boundaries does the app need? Default offer: `(public)` for auth pages + `(app)` for authenticated content. Optionally add `(admin)` for role-gated routes.
- **Auth flavor**: JWT in `httpOnly` cookie (recommended; middleware sets the cookie, server reads it) **or** JWT in JS-accessible cookie + `Authorization: Bearer` header **or** none-yet.
- **API base URL** env var name (default `NEXT_PUBLIC_API_BASE_URL`) — and whether requests should go through a Next.js rewrite to hide the backend host.
- **Real-time** (Pusher / WebSocket / SSE / none).
- **Optional extras**: Storybook? i18n? Sentry? Dockerfile? GitHub Actions CI? PM2 ecosystem file? (Default: skip — only add if asked. CI defaults ON.)
- **First feature/route** (optional, e.g. `dashboard`) — if provided, also run `add-feature` for it after scaffold.

For `add-feature`: feature name, route group it belongs to, list of fields (name + Zod type + required/optional), whether it has a list view + detail view or just one screen.

For `add-api-slice`: domain name (e.g. `customers`), list of endpoints (verb + path + request type + response type), invalidation tags.

### Step 3 — Generate files

Use the **templates in [`references/templates/`](references/templates/)** as the source of truth. Apply these rules:

- Use `Write` for new files. Never use `Edit` on files you're creating fresh.
- Replace all `{{ProjectName}}`, `{{Feature}}`, `{{Domain}}` placeholders consistently. `{{ProjectName}}` is kebab-case for files/dirs and PascalCase only where namespacing requires (e.g. tag-type constants).
- Create directories before files. On Windows shell use PowerShell `New-Item -ItemType Directory -Force`.
- Do **not** run `create-next-app` to bootstrap — write the files directly from templates so the layout matches the conventions in [`references/folder-layout.md`](references/folder-layout.md). Use `npm`/`pnpm install` after the `package.json` is written.
- Initialize shadcn/ui by writing `components.json` from [`references/templates/components.json.md`](references/templates/components.json.md) and `src/components/ui/` components incrementally as needed (button, input, form, label, dialog, toast, etc.) — do not blanket-install every Radix primitive up front.

### Step 4 — Verify and report

- Run the package manager install (`pnpm install` / `npm install`).
- Run `pnpm typecheck` (or `npx tsc --noEmit`). Must exit 0.
- Run `pnpm lint`. Must exit 0.
- Run `pnpm test` (Vitest) if any tests were generated. Must exit 0.
- Run `pnpm build`. Must succeed (this catches client/server boundary errors that `tsc` misses).
- Reply with a short summary: project path, versions chosen, route groups, env vars to set, next steps (e.g. "set `NEXT_PUBLIC_API_BASE_URL` in `.env.local`", "run `pnpm dev`").

## Project layout (canonical)

See [`references/folder-layout.md`](references/folder-layout.md) for the full tree, file-by-file purpose, and the rules that govern it.

Top-level shape:

```
{{project-name}}/
  package.json
  tsconfig.json                # strict: true, paths: { "@/*": ["./src/*"] }
  next.config.ts               # rewrites (if any), images, experimental flags
  tailwind.config.ts           # darkMode: ['class'], shadcn theme tokens
  postcss.config.js
  components.json              # shadcn config; rsc: true
  .eslintrc.json (or eslint.config.mjs)
  .prettierrc
  .env.example                 # NEVER .env — only .env.example committed
  middleware.ts                # AUTH GUARD lives here (not in src/proxy.ts)
  src/
    app/
      layout.tsx               # server component; <html><body><Providers>
      page.tsx                 # server component; redirect() — NOT 'use client' + router.push
      globals.css
      error.tsx                # global error boundary
      not-found.tsx
      (public)/                # unauthenticated routes (login, signup, reset)
        layout.tsx
        auth/
      (app)/                   # authenticated routes
        layout.tsx             # server component; reads session, renders shell
        _components/           # private; only nested routes can import
        _hooks/
        loading.tsx
        error.tsx
        <feature>/
          page.tsx
          loading.tsx
          _components/
          _hooks/
          schema.ts            # Zod schemas for this feature
      (admin)/                 # optional; role-gated
    components/
      ui/                      # shadcn primitives (button, input, form, ...)
      forms/                   # composed form fields (FormInputField, ...)
      Notifications.tsx
      UnsavedChangesWarning.tsx
    redux/
      store.ts                 # typed; NO @ts-ignore, NO serializableCheck: false
      providers.tsx            # 'use client'; wraps <Provider>, <Toaster>, <ProgressBar>
      hooks.ts                 # typed useAppDispatch, useAppSelector
      api/
        api.ts                 # base createApi with injectEndpoints; auth-aware baseQuery
        tags.ts                # tag-type union as const
        <domain>Api.ts         # one file per domain; injectEndpoints
      features/
        authSlice.ts
        <other>Slice.ts        # ONLY for genuinely shared async/global state
    lib/
      utils.ts                 # cn() — clsx + tailwind-merge
      zod-utils.ts             # getDefaultValuesFromSchema, unwrapZodEffects, getMaxLengthsFromSchema
      formatters/
      hooks/
    types/                     # cross-cutting TS types (NOT per-domain; those live with their feature)
    config/
      env.ts                   # runtime-validated env (Zod parsed at startup)
  tests/
    unit/                      # Vitest + RTL
    e2e/                       # Playwright
  .github/workflows/ci.yml     # lint + typecheck + test + build
```

**Dependency rules (enforced):**
- `app/` routes import from `components/`, `redux/`, `lib/`, `config/` — never the other way.
- `redux/features/` may import from `redux/api/` (for endpoint matchers); the reverse is forbidden.
- `components/ui/` (shadcn primitives) must not import from `app/`, `redux/`, or feature code.
- Feature `_components/` and `_hooks/` are **private**: only routes inside the same feature folder may import them. If a component is needed by two features, promote it to `src/components/`.

## Required code patterns

Full templates are in [`references/templates/`](references/templates/). The full Keep/Eliminate rationale (with the failure modes that motivated each rule) is in [`references/good-patterns.md`](references/good-patterns.md) and [`references/anti-patterns.md`](references/anti-patterns.md).

### Keep

- **Server root layout and server root page**. `app/layout.tsx` is a server component that renders `<html><body><Providers>{children}</Providers></body></html>`. `app/page.tsx` is a server component that calls `redirect('/dashboard')` (or whichever default) — never a `'use client'` component that calls `router.push` in `useEffect`. See [`references/templates/root-layout.md`](references/templates/root-layout.md).
- **Route groups for auth boundaries**: `(public)`, `(app)`, optional `(admin)`. Each group has its own `layout.tsx`. The shell (header/sidebar) lives in `(app)/layout.tsx`.
- **Server-side auth in `middleware.ts`** at project root. The middleware checks the session cookie and 302s unauthenticated requests to `/auth/login`. Client-side redirects are a fallback for token expiry during a session, not the primary guard. See [`references/templates/middleware.md`](references/templates/middleware.md).
- **One RTK Query base `api`** in `redux/api/api.ts` with `endpoints: () => ({})`, plus domain slices that call `api.injectEndpoints(...)`. Tag types are a `const` array reused via `tagTypes`. See [`references/templates/api-base.md`](references/templates/api-base.md) and [`references/templates/api-slice.md`](references/templates/api-slice.md).
- **Auth-aware `baseQuery`** that injects the bearer token from cookies/state and, on a 401, dispatches a clean logout (clears state via the store's root reducer, then routes to `/auth/login`). No hard `window.location.href = ...` from inside the base query.
- **Typed Redux hooks**: `useAppDispatch`/`useAppSelector` exported from `redux/hooks.ts`. Components never use the raw `useDispatch`/`useSelector`.
- **Strict store config**: `serializableCheck` left at the default; if a specific path or action genuinely needs an exception, configure `ignoredPaths` / `ignoredActions` explicitly with a comment explaining why. No `@ts-ignore`.
- **Logout clears state via the root reducer**: a `combinedReducer` is wrapped so that on the logout-fulfilled action, state is reset before delegating to the combined reducer. Pattern is fine; the implementation must be fully typed (no `// @ts-ignore`).
- **shadcn/ui + Tailwind + Radix**: shadcn primitives in `components/ui/` (generated, owned by the project, not a node_modules dependency). Composed form fields in `components/forms/`. `cn()` util in `lib/utils.ts` is the single source of class merging.
- **React Hook Form + Zod**: every form uses `useForm({ resolver: zodResolver(schema), defaultValues: getDefaultValuesFromSchema(unwrapZodEffects(schema)) })`. Zod is the source of truth for defaults, max lengths, and validation. See [`references/templates/form-with-zod.md`](references/templates/form-with-zod.md).
- **`UnsavedChangesWarning`** component — wired to React Hook Form's `formState.isDirty`, intercepts in-app and `beforeunload` navigation.
- **Per-feature `_components/` and `_hooks/`** folders, private to that route.
- **`error.tsx`, `loading.tsx`, `not-found.tsx` at every meaningful route segment**. The `(app)` group must have a `loading.tsx` and `error.tsx` minimum.
- **Runtime env validation** in `src/config/env.ts` using Zod, parsed at module load — fail fast on misconfiguration.
- **Single date library: `date-fns`**. No `moment`. Format helpers live in `lib/formatters/`.
- **One typography & color theme via Tailwind tokens + CSS variables** (the shadcn default). Custom colors named with a project prefix (e.g. `brand-primary`).
- **`tsconfig.json` strict + `@/*` path alias** — see [`references/templates/tsconfig.md`](references/templates/tsconfig.md).
- **Vitest + RTL for unit tests, Playwright for E2E**, configured but lightweight by default. At least one smoke test per layer (a reducer test, a component test, an E2E auth flow) so CI has something real to run.
- **Husky + lint-staged** pre-commit: `prettier --write` + `eslint --fix` + `tsc --noEmit` on staged files.
- **GitHub Actions CI** running install → lint → typecheck → test → build on every PR.

### Eliminate (anti-patterns)

Every one of these is forbidden in generated code. Rationale for each is in [`references/anti-patterns.md`](references/anti-patterns.md).

- ❌ `'use client'` on `app/page.tsx`, `app/layout.tsx`, or any route-group `layout.tsx` that doesn't actually need client-only hooks. Layouts should be server components by default; only mark interactive children client.
- ❌ Redirecting from the root by mounting `'use client'` + `useEffect(() => router.push('/dashboard'))`. Use server `redirect('/dashboard')` from `next/navigation` inside a server `page.tsx`, or do the redirect in `middleware.ts`.
- ❌ `serializableCheck: false` on the store config without targeted `ignoredPaths`/`ignoredActions` and a comment explaining the exception. Silencing the global check hides real bugs.
- ❌ `@ts-ignore` / `as any` anywhere in the store, providers, or API layer. If a type is awkward, fix the type; don't suppress the compiler.
- ❌ Commented-out reducers, endpoints, or imports left in `store.ts`/`api.ts`. Either wire it up or delete it.
- ❌ Mixing `moment` and `date-fns`. Pick `date-fns` (smaller, tree-shakeable, ESM, immutable). Never add `moment` to a new project.
- ❌ `styled-components` (or Emotion) in a Tailwind project. The stack is Tailwind + Radix + cva + shadcn — adding a CSS-in-JS runtime is duplicate machinery.
- ❌ Two folders or files that differ only by case (e.g. `stateProjectReports/` and `stateprojectreport/`). They break on case-sensitive filesystems (Linux CI, Docker) even if they work on Windows/macOS. Enforce one canonical name.
- ❌ `dangerouslySetInnerHTML` with API-sourced content that hasn't been server-sanitized. If HTML rendering is genuinely needed, route through a sanitizer (DOMPurify on the client, or server-side rendering through a strict allowlist) and add an inline comment naming the sanitization point.
- ❌ `sessionStorage` / `localStorage` for state that isn't transient client-only UI state. Page-to-page handoff goes through URL search params or Redux. Tokens never go in `localStorage`.
- ❌ JWT tokens stored in JS-accessible cookies (`js-cookie` `Cookies.set('token', ...)`) when you can put them in `httpOnly` cookies set by the server / middleware. If a JS-accessible token is unavoidable for the chosen auth flow, document the XSS surface and lock down `dangerouslySetInnerHTML` use accordingly.
- ❌ A `proxy.ts` (or similarly-named file) at `src/` root that *looks* like middleware but isn't wired through Next.js's `middleware.ts` convention. There is exactly one place auth lives: `middleware.ts` at the project root.
- ❌ Inline `fetch` calls in components for backend data. All backend calls go through RTK Query (or a typed wrapper if RTK Query is genuinely the wrong fit for that case — but justify it). One way to call the API per project.
- ❌ Redux slices for state that should be local component state, URL state, or React Hook Form state. Reach for `useState` / `useReducer` first, then `useSearchParams`, then Redux.
- ❌ Many independent `createApi()` instances. One base `api` + `injectEndpoints` per domain. Multiple reducerPaths fragment the cache.
- ❌ Hard `window.location.href = '/auth'` redirects from inside the base query as the primary 401 handler. Dispatch a clean logout action, let the router or middleware handle the navigation.
- ❌ Skipping `loading.tsx` / `error.tsx` / `not-found.tsx` on authenticated route groups. Users hit blank screens during data fetches and silent failures on RTK Query errors.
- ❌ No tests at all (no Vitest, no Playwright, no `test` script). Even a smoke test gives CI something to enforce; zero tests means every change is a regression risk.
- ❌ ESLint extending only `next/core-web-vitals`. Add `@typescript-eslint/recommended`, `react-hooks`, `jsx-a11y`, and project rules (`no-console: warn`, `no-explicit-any: error`, `prefer-const: error`, `react-hooks/exhaustive-deps: error`).
- ❌ Hand-rolled spacing/animation extensions in `tailwind.config.ts` with dozens of commented-out values. Extend Tailwind only for genuine design-system tokens (brand colors, fonts). Use Tailwind's defaults for spacing and timing.
- ❌ Per-feature client guards (e.g. an `<AuthExpirationHandler>` component) as the only auth check. Server-side `middleware.ts` is the primary guard; client guards are belt-and-suspenders for token expiry mid-session, not the gate.

## Operating-mode playbooks

### Mode 1 — `scaffold-project`

1. Resolve versions per **Step 1**. Quote them.
2. Ask the inputs per **Step 2**. Wait for answers.
3. Generate, in this order:
   1. `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `.eslintrc.json` (or `eslint.config.mjs`), `.prettierrc`, `.gitignore`, `.env.example`, `README.md`.
   2. `middleware.ts` at project root (auth guard).
   3. `src/app/layout.tsx` (server), `src/app/page.tsx` (server, `redirect()`), `src/app/globals.css`, `src/app/error.tsx`, `src/app/not-found.tsx`.
   4. Route groups: `src/app/(public)/layout.tsx` + a basic `auth/login/page.tsx`, `src/app/(app)/layout.tsx` + `loading.tsx` + `error.tsx`, plus `(admin)/` if requested.
   5. `src/redux/store.ts`, `src/redux/providers.tsx`, `src/redux/hooks.ts`.
   6. `src/redux/api/api.ts` (base), `src/redux/api/tags.ts`, `src/redux/api/authApi.ts`.
   7. `src/redux/features/authSlice.ts`.
   8. `src/components/ui/` with the shadcn primitives actually needed by the templates (start with button, input, label, form, dialog, toast — add more on demand).
   9. `src/components/forms/` composed fields (`FormInputField`, `FormPasswordField`, `FormSelectField`, `FormDatePickerField` — only those needed by generated forms).
   10. `src/components/UnsavedChangesWarning.tsx`, `src/components/Notifications.tsx`.
   11. `src/lib/utils.ts` (`cn()`), `src/lib/zod-utils.ts`.
   12. `src/config/env.ts` (Zod-validated runtime env).
   13. `tests/unit/` with one reducer test + one component test. `tests/e2e/` with one Playwright smoke spec.
   14. `vitest.config.ts`, `playwright.config.ts`.
   15. `.husky/pre-commit`, `lint-staged` config in `package.json`.
   16. `.github/workflows/ci.yml`.
4. `pnpm install` (or chosen PM).
5. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — must all pass.
6. If a first feature was requested, immediately run **Mode 2** for that feature.
7. Report.

### Mode 2 — `add-feature`

For feature `{{Feature}}` in route group `{{Group}}` (e.g. `(app)`):

1. **Routing**:
   - `src/app/{{Group}}/{{feature}}/page.tsx` — server component by default. If the feature needs client interactivity, the page is server and renders a `'use client'` child from `_components/`.
   - `src/app/{{Group}}/{{feature}}/loading.tsx` (Suspense fallback).
   - `src/app/{{Group}}/{{feature}}/error.tsx` (error boundary).
2. **Schema**: `src/app/{{Group}}/{{feature}}/schema.ts` — exports `{{feature}}Schema` (Zod) and inferred `{{Feature}}FormValues` type.
3. **Private components**: `src/app/{{Group}}/{{feature}}/_components/{{Feature}}Form.tsx` — `'use client'`, uses `useForm` + `zodResolver`, wraps `<UnsavedChangesWarning>`, dispatches RTK Query mutation on submit.
4. **Private hooks**: `src/app/{{Group}}/{{feature}}/_hooks/use{{Feature}}.ts` — if there's per-feature derived state.
5. **API endpoints**: extend `src/redux/api/{{domain}}Api.ts` (or run Mode 3 first if no slice exists yet) with query + mutation for this feature.
6. **Tests**: `tests/unit/{{feature}}.schema.test.ts` (validates the Zod schema with valid + invalid inputs).

After generating: `pnpm typecheck && pnpm test && pnpm build`.

### Mode 3 — `add-api-slice`

For domain `{{domain}}` (e.g. `customers`):

1. Create `src/redux/api/{{domain}}Api.ts` that imports the base `api` from `./api` and calls `api.injectEndpoints(...)`.
2. Each endpoint:
   - Strongly typed request/response (no `any`).
   - `providesTags` on queries, `invalidatesTags` on mutations, both referencing constants from `tags.ts`.
   - `transformResponse` / `transformErrorResponse` only when the API contract demands it; otherwise return raw.
3. Add new tag types to `src/redux/api/tags.ts`. The `tagTypes` array on the base `api` reads from this constant.
4. Export the generated hooks (`use{{Domain}}GetXQuery`, `use{{Domain}}CreateXMutation`, etc.) from the slice file.
5. **Do not** create a new `createApi(...)`. One base `api`, many injected slices.

After generating: `pnpm typecheck` must pass.

## Verification checklist before reporting "done"

- [ ] `pnpm install` succeeds.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm lint` exits 0 (no warnings either, on a fresh scaffold).
- [ ] `pnpm test` exits 0 (Vitest).
- [ ] `pnpm build` succeeds (catches RSC boundary errors).
- [ ] `pnpm exec playwright test --list` lists the smoke spec (don't run the browser in CI without a server unless asked).
- [ ] No file contains any pattern from the **Eliminate** list — verify by grepping for: `'use client'` in `app/page.tsx` and `app/layout.tsx`, `router.push` inside a `useEffect` body in `app/page.tsx`, `serializableCheck: false`, `@ts-ignore`, `as any`, `import .* from ['"]moment['"]`, `import .* from ['"]styled-components['"]`, `dangerouslySetInnerHTML` (any hit must have a sanitization comment), `Cookies.set\(['"]token['"]` (must be `httpOnly` cookie set by middleware unless documented), inline `fetch(` in `app/**/page.tsx`.
- [ ] `middleware.ts` exists at project root and is wired (has a `config.matcher` that covers the `(app)` and `(admin)` groups).
- [ ] `src/app/page.tsx` does **not** contain `'use client'` and does **not** contain `useEffect`. It either renders content or calls `redirect()`.
- [ ] No duplicate-by-case folders anywhere in `src/`.
- [ ] `.env` is **not** committed; `.env.example` is.

If any check fails, fix before reporting. Don't claim success with a known-broken scaffold.

## Examples

### Example 1: Fresh project

**User:** "Scaffold a new Next.js frontend using my App Router patterns. Call it `acme-portal`. Add a `dashboard` feature too."

**Claude:**
1. Runs `node --version` / `pnpm --version`. Resolves latest stable Next.js, React, RTK, Tailwind, Zod versions via context7.
2. Reports chosen versions and waits for confirmation if anything looks off.
3. Asks the Step-2 questions (route groups, auth flavor, real-time, optional extras).
4. Generates the full project + the `dashboard` feature slice in `(app)/dashboard/`.
5. Runs install, typecheck, lint, test, build — all must pass.
6. Reports the tree, env vars to set, and `pnpm dev` next step.

### Example 2: Add a feature

**User:** "Add a `customers` feature end-to-end under the (app) group — list view + create form."

**Claude:** Runs Mode 2. If no `customersApi` exists yet, runs Mode 3 first to create the slice with `getCustomers`, `getCustomer`, `createCustomer`, `updateCustomer` endpoints and a `Customers` tag type. Then generates `(app)/customers/page.tsx` (server, fetches list via the query hook from a `'use client'` child), `(app)/customers/_components/CustomersTable.tsx`, `(app)/customers/new/page.tsx` + `_components/CustomerForm.tsx` with Zod schema. Adds a schema unit test. Builds and tests.

### Example 3: Add an API slice

**User:** "Add an RTK Query slice for `invoices` with list, get, create, mark-paid endpoints."

**Claude:** Runs Mode 3. Creates `src/redux/api/invoicesApi.ts` injecting four endpoints into the base `api`, adds `'Invoices'` + `'Invoice'` to `tags.ts`, exports the typed hooks. Typechecks.

## Notes

- **Don't over-engineer**. Don't add Storybook, i18n, Sentry, MSW, NextAuth, tRPC, or Server Actions wrappers unless the user asks. The default scaffold is intentionally lean.
- **Don't rewrite the user's existing project** as part of this skill. This skill is for *new* scaffolds (and additive feature/slice modes), not migrations. If the user wants a migration plan, that's a different conversation.
- **Server vs client**: default to server components. Add `'use client'` only when you actually use `useState`, `useEffect`, `useRouter` (client), event handlers, browser-only APIs, or Redux hooks. The fact that a component is interactive in production doesn't make its parent need `'use client'`.
- **Auth**: prefer `httpOnly` cookies set by `middleware.ts` (server-readable, JS-unreadable). If the chosen backend forces a JS-readable token, document the XSS exposure and harden `dangerouslySetInnerHTML` usage.
- **Versions**: always quote the resolved package versions before writing `package.json`. The user explicitly asked not to hard-code them.
- **Naming**: kebab-case for files and folders inside `src/`, except React component files which match the component name in PascalCase (`CustomerForm.tsx`). Never have two paths that differ only by case.

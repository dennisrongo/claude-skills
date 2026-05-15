# Anti-patterns to Eliminate

Each entry below explains **what** the pattern looks like in the wild, **why** it's bad, and **what to do instead**. The skill must not emit any of these. If a user explicitly requests one, push back with the rationale before complying.

## 1. `'use client'` on the root page with a `useEffect(() => router.push(...))` redirect

```tsx
// app/page.tsx — BAD
'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
export default function Home() {
  const router = useRouter();
  useEffect(() => { router.push('/dashboard'); });
}
```

**Why bad:**
- The page renders blank HTML on first load (no SSR content), so Open Graph crawlers, SEO, and link-preview tools see nothing.
- Causes a visible flash (empty page → JS hydrate → navigate).
- Costs an extra client navigation that could have been a 308 from the server.
- Defeats Next.js's built-in `redirect()` machinery.

**Do instead:**

```tsx
// app/page.tsx — GOOD
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/dashboard');
}
```

Or handle it in `middleware.ts` if the redirect target depends on auth/session.

## 2. `'use client'` on `app/layout.tsx` or route-group `layout.tsx`

Marking a layout `'use client'` opts the entire subtree into client rendering and disables streaming, server data fetches, and `metadata` exports from descendants. Layouts should stay server components; push the client-only chrome (`AppShell`, `Sidebar`) into a `'use client'` child component imported from `_components/`.

## 3. `serializableCheck: false` (or `immutableCheck: false`)

```ts
// store.ts — BAD
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({ serializableCheck: false }).concat(api.middleware),
```

**Why bad:** silences a class of real bugs (Dates, Maps, class instances, callbacks accidentally placed in actions or state). Once off, you stop noticing the next non-serializable value that slips in.

**Do instead:** keep the default. If one specific path or action genuinely holds a non-serializable value, scope the exception:

```ts
serializableCheck: {
  ignoredPaths: ['auth.expiresAt'],
  ignoredActions: ['someApi/executeMutation/fulfilled'],
},
```

…and leave a comment naming what's stored there and why it can't be a plain value.

## 4. `@ts-ignore` / `as any` in the store, providers, or API layer

These are the load-bearing files of the entire app. If TypeScript is unhappy with them, the types are wrong — fix them. Use `satisfies`, narrow the inferred type, or extract a typed helper. `@ts-ignore` here hides real type breakage from refactors.

## 5. Commented-out reducers, endpoints, imports

`store.ts` that imports `authApi` and `dashboardApi` but commented out the lines that register their reducers in `combineReducers` is a half-finished refactor pretending to be code. Either wire it up or delete it. The git history is the right place for "we used to do this."

## 6. `moment` alongside `date-fns`

`moment` is in maintenance mode, mutable, and ships ~300 KB minified. `date-fns` is tree-shakeable, immutable, and ESM. Mixing them means two date libraries to learn, two timezone behaviors to reconcile, and two bundles in the user's tab. Pick `date-fns` for new projects.

## 7. `styled-components` (or Emotion) in a Tailwind project

The stack is Tailwind utilities + Radix primitives + `class-variance-authority` for variants + `cn()` for merging. Adding a CSS-in-JS runtime gives you two styling systems, two specificity stories, and a hydration cost. If a `styled-components` import sneaks in (often from copied legacy code), remove it.

## 8. Duplicate-by-case folders or files

`src/models/stateProjectReports/` and `src/models/stateprojectreport/` work on Windows (case-insensitive) and break on Linux (case-sensitive). Imports resolve to one or the other depending on which the bundler sees first, producing "works on my machine" bugs that surface only in CI or production. Enforce one canonical casing.

## 9. `dangerouslySetInnerHTML` without server-side sanitization

```tsx
<div dangerouslySetInnerHTML={{ __html: apiResponse.body }} />
```

If `apiResponse.body` is anything other than provably safe (e.g., a static template you control), this is an XSS vector. The fix is layered:

1. Prefer rendering as JSX / Markdown via a strict renderer (no raw HTML).
2. If raw HTML is genuinely required, sanitize at the source — server-side allowlist, or DOMPurify on the client with a configured profile.
3. Add an inline comment naming the sanitization point so the next reviewer knows it isn't accidental.

A scaffolded project should not contain any `dangerouslySetInnerHTML` calls; if a feature genuinely needs one, add it with the comment above.

## 10. `sessionStorage` / `localStorage` for non-transient state

`sessionStorage.setItem('wizardStep', JSON.stringify(state))` is a shortcut that almost always grows into a bug:
- Not SSR-safe (`ReferenceError: sessionStorage is not defined`).
- Survives tab refreshes but not new tabs — confusing for users.
- Easy to forget to clear, leading to stale state in later sessions.

**Do instead:**
- Multi-step wizard state → URL search params (`useSearchParams`) so it's shareable and back-button-safe, or Redux if it must be shared across routes.
- Token persistence → `httpOnly` cookies (server-set), never `localStorage`.
- Truly transient UI state → component state.

## 11. JWT in a JS-accessible cookie or `localStorage`

A token in `js-cookie` or `localStorage` is reachable from any XSS payload that lands on the page. The mitigation is `httpOnly` cookies (the browser sends them with requests, but JS cannot read them):

- The login endpoint should set the cookie via a server response header.
- `middleware.ts` reads the cookie on the server to gate routes.
- RTK Query sends the cookie automatically via `credentials: 'include'` on `fetch`.

If the chosen backend cannot set cookies and forces a `Authorization: Bearer` flow with a client-readable token, document the XSS surface in the project README and treat every `dangerouslySetInnerHTML`, `eval`, or untrusted third-party script as a P1 risk.

## 12. A `src/proxy.ts` (or equivalent) standing in for `middleware.ts`

Next.js has exactly one place that intercepts requests at the network boundary: `middleware.ts` at the project root. A file named `src/proxy.ts` that imports `next/server` and exports a function but isn't wired into the framework is dead code that *looks* like a guard. Either move its logic into `middleware.ts` or delete it.

## 13. Inline `fetch` in components

```tsx
useEffect(() => {
  fetch('/api/customers').then(r => r.json()).then(setData);
}, []);
```

This bypasses the cache, retries, error handling, devtools integration, and tag-based invalidation that RTK Query gives you for free. It also produces inconsistent loading/error UX across the app. All backend calls go through RTK Query. If a single specific case genuinely needs raw `fetch` (e.g., streaming a file download), justify it in a comment.

## 14. Redux for local / URL / form state

If a piece of state is:
- Only read inside one component → `useState` / `useReducer`.
- Shareable via URL (filters, page numbers, selected tab) → `useSearchParams`.
- Form values → React Hook Form's internal state.

Reach for Redux only when state is genuinely shared across routes/components and isn't already covered by an RTK Query cache. `directoryResultsSlice`-style slices that hold the last list-view filter set are usually a smell.

## 15. Many independent `createApi(...)` instances

```ts
export const authApi = createApi({ reducerPath: 'auth', ... });
export const customersApi = createApi({ reducerPath: 'customers', ... });
export const invoicesApi = createApi({ reducerPath: 'invoices', ... });
```

Each instance has its own reducer path, middleware, cache, and tag-type set. They cannot invalidate each other's queries by tag. The right pattern is one base `api` with `injectEndpoints` per domain.

## 16. `window.location.href = '/auth/login'` from inside `baseQuery` for 401

It works, but:
- Loses unsaved form state.
- Forces a full page reload (re-downloads JS, re-hydrates Redux).
- Race conditions when multiple in-flight requests all hit 401 at once.

**Do instead:** dispatch a `logout` action; let the root reducer reset state cleanly; let `middleware.ts` (which now sees no session) handle the redirect on the next request, or call `router.replace('/auth/login')` from a single coordinator. Keep the hard `window.location` redirect only as a last-resort fallback.

## 17. Missing `error.tsx` / `loading.tsx` / `not-found.tsx`

The `(app)` group needs at minimum:
- `loading.tsx` — shown by Suspense while server components fetch.
- `error.tsx` — caught for runtime errors and RTK Query failures bubbling through `unwrap()`.
- `not-found.tsx` — for 404s from `notFound()` calls and unmatched routes.

Without these, the user sees a blank screen or the global error boundary, both of which are worse UX than a typed empty state.

## 18. No tests at all

A `package.json` with no `test` script tells you nobody runs anything before merging. Even a single reducer test, a single form-renders test, and a single Playwright login spec give CI something to enforce and break loudly when something regresses. The bar is "smoke tests exist," not "100% coverage."

## 19. ESLint extending only `next/core-web-vitals`

The Next preset is good but minimal. Add at least:
- `@typescript-eslint/recommended` (or `recommended-type-checked` if your CI has the budget).
- `plugin:react-hooks/recommended` — catches the missing-deps and Rules-of-Hooks bugs that `next/core-web-vitals` does not.
- `plugin:jsx-a11y/recommended` — accessibility lint.
- Project rules: `no-console: ['warn', { allow: ['warn', 'error'] }]`, `@typescript-eslint/no-explicit-any: 'error'`, `react-hooks/exhaustive-deps: 'error'`, `prefer-const: 'error'`.

## 20. Over-extended Tailwind config

`tailwind.config.ts` that adds 50+ custom spacing tokens, half of them commented out, and three custom animation timing functions, is design-system debt waiting to bite. Extend Tailwind for:
- Brand colors (named with a project prefix).
- Custom fonts.
- Genuine design tokens you reuse.

Use the defaults for everything else.

## 21. Per-feature client guards as the only auth check

A `<AuthExpirationHandler>` that the app shell mounts and that runs `if (!token) router.push('/auth/login')` on an interval is a belt; it is not the only line of defense. The primary auth check is `middleware.ts`, server-side, before the route renders. Client guards exist for session expiry while the user is already inside the app.

## 22. PM2 / `ecosystem.config.js` without considering simpler hosting

If the target deploy is Vercel / Cloudflare / Netlify / any container orchestrator, the PM2 process file is unused weight. Add it only when the user explicitly asks for a VM-style `node`/`next start` deployment.

## 23. Hand-rolled custom `proxy.ts` config when Next.js rewrites would do

If the goal is "the frontend calls `/api/...` and Next.js forwards to a backend," use `next.config.ts` `rewrites()` — not a custom request-interception file.

## 24. Mixing client navigation libraries

`next-nprogress-bar` is fine for the top loading bar; don't also pull in `nprogress` or a second router-event listener. Pick one progress UI.

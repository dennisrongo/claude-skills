# Anti-patterns to Eliminate

Each entry below explains **what** the pattern looks like in the wild, **why** it's bad, and **what to do instead**. The skill must not emit any of these. If a user explicitly requests one, push back with the rationale before complying.

> **About the SPA-style choice.** This project is deliberately API-driven, not SSR. Pages are `'use client'`. Data goes through RTK Query → Route Handlers. That choice eliminates a whole class of "is this server or client?" bugs, makes mocking trivial in tests, and keeps a clean frontend/backend split with an explicit HTTP seam. Several anti-patterns below exist *because* of that choice — they're not absolute rules in every Next.js project, but they are absolute rules in this one.

## 1. `fetch()` or `await db.*` inside a server component

```tsx
// app/(app)/dashboard/page.tsx — BAD
export default async function DashboardPage() {
  const stats = await db.stats.findMany();
  return <Dashboard stats={stats} />;
}
```

**Why bad:** the app is API-driven by deliberate choice. SSR data fetching breaks the one-way data flow (UI → RTK Query → /api → DB), produces a different code path in production than in dev (server fetch vs. browser fetch), defeats RTK Query's caching/devtools/invalidation, and makes integration tests harder because you now have two ways to load data.

**Do instead:** make the page `'use client'` and call `useGetStatsQuery()` from `src/redux/api/statsApi.ts`. The matching `src/app/api/stats/route.ts` does the `db.*` call.

## 2. `'use server'` directive (Server Actions)

```tsx
// BAD
'use server';
export async function createCustomer(formData: FormData) { ... }
```

**Why bad:** Server Actions are a second mutation path competing with RTK Query mutations. The project picks one. Mixed projects develop "do we do this with an Action or a mutation?" cargo-culting, two error-handling stories, two loading-state stories, and two places to forget the auth check.

**Do instead:** mutations are RTK Query mutations calling a Route Handler. The handler does `await auth()` + Zod validation + Prisma write.

## 3. `async function Page` in any `page.tsx`

Pages are `'use client'` and synchronous. The body uses RTK Query hooks. If you see `export default async function ...Page(...)` you've reintroduced SSR data fetching by accident.

## 4. `redirect()` from a server `page.tsx` as the auth gate

```tsx
// BAD
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
export default async function AppLayout({ children }) {
  const session = await auth();
  if (!session) redirect('/auth/login');
  return <>{children}</>;
}
```

**Why bad:** belt-and-suspenders auth fragmented across layout files. The gate is `middleware.ts`. A layout-level `redirect` runs *after* the page is requested (more work for nothing) and gives no consistent behavior across routes.

**Do instead:** `middleware.ts` re-exports (or wraps) `auth` from `src/auth.config.ts`. Unauthenticated requests to protected paths are 302'd before any layout renders. Layouts assume they're authenticated when they render.

## 5. Custom JWT-in-`httpOnly`-cookie schemes alongside NextAuth

```ts
// BAD — competing with NextAuth
cookies().set('session', signToken(user), { httpOnly: true, ... });
```

**Why bad:** two auth systems in one app. NextAuth already manages the session cookie; rolling your own next to it gives you race conditions on logout (which cookie wins?), two refresh stories, two CSRF stories, and a guaranteed bug when the user signs out from one but not the other.

**Do instead:** NextAuth is the only auth system. If you need extra state on the session (role, org), add a `jwt` callback in `src/auth.ts` that augments the token.

## 6. Decoding the NextAuth JWT manually on the client

```tsx
// BAD
const token = document.cookie.match(/next-auth.session-token=([^;]+)/)?.[1];
const claims = jwtDecode(token!);
```

**Why bad:** the cookie is `httpOnly` by default (it shouldn't even be readable from JS). Even if it weren't, decoding ≠ verifying. Use the official hook — it handles refresh, expiry, and SSR-safe rendering.

**Do instead:** `const { data: session } = useSession()` from `next-auth/react`. Server-side (Route Handlers): `const session = await auth()`.

## 7. `serializableCheck: false` (or `immutableCheck: false`)

```ts
// store.ts — BAD
middleware: (getDefaultMiddleware) =>
  getDefaultMiddleware({ serializableCheck: false }).concat(api.middleware),
```

**Why bad:** silences a class of real bugs (Dates, Maps, class instances, callbacks accidentally placed in actions or state). Once off, you stop noticing the next non-serializable value that slips in.

**Do instead:** keep the default. If one specific path or action genuinely holds a non-serializable value, scope the exception:

```ts
serializableCheck: {
  ignoredPaths: ['someFeature.someDate'],
  ignoredActions: ['someApi/executeMutation/fulfilled'],
},
```

…and leave a comment naming what's stored there and why it can't be a plain value.

## 8. `@ts-ignore` / `as any` in the store, providers, API layer, or Route Handlers

These are the load-bearing files of the entire app. If TypeScript is unhappy with them, the types are wrong — fix them. Use `satisfies`, narrow the inferred type, or extract a typed helper. `@ts-ignore` here hides real type breakage from refactors.

## 9. Commented-out reducers, endpoints, imports

`store.ts` that imports `authApi` and `dashboardApi` but commented out the lines that register their reducers is a half-finished refactor pretending to be code. Either wire it up or delete it. Git history is the right place for "we used to do this."

## 10. `moment` alongside `date-fns`

`moment` is in maintenance mode, mutable, and ships ~300 KB minified. `date-fns` is tree-shakeable, immutable, and ESM. Pick `date-fns`.

## 11. `styled-components` (or Emotion) in a Tailwind project

The stack is Tailwind utilities + Radix primitives + `class-variance-authority` for variants + `cn()` for merging. Adding a CSS-in-JS runtime gives you two styling systems, two specificity stories, and a hydration cost.

## 12. Duplicate-by-case folders or files

`src/models/UserProfile/` and `src/models/userprofile/` work on Windows (case-insensitive) and break on Linux (case-sensitive). Enforce one canonical casing.

## 13. `dangerouslySetInnerHTML` without server-side sanitization

If `apiResponse.body` is anything other than provably safe, this is an XSS vector. Fix layered:

1. Prefer rendering as JSX / Markdown via a strict renderer (no raw HTML).
2. If raw HTML is genuinely required, sanitize at the source — server-side allowlist in the Route Handler, or DOMPurify on the client with a configured profile.
3. Inline comment naming the sanitization point.

A scaffolded project should not contain any `dangerouslySetInnerHTML` calls.

## 14. `sessionStorage` / `localStorage` for non-transient state

- Not SSR-safe (`ReferenceError: sessionStorage is not defined`).
- Survives tab refreshes but not new tabs.
- Easy to forget to clear.

**Do instead:** URL search params for shareable state, Redux for cross-route state, component state for transient UI. Tokens never go in `localStorage` — NextAuth's cookie is `httpOnly`.

## 15. JWT in a JS-accessible cookie or `localStorage`

A token in `localStorage` is reachable from any XSS payload. NextAuth's session cookie is `httpOnly` by default — leave it that way. Do not add `js-cookie` and write parallel auth state to a readable cookie.

## 16. A hand-rolled interceptor file (e.g. `src/proxy.ts`) standing in for `middleware.ts`

Next.js has exactly one place that intercepts requests: `middleware.ts` at the project root. Any file that imports `next/server` and exports a request-guard function but isn't wired into the framework is dead code that *looks* like a guard. Either move its logic into `middleware.ts` or delete it.

## 17. Inline `fetch` in components

```tsx
useEffect(() => {
  fetch('/api/customers').then(r => r.json()).then(setData);
}, []);
```

This bypasses the cache, retries, error handling, devtools, and tag-based invalidation that RTK Query gives you for free. **All** backend calls go through RTK Query.

## 18. Redux for local / URL / form state

If a piece of state is:
- Only read inside one component → `useState` / `useReducer`.
- Shareable via URL (filters, page numbers, selected tab) → `useSearchParams`.
- Form values → React Hook Form's internal state.
- Session/user info → `useSession()` from `next-auth/react`.

Reach for Redux only when state is genuinely shared across routes and isn't already covered by an RTK Query cache or NextAuth.

## 19. Many independent `createApi(...)` instances

```ts
export const authApi = createApi({ reducerPath: 'auth', ... });
export const customersApi = createApi({ reducerPath: 'customers', ... });
```

Each instance has its own cache and tag-type set; they can't invalidate each other. One base `api` with `injectEndpoints` per domain.

## 20. `window.location.href = '/auth/login'` from inside `baseQuery` for 401

Loses unsaved form state, full page reload, race conditions when multiple in-flight requests 401 at once.

**Do instead:** call `signOut({ callbackUrl: '/auth/login', redirect: true })` from `next-auth/react` inside the base query's 401 branch. NextAuth clears the cookie and routes cleanly.

## 21. Multiple `PrismaClient` instances

```ts
// some-route.ts — BAD
const prisma = new PrismaClient();
```

Every dev hot-reload spawns a new client and burns through Postgres connections. Use the singleton:

```ts
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

…and every handler imports `db` from there.

## 22. Route Handlers without `await auth()`

```ts
// app/api/customers/route.ts — BAD
export async function GET() {
  const customers = await db.customer.findMany();
  return Response.json(customers);
}
```

Anyone with the URL can read every customer. **Every** handler (except `/api/auth/[...nextauth]` and explicit public endpoints like `/api/health`) calls `requireSession()` (or `await auth()`) first and 401s on absence. Use the helper in `src/lib/api-auth.ts`.

## 23. Route Handlers that trust client-sent user IDs for ownership

```ts
// BAD
const { userId, ...data } = await req.json();
await db.customer.create({ data: { ...data, userId } });
```

A logged-in user can write under any other user's ID by lying in the request body. Read the user ID from the session:

```ts
const session = await requireSession();
await db.customer.create({ data: { ...validated, userId: session.user.id } });
```

Ownership reads use `where: { id, userId: session.user.id }` so a stranger's record returns 404 / null, not someone else's data.

## 24. `prisma db push` in CI or against shared databases

`db push` skips the migration history. Two engineers running `db push` against different branches produce divergent schemas that aren't represented in `prisma/migrations/`. Use `prisma migrate dev` in development and `prisma migrate deploy` in CI. `db push` is only for local prototyping you're about to throw away.

## 25. `prisma migrate reset` without explicit user confirmation

Drops the database. The skill never runs this unprompted. If the user asks for it, confirm and pause for a verbal "yes."

## 26. Missing `error.tsx` / `loading.tsx` on the `(app)` group

Without these the user sees a blank screen during RTK Query loads and the global error boundary on any unwrap failure.

## 27. No tests at all

A `package.json` with no `test` script means nothing gets enforced before merge. The bar is "smoke tests exist": one schema test, one component test, one E2E auth flow.

## 28. ESLint extending only `next/core-web-vitals`

Add `@typescript-eslint/recommended`, `react-hooks/recommended`, `jsx-a11y/recommended`, plus project rules (`no-console: warn`, `no-explicit-any: error`, `exhaustive-deps: error`, `prefer-const: error`).

## 29. Over-extended Tailwind config

50+ custom spacing tokens, three custom animation timings — design-system debt. Extend Tailwind only for brand colors, custom fonts, and genuine design tokens.

## 30. Per-feature client guards as the only auth check

A client component polling session expiry on an interval is **not** the primary guard. The primary guard is `middleware.ts`. Client guards exist to handle session expiry mid-app — belt-and-suspenders, not the gate.

## 31. PM2 / `ecosystem.config.js` without considering simpler hosting

If the target is Vercel / Cloudflare / a container orchestrator, PM2 is unused weight. Add only when the user explicitly asks for VM-style hosting.

## 32. Importing the Prisma adapter (or `@/lib/db`) inside `src/auth.config.ts`

`auth.config.ts` is consumed by `middleware.ts`, which runs on the Edge runtime. Edge cannot import the Prisma client (Node-only). If you accidentally import `@/lib/db` into `auth.config.ts`, the production build fails with a confusing "module not found in edge runtime" error.

**Rule:** `auth.config.ts` has providers + callbacks only. `auth.ts` imports `auth.config.ts`, adds the adapter, and exports the runtime objects. Middleware imports from `auth.config.ts` (or from a thin Edge-safe shim).

## 33. `'use server'` anywhere

Listed again because it matters. Grep `src/` for `'use server'` before reporting "done" — any hit is a bug.

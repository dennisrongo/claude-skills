# Canonical Folder Layout

This is the source-of-truth tree for a new project. Every file/folder listed here exists in a scaffolded project unless the user opted out. The skill must not reorganize this layout when adding features.

```
{{project-name}}/
├── .env.example                      # committed; documents required env vars (no secrets)
├── .eslintrc.json                    # or eslint.config.mjs — strict TS + a11y + hooks
├── .gitignore
├── .husky/
│   └── pre-commit                    # runs lint-staged
├── .prettierrc
├── README.md
├── components.json                   # shadcn config; rsc: true, tsx: true
├── docker-compose.yml                # OPTIONAL — only when user picked "local Docker" DB host
├── middleware.ts                     # NextAuth-driven route gate. Project-root, framework convention.
├── next.config.ts
├── next-env.d.ts                     # generated; do not edit
├── package.json                      # scripts: dev, build, start, lint, typecheck, test, test:e2e, db:*
├── playwright.config.ts
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json                     # strict + @/* alias
├── vitest.config.ts
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # install → lint → typecheck → test → build (with Postgres service)
│
├── prisma/
│   ├── schema.prisma                 # NextAuth tables (User/Account/Session/VerificationToken) + domain models
│   ├── migrations/                   # generated; CHECKED IN — these are the source of truth
│   │   └── <timestamp>_init/
│   │       └── migration.sql
│   └── seed.ts                       # OPTIONAL — seeds test user(s) for Credentials provider
│
├── public/                           # static assets only (favicons, robots.txt, og images)
│   └── favicon.ico
│
├── src/
│   ├── auth.ts                       # NextAuth (Auth.js v5) full config — adapter + providers + callbacks
│   ├── auth.config.ts                # Edge-safe config (no DB / no adapter imports) — for middleware
│   │
│   ├── app/
│   │   ├── layout.tsx                # SERVER — the ONE server component in the app. <html><body><Providers>
│   │   ├── error.tsx                 # global error boundary ('use client')
│   │   ├── not-found.tsx
│   │   ├── globals.css
│   │   ├── favicon.ico               # (optional duplicate of public/)
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts      # export { GET, POST } from NextAuth handlers
│   │   │   ├── <domain>/
│   │   │   │   ├── route.ts          # GET (list) + POST (create) — both call requireSession()
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts      # GET + PATCH + DELETE
│   │   │   └── health/
│   │   │       └── route.ts          # OPTIONAL — unauthenticated readiness probe
│   │   │
│   │   ├── (public)/                 # unauthenticated routes
│   │   │   ├── layout.tsx            # SERVER. minimal chrome (centered card).
│   │   │   └── auth/
│   │   │       ├── login/
│   │   │       │   ├── page.tsx                  # 'use client'
│   │   │       │   └── _components/LoginForm.tsx # 'use client'; calls signIn('credentials', {...})
│   │   │       ├── signup/                       # OPTIONAL — only when Credentials + signup enabled
│   │   │       │   ├── page.tsx                  # 'use client'
│   │   │       │   └── _components/SignupForm.tsx
│   │   │       └── error/
│   │   │           └── page.tsx                  # NextAuth /auth/error landing
│   │   │
│   │   ├── (app)/                    # authenticated routes
│   │   │   ├── layout.tsx            # SERVER. renders <AppShell> client child. No DB/fetch here.
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   ├── _components/
│   │   │   │   ├── AppShell.tsx      # 'use client'; Sidebar + Header
│   │   │   │   ├── Sidebar.tsx       # 'use client'
│   │   │   │   └── UserMenu.tsx      # 'use client'; uses useSession() + signOut()
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx          # 'use client'; uses RTK Query hooks
│   │   │   │   ├── loading.tsx
│   │   │   │   └── _components/
│   │   │   └── <feature>/
│   │   │       ├── page.tsx          # 'use client'
│   │   │       ├── new/page.tsx      # 'use client'; renders <FeatureForm mode="create" />
│   │   │       ├── [id]/page.tsx     # 'use client'; renders <FeatureForm mode="edit" />
│   │   │       ├── loading.tsx
│   │   │       ├── schema.ts         # Zod — SHARED with the matching Route Handler
│   │   │       ├── _components/
│   │   │       └── _hooks/
│   │   │
│   │   └── (admin)/                  # OPTIONAL: role-gated. middleware enforces role claim.
│   │       └── layout.tsx
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn primitives. OWNED by the project.
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── form.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   └── use-toast.ts
│   │   ├── forms/                    # composed form fields built on ui/form.tsx
│   │   │   ├── FormInputField.tsx
│   │   │   ├── FormPasswordField.tsx
│   │   │   ├── FormSelectField.tsx
│   │   │   ├── FormDatePickerField.tsx
│   │   │   └── FormTextareaField.tsx
│   │   ├── Notifications.tsx
│   │   ├── UnsavedChangesWarning.tsx
│   │   └── AlertMessage.tsx
│   │
│   ├── redux/
│   │   ├── store.ts                  # typed; combined reducer; signOut wipes cache via NextAuth event.
│   │   ├── providers.tsx             # 'use client'; <SessionProvider><Provider><Toaster><ProgressBar>
│   │   ├── hooks.ts                  # typed useAppDispatch, useAppSelector
│   │   └── api/
│   │       ├── api.ts                # base createApi; baseUrl: '/api'; credentials: 'include'
│   │       ├── tags.ts               # tag-type union
│   │       └── <domain>Api.ts        # one file per domain — injectEndpoints
│   │
│   ├── lib/
│   │   ├── db.ts                     # PrismaClient SINGLETON (HMR-safe)
│   │   ├── api-auth.ts               # requireSession() + ownership helpers for Route Handlers
│   │   ├── utils.ts                  # cn() — clsx + tailwind-merge
│   │   ├── zod-utils.ts              # getDefaultValuesFromSchema, unwrapZodEffects, getMaxLengthsFromSchema
│   │   ├── formatters/
│   │   │   ├── date.ts               # date-fns wrappers ONLY. No moment.
│   │   │   └── currency.ts
│   │   └── hooks/
│   │       └── useDebouncedValue.ts
│   │
│   ├── config/
│   │   └── env.ts                    # Zod-parsed runtime env. Fail fast at startup.
│   │                                 # Required: AUTH_SECRET, DATABASE_URL. Plus OAuth keys if chosen.
│   │
│   └── types/
│       ├── next-auth.d.ts            # module augmentation — adds id, role to Session.user
│       └── api.ts                    # shared API envelope types (if any)
│
└── tests/
    ├── unit/
    │   ├── auth-helpers.test.ts      # tests requireSession() with mocked auth()
    │   ├── <feature>.schema.test.ts
    │   └── zod-utils.test.ts
    ├── e2e/
    │   └── auth.spec.ts              # log in (Credentials), land on dashboard, sign out
    └── setup.ts                      # @testing-library/jest-dom, vi globals
```

## Rules that govern the layout

1. **The root `app/layout.tsx` is the only server component that matters.** Every `page.tsx` is `'use client'`. Group layouts (`(app)/layout.tsx`, `(public)/layout.tsx`) stay server components but only because they render zero data — they pass children through to a client shell. **No file under `src/app/**` outside `route.ts` calls `await db.*` or `fetch()` for data.**

2. **`src/app/api/**/route.ts` is the backend.** Every handler imports from `@/auth` (or `@/lib/api-auth`) and `@/lib/db`. Every handler authenticates first. Inputs validated with the feature's Zod schema. Responses are JSON.

3. **`_components/` and `_hooks/` are private.** Anything inside `_<name>/` may only be imported by files in the same route folder or its descendants. If two routes need the same component, lift it to `src/components/`.

4. **One RTK Query base; many injected slices.** `redux/api/api.ts` is the only file that calls `createApi(...)`. All other `*Api.ts` files import that `api` and call `api.injectEndpoints(...)`. `baseUrl` is `'/api'` (same-origin) and `credentials: 'include'` lets the NextAuth session cookie ride along.

5. **`middleware.ts` is the only auth gate at the network boundary.** It re-exports (or wraps) `auth` from `src/auth.config.ts` (Edge-safe — no DB imports). No `src/proxy.ts` or `src/middleware/*.ts` standing in for it.

6. **`src/auth.ts` vs `src/auth.config.ts`.** Two files because the Edge runtime (where `middleware.ts` runs) can't import the Prisma adapter or any Node-only code. `auth.config.ts` holds providers + callbacks that are Edge-safe. `auth.ts` extends that config with the adapter and re-exports `{ handlers, auth, signIn, signOut }`. The split is mandatory for v5 + Prisma — don't collapse it.

7. **Prisma migrations are committed.** `prisma/migrations/**` is checked in. CI runs `prisma migrate deploy`, not `prisma db push`. Never `prisma db push` in CI.

8. **Domain models live with their feature.** A `Customer` type used only by `(app)/customers/` lives in `(app)/customers/types.ts` or is inferred from the Zod schema. Cross-cutting types in `src/types/`.

9. **Feature schemas are local AND shared with handlers.** `(app)/<feature>/schema.ts` exports Zod schemas owned by that feature. The matching `app/api/<feature>/route.ts` imports the same schema for request validation. Same Zod, two sides.

10. **`tests/` mirrors `src/` loosely.** Tests organized by what they test, not 1:1 parity.

11. **`public/` holds only static assets.** No code.

12. **No duplicate-by-case paths.** Linux CI breaks what works on Windows/macOS.

13. **`components/ui/` is owned, not imported.** shadcn primitives are generated *into* the project.

14. **No `'use server'` directive anywhere.** This project doesn't use Server Actions. Mutations go through RTK Query → Route Handlers.

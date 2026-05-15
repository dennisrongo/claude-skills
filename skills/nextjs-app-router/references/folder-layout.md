# Canonical Folder Layout

This is the source-of-truth tree for a new project. Every file/folder listed here exists in a scaffolded project unless the user opted out. The skill must not reorganize this layout when adding features.

```
{{project-name}}/
├── .env.example                      # committed; documents required env vars
├── .eslintrc.json                    # or eslint.config.mjs — strict TS + a11y + hooks
├── .gitignore
├── .husky/
│   └── pre-commit                    # runs lint-staged
├── .prettierrc
├── README.md
├── components.json                   # shadcn config; rsc: true, tsx: true
├── middleware.ts                     # AUTH GUARD. Wired via Next.js convention.
├── next.config.ts
├── next-env.d.ts                     # generated; do not edit
├── package.json                      # scripts: dev, build, start, lint, typecheck, test, test:e2e
├── playwright.config.ts
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json                     # strict + @/* alias
├── vitest.config.ts
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # install → lint → typecheck → test → build
│
├── public/                           # static assets only (favicons, robots.txt, og images)
│   └── favicon.ico
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # SERVER. <html><body><Providers>{children}
│   │   ├── page.tsx                  # SERVER. redirect('/dashboard') or render landing.
│   │   ├── error.tsx                 # global error boundary
│   │   ├── not-found.tsx
│   │   ├── globals.css
│   │   ├── favicon.ico               # (optional duplicate of public/)
│   │   │
│   │   ├── (public)/                 # unauthenticated routes
│   │   │   ├── layout.tsx            # SERVER. minimal chrome (centered card).
│   │   │   └── auth/
│   │   │       ├── login/
│   │   │       │   ├── page.tsx
│   │   │       │   └── _components/LoginForm.tsx   # 'use client'
│   │   │       ├── signup/
│   │   │       └── forgot-password/
│   │   │
│   │   ├── (app)/                    # authenticated routes
│   │   │   ├── layout.tsx            # SERVER. reads session, renders shell.
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   ├── _components/
│   │   │   │   ├── AppShell.tsx      # 'use client'; Sidebar + Header
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── _hooks/
│   │   │   │   └── useSessionExpiryWarning.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── _components/
│   │   │   └── <feature>/
│   │   │       ├── page.tsx
│   │   │       ├── loading.tsx
│   │   │       ├── schema.ts
│   │   │       ├── _components/
│   │   │       └── _hooks/
│   │   │
│   │   └── (admin)/                  # OPTIONAL: role-gated. middleware enforces role.
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
│   │   ├── Notifications.tsx         # toast-driven notification surface
│   │   ├── UnsavedChangesWarning.tsx # in-app + beforeunload guard
│   │   └── AlertMessage.tsx
│   │
│   ├── redux/
│   │   ├── store.ts                  # typed; combined reducer; logout resets state.
│   │   ├── providers.tsx             # 'use client'; <Provider> + <Toaster> + <ProgressBar>
│   │   ├── hooks.ts                  # typed useAppDispatch, useAppSelector
│   │   ├── api/
│   │   │   ├── api.ts                # base createApi + auth-aware baseQuery
│   │   │   ├── tags.ts               # tag-type union
│   │   │   ├── authApi.ts            # injectEndpoints
│   │   │   └── <domain>Api.ts
│   │   └── features/
│   │       ├── authSlice.ts
│   │       └── <other>Slice.ts       # only for shared async/global state
│   │
│   ├── lib/
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
│   │
│   └── types/                        # cross-cutting TS types only.
│       └── api.ts                    # shared API envelope types if any
│
└── tests/
    ├── unit/
    │   ├── auth.slice.test.ts
    │   ├── login-form.test.tsx
    │   └── zod-utils.test.ts
    ├── e2e/
    │   └── auth.spec.ts
    └── setup.ts                      # @testing-library/jest-dom, vi globals
```

## Rules that govern the layout

1. **Server-by-default in `app/`.** A file gets `'use client'` only if it itself uses a client API. A page can be a server component that renders a `'use client'` child from `_components/`.

2. **`_components/` and `_hooks/` are private.** Anything inside `_<name>/` may only be imported by files in the same route folder or its descendants. If two routes need the same component, lift it to `src/components/`.

3. **One RTK Query base; many injected slices.** `redux/api/api.ts` is the only file that calls `createApi(...)`. All other `*Api.ts` files import that `api` and call `api.injectEndpoints(...)`. Multiple `createApi` instances are forbidden — they fragment the cache and complicate invalidation.

4. **Domain models live with their feature.** A `Customer` type used only by `(app)/customers/` lives in `(app)/customers/types.ts` or is inferred from the Zod schema. Only cross-cutting types belong in `src/types/`. Avoid a global `src/models/` dumping ground.

5. **`middleware.ts` is the only auth gate at the network boundary.** No `src/proxy.ts` or `src/middleware/*.ts` standing in for it. Client guards exist only to handle session expiry during an active session.

6. **`tests/` mirrors `src/` loosely, not strictly.** Tests are organized by what they test, not by 1:1 directory parity.

7. **`public/` holds only static assets.** No code. Image components import from there via the standard `next/image` workflow.

8. **No duplicate-by-case paths.** Linux CI will break what works on Windows/macOS. The linter cannot catch this; the scaffolder must.

9. **Feature schemas are local.** `(app)/<feature>/schema.ts` exports Zod schemas owned by that feature. They are not re-exported from `src/lib/`.

10. **`components/ui/` is owned, not imported.** shadcn-style primitives are generated *into* the project and modified as needed. They are not a node_modules dependency.

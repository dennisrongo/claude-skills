# Good Patterns to Keep

These are the patterns the scaffolder must emit by default. Each one is here because it solves a recurring problem in real-world Next.js + Redux + Tailwind projects.

## 1. Route groups for auth and role boundaries

`app/(public)/`, `app/(app)/`, `app/(admin)/` carve the route tree by who is allowed in. Each group has its own `layout.tsx`, so the chrome (or lack of it) for unauthenticated pages doesn't bleed into authenticated pages. Groups don't appear in URLs — they're purely an organizational tool.

**Why it works:** auth boundaries become a property of the file system, not a runtime check sprinkled into every page. The `middleware.ts` `config.matcher` mirrors the group structure and gates on the server.

## 2. Server-by-default with `'use client'` islands

`app/layout.tsx`, `app/page.tsx`, every group `layout.tsx`, and every feature `page.tsx` is a server component. The interactive parts — forms, table state, sidebars with toggles — are extracted into `_components/Something.tsx` files marked `'use client'` and imported from the server page.

**Why it works:** SSR for free, streaming, smaller client JS, `metadata` exports work, server-only data sources (cookies, DB calls) are reachable from the page.

## 3. Server `redirect()` and middleware-driven navigation

Top-level redirects (e.g. `/` → `/dashboard`) are server calls inside a server `page.tsx`. Auth-conditional redirects live in `middleware.ts`. The client `useRouter().push()` is reserved for in-app navigation triggered by user actions (button clicks, form submissions).

## 4. One RTK Query base, many injected slices

```ts
// redux/api/api.ts
export const api = createApi({
  reducerPath: 'api',
  baseQuery: authAwareBaseQuery,
  tagTypes: TAG_TYPES,
  endpoints: () => ({}),
});

// redux/api/customersApi.ts
export const customersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCustomers: build.query<Customer[], void>({
      query: () => '/customers',
      providesTags: [{ type: 'Customers', id: 'LIST' }],
    }),
    createCustomer: build.mutation<Customer, NewCustomer>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: [{ type: 'Customers', id: 'LIST' }],
    }),
  }),
});
```

**Why it works:** one cache, one middleware, one set of tag types. Cross-domain invalidation just works (a mutation in `invoicesApi` can invalidate `Customers` tags). The base file stays small; domain logic lives next to the domain.

## 5. Auth-aware `baseQuery` with clean 401 handling

`baseQuery` injects the session into requests (via cookies for `httpOnly` flows, or via a `prepareHeaders` callback that reads from state for bearer flows). On a 401, it dispatches a typed logout action that the root reducer uses to reset state, then signals the router (not `window.location`) to navigate to `/auth/login`.

**Why it works:** no hard reloads, no race conditions when multiple in-flight requests 401, and the redirect target stays consistent with whatever `middleware.ts` would have done.

## 6. State-reset on logout via wrapped root reducer

```ts
const combinedReducer = combineReducers({ ... });

export const store = configureStore({
  reducer: (state, action) => {
    if (authApi.endpoints.logout.matchFulfilled(action)) {
      return combinedReducer(undefined, action);
    }
    return combinedReducer(state, action);
  },
  // ...
});
```

**Why it works:** logout wipes every slice (including RTK Query cache) in one place. No per-slice `extraReducers` listening for the logout action. Fully typed — no `@ts-ignore`.

## 7. Typed Redux hooks

`redux/hooks.ts` exports `useAppDispatch` and `useAppSelector` typed against `RootState` and `AppDispatch`. Components never import the raw `useDispatch` / `useSelector` from `react-redux`.

## 8. React Hook Form + Zod with schema-introspected defaults

```ts
const schema = z.object({ name: z.string().min(1), age: z.number().min(0) });

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: getDefaultValuesFromSchema(unwrapZodEffects(schema)),
});
```

`getDefaultValuesFromSchema` walks the Zod tree and produces a defaults object that matches the schema shape (empty string for `z.string()`, `null` for nullable, `0` for numeric, etc.). `unwrapZodEffects` peels `.refine()` / `.transform()` wrappers so the introspection works.

`getMaxLengthsFromSchema` reads `z.string().max(N)` and feeds the `maxLength` attribute to the rendered `<Input>`.

**Why it works:** the schema is the single source of truth for both validation and field configuration. No drift between "what the form accepts" and "what the API will accept."

## 9. Composed form fields built on shadcn `<Form>`

`components/forms/FormInputField.tsx` and siblings take `form`, `schema`, `fieldName`, `formLabel` props and render a fully wired `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` block. Every form in the app reuses these.

**Why it works:** form layout/spacing/error display is consistent across the app, and changes to the shared field components propagate everywhere. New forms are mostly schema + a list of fields.

## 10. `UnsavedChangesWarning` tied to RHF `formState.isDirty`

A small component that hooks into in-app navigation (Next router events) and `window.beforeunload` to warn when a form has unsaved changes. Used inside every non-trivial form.

## 11. `error.tsx`, `loading.tsx`, `not-found.tsx` at meaningful segments

At minimum: global ones at `app/`, group-level ones at `(app)/`, and feature-level `loading.tsx` for any feature that fetches data via Suspense.

## 12. Runtime env validation

```ts
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
});
```

**Why it works:** misconfiguration crashes the app at startup with a clear error, not deep inside a request handler with a cryptic `undefined` later.

## 13. shadcn primitives owned by the project

`components/ui/button.tsx`, `input.tsx`, `form.tsx`, etc. live in the repo and are editable. They are not pulled from `node_modules`. When the design system evolves, you edit these files; you don't fork a library.

## 14. `cn()` in `lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

Single source of class merging across the app.

## 15. Per-feature `_components/` and `_hooks/`

Co-locate the implementation details with the route. When a feature is deleted, the entire folder goes with it; no orphaned files in a shared directory. Promote to `src/components/` only when a second feature genuinely needs the same code.

## 16. One date library: `date-fns`

Tree-shakeable, immutable, ESM-friendly. Format helpers live in `lib/formatters/date.ts` so the rest of the codebase doesn't import `date-fns` directly — the wrapper makes it easy to change the underlying library later.

## 17. Strict TypeScript

`tsconfig.json` with `"strict": true`, `"noUncheckedIndexedAccess": true`, `"forceConsistentCasingInFileNames": true`. The last one catches the duplicate-by-case folder bug at compile time, which is the only place to catch it before Linux production.

## 18. Strict ESLint

`@typescript-eslint/recommended`, `plugin:react-hooks/recommended`, `plugin:jsx-a11y/recommended`, plus `no-console: warn`, `no-explicit-any: error`, `exhaustive-deps: error`. Pre-commit hook runs `eslint --fix` so the rules actually get enforced.

## 19. `middleware.ts` as the auth gate

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const session = req.cookies.get('session')?.value;
  if (!session && req.nextUrl.pathname.startsWith('/app')) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('returnTo', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public).*)'],
};
```

(The matcher syntax here is illustrative — the scaffolder picks one that mirrors the project's actual route groups.)

## 20. Vitest + RTL for unit, Playwright for E2E

A new project gets at least:
- One reducer/slice test (catches accidental shape changes).
- One form-renders-and-submits test (catches RHF/zod wiring regressions).
- One Playwright spec that boots the app, logs in, and asserts the dashboard renders (catches middleware and provider regressions).

Three tests is enough to make CI meaningful.

## 21. Husky + lint-staged

```jsonc
// package.json
"lint-staged": {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{json,md,css}": ["prettier --write"]
}
```

Pre-commit hook keeps formatting and lint clean without anyone having to remember.

## 22. GitHub Actions CI

A single `ci.yml` that runs install → lint → typecheck → test → build on every PR. Build catches RSC/server-component boundary errors that `tsc --noEmit` misses.

## 23. `next-nprogress-bar` for top loading bar

One small, well-maintained library that hooks into Next.js's router events. Configured once in `providers.tsx`.

## 24. Toaster via shadcn `use-toast` (or `react-toastify`, not both)

Pick one toast library and wrap it. Composed `Notifications.tsx` is what features call; the underlying library can change without touching feature code.

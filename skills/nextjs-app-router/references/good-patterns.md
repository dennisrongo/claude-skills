# Good Patterns to Keep

These are the patterns the scaffolder must emit by default. Each one is here because it solves a recurring problem in real-world Next.js + NextAuth + Prisma + Redux Toolkit projects.

## 1. Route groups for auth and role boundaries

`app/(public)/`, `app/(app)/`, `app/(admin)/` carve the route tree by who is allowed in. Each group has its own `layout.tsx`. The `middleware.ts` `config.matcher` mirrors the group structure and gates on the server.

**Why it works:** auth boundaries become a property of the file system, not a runtime check sprinkled into every page.

## 2. SPA-style pages, server root layout only

`src/app/layout.tsx` is a server component that renders `<html><body><Providers>{children}</Providers></body></html>`. **Every other `page.tsx` is `'use client'`** and uses RTK Query hooks for data. Per-route metadata lives at the layout level (server) — pages can't export `metadata` because they're client. This is the deliberate "API-driven, not SSR" choice.

**Why it works:** one mental model for data flow (UI → RTK Query → /api → DB), trivial mocking in tests, no "server or client?" cargo culting, no second mutation path via Server Actions.

## 3. NextAuth (Auth.js v5) as the single auth source

```ts
// src/auth.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import authConfig from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' }, // required when Credentials provider is present
});
```

```ts
// src/auth.config.ts — EDGE-SAFE (no DB imports)
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export default {
  providers: [Credentials({ /* authorize: dynamically imported in auth.ts */ })],
  pages: { signIn: '/auth/login' },
  callbacks: {
    async jwt({ token, user }) { if (user) token.id = user.id; return token; },
    async session({ session, token }) { if (token?.id) session.user.id = token.id as string; return session; },
  },
} satisfies NextAuthConfig;
```

```ts
// middleware.ts
import NextAuth from 'next-auth';
import authConfig from '@/auth.config';
export const { auth: middleware } = NextAuth(authConfig);
export const config = { matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'] };
```

**Why split into two files:** middleware runs on the Edge runtime, which can't import the Prisma adapter. `auth.config.ts` is Edge-safe; `auth.ts` extends it with the adapter and is only imported from Node code (Route Handlers, server components).

## 4. Route Handlers as the backend

```ts
// src/app/api/customers/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/api-auth';
import { customerSchema } from '@/app/(app)/customers/schema';

export async function GET() {
  const session = await requireSession();
  const customers = await db.customer.findMany({ where: { userId: session.user.id } });
  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const session = await requireSession();
  const parsed = customerSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const created = await db.customer.create({ data: { ...parsed.data, userId: session.user.id } });
  return NextResponse.json(created, { status: 201 });
}
```

**Why it works:** every backend operation has one home, one auth check, one Zod validation pass against the same schema the form uses, one Prisma call. Ownership is enforced via `userId: session.user.id`.

## 5. `requireSession()` helper for handlers

```ts
// src/lib/api-auth.ts
import { auth } from '@/auth';

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return session as typeof session & { user: { id: string } };
}
```

Handlers `await requireSession()`; on failure, the thrown `Response` bubbles up as a 401 (Next handles thrown Responses in handlers cleanly in v14+; if not, wrap in try/catch and return). Saves five lines in every handler and guarantees the check exists.

## 6. Prisma singleton

```ts
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

**Why it works:** dev hot-reload creates new modules but reuses the global. Without this, you exhaust your Postgres connection pool in five minutes of editing.

## 7. One RTK Query base, many injected slices

```ts
// redux/api/api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { signOut } from 'next-auth/react';
import { TAG_TYPES } from './tags';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  credentials: 'include', // ride the NextAuth session cookie (same-origin)
});

export const baseQueryWithAuth: BaseQueryFn<...> = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);
  if (result.error?.status === 401) {
    void signOut({ callbackUrl: '/auth/login', redirect: true });
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: TAG_TYPES,
  endpoints: () => ({}),
});
```

```ts
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

**Why it works:** one cache, one middleware, one set of tag types. Cross-domain invalidation just works. `baseUrl: '/api'` keeps requests same-origin so the NextAuth session cookie rides along.

## 8. SessionProvider + Redux Provider co-located

```tsx
// src/redux/providers.tsx
'use client';
import { SessionProvider } from 'next-auth/react';
import { Provider } from 'react-redux';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { Toaster } from '@/components/ui/toaster';
import { store } from './store';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Provider store={store}>
        {children}
        <Toaster />
        <ProgressBar height="3px" color="hsl(var(--primary))" shallowRouting options={{ showSpinner: false }} />
      </Provider>
    </SessionProvider>
  );
}
```

**Why this order:** `SessionProvider` outside so any component (including Redux-connected ones) can `useSession()`. Redux inside so RTK Query mutations can dispatch.

## 9. Typed Redux hooks

`redux/hooks.ts` exports `useAppDispatch` and `useAppSelector` typed against `RootState` and `AppDispatch`. Components never import the raw `useDispatch` / `useSelector`.

## 10. React Hook Form + Zod with schema-introspected defaults

```ts
const schema = z.object({ name: z.string().min(1), age: z.number().min(0) });

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: getDefaultValuesFromSchema(unwrapZodEffects(schema)),
});
```

`getDefaultValuesFromSchema` walks the Zod tree and produces a defaults object matching the schema shape. **The same `schema` is imported in `app/api/<feature>/route.ts` and used to validate request bodies** — one source of truth for form + handler validation.

## 11. Composed form fields built on shadcn `<Form>`

`components/forms/FormInputField.tsx` and siblings take `form`, `schema`, `fieldName`, `formLabel` props and render a fully wired `<FormField>`/`<FormItem>`/`<FormLabel>`/`<FormControl>`/`<FormMessage>` block. Every form reuses these.

## 12. `UnsavedChangesWarning` tied to RHF `formState.isDirty`

A small component that hooks into `window.beforeunload` (and Next router events when the API stabilizes) to warn when a form has unsaved changes.

## 13. `error.tsx`, `loading.tsx`, `not-found.tsx` at meaningful segments

At minimum: global ones at `app/`, group-level ones at `(app)/`, and feature-level `loading.tsx` for any feature that fetches data.

## 14. Runtime env validation

```ts
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(), // required in prod, optional locally
  DATABASE_URL: z.string().url(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
```

**Why:** misconfiguration crashes the app at startup with a clear error, not deep inside a Route Handler with a cryptic `undefined`.

## 15. shadcn primitives owned by the project

`components/ui/button.tsx`, `input.tsx`, `form.tsx`, etc. live in the repo and are editable. Not pulled from `node_modules`.

## 16. `cn()` in `lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

Single source of class merging.

## 17. Per-feature `_components/` and `_hooks/`

Co-locate implementation details with the route. When a feature is deleted, the entire folder goes with it. Promote to `src/components/` only when a second feature genuinely needs it.

## 18. One date library: `date-fns`

Tree-shakeable, immutable, ESM-friendly. Format helpers live in `lib/formatters/date.ts`.

## 19. Strict TypeScript

`"strict": true`, `"noUncheckedIndexedAccess": true`, `"forceConsistentCasingInFileNames": true`. The last one catches the duplicate-by-case folder bug at compile time.

## 20. Strict ESLint

`@typescript-eslint/recommended`, `react-hooks/recommended`, `jsx-a11y/recommended`, plus `no-console: warn`, `no-explicit-any: error`, `exhaustive-deps: error`. Pre-commit hook runs `eslint --fix`.

## 21. `middleware.ts` as the auth gate

```ts
// middleware.ts
import NextAuth from 'next-auth';
import authConfig from '@/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // /api/auth is NextAuth's own; static assets excluded.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
```

Path-specific redirects (e.g. `/` → `/app/dashboard` for signed-in users) live in a custom wrapper around `auth()` if needed.

## 22. Prisma migrations checked in

`prisma/migrations/**` is committed. CI runs `prisma migrate deploy`. `prisma db push` is only for throwaway prototyping.

## 23. Module augmentation for `Session.user.id` / role

```ts
// src/types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string; name?: string | null; image?: string | null; role?: string };
  }
}

declare module 'next-auth/jwt' {
  interface JWT { id: string; role?: string }
}
```

Without this, `session.user.id` is `undefined` in TypeScript even though the runtime callback added it.

## 24. Vitest + RTL for unit, Playwright for E2E

A new project gets at least:
- One reducer/slice test.
- One Zod schema test (validates valid + invalid payloads).
- One form-renders test.
- One Playwright spec that logs in (Credentials), lands on dashboard, signs out.

## 25. Husky + lint-staged

```jsonc
"lint-staged": {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
  "*.{json,md,css}": ["prettier --write"]
}
```

## 26. GitHub Actions CI with a Postgres service

```yaml
services:
  postgres:
    image: postgres:16
    env: { POSTGRES_PASSWORD: postgres }
    ports: ['5432:5432']
    options: --health-cmd pg_isready --health-interval 10s
```

Steps: install → `prisma migrate deploy` → lint → typecheck → test → build.

## 27. `next-nprogress-bar` for top loading bar

One small, well-maintained library. Configured in `providers.tsx`.

## 28. Toaster via shadcn `use-toast`

One toast library. Composed `Notifications.tsx` wraps it; features call the wrapper.

# NextAuth (Auth.js v5) configuration

Two files, by design:

- **`src/auth.config.ts`** — Edge-safe. Providers, callbacks, page mappings. **No DB imports.** Consumed by `middleware.ts`.
- **`src/auth.ts`** — full config. Imports `auth.config.ts`, adds the Prisma adapter, adds `authorize` for Credentials (which needs `db` + `bcryptjs`). Consumed by Route Handlers and server components.

The split is mandatory because middleware runs on the Edge runtime, which can't import the Prisma client (Node-only). Collapsing them produces a confusing "module not found in edge runtime" error at build time.

## `src/auth.config.ts` (EDGE-SAFE)

```ts
import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
// import GitHub from 'next-auth/providers/github';   // uncomment if enabled in Step 2
// import Google from 'next-auth/providers/google';   // uncomment if enabled in Step 2

export default {
  providers: [
    Credentials({
      // The `authorize` function lives in src/auth.ts (it needs DB + bcryptjs).
      // Here we only declare the credentials shape so the provider is registered for type inference.
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
    }),
    // GitHub({ clientId: process.env.AUTH_GITHUB_ID!, clientSecret: process.env.AUTH_GITHUB_SECRET! }),
    // Google({ clientId: process.env.AUTH_GOOGLE_ID!, clientSecret: process.env.AUTH_GOOGLE_SECRET! }),
  ],
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const onPublic = nextUrl.pathname.startsWith('/auth');
      const onApp = nextUrl.pathname.startsWith('/app');
      const onAdmin = nextUrl.pathname.startsWith('/admin');

      if (onPublic) {
        return isLoggedIn ? Response.redirect(new URL('/app/dashboard', nextUrl)) : true;
      }
      if (onApp || onAdmin) {
        return isLoggedIn; // false → redirect to pages.signIn
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        // Add `role` here if the User model has one:
        // if ('role' in user) token.role = user.role as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
        // if (token.role) session.user.role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

**Edge-safety checklist for this file:**

- No `import { db } from '@/lib/db'`.
- No `import { PrismaAdapter } from '@auth/prisma-adapter'`.
- No `import bcrypt from 'bcryptjs'`.
- No `import { auth } from '@/auth'` (circular).

## `src/auth.ts` (full config, Node-only)

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import authConfig from './auth.config';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // JWT strategy is REQUIRED when Credentials is one of the providers.
  // Database sessions don't work with Credentials by NextAuth design.
  session: { strategy: 'jwt' },
  providers: [
    // Re-declare Credentials here with the real `authorize` (which needs db + bcrypt).
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, image: true, password: true, role: true },
        });
        if (!user?.password) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
    // Any OAuth providers from authConfig.providers carry over via the spread above —
    // re-declare them here only if they need server-only secrets that auth.config.ts couldn't see.
  ],
});
```

## `src/app/api/auth/[...nextauth]/route.ts`

```ts
export { GET, POST } from '@/auth';
```

That's the entire file. NextAuth's `handlers` is `{ GET, POST }`, and `auth.ts` re-exports them. The catch-all route gets every `/api/auth/*` request (sign-in, callback, CSRF, session, etc.).

## `src/types/next-auth.d.ts`

```ts
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role?: string;
    };
  }

  interface User {
    id: string;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role?: string;
  }
}
```

Without this file, TypeScript thinks `session.user.id` is `undefined`.

## Forbidden in `auth.config.ts`

- Importing `@/lib/db`, `@/auth`, `@auth/prisma-adapter`, `bcryptjs`, or anything that pulls in Node-only modules.
- Defining the Credentials `authorize` here (it needs the DB).
- Any logic that calls `cookies()` or `headers()` from `next/headers` — those are server-only.

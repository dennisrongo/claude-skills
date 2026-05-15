# `middleware.ts` template (NextAuth-driven)

This is **the** auth gate. Place at the project root (not in `src/`). Next.js requires this exact filename and location.

## Variant A — Plain NextAuth `auth` (covers most projects)

```ts
// middleware.ts
import NextAuth from 'next-auth';
import authConfig from '@/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

// Exclude NextAuth's own API routes and static assets.
export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
```

NextAuth's `auth` returns 302s to `pages.signIn` for unauthenticated requests to anything matched by the `authorized` callback in `auth.config.ts`. If `authorized` isn't defined, all matched routes require a session.

The `authorized` callback in `auth.config.ts`:

```ts
// inside src/auth.config.ts
callbacks: {
  authorized({ auth, request: { nextUrl } }) {
    const isLoggedIn = !!auth?.user;
    const isOnPublic = nextUrl.pathname.startsWith('/auth');
    if (isOnPublic) {
      return isLoggedIn
        ? Response.redirect(new URL('/app/dashboard', nextUrl))
        : true;
    }
    return isLoggedIn; // false → redirected to pages.signIn
  },
}
```

## Variant B — Custom wrapper for role/path logic

When `(admin)` exists or `/` needs role-based routing:

```ts
// middleware.ts
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from '@/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Root redirect
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = session ? '/app/dashboard' : '/auth/login';
    return NextResponse.redirect(url);
  }

  // Admin gate
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(url);
    }
    if (session.user?.role !== 'admin') {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // App gate
  if (pathname.startsWith('/app') && !session) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
```

**Notes:**

- `auth.config.ts` must be **Edge-safe**: no Prisma adapter, no `@/lib/db`, no Node-only imports. The middleware runs on the Edge runtime; importing Node-only code crashes the production build with a confusing "module not found in edge runtime" error.
- The matcher excludes `api/auth` so NextAuth's own `/api/auth/[...nextauth]` route is reachable without recursion.
- Other `/api/**` routes (your Route Handlers) are excluded *from middleware redirects* because the matcher targets pages — handlers run their own `requireSession()` check and return JSON 401s rather than 302s.
- Role claims: add them in the `jwt` callback inside `auth.config.ts` (or `auth.ts` if the role comes from the DB). Module-augment `Session` and `JWT` in `src/types/next-auth.d.ts`.
- Do **not** add a `src/proxy.ts` or `src/middleware/*.ts` — Next.js only looks at `middleware.ts` at the project root.

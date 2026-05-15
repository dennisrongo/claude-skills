# `middleware.ts` template

This is **the** auth gate. Place at the project root (not in `src/`). Next.js requires this exact filename and location.

## Variant A — `httpOnly` cookie set by the backend on login

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/app', '/admin'];
const AUTH_PATH = '/auth/login';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = req.cookies.get('session')?.value;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Already authenticated user hitting an auth page → bounce to /app.
  if (session && pathname.startsWith('/auth')) {
    const url = req.nextUrl.clone();
    url.pathname = '/app/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Unauthenticated user hitting a protected route → redirect with returnTo.
  if (!session && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = AUTH_PATH;
    url.search = '';
    url.searchParams.set('returnTo', pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
```

## Variant B — JS-readable cookie (decode the JWT here)

If the backend cannot set an `httpOnly` cookie and the project must use a JS-readable token, decode the JWT in middleware to check expiry — never trust the client to have done so:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // Edge-compatible; do not use jwt-decode here.

const PROTECTED_PREFIXES = ['/app', '/admin'];
const SECRET = new TextEncoder().encode(process.env.JWT_VERIFY_KEY!);

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isProtected) return NextResponse.next();
  if (!token) return redirectToLogin(req);

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return redirectToLogin(req);
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/auth/login';
  url.searchParams.set('returnTo', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Notes:**
- `jose` is Edge-runtime compatible. `jsonwebtoken` and `jwt-decode` are not — they assume Node.
- The matcher must exclude `_next/static`, `_next/image`, and `favicon.ico`. Add other public assets as needed.
- Do **not** add a `src/proxy.ts` or `src/middleware.ts` — Next.js only looks at `middleware.ts` at the project root.
- Role-gating for `/admin` happens here too: decode the role claim and 403 (or redirect) when the user is not allowed.

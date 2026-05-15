# NextAuth integration (replaces the old auth slice)

There is **no `authSlice.ts`** in this project. NextAuth's `SessionProvider` is the single source of session truth. This file documents how the pieces fit together so nobody is tempted to reintroduce a redundant Redux slice.

## Where session state lives

| Need | Source |
|------|--------|
| "Is the user signed in?" (client) | `useSession()` from `next-auth/react` |
| User id, email, role (client) | `useSession().data.user` |
| Server-side session inside a Route Handler | `await auth()` (or `requireSession()`) |
| Server-side session inside a server component (layouts only) | `await auth()` — **but layouts should not need this; middleware already gated** |
| Sign-in trigger | `signIn('credentials', { email, password, redirect: false })` from `next-auth/react` |
| Sign-out trigger | `signOut({ callbackUrl: '/auth/login', redirect: true })` |
| Auth gate at the network boundary | `middleware.ts` |

## Sign-in (Credentials provider)

```tsx
// src/app/(public)/auth/login/_components/LoginForm.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

// inside onSubmit:
const res = await signIn('credentials', { email, password, redirect: false });
if (res?.error) {
  // surface "Invalid email or password." — don't leak which field was wrong
  return;
}
router.replace(searchParams.get('returnTo') ?? '/app/dashboard');
router.refresh();
```

## Sign-out

```tsx
'use client';
import { signOut } from 'next-auth/react';

<Button onClick={() => signOut({ callbackUrl: '/auth/login', redirect: true })}>
  Sign out
</Button>
```

The Redux store's `signOutEvent` is also dispatched from the RTK Query base on 401 (see [`api-base.md`](api-base.md)) to clear cached queries. For a user-initiated sign-out, that happens implicitly when the next request 401s — but if you want to clear the cache immediately on click, dispatch `signOutEvent` before calling `signOut`:

```tsx
import { useDispatch } from 'react-redux';
import { signOutEvent } from '@/redux/store';

const dispatch = useDispatch();
const onSignOut = () => {
  dispatch(signOutEvent);
  void signOut({ callbackUrl: '/auth/login', redirect: true });
};
```

## Module augmentation — `src/types/next-auth.d.ts`

Without this, `session.user.id` is `undefined` in TypeScript even though the runtime callback puts it there.

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

## Forbidden

- A Redux `authSlice` storing `user`, `token`, or `expiresAt`. Use `useSession()`.
- Manual `js-cookie` writes (`Cookies.set('token', ...)`). NextAuth owns the session cookie and it's `httpOnly` by design.
- Decoding the NextAuth JWT on the client. Use the hook.
- Calling `await auth()` inside a server `layout.tsx` "just to check". Middleware already gated. Calling `auth()` again is a round-trip with no behavior change.
- A second auth library (`Clerk`, `Lucia`, custom JWT signer) running alongside NextAuth.

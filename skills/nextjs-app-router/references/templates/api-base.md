# Base RTK Query API and tag-types

## `src/redux/api/tags.ts`

```ts
// Single source of truth for cache tags. Every domain adds to this union.
export const TAG_TYPES = [
  // Add domain tags here as features are added, e.g. 'Customers', 'Customer', 'Invoices', 'Invoice'.
] as const;

export type TagType = (typeof TAG_TYPES)[number];
```

## `src/redux/api/api.ts`

```ts
import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { signOut } from 'next-auth/react';
import { TAG_TYPES } from './tags';
import { signOutEvent } from '../store';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  // Same-origin — the NextAuth session cookie rides along automatically.
  credentials: 'include',
});

export const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    // Wipe Redux state first, then let NextAuth clear the cookie and redirect.
    api.dispatch(signOutEvent);
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

**Notes:**

- `baseUrl: '/api'` — requests go to the in-app Route Handlers under `src/app/api/**`. Same-origin means the NextAuth session cookie is sent automatically.
- `credentials: 'include'` — required so the cookie rides on every request. Don't drop it.
- `createApi` is called **once** in this file. Every other `*Api.ts` file uses `api.injectEndpoints(...)`.
- The 401 handler dispatches `signOutEvent` (resets Redux state via the root reducer) then calls NextAuth's `signOut` which clears the cookie and routes to `/auth/login`. **Never** `window.location.href = '...'` here.
- `tagTypes` reads from the shared `TAG_TYPES` constant — domains add to that one array, not here.
- No `prepareHeaders` injecting an `Authorization: Bearer` token. NextAuth uses an `httpOnly` session cookie; the browser handles it.

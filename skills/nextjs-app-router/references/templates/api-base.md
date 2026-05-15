# Base RTK Query API and tag-types

## `src/redux/api/tags.ts`

```ts
// Single source of truth for cache tags. Every domain adds to this union.
export const TAG_TYPES = [
  'Auth',
  // Add domain tags here as features are added, e.g. 'Customers', 'Customer', 'Invoices', 'Invoice'.
] as const;

export type TagType = (typeof TAG_TYPES)[number];
```

## `src/redux/api/api.ts`

```ts
import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { env } from '@/config/env';
import { TAG_TYPES } from './tags';
import { logout } from '@/redux/features/authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
  // For httpOnly cookie auth, this is mandatory. Drop it only for bearer-token-only flows.
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    // If the project uses a JS-readable bearer token, attach it here.
    // For httpOnly cookie flows, leave this empty — the browser sends the cookie.
    const token = (getState() as { auth?: { token?: string } }).auth?.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    // Clean logout: dispatch action → root reducer resets state → middleware/router handles redirect.
    api.dispatch(logout());
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
- `createApi` is called **once** in this file. Every other `*Api.ts` file uses `api.injectEndpoints(...)`.
- The 401 handler dispatches a plain action; it does **not** call `window.location.href = '...'`. Navigation is handled by middleware on the next request or by an in-app guard listening to the auth state.
- `tagTypes` reads from the shared `TAG_TYPES` constant — domains add to that one array, not here.

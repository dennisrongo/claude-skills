# Auth slice and auth API template

## `src/redux/features/authSlice.ts`

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '@/redux/api/authApi';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

interface AuthState {
  user: AuthUser | null;
  token: string | null; // only populated for bearer-flow projects; null for httpOnly-cookie flows
  expiresAt: number | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  expiresAt: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: () => initialState,
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, { payload }) => {
      state.user = payload.user;
      state.token = payload.token ?? null;
      state.expiresAt = payload.expiresAt ?? null;
    });
    builder.addMatcher(authApi.endpoints.getMe.matchFulfilled, (state, { payload }) => {
      state.user = payload;
    });
  },
});

export const { logout, setUser } = authSlice.actions;
```

**Note:** the store's `rootReducer` already wipes the entire store on `authApi.endpoints.logout.matchFulfilled` — so a `logout()` action dispatched here from the 401 handler still triggers a full state reset via the wrapped reducer in `store.ts`. The slice's own `logout` reducer is there for cases where the user explicitly clicks "Sign out" without hitting the logout endpoint.

## `src/redux/api/authApi.ts`

```ts
import { api } from './api';
import type { AuthUser } from '@/redux/features/authSlice';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  /** Populated only for bearer-token flows. httpOnly-cookie flows leave this undefined. */
  token?: string;
  expiresAt?: number;
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      invalidatesTags: ['Auth'],
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth'],
    }),
    getMe: build.query<AuthUser, void>({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useGetMeQuery } = authApi;
```

**Forbidden:**
- Storing the token via `js-cookie` inside the slice (`Cookies.set('token', ...)`). For `httpOnly` flows, the backend sets the cookie; for bearer flows, the token lives in Redux state and the `prepareHeaders` callback attaches it. Never both.
- Base64-encoding the user and writing it to a cookie (`Cookies.set('user', btoa(JSON.stringify(...)))`). It's not encryption, it's obfuscation. If the server needs the user, the server reads it from the session cookie / database.
- Decoding the JWT on the client to drive auth decisions. Decode only for non-sensitive display (e.g. showing the user's name pulled from a claim) — never as the gate. The gate is the server.

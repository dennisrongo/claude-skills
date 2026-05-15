# Providers, store, typed hooks

## `src/redux/providers.tsx` (CLIENT)

```tsx
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
        <ProgressBar
          height="3px"
          color="hsl(var(--primary))"
          shallowRouting
          disableSameURL
          options={{ showSpinner: false }}
        />
      </Provider>
    </SessionProvider>
  );
}
```

**Order matters:** `<SessionProvider>` outside so any component (including Redux-connected ones) can `useSession()`. Redux inside so RTK Query and dispatches work normally.

## `src/redux/store.ts`

```ts
import { combineReducers, configureStore, type Action } from '@reduxjs/toolkit';
import { api } from './api/api';

const combinedReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  // Add additional slices here ONLY for genuinely shared async/global state.
  // Auth/session is NOT a slice — it lives in NextAuth's SessionProvider.
});

type CombinedState = ReturnType<typeof combinedReducer>;

const SIGN_OUT = '__signout__' as const;

export const signOutEvent = { type: SIGN_OUT } as const;

const rootReducer = (state: CombinedState | undefined, action: Action): CombinedState => {
  // Wipe the entire store when the app dispatches signOutEvent (called from the
  // baseQuery 401 handler before invoking next-auth's signOut).
  if (action.type === SIGN_OUT) {
    return combinedReducer(undefined, action);
  }
  return combinedReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Keep serializableCheck ON. If a specific value is genuinely non-serializable,
      // add { ignoredPaths: ['...'] } here with a comment explaining why.
    }).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**No `@ts-ignore`. No `serializableCheck: false`. No commented-out reducers. No auth slice — NextAuth owns session state.**

## `src/redux/hooks.ts`

```ts
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

Components import `useAppDispatch` / `useAppSelector` — never the raw `useDispatch` / `useSelector` from `react-redux`. ESLint can enforce this with `no-restricted-imports`.

## Why no `authSlice`

NextAuth's `SessionProvider` is the single source of session truth. Components read it with `useSession()`. Duplicating that into a Redux slice creates two sources of truth that drift apart (the slice doesn't know when NextAuth refreshes the JWT, etc.) and doubles the work on sign-in/out.

If you need session-derived data inside a Redux slice (rare — typically you'd put it in the request itself), select from `useSession()` at the component boundary and pass it as an action payload.

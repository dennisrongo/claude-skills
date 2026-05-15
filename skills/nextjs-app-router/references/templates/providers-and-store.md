# Providers, store, typed hooks

## `src/redux/providers.tsx` (CLIENT — this one must be client because of `<Provider store>`)

```tsx
'use client';

import { Provider } from 'react-redux';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';
import { Toaster } from '@/components/ui/toaster';
import { store } from './store';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
```

## `src/redux/store.ts`

```ts
import { combineReducers, configureStore, type Action } from '@reduxjs/toolkit';
import { api } from './api/api';
import { authApi } from './api/authApi';
import { authSlice } from './features/authSlice';

const combinedReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  auth: authSlice.reducer,
});

type CombinedState = ReturnType<typeof combinedReducer>;

const rootReducer = (state: CombinedState | undefined, action: Action): CombinedState => {
  // Wipe the entire store on logout. RTK Query cache, auth, everything.
  if (authApi.endpoints.logout.matchFulfilled(action)) {
    return combinedReducer(undefined, action);
  }
  return combinedReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Keep serializableCheck ON. If a specific value is genuinely non-serializable,
      // add it here with a comment explaining why.
      // serializableCheck: { ignoredPaths: ['auth.expiresAt'] },
    }).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

**No `@ts-ignore`. No `serializableCheck: false`. No commented-out reducers.**

## `src/redux/hooks.ts`

```ts
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

Components import `useAppDispatch` / `useAppSelector` — never the raw `useDispatch` / `useSelector` from `react-redux`. ESLint can enforce this with `no-restricted-imports` if desired.

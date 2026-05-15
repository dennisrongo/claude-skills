# Domain API slice template (injected endpoints)

One file per domain. Imports the shared `api` and calls `api.injectEndpoints(...)`. Never calls `createApi`.

## Example: `src/redux/api/customersApi.ts`

```ts
import { api } from './api';

export interface Customer {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type NewCustomer = Omit<Customer, 'id' | 'createdAt'>;
export type UpdateCustomer = Partial<NewCustomer>;

export const customersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCustomers: build.query<Customer[], void>({
      query: () => '/customers',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Customer' as const, id })),
              { type: 'Customers' as const, id: 'LIST' },
            ]
          : [{ type: 'Customers' as const, id: 'LIST' }],
    }),

    getCustomer: build.query<Customer, string>({
      query: (id) => `/customers/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'Customer', id }],
    }),

    createCustomer: build.mutation<Customer, NewCustomer>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      invalidatesTags: [{ type: 'Customers', id: 'LIST' }],
    }),

    updateCustomer: build.mutation<Customer, { id: string; patch: UpdateCustomer }>({
      query: ({ id, patch }) => ({ url: `/customers/${id}`, method: 'PATCH', body: patch }),
      invalidatesTags: (_result, _err, { id }) => [
        { type: 'Customer', id },
        { type: 'Customers', id: 'LIST' },
      ],
    }),

    deleteCustomer: build.mutation<void, string>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _err, id) => [
        { type: 'Customer', id },
        { type: 'Customers', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
} = customersApi;
```

**Don't forget:** add `'Customer'` and `'Customers'` to `TAG_TYPES` in `src/redux/api/tags.ts`. TypeScript will error on the `providesTags` / `invalidatesTags` lines until you do.

**Forbidden:**
- `createApi(...)` in this file — only the base does that.
- `any` in the generic slots (`build.query<any, any>`). Type both sides.
- `transformResponse` that does data mangling that should be the backend's job. Use it only when the contract truly demands it (renaming a field that the backend can't change, unwrapping a `{ data: ... }` envelope, etc.).

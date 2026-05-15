# Feature slice template (Mode 2 — `add-feature`)

A feature is a route folder under a route group, with its own private `_components/` and `_hooks/`, a local Zod `schema.ts` (shared with the matching Route Handler), and one or more RTK Query endpoints injected into the appropriate domain slice. **Every `page.tsx` is `'use client'`**.

## Layout for feature `{{feature}}` under `(app)` (list + create + edit)

```
src/app/(app)/{{feature}}s/
├── page.tsx                   # 'use client' — list view, uses useGet{{Feature}}sQuery
├── new/page.tsx               # 'use client' — renders <{{Feature}}Form mode="create" />
├── [id]/
│   ├── page.tsx               # 'use client' — renders <{{Feature}}Form mode="edit" id={params.id} />
│   ├── loading.tsx
│   └── _components/
├── loading.tsx
├── error.tsx
├── schema.ts                  # Zod — SHARED with src/app/api/{{feature}}/route.ts
├── _components/
│   ├── {{Feature}}sTable.tsx
│   └── {{Feature}}Form.tsx
└── _hooks/
    └── use{{Feature}}Filters.ts

src/app/api/{{feature}}s/
├── route.ts                   # GET (list) + POST (create)
└── [id]/route.ts              # GET + PATCH + DELETE
```

## `page.tsx` for the list view (CLIENT)

```tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { {{Feature}}sTable } from './_components/{{Feature}}sTable';

export default function {{Feature}}sPage() {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{{Feature}}s</h1>
        <Button asChild>
          <Link href="/app/{{feature}}s/new">New {{feature}}</Link>
        </Button>
      </header>
      <{{Feature}}sTable />
    </section>
  );
}
```

Per-route metadata for client pages lives at the layout level (server). If this feature needs a specific `<title>`, lift it into a `(app)/{{feature}}s/layout.tsx` server component with a `metadata` export.

## `_components/{{Feature}}sTable.tsx` (CLIENT)

```tsx
'use client';

import { useGet{{Feature}}sQuery } from '@/redux/api/{{feature}}sApi';

export function {{Feature}}sTable() {
  const { data, isLoading, error } = useGet{{Feature}}sQuery();

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-destructive">Failed to load.</p>;
  if (!data?.length) return <p className="text-muted-foreground">No {{feature}}s yet.</p>;

  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b">
          <th className="py-2">Name</th>
          <th className="py-2">Created</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id} className="border-b">
            <td className="py-2">{row.name}</td>
            <td className="py-2 text-muted-foreground">{row.createdAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## `schema.ts` (SHARED with Route Handler)

```ts
import { z } from 'zod';

export const {{feature}}Schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
});

export type {{Feature}}FormValues = z.infer<typeof {{feature}}Schema>;
```

The matching `src/app/api/{{feature}}s/route.ts` imports `{{feature}}Schema` and calls `{{feature}}Schema.safeParse(await req.json())`. One schema, two sides.

## `new/page.tsx` (CLIENT)

```tsx
'use client';

import { {{Feature}}Form } from '../_components/{{Feature}}Form';

export default function New{{Feature}}Page() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">New {{feature}}</h1>
      <{{Feature}}Form mode="create" />
    </section>
  );
}
```

## `[id]/page.tsx` (CLIENT)

```tsx
'use client';

import { useParams } from 'next/navigation';
import { {{Feature}}Form } from '../_components/{{Feature}}Form';

export default function Edit{{Feature}}Page() {
  const params = useParams<{ id: string }>();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit {{feature}}</h1>
      <{{Feature}}Form mode="edit" id={params.id} />
    </section>
  );
}
```

## `_components/{{Feature}}Form.tsx` (CLIENT)

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { FormInputField } from '@/components/forms/FormInputField';
import { UnsavedChangesWarning } from '@/components/UnsavedChangesWarning';
import { useToast } from '@/components/ui/use-toast';
import {
  useCreate{{Feature}}Mutation,
  useUpdate{{Feature}}Mutation,
  useGet{{Feature}}Query,
} from '@/redux/api/{{feature}}sApi';
import { getDefaultValuesFromSchema, unwrapZodEffects } from '@/lib/zod-utils';
import { {{feature}}Schema, type {{Feature}}FormValues } from '../schema';

interface Props {
  mode: 'create' | 'edit';
  id?: string;
}

export function {{Feature}}Form({ mode, id }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const { data: existing } = useGet{{Feature}}Query(id ?? '', { skip: mode !== 'edit' || !id });
  const [create, { isLoading: isCreating }] = useCreate{{Feature}}Mutation();
  const [update, { isLoading: isUpdating }] = useUpdate{{Feature}}Mutation();

  const form = useForm<{{Feature}}FormValues>({
    resolver: zodResolver({{feature}}Schema),
    defaultValues:
      existing ??
      (getDefaultValuesFromSchema(unwrapZodEffects({{feature}}Schema)) as {{Feature}}FormValues),
    values: existing,
  });

  const isSubmitting = isCreating || isUpdating;

  const onSubmit = async (values: {{Feature}}FormValues) => {
    try {
      if (mode === 'create') {
        const created = await create(values).unwrap();
        toast({ title: '{{Feature}} created.' });
        router.replace(`/app/{{feature}}s/${created.id}`);
      } else if (id) {
        await update({ id, patch: values }).unwrap();
        toast({ title: '{{Feature}} updated.' });
      }
    } catch {
      toast({ title: 'Could not save', variant: 'destructive' });
    }
  };

  return (
    <Form {...form}>
      <UnsavedChangesWarning when={form.formState.isDirty && !form.formState.isSubmitting} />
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-4">
        <FormInputField form={form} schema={{feature}}Schema} fieldName="name" label="Name" />
        <FormInputField form={form} schema={{feature}}Schema} fieldName="email" label="Email" type="email" />
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

## Schema unit test — `tests/unit/{{feature}}.schema.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { {{feature}}Schema } from '@/app/(app)/{{feature}}s/schema';

describe('{{feature}}Schema', () => {
  it('accepts a valid payload', () => {
    expect({{feature}}Schema.safeParse({ name: 'Acme', email: 'ops@acme.test' }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect({{feature}}Schema.safeParse({ name: '', email: 'ops@acme.test' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect({{feature}}Schema.safeParse({ name: 'Acme', email: 'nope' }).success).toBe(false);
  });
});
```

## Route Handlers

Always generate the matching `src/app/api/{{feature}}s/route.ts` and `[id]/route.ts` alongside the client-side feature. See [`route-handler.md`](route-handler.md).

## Endpoint additions to the RTK slice

If the domain slice doesn't exist yet, run Mode 3 (`add-api-slice`). Then add the feature's query/mutation pair — see [`api-slice.md`](api-slice.md).

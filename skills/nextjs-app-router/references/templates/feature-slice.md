# Feature slice template (Mode 2 — `add-feature`)

A feature is a route folder under a route group, with its own private `_components/` and `_hooks/`, a local Zod `schema.ts`, and (usually) one or more RTK Query endpoints injected into the appropriate domain slice.

## Layout for feature `{{feature}}` under `(app)`

```
src/app/(app)/{{feature}}/
├── page.tsx                   # SERVER component (renders client child if interactive)
├── loading.tsx
├── error.tsx                  # optional but recommended
├── schema.ts                  # Zod schemas owned by this feature
├── _components/
│   ├── {{Feature}}Table.tsx   # 'use client' if it has interactions
│   └── {{Feature}}Form.tsx    # 'use client'
└── _hooks/
    └── use{{Feature}}Filters.ts
```

For a feature with sub-routes (list + detail + new):

```
src/app/(app)/{{feature}}/
├── page.tsx                   # list
├── new/
│   └── page.tsx               # SERVER renders <{{Feature}}Form mode="create" />
├── [id]/
│   ├── page.tsx               # SERVER renders <{{Feature}}Form mode="edit" id={id} />
│   ├── loading.tsx
│   └── _components/{{Feature}}DetailPanel.tsx
├── schema.ts
├── _components/
│   ├── {{Feature}}Table.tsx
│   └── {{Feature}}Form.tsx
└── _hooks/
```

## `page.tsx` for the list view (SERVER)

```tsx
import { Suspense } from 'react';
import { {{Feature}}Table } from './_components/{{Feature}}Table';

export const metadata = { title: '{{Feature}}s' };

export default function {{Feature}}sPage() {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{{Feature}}s</h1>
      </header>
      <Suspense fallback={<div>Loading…</div>}>
        <{{Feature}}Table />
      </Suspense>
    </section>
  );
}
```

## `_components/{{Feature}}Table.tsx` (CLIENT)

```tsx
'use client';

import { use{{Feature}}sQuery } from '@/redux/api/{{feature}}sApi';

export function {{Feature}}sTable() {
  const { data, isLoading, error } = use{{Feature}}sQuery();

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

## `schema.ts`

```ts
import { z } from 'zod';

export const {{feature}}Schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
});

export type {{Feature}}FormValues = z.infer<typeof {{feature}}Schema>;
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
import { useCreate{{Feature}}Mutation } from '@/redux/api/{{feature}}sApi';
import { getDefaultValuesFromSchema, unwrapZodEffects } from '@/lib/zod-utils';
import { {{feature}}Schema, type {{Feature}}FormValues } from '../schema';

export function {{Feature}}Form() {
  const router = useRouter();
  const { toast } = useToast();
  const [create, { isLoading }] = useCreate{{Feature}}Mutation();

  const form = useForm<{{Feature}}FormValues>({
    resolver: zodResolver({{feature}}Schema),
    defaultValues: getDefaultValuesFromSchema(unwrapZodEffects({{feature}}Schema)) as {{Feature}}FormValues,
  });

  const onSubmit = async (values: {{Feature}}FormValues) => {
    try {
      const created = await create(values).unwrap();
      toast({ title: '{{Feature}} created.' });
      router.replace(`/app/{{feature}}s/${created.id}`);
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
          <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving…' : 'Save'}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
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

## Endpoint additions

If the domain slice doesn't exist yet, run Mode 3 first (`add-api-slice`). Then add the feature's query/mutation pair to that slice — see [`api-slice.md`](api-slice.md).

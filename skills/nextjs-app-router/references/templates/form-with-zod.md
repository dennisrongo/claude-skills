# Form template (React Hook Form + Zod)

## `src/lib/zod-utils.ts`

```ts
import { z, type ZodTypeAny, ZodEffects, ZodObject, ZodOptional, ZodNullable, ZodString, ZodNumber, ZodBoolean, ZodArray, ZodDefault } from 'zod';

/** Peel `.refine()` / `.transform()` / `.superRefine()` layers to reach the underlying schema. */
export function unwrapZodEffects<T extends ZodTypeAny>(schema: T): ZodTypeAny {
  let current: ZodTypeAny = schema;
  while (current instanceof ZodEffects) {
    current = current.innerType();
  }
  return current;
}

/** Walk a Zod object schema and produce a defaults object matching its shape. */
export function getDefaultValuesFromSchema(schema: ZodTypeAny): Record<string, unknown> {
  const inner = unwrapZodEffects(schema);
  if (!(inner instanceof ZodObject)) return {};

  const shape = inner.shape as Record<string, ZodTypeAny>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(shape)) {
    out[key] = defaultFor(field);
  }
  return out;
}

function defaultFor(field: ZodTypeAny): unknown {
  let current: ZodTypeAny = field;
  while (current instanceof ZodEffects) current = current.innerType();

  if (current instanceof ZodDefault) return current._def.defaultValue();
  if (current instanceof ZodOptional) return undefined;
  if (current instanceof ZodNullable) return null;
  if (current instanceof ZodString) return '';
  if (current instanceof ZodNumber) return undefined; // empty number input
  if (current instanceof ZodBoolean) return false;
  if (current instanceof ZodArray) return [];
  if (current instanceof ZodObject) return getDefaultValuesFromSchema(current);
  return undefined;
}

/** Extract `.max(N)` constraints from string fields for `maxLength` attributes. */
export function getMaxLengthsFromSchema(schema: ZodTypeAny): Record<string, number> {
  const inner = unwrapZodEffects(schema);
  if (!(inner instanceof ZodObject)) return {};

  const out: Record<string, number> = {};
  for (const [key, field] of Object.entries(inner.shape as Record<string, ZodTypeAny>)) {
    let current: ZodTypeAny = field;
    while (current instanceof ZodEffects || current instanceof ZodOptional || current instanceof ZodNullable || current instanceof ZodDefault) {
      current = current instanceof ZodDefault ? current._def.innerType : (current as ZodOptional<ZodTypeAny>).unwrap?.() ?? (current as ZodEffects<ZodTypeAny>).innerType?.();
    }
    if (current instanceof ZodString) {
      const max = current._def.checks?.find((c) => c.kind === 'max');
      if (max && 'value' in max) out[key] = max.value as number;
    }
  }
  return out;
}
```

> The exact `_def` access details depend on the Zod major version. Verify against the version chosen at scaffold time (resolve via context7) and adapt — Zod's runtime introspection API has shifted between v3 and later versions.

## Composed form field — `src/components/forms/FormInputField.tsx`

```tsx
'use client';

import type { ComponentProps } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import type { ZodTypeAny } from 'zod';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getMaxLengthsFromSchema } from '@/lib/zod-utils';

interface FormInputFieldProps<TForm extends FieldValues> {
  form: UseFormReturn<TForm>;
  schema?: ZodTypeAny;
  fieldName: Path<TForm>;
  label: string;
  placeholder?: string;
  type?: ComponentProps<typeof Input>['type'];
}

export function FormInputField<TForm extends FieldValues>({
  form,
  schema,
  fieldName,
  label,
  placeholder,
  type = 'text',
}: FormInputFieldProps<TForm>) {
  const maxLengths = schema ? getMaxLengthsFromSchema(schema) : {};
  return (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              maxLength={maxLengths[String(fieldName)]}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
```

**No `dangerouslySetInnerHTML` for the label.** Labels are strings. If a future requirement is "render an inline `<strong>` in the label," accept a `ReactNode` instead of a string — never raw HTML.

## A real form — `src/app/(public)/auth/login/_components/LoginForm.tsx`

The login form uses NextAuth's `signIn` directly — there is no `useLoginMutation` because auth is not a domain in the RTK Query slice.

```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { FormInputField } from '@/components/forms/FormInputField';
import { FormPasswordField } from '@/components/forms/FormPasswordField';
import { getDefaultValuesFromSchema, unwrapZodEffects } from '@/lib/zod-utils';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Required'),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/app/dashboard';
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: getDefaultValuesFromSchema(unwrapZodEffects(loginSchema)) as LoginValues,
  });

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    const res = await signIn('credentials', { ...values, redirect: false });
    if (res?.error) {
      // Don't reveal which field was wrong — security best practice.
      setError('Invalid email or password.');
      return;
    }
    router.replace(returnTo);
    router.refresh();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <FormInputField form={form} schema={loginSchema} fieldName="email" label="Email" type="email" autoComplete="email" />
        <FormPasswordField form={form} schema={loginSchema} fieldName="password" label="Password" autoComplete="current-password" />
        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Form>
  );
}
```

**Why no `useLoginMutation`:** auth flows go through NextAuth (`signIn` / `signOut`), not through RTK Query. RTK Query is for domain data. Keeping these separate avoids the temptation to re-implement session state inside Redux.

## `UnsavedChangesWarning` integration

For non-trivial forms, wrap the submit area with the guard:

```tsx
import { UnsavedChangesWarning } from '@/components/UnsavedChangesWarning';

// inside the form:
<UnsavedChangesWarning when={form.formState.isDirty && !form.formState.isSubmitting} />
```

`UnsavedChangesWarning` uses `window.beforeunload` + a Next router-events listener to prompt before navigating away.

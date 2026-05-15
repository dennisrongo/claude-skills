# Prisma schema (NextAuth + domain)

One `schema.prisma` file holds the NextAuth tables (so the Prisma adapter works) plus your domain models. Verify field shapes against the current `@auth/prisma-adapter` docs via context7 at scaffold time — the adapter's required columns evolve.

## `prisma/schema.prisma`

```prisma
// This file is the source of truth for the database schema.
// Every change goes through `pnpm exec prisma migrate dev --name <slug>`.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------- NextAuth tables ----------
// Shape required by @auth/prisma-adapter. Verify against current adapter docs.

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?

  // Required when the Credentials provider is enabled.
  // OAuth-only users won't have a password — keep it nullable.
  password      String?

  // Custom: optional role for (admin) gating.
  role          String?   @default("user")

  accounts      Account[]
  sessions      Session[]

  // Domain relations:
  customers     Customer[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  // Present even when session.strategy = 'jwt' — the adapter still references it.
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ---------- Domain models ----------

model Customer {
  id        String   @id @default(cuid())
  userId    String
  name      String
  email     String

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

## `prisma/seed.ts` (OPTIONAL — only if Credentials and a test user was requested)

```ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('test1234', 10);

  await db.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      password,
      role: 'admin',
    },
  });

  console.log('Seeded test@example.com / test1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
```

Run with `pnpm db:seed`. **Never seed production.**

## Migration commands

```bash
# Dev (creates a new migration + applies it):
pnpm exec prisma migrate dev --name init

# CI / prod (applies committed migrations without prompting):
pnpm exec prisma migrate deploy

# Regenerate the typed client after a schema change (migrate dev does this for you):
pnpm exec prisma generate

# Inspect the DB visually (dev only):
pnpm exec prisma studio
```

## Forbidden

- `prisma db push` in CI or against any shared database. Use `prisma migrate dev` (development) or `prisma migrate deploy` (everything else).
- Running `prisma migrate reset` without explicit user confirmation — it drops the DB.
- Editing migration files after they've been applied to any non-throwaway database. Create a follow-up migration instead.
- Adding domain tables that reference `Account` or `Session` directly. Those are NextAuth's tables; reference `User` instead.
- Storing OAuth tokens or sensitive secrets in domain models — they belong in `Account` (which NextAuth populates).
- Plain-text passwords. Always `bcrypt.hash(password, 10)` (or higher cost factor) before storing.

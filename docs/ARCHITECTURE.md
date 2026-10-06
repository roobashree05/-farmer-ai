# Architecture

AIJewel CRM is a modular monorepo. The web app talks only to the NestJS API. The API owns validation, permissions, and persistence. External systems are interfaces with a mock implementation selected by environment variables.

## Why NestJS

The API uses NestJS rather than a single Express file. Modules keep leads, WhatsApp, campaigns, meetings, calls, and knowledge independent. Guards enforce roles on the server. Providers are registered in one integration module, so CRM services depend on `WhatsAppProvider` and not on Meta HTTP details.

## Runtime

```text
Browser (Next.js)
    -> REST /api
        -> NestJS modules
            -> Prisma -> PostgreSQL
            -> FileStorageProvider -> local directory
            -> WhatsAppProvider / MetaProvider / AIProvider / VoiceProvider / CalendarProvider
```

`DEMO_MODE=true` selects the mock providers. Business services do not branch on vendor SDKs.

## Layout

```text
apps/web          Next.js dashboard
apps/api          NestJS API and worker entrypoint
packages/shared   Validation, personalization, AI grounding, voice state machine
packages/types    Frontend response types
packages/ui       Buttons, badges, page header, stat cards
database/         Prisma schema, migrations, seed
mocks/            WhatsApp group fixture and provider notes
infrastructure/docker
```

## Provider seam

`IntegrationsModule` reads `WHATSAPP_PROVIDER`, `META_PROVIDER`, `AI_PROVIDER`, `VOICE_PROVIDER`, `CALENDAR_PROVIDER`, and `STORAGE_PROVIDER`. `mock` or `local` constructs the in-process adapter. Any other value fails startup with `PROVIDER_NOT_CONFIGURED` instead of pretending a live integration exists.

## Request path

1. Request id middleware stores `requestId` and client IP.
2. JWT guard loads the user and current permissions from PostgreSQL.
3. Permission guard checks route metadata.
4. Validation pipe checks DTOs.
5. Services write audit rows and notifications.
6. The response interceptor returns `{ success, data }` and logs method, path, status, and duration. It does not log bodies, passwords, or tokens.
7. The exception filter returns `{ success: false, errorCode, message }` and logs unexpected stacks only on the server.

## Lead scale

There is no application lead cap. Lists use `skip`/`take`, filters, whitelisted sorting, and indexes. CSV import classifies duplicates in batches with `phone IN (...)` instead of loading every lead into the browser or into one memory set of the full table beyond the current chunk plus an in-file phone set.

Phone uniqueness for active leads is a partial unique index (`deletedAt IS NULL`), so a merged or deleted phone can be reused.

## Worker

`apps/api/src/worker.ts` starts only the scheduler. It executes due campaigns, meeting reminders, and follow-up notifications. Docker Compose runs the worker with `SCHEDULER_ENABLED=true` and the API with it false. Local `npm run dev` runs the scheduler inside the API.

## AWS shape

The same modules can later point at RDS, S3, ElastiCache, and real provider classes. See [AWS_MIGRATION.md](AWS_MIGRATION.md).

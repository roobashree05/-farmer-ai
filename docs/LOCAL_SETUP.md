# Local setup

The supported laptop path is Docker Desktop on Windows, macOS, or Linux. The app itself is Node 22.

## Windows

1. Install Docker Desktop and Node.js 22.
2. Clone the repository.
3. In PowerShell:

```powershell
copy .env.example .env
```

4. Edit `.env` and replace `JWT_SECRET` and `JWT_REFRESH_SECRET` with long random strings.
5. Start infrastructure:

```powershell
docker compose -f docker-compose.dev.yml up -d
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Or start the whole stack:

```powershell
docker compose up --build
```

Open http://localhost:3000.

`POSTGRES_PASSWORD` in Compose defaults to `aijewel` for the local database only. Do not reuse that password in a shared environment. Override it in `.env` if you want a different local password, and keep `DATABASE_URL` in agreement when you are not using the dev Compose file.

## Linux without Docker

PostgreSQL 16 can be installed with the OS packages. Create the role and databases, then use the same Prisma commands. Redis is optional for this build.

```bash
sudo -u postgres psql -c "CREATE ROLE aijewel LOGIN PASSWORD 'aijewel' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE aijewel OWNER aijewel;"
```

## Environment

See `.env.example`. Provider switches:

```text
WHATSAPP_PROVIDER=mock
META_PROVIDER=mock
AI_PROVIDER=mock
VOICE_PROVIDER=mock
CALENDAR_PROVIDER=mock
STORAGE_PROVIDER=local
DEMO_MODE=true
```

`WHATSAPP_PROVIDER=mock` is the laptop default. To send and receive real WhatsApp messages, set `WHATSAPP_PROVIDER=meta` and fill `META_WABA_ID`, `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_GRAPH_API_VERSION`, `META_WEBHOOK_VERIFY_TOKEN`, and `PUBLIC_BASE_URL`. Supported versions are `v21.0` through `v26.0`. `v25.0` is the version named by the Cloud API send-messages guide. The API refuses to start when `meta` is selected and any of those values are missing or invalid. After it starts, open Settings and run Test WhatsApp connection. The page stays on `untested` until that Graph call succeeds. Point the Meta webhook at `{PUBLIC_BASE_URL}/api/webhooks/whatsapp` and subscribe to the `messages` field.

`AI_PROVIDER=mock` is the laptop default. To answer from Claude, set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` is optional and defaults to `claude-sonnet-5`. The API refuses to start when `anthropic` is selected and the key or model is missing or invalid. After it starts, open Settings and run Test Claude connection. The page stays on `untested` until that models call succeeds. Answers still have to stay inside the knowledge base.

`NEXT_PUBLIC_DEMO_PASSWORD` is what the login form fills in. Keep it the same as `SEED_PASSWORD`. `DEMO_MODE` only changes the Settings and health flags. It does not switch providers. `npm run dev` starts the web app from `apps/web`, and that process loads `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_DEMO_EMAIL`, and `NEXT_PUBLIC_DEMO_PASSWORD` from the repository root `.env`.

`JWT_REFRESH_SECRET` is reserved. The API stores refresh tokens as SHA-256 hashes of random values and does not read that variable. `REDIS_URL` is reserved for a later rate limiter. `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are read by Docker Compose and must match `DATABASE_URL`.

`UPLOAD_DIRECTORY` is the recording folder. It is created on demand and is gitignored.

## Seed logins

All seeded users share `SEED_PASSWORD`.

| Email | Role |
| --- | --- |
| admin@aijewel.local | ADMIN |
| manager@aijewel.local | MARKETING_MANAGER |
| executive@aijewel.local | MARKETING_EXECUTIVE |
| sales@aijewel.local | SALES |
| management@aijewel.local | MANAGEMENT |

## Time zone

Meetings use `Asia/Kolkata` wall-clock times. Set `TZ=Asia/Kolkata` in Docker and on the laptop if you want server logs in the same zone. Stored timestamps are UTC.

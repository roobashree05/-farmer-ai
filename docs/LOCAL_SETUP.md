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

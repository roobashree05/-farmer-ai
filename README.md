# AIJewel CRM

Local-first CRM for jewellery retail: leads, WhatsApp, campaigns, meetings, call recordings, and a knowledge-base voice bot.

The business workflow runs on a laptop with Docker and mock providers. PostgreSQL, files, and the API do not call Meta, WhatsApp, or a telephony network. Those providers sit behind interfaces so a later AWS deployment can replace the mocks without rewriting CRM rules.

## Stack

- Next.js, React, TypeScript, Tailwind CSS
- NestJS REST API
- PostgreSQL and Prisma migrations
- Redis is present in Docker Compose for a later cache or queue
- Jest and Playwright

NestJS is the API framework because modules, dependency injection, guards, and Swagger match the provider and permission boundaries.

## Quick start

```bash
cp .env.example .env
# Put a long random JWT_SECRET and JWT_REFRESH_SECRET in .env
docker compose -f docker-compose.dev.yml up -d
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/health
- OpenAPI: http://localhost:4000/docs

Seeded admin: `admin@aijewel.local`. Password: the `SEED_PASSWORD` in `.env` (`Local-demo-1234` in the example file).

Full stack, including the API and web containers:

```bash
docker compose up --build
```

More detail is in [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Demo path

1. Sign in as admin.
2. Open Imports and import the Hyderabad WhatsApp group (500 contacts).
3. Open one imported lead.
4. Send a WhatsApp message and read the simulated customer reply and knowledge-base answer.
5. Create a personalized campaign, preview it, schedule it, and execute it.
6. Book a meeting from the lead page and find it on the calendar.
7. Start the voice bot from the lead page and play the recording.
8. Confirm the lead timeline, dashboard, notifications, and audit log.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API, shared package watch, and web |
| `npm test` | Unit tests |
| `npm run test:integration` | API tests against PostgreSQL |
| `npm run test:e2e` | Playwright UI test |
| `npm run perf -- 1000` | Insert N extra leads and time a paged query |
| `npm run lint` | Typecheck workspaces |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Project plan](docs/PROJECT_PLAN.md)
- [Database](docs/DATABASE.md)
- [API modules](docs/API_MODULES.md)
- [Local setup](docs/LOCAL_SETUP.md)
- [API overview](docs/API.md)
- [Testing](docs/TESTING.md)
- [AWS migration](docs/AWS_MIGRATION.md)
- [Integrations](docs/INTEGRATIONS.md)
- [Security](docs/SECURITY.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.md)

# Project plan

The build follows the phase order in the product brief. Each phase is a vertical slice: schema or module, API, UI where the phase is visible, and tests.

| Phase | Delivered behavior |
| --- | --- |
| 1 Foundation | Workspaces, Docker Compose, health check, lint, shared package |
| 2 Database and auth | Prisma schema, migrations, seed, JWT, five roles |
| 3 Leads | CRUD, search, filters, CSV import, bulk actions, timeline, no lead cap |
| 4 WhatsApp | Mock provider, conversations, delivery status, simulated reply |
| 5 Campaigns | Meta and social campaign records, calendar items |
| 6 Knowledge and AI | Categories, grounded answers, escalation |
| 7 Personalization | Variable replacement, preview, draft-to-report workflow |
| 8 Calls | Manual calls, local recordings, playback permission |
| 9 Calendar | Mock availability, booking, cancel, reschedule |
| 10 Voice bot | State machine, transcript, recording |
| 11 Dashboard | Counts, reports, CSV export, notifications, customer 360 |
| 12 Audit and security | Audit log, helmet, redaction, permission tests |
| 13 Tests | Unit, integration workflow, Playwright login/lead |
| 14 Performance | `scripts/perf-leads.ts` for 1,000 and larger batches |
| 15 Local run | Compose files, seed, setup docs |

## External systems that stay mocked locally

| System | Interface | Local class |
| --- | --- | --- |
| WhatsApp | `WhatsAppProvider` | `MockWhatsAppProvider` |
| Meta ads | `MetaProvider` | `MockMetaProvider` |
| AI | `AIProvider` | `MockAIProvider` |
| Voice | `VoiceProvider` | `MockVoiceProvider` |
| Calendar | `CalendarProvider` | `MockCalendarProvider` |
| Files | `FileStorageProvider` | `LocalFileStorageProvider` |

Redis is started for later rate limits or queues. The current login limiter is in memory.

## Branching

`main` is the integration branch. Feature work belongs on `feature/*` branches (or the delivery branch used by this change). Do not commit `.env`, recordings, or `node_modules`.

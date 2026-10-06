# API modules

Base path: `/api`. Interactive docs: `/docs`.

| Module | Routes | Responsibility |
| --- | --- | --- |
| auth | `/api/auth/login`, `/refresh`, `/logout`, `/me` | Password check, JWT, refresh rotation |
| users | `/api/users` | Create and update users and roles |
| leads | `/api/leads` | Search, CRUD, notes, follow-ups, convert, merge, bulk, CSV, WhatsApp group import, export |
| customers | `/api/customers` | Customer list and 360 workspace |
| whatsapp | `/api/whatsapp/conversations` | Inbox, send, mock reply, AI answer |
| campaigns | `/api/campaigns`, `/api/templates`, `/api/segments` | Drafts, preview, transitions, mock execution |
| meetings | `/api/meetings`, `/api/calendar` | Slots, booking, cancel, reschedule, calendar feed |
| calls | `/api/calls` | Manual calls, voice bot, recording upload and stream |
| knowledge-base | `/api/knowledge-base` | Categories and entries |
| ai | `/api/ai/reply`, `/api/ai/summarize` | Grounded answer and escalation |
| notifications | `/api/notifications` | Per-user inbox |
| reports | `/api/dashboard`, `/api/reports` | Dashboard counts and campaign CSV |
| search | `/api/search` | Leads, campaigns, conversations |
| audit | `/api/audit` | Filterable audit log |
| settings | `/api/settings` | Provider names and lead statuses |
| health | `/api/health`, `/api/health/ready` | Liveness and database |

Success responses are `{ "success": true, "data": ... }`. Errors are `{ "success": false, "errorCode": "...", "message": "..." }`.

Permission codes live in `packages/shared/src/permissions.ts` and are copied into the database by the seed. The API reads the database on each request, so a role change applies on the next call.

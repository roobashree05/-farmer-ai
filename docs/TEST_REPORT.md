# Test report

Measured on this environment on 6 October 2026. PostgreSQL 16 was local. Docker was not installed, so Compose was not part of this run.

## Unit

`npm test`

- `@aijewel/shared`: 14 passed
- `@aijewel/api` unit: 2 passed (`redact`, no application lead cap)

## Integration

`npm run test:integration` passed before the campaign-failure notification change: 5 tests. The suite signs in, rejects a bad password, creates a lead, rejects a duplicate, imports 500 WhatsApp contacts twice, sends a mock WhatsApp message, checks AI escalation, previews and executes a campaign, books a meeting, runs the voice bot, streams a wav, denies a marketing executive the recording, and reads the timeline, dashboard, and audit log.

## End to end

Playwright Chromium:

- `demo-workflow.spec.ts` passed: login, import of 500 group contacts, open the first contact, send WhatsApp, see the grounded warranty answer and READ, preview a personalized message, move the campaign to REPORT, book a meeting, start the voice bot, and see the recording control.
- `crm.spec.ts` passes: login, dashboard, create a lead with a blank email, and search for that lead.

## Performance

`npm run perf` against the seeded database. Each run deletes previous `+9170` rows, inserts with `createMany` in batches of 1,000, then reads 25 rows.

| Inserted | Insert | Page query | Active leads after insert |
| --- | ---: | ---: | ---: |
| 1,000 | 99 ms | 4 ms | 1,100 |
| 10,000 | 903 ms | 5 ms | 10,100 |
| 50,000 | 4,354 ms | 15 ms | 50,100 |
| 100,000 | 9,706 ms | 34 ms | 100,100 |

With 100,100 leads still loaded, the API returned:

| Request | Time |
| --- | ---: |
| `GET /api/leads?page=1&pageSize=25` | 15 ms, 25 rows |
| `GET /api/leads?page=1&pageSize=25&q=Perf Shop 1` | 136 ms, 22,000 matches, 25 rows |
| `GET /api/leads?page=4000&pageSize=25` | 29 ms |
| `GET /api/dashboard` | 100 ms |
| `GET /api/search?q=Perf Lead 50000` | 206 ms, 1 lead |

The browser list asks for 25 rows. It does not receive the full table.

## Not verified here

- `docker compose up`
- Desktop widths 1920, 1366, and 1440, and a tablet width, in a real browser window

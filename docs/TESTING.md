# Testing

## Unit

```bash
npm test
```

Covers phone and email validation, CSV parsing, duplicate classification, personalization, campaign transitions, knowledge-base answers, permissions, the voice state machine, calendar slots, and audit redaction. These tests do not need PostgreSQL.

The knowledge tests assert that a known price is quoted from the pricing entry and that an unknown product does not receive an invented price.

## Integration

Requires PostgreSQL and a migrated `aijewel_test` database.

```bash
npm run test:integration
```

The script migrates, truncates, seeds, and runs `apps/api/test/integration/workflow.spec.ts`. The test signs in, creates a lead, rejects a duplicate, imports 500 WhatsApp contacts twice, sends a mock WhatsApp message, checks AI escalation, previews and executes a campaign, books a meeting, runs the voice bot, streams the wav, and reads the timeline and dashboard.

## End to end

Start the app (`npm run dev`), then:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright signs in, checks the dashboard, creates a lead, and searches for it.

## Performance

```bash
npm run perf -- 1000
npm run perf -- 10000
```

The script inserts leads with `createMany` in batches of 1,000 and times a filtered `take: 25` query. It does not load the result set into the browser. Use it on the laptop before a 50,000 or 100,000 run. Results belong in `docs/TEST_REPORT.md` after a real run.

## What a passing suite does not prove

Mock providers do not prove Meta, WhatsApp, or telephony certification. They prove the CRM workflow and the boundaries where those providers will be attached.

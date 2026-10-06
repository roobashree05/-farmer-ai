# Known limitations

- WhatsApp, Meta, voice, calendar, and AI are mocks. They do not deliver messages, spend money, or place phone calls.
- The mock WhatsApp reply is a fixed warranty question so the local demo can show a grounded answer. It is not a customer simulator with open-ended intent.
- Mock campaign metrics are deterministic hashes, not ad-platform statistics.
- The voice recording is a generated tone, not captured audio.
- Login rate limiting is in memory and resets when the process restarts. Redis is available in Compose but is not required for the current features.
- JWT access tokens live in `sessionStorage`. See SECURITY.md before a production rollout.
- Export and bulk routes process bounded batches per HTTP request. That does not limit how many leads can be stored.
- Meeting slots use Asia/Kolkata business hours. Other time zones need a per-company calendar setting that is not built yet.
- There is no S3 client, Terraform, or production secret store. AWS_MIGRATION.md describes the adapter points.
- Playwright covers login, dashboard, lead create, and search. The longer business workflow is covered by the API integration test.
- Performance numbers depend on the laptop. Run `npm run perf` locally for 10,000, 50,000, and 100,000 if the machine can take the insert time.
- Seeded campaign rows include a few statuses so the calendar and reports are not empty. They are sample data, not proof of a live ad account.

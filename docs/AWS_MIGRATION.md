# AWS migration

Do not deploy this repository to AWS until the local acceptance tests pass. The migration is a hosting and adapter change.

| Local | AWS | What changes |
| --- | --- | --- |
| Docker PostgreSQL | Amazon RDS for PostgreSQL | `DATABASE_URL` |
| `UPLOAD_DIRECTORY` | Amazon S3 | New `FileStorageProvider` implementation registered when `STORAGE_PROVIDER=s3` |
| Redis container | ElastiCache | `REDIS_URL`, then move the login rate limiter off process memory |
| `npm run dev` / API container | ECS or Fargate | Same image as `infrastructure/docker/api.Dockerfile` |
| `.env` file | Secrets Manager or SSM | Inject the same variable names |
| stdout JSON logs | CloudWatch | Ship the existing JSON log lines |
| `MockAIProvider` | Bedrock or another approved model | New `AIProvider` that still receives only knowledge-base documents |
| `MockWhatsAppProvider` | Meta WhatsApp Cloud API | New `WhatsAppProvider` |
| `MockMetaProvider` | Meta Marketing API | New `MetaProvider` |
| `MockVoiceProvider` | Approved telephony vendor | New `VoiceProvider` |
| `MockCalendarProvider` | Google or Microsoft calendar | New `CalendarProvider` |

Business services should keep calling the interfaces in `apps/api/src/integrations`. Do not import the AWS SDK into lead or campaign services.

## Data

Take a Postgres dump, restore it to RDS, and run `prisma migrate deploy` before serving traffic. Copy recording files to S3 using the existing `storageKey` as the object key.

`pg_trgm` must be available on RDS. The migration creates the extension.

## Secrets

`JWT_SECRET` and `JWT_REFRESH_SECRET` must be new production values. Do not copy the laptop `.env`.

## Not in this repository

There is no Terraform, ECS task definition, or working S3 client. Adding a class that claims to upload without credentials would hide the gap. Implement `S3FileStorageProvider` when the bucket and task role exist, and select it with `STORAGE_PROVIDER=s3`.

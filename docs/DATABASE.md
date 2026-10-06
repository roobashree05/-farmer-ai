# Database

PostgreSQL is the only database. Prisma schema: `database/schema.prisma`. Migrations: `database/migrations`. Seed: `database/seed/seed.ts`.

Do not edit data by hand. Change the schema and add a migration.

## Relationships

```text
Role *--* Permission
User *--1 Role
Lead *--1 LeadStatusDefinition
Lead *--1 LeadSource
Lead *--1 User (assignee)
Lead *--1 Company
Lead 1--1 Customer
Lead 1--* Note, Activity, FollowUp, Call, Meeting, Conversation, CampaignMessage, AIConversation
WhatsAppGroup 1--* WhatsAppGroupMember *--1 Lead
Campaign 1--* CampaignMessage
Campaign 1--* CampaignMetric
Call 1--1 CallRecording
KnowledgeBase 1--* KnowledgeBaseDocument
AIConversation 1--* AIMessage
```

`Company` is the shop record. `Lead.shopName` is also stored on the lead so shop search does not require a join and can use its own index.

## Lead statuses

Statuses are rows, not a Postgres enum, so an admin can add one. Seeded codes: `NEW`, `CONTACTED`, `QUALIFIED`, `MEETING_SCHEDULED`, `FOLLOW_UP`, `CONVERTED`, `LOST`.

## Indexes

Leads are indexed on phone, email, shop name, status, source, assignee, location, name, `createdAt`, `updatedAt`, plus `(assignedUserId, statusId)`, `(leadSourceId, createdAt)`, and `(deletedAt, createdAt)`.

A partial unique index keeps one active lead per phone. `pg_trgm` indexes support `ILIKE` search on name, shop, and phone.

Campaign metrics are unique per campaign and date. Audit logs are indexed by entity, user, action, and time.

## Files

Call recordings are not bytea columns. `CallRecording.storageKey` is a relative key. `LocalFileStorageProvider` joins it to `UPLOAD_DIRECTORY`.

## Unlimited storage

No `MAX_LEADS` check exists. A single export streams in batches of 500. Bulk actions accept up to 1,000 ids per request so one HTTP call stays bounded; that is a request size, not a storage quota. Call the endpoint again for the next batch.

## Seed volume

10 users, 100 leads, 20 customers, 10 campaigns, 20 conversations, about 50 messages, 10 calls with wav files, 5 meetings, 10 knowledge entries, and 500 WhatsApp group members. The group members become leads when the import runs.

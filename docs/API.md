# API

OpenAPI is generated from the Nest controllers and served at `/docs` after the API starts. Authorize with `Bearer <accessToken>` from `POST /api/auth/login`.

## Auth

`POST /api/auth/login`

```json
{ "email": "admin@aijewel.local", "password": "Local-demo-1234" }
```

Response `data` contains `accessToken`, `refreshToken`, and `user` with `permissions`. Access tokens expire in 15 minutes. `POST /api/auth/refresh` rotates the refresh token. Reuse of a revoked refresh token revokes the user's remaining refresh tokens.

## Errors

```json
{ "success": false, "errorCode": "LEAD_NOT_FOUND", "message": "Lead was not found" }
```

Validation errors use `VALIDATION_ERROR`. Permission failures use `FORBIDDEN`. Unexpected failures use `INTERNAL_ERROR` and do not include a stack.

## Leads

`GET /api/leads?page=1&pageSize=25&q=kumar&status=NEW&source=WHATSAPP_GROUP&location=Hyderabad&sortBy=createdAt&sortDir=desc`

`pageSize` cannot exceed 100. `sortBy` is limited to `name`, `shopName`, `createdAt`, `updatedAt`, and `displayId`.

`POST /api/leads/import` is multipart with `file` and optional `mapping` JSON. The mapping keys are `name`, `phone`, `whatsappNumber`, `email`, `shopName`, `location`, `leadSource`, `status`, `tags`, `notes`, `customerCategory`, `previousEnquiry`, and `assignedEmail`.

`POST /api/leads/import/whatsapp-group` reads `WHATSAPP_GROUP_FIXTURE` when no file is uploaded.

## Campaign preview

`POST /api/campaigns/:id/preview` with `{ "leadIds": ["..."] }` returns the rendered text. Variables are `customer_name`, `shop_name`, `location`, `contact_person`, and `previous_interest`.

Personalized transitions: `DRAFT -> REVIEW -> APPROVED -> SCHEDULED -> SENT -> REPORT`.

Meta, WhatsApp, and social transitions: `DRAFT -> APPROVAL -> SCHEDULED -> RUNNING -> PAUSED | COMPLETED | FAILED`.

`APPROVED` and `APPROVAL` require `campaigns.approve`. Execution requires `campaigns.send`.

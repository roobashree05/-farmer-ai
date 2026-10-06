# Security

- Passwords are hashed with bcrypt (cost 12). The API never returns `passwordHash`.
- Audit payloads pass through `redact`, which replaces keys matching password, token, secret, or authorization.
- Access tokens are JWTs. Refresh tokens are random and stored as SHA-256 hashes.
- Login attempts are limited to 10 per minute per IP in the API process.
- Permissions are checked in Nest guards and, for a few multi-action routes, again in the controller. Hiding a button is not the control.
- DTOs use `class-validator`. The validation pipe strips unknown fields.
- Prisma parameterizes queries.
- React renders message text as text, not HTML.
- Helmet sets secure headers on the API. The web app sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and a locked-down permissions policy.
- Recording download requires `recordings.read` and writes `RECORDING_ACCESSED`.
- Secrets come from the environment. `.env` is gitignored. `.env.example` has placeholders.
- Logs include timestamp, level, service, request id, user id, and message. They do not include request bodies.

## Token storage

The browser keeps the access and refresh tokens in `sessionStorage` and sends `Authorization: Bearer`. That avoids CSRF on cookie-authenticated POST requests. It is still visible to any script running on the origin. Before production, move the refresh token to an `HttpOnly` `Secure` cookie and add a CSRF token for cookie-authenticated requests.

## CSRF

Bearer tokens are not sent automatically by the browser, so classic CSRF does not apply to the current API. Cookie sessions would need CSRF protection.

## SQL and XSS

There is no string-built SQL in the CRM services. Do not introduce `dangerouslySetInnerHTML` for message bodies.

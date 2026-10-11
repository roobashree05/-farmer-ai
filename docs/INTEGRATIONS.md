# Integrations

## WhatsApp

`WHATSAPP_PROVIDER=mock` keeps `MockWhatsAppProvider`. `sendMessage` returns `SENT` and advances `getMessageStatus` through `DELIVERED` and `READ`. After a CRM user sends a message, the service stores that status trail, inserts a simulated inbound warranty question, and asks `AIProvider` to answer from the knowledge base. The answer is stored as another outbound message and as `AIMessage` rows. That path does not call Meta.

`WHATSAPP_PROVIDER=meta` constructs `MetaWhatsAppProvider` only when every required variable is present and valid. Selecting `meta` is not a connection. Settings reports `configuration` as `missing` or `invalid`, and `connection` stays `untested` until `POST /api/settings/whatsapp/connection-test` receives a successful Graph response for the configured phone number id. The test reads `id`, `display_phone_number`, and `verified_name`. It does not send a WhatsApp message.

Required variables: `META_WABA_ID`, `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_GRAPH_API_VERSION`, `META_WEBHOOK_VERIFY_TOKEN`, and `PUBLIC_BASE_URL`. Tokens and the app secret stay in the API process. They are not returned by settings, written into audit payloads, or logged.

Supported Graph API versions, as of October 2026: `v21.0`, `v22.0`, `v23.0`, `v24.0`, `v25.0`, and `v26.0`. Use `v25.0` unless Meta's Cloud API send-messages guide names a newer version you have already tested. `v20.0` and older are rejected. The client calls `https://graph.facebook.com/{version}/{phone-number-id}/messages` with the access token in the `Authorization` header.

A text send is allowed only inside the 24-hour customer service window, counted from the latest inbound WhatsApp message. Outside that window the API returns `WHATSAPP_SESSION_CLOSED` and does not call Meta. Approved templates use the same send route with `templateName`, optional `templateLanguage` (`en` or `en_US`), and ordered `variables`. The HTTP response stores status `SENT` and the returned `wamid`. `SENT` means Meta accepted the request. `DELIVERED`, `READ`, and `FAILED` are applied only from webhook status events, and a status never moves backwards.

`GET /api/webhooks/whatsapp` answers Meta's subscription challenge when `hub.mode` is `subscribe` and `hub.verify_token` matches `META_WEBHOOK_VERIFY_TOKEN`. The comparison hashes both values before `timingSafeEqual`. The response is the raw challenge, not the usual JSON envelope. `POST /api/webhooks/whatsapp` checks `X-Hub-Signature-256` against the exact raw body and `META_APP_SECRET`. Invalid signatures are rejected. A valid payload is acknowledged with HTTP 200. Inbound messages are matched to a conversation by phone, or a lead is created when the number is new. Repeated `wamid` values are ignored. The callback URL is `{PUBLIC_BASE_URL}/api/webhooks/whatsapp`.

The same text sent again within 20 seconds, or the same `Idempotency-Key`, does not make a second Meta call. Media bytes are not downloaded. Non-text inbound messages are stored as their caption or a type label such as `[image]`.

`GET /api/whatsapp/stream` is a server-sent event stream for the open CRM session. It pushes message and status ids so the existing thread reloads. The stream is in-process, so one API instance is the real-time boundary.

A repeated group import uses the active-lead phone index, so the same 500 contacts do not create a second set of leads. Group membership is upserted by group and phone.

## Meta

`MockMetaProvider.getPerformance` derives spend, impressions, reach, clicks, leads, engagement, and conversions from the campaign id. The numbers are stable for a given id. Execution writes one `CampaignMetric` row and campaign messages for the selected leads.

## AI

`MockAIProvider` scores token overlap against active knowledge documents. If the question asks for a price, only documents that contain a number are eligible. Below a 0.34 score, `escalateToHuman` is true and the text says the answer is not in the knowledge base. The response quotes the document; it does not add facts.

`summarizeConversation` keeps the latest turns. `classifyLead` maps a few phrases to a suggested status. The CRM does not auto-overwrite status from that suggestion except where a specific workflow, such as conversion, sets it.

## Voice

`runVoiceBot` is a map of state handlers, not one function full of branches. States run in order: greeting, identify, requirement, answer, qualify, book meeting, or transfer, then end. Low confidence skips qualification and transfers to a human. `MockVoiceProvider` stores the transcript and returns a generated WAV tone. The file is saved through `FileStorageProvider`.

## Calendar

Slots are every 30 minutes from 09:00 to 17:00 Asia/Kolkata. A slot is busy when it overlaps a `SCHEDULED` meeting or is in the past. Booking also rejects ranges outside those hours and host conflicts. The mock calendar returns an `externalEventId`.

## Files

`LocalFileStorageProvider` refuses absolute keys and `..`. The database stores the relative key only.

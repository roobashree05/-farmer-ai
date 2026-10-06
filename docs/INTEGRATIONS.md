# Integrations

## WhatsApp

`MockWhatsAppProvider.sendMessage` returns `SENT` and advances `getMessageStatus` through `DELIVERED` and `READ`. After a CRM user sends a message, the service stores that status trail, inserts a simulated inbound warranty question, and asks `AIProvider` to answer from the knowledge base. The answer is stored as another outbound message and as `AIMessage` rows.

`sendTemplate` is on the interface for a future Meta template call. The mock delegates to `sendMessage`.

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

-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "WhatsAppMessage" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN "errorCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_providerMessageId_key" ON "WhatsAppMessage"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_conversationId_idempotencyKey_key" ON "WhatsAppMessage"("conversationId", "idempotencyKey");

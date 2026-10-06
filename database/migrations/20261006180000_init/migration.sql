-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'MARKETING_MANAGER', 'MARKETING_EXECUTIVE', 'SALES', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "CampaignKind" AS ENUM ('META', 'PERSONALIZED', 'WHATSAPP', 'SOCIAL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVAL', 'APPROVED', 'SCHEDULED', 'RUNNING', 'PAUSED', 'SENT', 'COMPLETED', 'REPORT', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('MANUAL', 'VOICE_BOT');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('SCHEDULED', 'RINGING', 'ANSWERED', 'COMPLETED', 'MISSED', 'FAILED');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('COMPANY', 'PRODUCT', 'PRICING', 'FAQ', 'SUPPORT', 'WARRANTY', 'DEMO', 'SALES');

-- CreateEnum
CREATE TYPE "AiRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('CSV', 'WHATSAPP_GROUP');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStatusDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadStatusDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "LeadTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "displayId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "shopName" TEXT,
    "location" TEXT,
    "leadSourceId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "companyId" TEXT,
    "customerCategory" TEXT,
    "previousEnquiry" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "whatsappGroupId" TEXT,
    "whatsappGroupName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTagOnLead" (
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "LeadTagOnLead_pkey" PRIMARY KEY ("leadId","tagId")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "shopName" TEXT,
    "location" TEXT,
    "category" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "whatsappNumber" TEXT,
    "companyId" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CampaignKind" NOT NULL,
    "platform" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audience" TEXT,
    "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "content" TEXT NOT NULL,
    "creative" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "leadIds" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMessage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMetric" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CampaignMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppGroup" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "leadId" TEXT,

    CONSTRAINT "WhatsAppGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "providerMessageId" TEXT,
    "statusEvents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "customerId" TEXT,
    "employeeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "callType" "CallType" NOT NULL,
    "status" "CallStatus" NOT NULL,
    "notes" TEXT,
    "outcome" TEXT,
    "followUpAt" TIMESTAMP(3),
    "transcript" TEXT,
    "summary" TEXT,
    "voiceState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRecording" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "meetingType" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attendeeName" TEXT NOT NULL,
    "attendeePhone" TEXT NOT NULL,
    "attendeeEmail" TEXT,
    "externalEventId" TEXT,
    "notes" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBaseDocument" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiRole" NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "escalateToHuman" BOOLEAN NOT NULL DEFAULT false,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipAddress" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filterJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successful" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "invalid" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeadStatusDefinition_code_key" ON "LeadStatusDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_code_key" ON "LeadSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeadTag_name_key" ON "LeadTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_displayId_key" ON "Lead"("displayId");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_shopName_idx" ON "Lead"("shopName");

-- CreateIndex
CREATE INDEX "Lead_statusId_idx" ON "Lead"("statusId");

-- CreateIndex
CREATE INDEX "Lead_leadSourceId_idx" ON "Lead"("leadSourceId");

-- CreateIndex
CREATE INDEX "Lead_assignedUserId_idx" ON "Lead"("assignedUserId");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_updatedAt_idx" ON "Lead"("updatedAt");

-- CreateIndex
CREATE INDEX "Lead_location_idx" ON "Lead"("location");

-- CreateIndex
CREATE INDEX "Lead_name_idx" ON "Lead"("name");

-- CreateIndex
CREATE INDEX "Lead_deletedAt_createdAt_idx" ON "Lead"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedUserId_statusId_idx" ON "Lead"("assignedUserId", "statusId");

-- CreateIndex
CREATE INDEX "Lead_leadSourceId_createdAt_idx" ON "Lead"("leadSourceId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadTagOnLead_tagId_idx" ON "LeadTagOnLead"("tagId");

-- CreateIndex
CREATE INDEX "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadActivity_type_idx" ON "LeadActivity"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_leadId_key" ON "Customer"("leadId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_shopName_idx" ON "Customer"("shopName");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_leadId_idx" ON "Contact"("leadId");

-- CreateIndex
CREATE INDEX "Contact_customerId_idx" ON "Contact"("customerId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_kind_idx" ON "Campaign"("kind");

-- CreateIndex
CREATE INDEX "Campaign_startDate_idx" ON "Campaign"("startDate");

-- CreateIndex
CREATE INDEX "Campaign_platform_idx" ON "Campaign"("platform");

-- CreateIndex
CREATE INDEX "Campaign_createdById_idx" ON "Campaign"("createdById");

-- CreateIndex
CREATE INDEX "CampaignMessage_campaignId_idx" ON "CampaignMessage"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMessage_leadId_idx" ON "CampaignMessage"("leadId");

-- CreateIndex
CREATE INDEX "CampaignMetric_date_idx" ON "CampaignMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMetric_campaignId_date_key" ON "CampaignMetric"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_phone_key" ON "WhatsAppContact"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_waId_key" ON "WhatsAppContact"("waId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContact_leadId_key" ON "WhatsAppContact"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppGroup_externalId_key" ON "WhatsAppGroup"("externalId");

-- CreateIndex
CREATE INDEX "WhatsAppGroupMember_phone_idx" ON "WhatsAppGroupMember"("phone");

-- CreateIndex
CREATE INDEX "WhatsAppGroupMember_leadId_idx" ON "WhatsAppGroupMember"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppGroupMember_groupId_phone_key" ON "WhatsAppGroupMember"("groupId", "phone");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_leadId_idx" ON "WhatsAppConversation"("leadId");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_contactPhone_idx" ON "WhatsAppConversation"("contactPhone");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_lastMessageAt_idx" ON "WhatsAppConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_providerMessageId_idx" ON "WhatsAppMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "Call_leadId_idx" ON "Call"("leadId");

-- CreateIndex
CREATE INDEX "Call_employeeId_idx" ON "Call"("employeeId");

-- CreateIndex
CREATE INDEX "Call_status_idx" ON "Call"("status");

-- CreateIndex
CREATE INDEX "Call_callType_idx" ON "Call"("callType");

-- CreateIndex
CREATE INDEX "Call_startedAt_idx" ON "Call"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallRecording_callId_key" ON "CallRecording"("callId");

-- CreateIndex
CREATE INDEX "Meeting_leadId_idx" ON "Meeting"("leadId");

-- CreateIndex
CREATE INDEX "Meeting_hostUserId_idx" ON "Meeting"("hostUserId");

-- CreateIndex
CREATE INDEX "Meeting_startAt_idx" ON "Meeting"("startAt");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "CalendarAccount_userId_idx" ON "CalendarAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarAccount_provider_externalId_key" ON "CalendarAccount"("provider", "externalId");

-- CreateIndex
CREATE INDEX "KnowledgeBase_category_idx" ON "KnowledgeBase"("category");

-- CreateIndex
CREATE INDEX "KnowledgeBase_isActive_idx" ON "KnowledgeBase"("isActive");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDocument_knowledgeBaseId_idx" ON "KnowledgeBaseDocument"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseDocument_isActive_idx" ON "KnowledgeBaseDocument"("isActive");

-- CreateIndex
CREATE INDEX "AIConversation_leadId_idx" ON "AIConversation"("leadId");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "FollowUp_leadId_idx" ON "FollowUp"("leadId");

-- CreateIndex
CREATE INDEX "FollowUp_userId_idx" ON "FollowUp"("userId");

-- CreateIndex
CREATE INDEX "FollowUp_dueAt_status_idx" ON "FollowUp"("dueAt", "status");

-- CreateIndex
CREATE INDEX "Template_channel_idx" ON "Template"("channel");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_type_idx" ON "ImportJob"("type");

-- CreateIndex
CREATE INDEX "ImportJob_createdById_idx" ON "ImportJob"("createdById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "LeadStatusDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTagOnLead" ADD CONSTRAINT "LeadTagOnLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTagOnLead" ADD CONSTRAINT "LeadTagOnLead_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "LeadTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMessage" ADD CONSTRAINT "CampaignMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMetric" ADD CONSTRAINT "CampaignMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppContact" ADD CONSTRAINT "WhatsAppContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppGroupMember" ADD CONSTRAINT "WhatsAppGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WhatsAppGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppGroupMember" ADD CONSTRAINT "WhatsAppGroupMember_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarAccount" ADD CONSTRAINT "CalendarAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBaseDocument" ADD CONSTRAINT "KnowledgeBaseDocument_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX "Lead_phone_active_unique" ON "Lead" ("phone") WHERE "deletedAt" IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Lead_name_trgm" ON "Lead" USING gin ("name" gin_trgm_ops);
CREATE INDEX "Lead_shopName_trgm" ON "Lead" USING gin ("shopName" gin_trgm_ops);
CREATE INDEX "Lead_phone_trgm" ON "Lead" USING gin ("phone" gin_trgm_ops);

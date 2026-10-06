import { PrismaClient, type CampaignKind, type CampaignStatus } from '@prisma/client';
import { hash } from 'bcrypt';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import {
  DEFAULT_LEAD_SOURCES,
  DEFAULT_LEAD_STATUSES,
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  toneWav,
  type RoleName,
} from '@aijewel/shared';

config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

const PEOPLE = [
  ['Asha', 'Iyer'],
  ['Rahul', 'Mehta'],
  ['Kavya', 'Reddy'],
  ['Imran', 'Qureshi'],
  ['Neha', 'Kapoor'],
  ['Arvind', 'Nair'],
  ['Sana', 'Sheikh'],
  ['Vikram', 'Joshi'],
  ['Lakshmi', 'Rao'],
  ['Farhan', 'Ali'],
] as const;

const SHOPS = ['Aurum Jewels', 'Charminar Gold', 'Deccan Diamonds', 'Pearl House', 'Heritage Ornaments'];
const AREAS = ['Abids', 'Banjara Hills', 'Secunderabad', 'Madhapur', 'Kukatpally'];

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log('Database already has users; skipping seed.');
    return;
  }

  const password = process.env.SEED_PASSWORD ?? 'Local-demo-1234';
  const passwordHash = await hash(password, 12);

  for (const code of PERMISSIONS) {
    await prisma.permission.create({ data: { code, description: PERMISSION_DESCRIPTIONS[code] } });
  }
  const permissions = await prisma.permission.findMany();
  const permissionByCode = new Map(permissions.map((item) => [item.code, item.id]));

  const roleDescriptions: Record<RoleName, string> = {
    ADMIN: 'Full access to CRM administration',
    MARKETING_MANAGER: 'Approves and runs marketing campaigns',
    MARKETING_EXECUTIVE: 'Builds campaigns and works leads',
    SALES: 'Owns customer conversations, calls, and meetings',
    MANAGEMENT: 'Read-only view of performance and audit history',
  };
  for (const roleName of Object.keys(ROLE_PERMISSIONS) as RoleName[]) {
    const role = await prisma.role.create({ data: { name: roleName, description: roleDescriptions[roleName] } });
    await prisma.rolePermission.createMany({
      data: ROLE_PERMISSIONS[roleName].map((code) => ({
        roleId: role.id,
        permissionId: permissionByCode.get(code)!,
      })),
    });
  }
  const roles = await prisma.role.findMany();
  const roleId = new Map(roles.map((role) => [role.name, role.id]));

  const users = [];
  for (let index = 0; index < PEOPLE.length; index += 1) {
    const roleName: RoleName =
      index === 0
        ? 'ADMIN'
        : index === 1
          ? 'MARKETING_MANAGER'
          : index === 2
            ? 'MARKETING_EXECUTIVE'
            : index === 3
              ? 'MANAGEMENT'
              : 'SALES';
    const [firstName, lastName] = PEOPLE[index];
    const email =
      index < 5
        ? `${['admin', 'manager', 'executive', 'management', 'sales'][index]}@aijewel.local`
        : `${firstName.toLowerCase()}.${lastName.toLowerCase()}@aijewel.local`;
    users.push(
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          phone: `+91981000000${index}`,
          roleId: roleId.get(roleName)!,
        },
      }),
    );
  }

  await prisma.leadStatusDefinition.createMany({ data: DEFAULT_LEAD_STATUSES.map((status) => ({ ...status })) });
  await prisma.leadSource.createMany({ data: DEFAULT_LEAD_SOURCES.map((source) => ({ ...source })) });
  const statuses = await prisma.leadStatusDefinition.findMany();
  const sources = await prisma.leadSource.findMany();
  const statusId = new Map(statuses.map((status) => [status.code, status.id]));
  const sourceId = new Map(sources.map((source) => [source.code, source.id]));
  const tags = await Promise.all(
    ['vip', 'bridal', 'retail', 'wholesale'].map((name) => prisma.leadTag.create({ data: { name } })),
  );

  const companies = [];
  for (let index = 0; index < SHOPS.length; index += 1) {
    companies.push(
      await prisma.company.create({
        data: { name: SHOPS[index], location: `${AREAS[index]}, Hyderabad`, phone: `+91404000000${index}` },
      }),
    );
  }

  const salesUsers = users.filter((user) => user.email.includes('sales') || user.roleId === roleId.get('SALES'));
  const leadData = Array.from({ length: 100 }, (_, index) => {
    const shop = SHOPS[index % SHOPS.length];
    const area = AREAS[index % AREAS.length];
    const statusCode = DEFAULT_LEAD_STATUSES[index % DEFAULT_LEAD_STATUSES.length].code;
    return {
      name: `${PEOPLE[index % PEOPLE.length][0]} ${PEOPLE[(index * 3) % PEOPLE.length][1]} ${index + 1}`,
      phone: `+9191${String(10000000 + index).padStart(8, '0').slice(0, 8)}`,
      whatsappNumber: `+9191${String(10000000 + index).padStart(8, '0').slice(0, 8)}`,
      email: `customer${index + 1}@shop.example`,
      shopName: shop,
      location: `${area}, Hyderabad`,
      statusId: statusId.get(statusCode)!,
      leadSourceId: sourceId.get(index % 5 === 0 ? 'REFERRAL' : 'MANUAL')!,
      assignedUserId: salesUsers[index % salesUsers.length]?.id,
      companyId: companies[index % companies.length].id,
      customerCategory: index % 4 === 0 ? 'WHOLESALER' : 'RETAILER',
      previousEnquiry: index % 3 === 0 ? 'Bridal sets' : 'Showroom display',
      lastContactAt: new Date(Date.now() - index * 36e5),
    };
  });
  const leads = await prisma.lead.createManyAndReturn({ data: leadData });
  await prisma.leadActivity.createMany({
    data: leads.map((lead) => ({ leadId: lead.id, type: 'LEAD_CREATED', summary: 'Sample lead created', userId: users[0].id })),
  });
  await prisma.leadTagOnLead.createMany({
    data: leads.slice(0, 40).map((lead, index) => ({ leadId: lead.id, tagId: tags[index % tags.length].id })),
  });
  await prisma.leadNote.createMany({
    data: leads.slice(0, 15).map((lead) => ({
      leadId: lead.id,
      userId: users[4].id,
      body: 'Asked for a showroom walkthrough next week.',
    })),
  });

  for (const lead of leads.slice(0, 20)) {
    await prisma.customer.create({
      data: {
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        shopName: lead.shopName,
        location: lead.location,
        category: lead.customerCategory,
        companyId: lead.companyId,
      },
    });
    await prisma.contact.create({
      data: {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        whatsappNumber: lead.whatsappNumber,
        companyId: lead.companyId,
        leadId: lead.id,
        customerId: undefined,
      },
    });
  }
  const customers = await prisma.customer.findMany();
  for (const customer of customers) {
    await prisma.contact.updateMany({ where: { leadId: customer.leadId }, data: { customerId: customer.id } });
  }

  const campaignPlan: { name: string; kind: CampaignKind; platform: string; status: CampaignStatus; content: string }[] = [
    { name: 'Hyderabad bridal awareness', kind: 'META', platform: 'FACEBOOK', status: 'RUNNING', content: 'Bridal showcase this month' },
    { name: 'Instagram reel — new collections', kind: 'SOCIAL', platform: 'INSTAGRAM', status: 'SCHEDULED', content: 'New festive collection' },
    { name: 'Retargeting jewellers', kind: 'META', platform: 'FACEBOOK', status: 'COMPLETED', content: 'Book a demo' },
    { name: 'Draft Diwali offer', kind: 'META', platform: 'INSTAGRAM', status: 'DRAFT', content: 'Diwali showroom offer' },
    { name: 'Personal note to retailers', kind: 'PERSONALIZED', platform: 'WHATSAPP', status: 'DRAFT', content: 'Hi {{customer_name}}, a new AIJewel workflow for {{shop_name}} in {{location}}.' },
    { name: 'Approved retailer sequence', kind: 'PERSONALIZED', platform: 'WHATSAPP', status: 'APPROVED', content: 'Hi {{customer_name}}, shall we schedule a demo for {{shop_name}}?' },
    { name: 'Sent onboarding tips', kind: 'PERSONALIZED', platform: 'WHATSAPP', status: 'SENT', content: 'Hi {{customer_name}}, your {{shop_name}} onboarding notes.' },
    { name: 'WhatsApp festive blast', kind: 'WHATSAPP', platform: 'WHATSAPP', status: 'SCHEDULED', content: 'Festive greeting from AIJewel' },
    { name: 'Paused lead form', kind: 'META', platform: 'FACEBOOK', status: 'PAUSED', content: 'Lead form for showroom software' },
    { name: 'Completed report sample', kind: 'META', platform: 'INSTAGRAM', status: 'REPORT', content: 'Always-on awareness' },
  ];
  for (let index = 0; index < campaignPlan.length; index += 1) {
    const plan = campaignPlan[index];
    const start = new Date(Date.now() + (index - 3) * 86400000);
    const campaign = await prisma.campaign.create({
      data: {
        ...plan,
        objective: 'OUTCOME_LEADS',
        audience: 'Hyderabad jewellers',
        budget: 5000 + index * 750,
        startDate: start,
        endDate: new Date(start.getTime() + 14 * 86400000),
        creative: 'Showroom photo',
        leadIds: leads.slice(0, 5).map((lead) => lead.id),
        createdById: users[1].id,
      },
    });
    if (['RUNNING', 'COMPLETED', 'SENT', 'REPORT', 'PAUSED'].includes(plan.status)) {
      await prisma.campaignMetric.create({
        data: {
          campaignId: campaign.id,
          date: new Date(),
          spend: 1800 + index * 220,
          impressions: 12000 + index * 800,
          reach: 9000 + index * 500,
          clicks: 640 + index * 30,
          leads: 18 + index,
          engagement: 900 + index * 40,
          conversions: 4 + (index % 3),
        },
      });
    }
    if (plan.status === 'SENT' || plan.status === 'REPORT') {
      await prisma.campaignMessage.create({
        data: {
          campaignId: campaign.id,
          leadId: leads[0].id,
          renderedBody: `Hi ${leads[0].name}, a note for ${leads[0].shopName}.`,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }
  }

  for (let index = 0; index < 20; index += 1) {
    const conversation = await prisma.whatsAppConversation.create({
      data: {
        leadId: leads[index].id,
        contactPhone: leads[index].phone,
        lastMessageAt: new Date(Date.now() - index * 600000),
      },
    });
    const count = index < 10 ? 3 : 2;
    for (let messageIndex = 0; messageIndex < count; messageIndex += 1) {
      await prisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          direction: messageIndex % 2 === 0 ? 'OUTBOUND' : 'INBOUND',
          body: messageIndex % 2 === 0 ? 'Hello from AIJewel. Can we help your showroom this week?' : 'Yes, please share the warranty details.',
          status: messageIndex % 2 === 0 ? 'READ' : 'READ',
        },
      });
    }
  }

  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIRECTORY ?? './storage/recordings');
  await mkdir(uploadDir, { recursive: true });
  for (let index = 0; index < 10; index += 1) {
    const call = await prisma.call.create({
      data: {
        leadId: leads[index].id,
        customerId: customers.find((customer) => customer.leadId === leads[index].id)?.id,
        employeeId: users[4].id,
        startedAt: new Date(Date.now() - index * 86400000),
        durationSeconds: 90 + index * 15,
        callType: index % 2 === 0 ? 'MANUAL' : 'VOICE_BOT',
        status: index === 3 ? 'MISSED' : 'COMPLETED',
        notes: 'Discussed showroom workflow.',
        outcome: index === 3 ? 'NO_ANSWER' : 'INTERESTED',
        summary: 'Customer wants a follow-up demo.',
      },
    });
    const audio = toneWav(1, 440 + index * 20);
    const key = `${call.id}.wav`;
    await writeFile(path.join(uploadDir, key), audio);
    await prisma.callRecording.create({
      data: {
        callId: call.id,
        storageKey: key,
        fileName: key,
        mimeType: 'audio/wav',
        byteSize: audio.length,
        durationSeconds: 1,
      },
    });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const meetingSlots = ['10:30', '11:00', '15:00', '16:00', '09:30'];
  for (let index = 0; index < 5; index += 1) {
    const [hour, minute] = meetingSlots[index].split(':').map(Number);
    const start = new Date(tomorrow);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + 30 * 60000);
    await prisma.meeting.create({
      data: {
        leadId: leads[index].id,
        hostUserId: users[4].id,
        title: `Demo · ${leads[index].shopName}`,
        startAt: start,
        endAt: end,
        durationMinutes: 30,
        meetingType: index === 4 ? 'SHOWROOM_VISIT' : 'DEMO',
        status: index === 4 ? 'CANCELLED' : index === 3 ? 'COMPLETED' : 'SCHEDULED',
        attendeeName: leads[index].name,
        attendeePhone: leads[index].phone,
        attendeeEmail: leads[index].email,
        externalEventId: `mock-seed-${index}`,
      },
    });
  }

  const knowledge = [
    ['COMPANY', 'About AIJewel', 'About AIJewel', 'AIJewel builds showroom software for independent jewellery retailers in India.'],
    ['PRODUCT', 'Showroom Suite', 'Showroom Suite', 'AIJewel Showroom Suite helps jewellers manage inventory, customers, and follow-ups in one place.'],
    ['PRODUCT', 'Inventory Assistant', 'Inventory Assistant', 'The inventory assistant tracks gold and diamond stock by shop location.'],
    ['PRICING', 'Showroom Suite price', 'Showroom Suite price', 'AIJewel Showroom Suite is priced at INR 48000 per year for a single shop.'],
    ['FAQ', 'Implementation', 'Implementation timeline', 'A typical AIJewel implementation takes 14 days from kickoff to go-live.'],
    ['SUPPORT', 'Support hours', 'Support hours', 'AIJewel support is available from 9am to 6pm IST, Monday to Saturday.'],
    ['WARRANTY', 'Warranty', 'Warranty', 'AIJewel software warranty covers manufacturing defects for 12 months from installation.'],
    ['DEMO', 'Book a demo', 'Demo', 'A free AIJewel demo is available on weekdays for jewellery retailers.'],
    ['SALES', 'Who it is for', 'Primary customers', 'Retail jewellers are the primary customers for AIJewel.'],
    ['FAQ', 'WhatsApp', 'WhatsApp inclusion', 'WhatsApp messaging for customer follow-up is included in the AIJewel suite.'],
  ] as const;
  for (const [category, name, title, content] of knowledge) {
    const base = await prisma.knowledgeBase.create({ data: { category, name } });
    await prisma.knowledgeBaseDocument.create({ data: { knowledgeBaseId: base.id, title, content } });
  }

  const groupJson = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../mocks/whatsapp/aijewel-hyderabad-group.json'), 'utf8'),
  ) as { groupId: string; groupName: string; members: { name: string; phone: string }[] };
  const group = await prisma.whatsAppGroup.create({
    data: { externalId: groupJson.groupId, name: groupJson.groupName },
  });
  const members = groupJson.members as { name: string; phone: string }[];
  for (let index = 0; index < members.length; index += 200) {
    await prisma.whatsAppGroupMember.createMany({
      data: members.slice(index, index + 200).map((member) => ({
        groupId: group.id,
        name: member.name,
        phone: member.phone,
      })),
    });
  }

  await prisma.template.createMany({
    data: [
      {
        name: 'Showroom introduction',
        channel: 'WHATSAPP',
        body: 'Hi {{customer_name}}, we have a new AIJewel solution that may be useful for {{shop_name}} in {{location}}.',
      },
      {
        name: 'Demo invite',
        channel: 'WHATSAPP',
        body: 'Hi {{contact_person}}, shall we show {{previous_interest}} for {{shop_name}}?',
      },
    ],
  });
  await prisma.segment.create({
    data: { name: 'Hyderabad retailers', filterJson: { location: 'Hyderabad', category: 'RETAILER' } },
  });
  await prisma.followUp.create({
    data: {
      leadId: leads[0].id,
      userId: users[4].id,
      dueAt: new Date(Date.now() + 2 * 86400000),
      notes: 'Send the bridal catalogue.',
    },
  });
  await prisma.notification.create({
    data: {
      userId: users[0].id,
      type: 'NEW_LEAD',
      title: 'Sample notification',
      body: 'The CRM seed data is ready for the local demo.',
    },
  });
  await prisma.calendarAccount.create({
    data: {
      userId: users[4].id,
      provider: 'mock',
      externalId: 'mock-calendar-sales',
      displayName: 'Sales calendar',
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: users[0].id,
      action: 'SEED',
      entity: 'Database',
      afterData: { leads: leads.length, groupMembers: members.length },
    },
  });

  console.log(`Seeded ${users.length} users, ${leads.length} leads, ${members.length} WhatsApp group contacts.`);
  console.log(`Sign in as admin@aijewel.local with the SEED_PASSWORD from .env`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

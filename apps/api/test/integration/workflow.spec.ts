import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/common/response.interceptor';

describe('AIJewel local workflow', () => {
  let app: INestApplication;
  let token = '';
  let salesToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    token = await login('admin@aijewel.local');
    salesToken = await login('sales@aijewel.local');
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'Local-demo-1234' });
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    return response.body.data.accessToken as string;
  }

  it('rejects a bad password without a stack trace', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@aijewel.local', password: 'wrong-password-1' });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Email or password is incorrect',
    });
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('blocks sales from approving campaigns', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Permission check',
        kind: 'PERSONALIZED',
        platform: 'WHATSAPP',
        objective: 'OUTCOME_LEADS',
        content: 'Hi {{customer_name}}',
      });
    const denied = await request(app.getHttpServer())
      .post(`/api/campaigns/${created.body.data.id}/transition`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'REVIEW' });
    expect(denied.status).toBe(403);
  });

  it('creates a lead, rejects a duplicate phone, and pages results', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Integration Kumar', phone: '9876512345', shopName: 'Kumar Jewellery', location: 'Hyderabad' });
    expect(created.status).toBe(201);
    const duplicate = await request(app.getHttpServer())
      .post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicate', phone: '9876512345' });
    expect(duplicate.body.errorCode).toBe('DUPLICATE_LEAD');
    const page = await request(app.getHttpServer())
      .get('/api/leads?page=1&pageSize=1&q=Integration%20Kumar')
      .set('Authorization', `Bearer ${token}`);
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.total).toBeGreaterThanOrEqual(1);
    expect(page.body.data.items[0].name).toBe('Integration Kumar');
  });

  it('imports the WhatsApp group once and treats a second import as duplicates', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/leads/import/whatsapp-group')
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(201);
    expect(first.body.data.successful).toBe(500);
    expect(first.body.data.invalid).toBe(0);
    const second = await request(app.getHttpServer())
      .post('/api/leads/import/whatsapp-group')
      .set('Authorization', `Bearer ${token}`);
    expect(second.body.data.duplicates).toBe(500);
    expect(second.body.data.successful).toBe(0);
    const leads = await request(app.getHttpServer())
      .get('/api/leads?source=WHATSAPP_GROUP&pageSize=1')
      .set('Authorization', `Bearer ${token}`);
    expect(leads.body.data.total).toBe(500);
  });

  it('runs WhatsApp, AI, campaign, meeting, voice, and dashboard steps', async () => {
    const leads = await request(app.getHttpServer())
      .get('/api/leads?source=WHATSAPP_GROUP&pageSize=1')
      .set('Authorization', `Bearer ${token}`);
    const leadId = leads.body.data.items[0].id as string;
    const conversation = await request(app.getHttpServer())
      .post('/api/whatsapp/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ leadId });
    const sent = await request(app.getHttpServer())
      .post(`/api/whatsapp/conversations/${conversation.body.data.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Hello from AIJewel' });
    expect(sent.body.data.outbound.status).toBe('READ');
    expect(sent.body.data.inbound.body).toContain('warranty');
    expect(sent.body.data.ai.body).toContain('12 months');
    expect(sent.body.data.ai.escalateToHuman).toBe(false);

    const ai = await request(app.getHttpServer())
      .post('/api/ai/reply')
      .set('Authorization', `Bearer ${token}`)
      .send({ leadId, message: 'What is the price of the diamond robot?' });
    expect(ai.body.data.escalateToHuman).toBe(true);
    expect(ai.body.data.text).not.toContain('48000');

    const campaign = await request(app.getHttpServer())
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Workflow campaign',
        kind: 'PERSONALIZED',
        platform: 'WHATSAPP',
        objective: 'OUTCOME_LEADS',
        content: 'Hi {{customer_name}}, we have a new AIJewel solution for {{shop_name}} in {{location}}.',
        leadIds: [leadId],
      });
    const campaignId = campaign.body.data.id as string;
    const preview = await request(app.getHttpServer())
      .post(`/api/campaigns/${campaignId}/preview`)
      .set('Authorization', `Bearer ${token}`)
      .send({ leadIds: [leadId] });
    expect(preview.body.data[0].message).toContain(preview.body.data[0].customer);
    expect(preview.body.data[0].message).not.toContain('{{');
    for (const status of ['REVIEW', 'APPROVED', 'SCHEDULED']) {
      const moved = await request(app.getHttpServer())
        .post(`/api/campaigns/${campaignId}/transition`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status });
      expect(moved.status).toBe(201);
    }
    const executed = await request(app.getHttpServer())
      .post(`/api/campaigns/${campaignId}/execute`)
      .set('Authorization', `Bearer ${token}`);
    expect(executed.body.data.status).toBe('REPORT');
    const report = await request(app.getHttpServer())
      .get(`/api/reports/campaigns?campaignId=${campaignId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(report.body.data.rows.length).toBeGreaterThan(0);
    expect(report.body.data.totals.impressions).toBeGreaterThan(0);

    const dateText = '2026-12-15';
    const slots = await request(app.getHttpServer())
      .get(`/api/meetings/availability?date=${dateText}`)
      .set('Authorization', `Bearer ${token}`);
    const open = slots.body.data.find((slot: { status: string; time: string }) => slot.status === 'AVAILABLE');
    expect(open).toBeTruthy();
    const meeting = await request(app.getHttpServer())
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        leadId,
        date: dateText,
        time: open.time,
        durationMinutes: 30,
        meetingType: 'DEMO',
        attendeeName: 'Workflow Guest',
        attendeePhone: '9876500099',
        attendeeEmail: 'guest@shop.example',
      });
    expect(meeting.status).toBe(201);
    const calendar = await request(app.getHttpServer())
      .get('/api/calendar?from=2026-12-14T00:00:00.000Z&to=2026-12-16T00:00:00.000Z')
      .set('Authorization', `Bearer ${token}`);
    expect(calendar.body.data.some((item: { id: string }) => item.id === meeting.body.data.id)).toBe(true);

    const voice = await request(app.getHttpServer())
      .post('/api/calls/voice')
      .set('Authorization', `Bearer ${token}`)
      .send({ leadId });
    expect(voice.body.data.outcome).toBe('MEETING_REQUESTED');
    const recording = await request(app.getHttpServer())
      .get(`/api/calls/${voice.body.data.callId}/recording`)
      .set('Authorization', `Bearer ${token}`);
    expect(recording.status).toBe(200);
    expect(recording.headers['content-type']).toContain('audio/wav');

    const executive = await login('executive@aijewel.local');
    const hidden = await request(app.getHttpServer())
      .get(`/api/calls/${voice.body.data.callId}/recording`)
      .set('Authorization', `Bearer ${executive}`);
    expect(hidden.status).toBe(403);

    const workspace = await request(app.getHttpServer())
      .get(`/api/leads/${leadId}/workspace`)
      .set('Authorization', `Bearer ${token}`);
    const types = workspace.body.data.timeline.map((item: { type: string }) => item.type);
    expect(types).toEqual(expect.arrayContaining(['WHATSAPP_SENT', 'AI_RESPONSE', 'CAMPAIGN_SENT', 'MEETING_BOOKED', 'CALL_MADE']));

    const dashboard = await request(app.getHttpServer()).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.body.data.leads.total).toBeGreaterThan(500);
    const audit = await request(app.getHttpServer()).get('/api/audit?action=LOGIN').set('Authorization', `Bearer ${token}`);
    expect(audit.body.data.total).toBeGreaterThan(0);
  });
});

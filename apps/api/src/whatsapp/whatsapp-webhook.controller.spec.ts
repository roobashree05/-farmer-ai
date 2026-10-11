import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../common/all-exceptions.filter';
import { AppException } from '../common/app.exception';
import { ResponseInterceptor } from '../common/response.interceptor';
import { signWebhookBody, verifyWebhookSignature, webhookChallenge } from '../integrations/whatsapp/meta-signature';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

const SECRET = '0123456789abcdef0123456789abcdef';

describe('WhatsApp webhook HTTP', () => {
  let app: INestApplication;
  let seen: Buffer | undefined;

  beforeAll(async () => {
    seen = undefined;
    const moduleRef = await Test.createTestingModule({
      controllers: [WhatsAppWebhookController],
      providers: [
        {
          provide: WhatsAppWebhookService,
          useValue: {
            verifySubscription: (query: Record<string, unknown>) => {
              const challenge = webhookChallenge(query, 'verify-token-value');
              if (!challenge) throw new AppException('WEBHOOK_VERIFICATION_FAILED', 'Webhook verification failed', 403);
              return challenge;
            },
            receive: async (rawBody: Buffer | undefined, signature?: string) => {
              seen = rawBody ? Buffer.from(rawBody) : undefined;
              if (!rawBody || !verifyWebhookSignature(rawBody, signature, SECRET)) {
                throw new AppException('WEBHOOK_SIGNATURE_INVALID', 'Webhook signature is invalid', 403);
              }
              return { accepted: 1, ignored: 0 };
            },
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the raw challenge and rejects a failed verification', async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
      original(...args);
    };
    let ok: request.Response;
    try {
    ok = await request(app.getHttpServer())
      .get('/api/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-token-value', 'hub.challenge': '12345' });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('12345');
    expect(ok.headers['content-type']).toContain('text/plain');

    const rejected = await request(app.getHttpServer())
      .get('/api/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '999' });
    expect(rejected.status).toBe(403);
    expect(rejected.body.errorCode).toBe('WEBHOOK_VERIFICATION_FAILED');
    expect(rejected.text).not.toBe('999');
    expect(lines.join('\n')).not.toContain('verify-token-value');
    } finally {
      console.log = original;
    }
  });

  it('passes the exact raw JSON body through to signature handling', async () => {
    const payload = '{"object":"whatsapp_business_account","entry":[]}';
    const response = await request(app.getHttpServer())
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signWebhookBody(Buffer.from(payload), '0123456789abcdef0123456789abcdef'))
      .send(payload);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { accepted: 1, ignored: 0 } });
    expect(seen?.toString('utf8')).toBe(payload);

    const tampered = await request(app.getHttpServer())
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signWebhookBody(Buffer.from(payload), SECRET))
      .send('{"object":"whatsapp_business_account","entry":[],"extra":true}');
    expect(tampered.status).toBe(403);
    expect(tampered.body.errorCode).toBe('WEBHOOK_SIGNATURE_INVALID');
  });
});

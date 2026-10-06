import { answerFromKnowledge, classifyLeadInterest } from './ai-knowledge';
import { buildAvailability } from './calendar-slots';
import { assertCampaignTransition, canTransition } from './campaign-workflow';
import { mapCsvRows, parseCsv } from './csv';
import { classifyImportRows } from './duplicates';
import { leadPersonalization, renderTemplate } from './personalization';
import { roleHasPermission } from './permissions';
import { isValidEmail, normalizePhone, validatePassword } from './validation';
import { runVoiceBot } from './voice-machine';

describe('lead validation', () => {
  it('normalizes Indian mobile numbers', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('09876543210')).toBe('+919876543210');
  });

  it('rejects impossible phone numbers', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });

  it('validates email and password', () => {
    expect(isValidEmail('owner@shop.in')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('')).toBe(true);
    expect(validatePassword('short1')).toMatch(/8 characters/);
    expect(validatePassword('changeme')).toMatch(/letters and numbers/);
    expect(validatePassword('Local-demo-1234')).toBeNull();
  });
});

describe('duplicate detection', () => {
  it('splits new, duplicate, and invalid rows', () => {
    const result = classifyImportRows(
      [
        { rowNumber: 2, phone: '+919800000001', valid: true },
        { rowNumber: 3, phone: '+919800000001', valid: true },
        { rowNumber: 4, phone: '+919800000002', valid: true },
        { rowNumber: 5, phone: null, valid: false },
      ],
      new Set(['+919800000002']),
    );
    expect(result.summary).toEqual({ total: 4, successful: 1, duplicates: 2, invalid: 1 });
    expect(result.validNew.map((row) => row.rowNumber)).toEqual([2]);
  });
});

describe('csv mapping', () => {
  it('parses quoted commas and maps columns', () => {
    const rows = parseCsv('Full Name,Mobile\n"Kumar, Reddy","9876543210"\n');
    const mapped = mapCsvRows(rows, { name: 'Full Name', phone: 'Mobile' });
    expect(mapped.records[0].name).toBe('Kumar, Reddy');
    expect(mapped.records[0].phone).toBe('9876543210');
  });
});

describe('personalization', () => {
  it('replaces customer variables before sending', () => {
    const rendered = renderTemplate(
      'Hi {{customer_name}}, we have a new AIJewel solution for {{shop_name}} in {{location}}.',
      leadPersonalization({
        name: 'Kumar',
        shopName: 'Kumar Jewellery',
        location: 'Hyderabad',
        previousEnquiry: 'Bridal sets',
      }),
    );
    expect(rendered.text).toBe('Hi Kumar, we have a new AIJewel solution for Kumar Jewellery in Hyderabad.');
    expect(rendered.missing).toEqual([]);
  });
});

describe('campaign scheduling', () => {
  it('allows the personalized workflow and rejects skips', () => {
    expect(canTransition('PERSONALIZED', 'DRAFT', 'REVIEW')).toBe(true);
    expect(() => assertCampaignTransition('PERSONALIZED', 'DRAFT', 'SENT')).toThrow(/Cannot move/);
    expect(canTransition('META', 'SCHEDULED', 'RUNNING')).toBe(true);
    expect(canTransition('META', 'RUNNING', 'COMPLETED')).toBe(true);
  });
});

describe('AI knowledge lookup', () => {
  const docs = [
    {
      title: 'Showroom Suite price',
      category: 'PRICING',
      content: 'AIJewel Showroom Suite is priced at INR 48000 per year for a single shop.',
    },
    {
      title: 'Warranty',
      category: 'WARRANTY',
      content: 'AIJewel software warranty covers manufacturing defects for 12 months from installation.',
    },
  ];

  it('quotes pricing from the knowledge base', () => {
    const answer = answerFromKnowledge('What is the price of AIJewel Showroom Suite?', docs);
    expect(answer.escalateToHuman).toBe(false);
    expect(answer.text).toContain('INR 48000');
    expect(answer.sources[0].title).toBe('Showroom Suite price');
  });

  it('does not invent a price that is not in the knowledge base', () => {
    const answer = answerFromKnowledge('What is the price of the diamond robot?', docs);
    expect(answer.escalateToHuman).toBe(true);
    expect(answer.text).not.toContain('48000');
    expect(answer.sources).toEqual([]);
  });

  it('classifies buying interest', () => {
    expect(classifyLeadInterest('Please book a demo').suggestedStatus).toBe('QUALIFIED');
  });
});

describe('permission checks', () => {
  it('lets managers approve campaigns and blocks sales and executives', () => {
    expect(roleHasPermission('MARKETING_MANAGER', 'campaigns.approve')).toBe(true);
    expect(roleHasPermission('MARKETING_EXECUTIVE', 'campaigns.approve')).toBe(false);
    expect(roleHasPermission('SALES', 'calls.write')).toBe(true);
    expect(roleHasPermission('SALES', 'leads.delete')).toBe(false);
    expect(roleHasPermission('MANAGEMENT', 'reports.read')).toBe(true);
    expect(roleHasPermission('MANAGEMENT', 'campaigns.send')).toBe(false);
    expect(roleHasPermission('ADMIN', 'users.write')).toBe(true);
  });
});

describe('voice state machine', () => {
  it('qualifies a customer when the FAQ answer is grounded', () => {
    const result = runVoiceBot({
      customerName: 'Kumar',
      shopName: 'Kumar Jewellery',
      utterance: 'What warranty do you provide?',
      faq: { text: 'Warranty is 12 months.', confident: true },
    });
    expect(result.turns.map((turn) => turn.state)).toEqual(
      expect.arrayContaining(['GREETING', 'IDENTIFY_CUSTOMER', 'QUALIFY_LEAD', 'BOOK_MEETING']),
    );
    expect(result.outcome).toBe('MEETING_REQUESTED');
    expect(result.escalateToHuman).toBe(false);
    expect(result.turns.some((turn) => turn.state === 'TRANSFER_TO_HUMAN')).toBe(false);
  });

  it('transfers to a human when confidence is low', () => {
    const result = runVoiceBot({
      customerName: 'Kumar',
      utterance: 'Do you sell diamond robots?',
      faq: { confident: false, text: '' },
    });
    expect(result.outcome).toBe('TRANSFERRED');
    expect(result.escalateToHuman).toBe(true);
    const botSpeech = result.turns.filter((turn) => turn.speaker === 'bot').map((turn) => turn.text).join(' ');
    expect(botSpeech).not.toContain('48000');
    expect(botSpeech).toContain('transfer');
  });
});

describe('meeting booking slots', () => {
  it('marks overlapping slots busy and leaves the next slot open', () => {
    const date = '2026-10-12';
    const slots = buildAvailability({
      date,
      now: new Date('2020-01-01T00:00:00.000Z'),
      busy: [],
    });
    const ten = slots.find((slot) => slot.time === '10:00');
    const tenThirty = slots.find((slot) => slot.time === '10:30');
    expect(ten?.status).toBe('AVAILABLE');
    expect(tenThirty?.status).toBe('AVAILABLE');

    const withBusy = buildAvailability({
      date,
      now: new Date('2020-01-01T00:00:00.000Z'),
      busy: [{ startIso: tenThirty!.startIso, endIso: tenThirty!.endIso }],
    });
    expect(withBusy.find((slot) => slot.time === '10:00')?.status).toBe('AVAILABLE');
    expect(withBusy.find((slot) => slot.time === '10:30')?.status).toBe('BUSY');
    expect(withBusy.find((slot) => slot.time === '11:00')?.status).toBe('AVAILABLE');
  });
});

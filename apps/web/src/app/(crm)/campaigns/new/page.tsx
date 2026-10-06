'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';
import { Suspense } from 'react';

function NewCampaignForm() {
  const router = useRouter();
  const params = useSearchParams();
  const leadId = params.get('leadId');
  const [form, setForm] = useState({
    name: 'Retailer introduction',
    kind: 'PERSONALIZED',
    platform: 'WHATSAPP',
    objective: 'OUTCOME_LEADS',
    audience: 'Selected jewellers',
    budget: 0,
    content: 'Hi {{customer_name}}, we have a new AIJewel solution that may be useful for {{shop_name}} in {{location}}.',
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const created = await api<{ id: string }>('/api/campaigns', {
      method: 'POST',
      json: { ...form, leadIds: leadId ? [leadId] : [] },
    });
    router.push(`/campaigns/${created.id}`);
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <PageHeader title="New campaign" subtitle={leadId ? `Includes lead ${leadId}` : 'Choose leads on the next screen.'} />
      <input className="field" data-testid="campaign-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      <select className="select" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
        {['PERSONALIZED', 'META', 'WHATSAPP', 'SOCIAL'].map((kind) => <option key={kind}>{kind}</option>)}
      </select>
      <input className="field" value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} />
      <input className="field" value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} />
      <input className="field" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} />
      <textarea className="textarea" data-testid="campaign-content" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
      <Button type="submit">Save draft</Button>
    </form>
  );
}

export default function NewCampaignPage() {
  return <Suspense fallback={<p>Loading…</p>}><NewCampaignForm /></Suspense>;
}

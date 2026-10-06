'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  kind: 'PERSONALIZED' | 'META' | 'WHATSAPP' | 'SOCIAL';
  status: string;
  content: string;
  platform: string;
  leadIds: string[];
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [preview, setPreview] = useState<{ customer: string; shop: string | null; message: string }[]>([]);
  const [leadId, setLeadId] = useState('');

  function load() {
    api<Campaign>(`/api/campaigns/${params.id}`).then(setCampaign);
  }
  useEffect(() => { load(); }, [params.id]);

  if (!campaign) return <p>Loading campaign…</p>;
  const nextStatus = campaign.kind === 'PERSONALIZED'
    ? ({ DRAFT: 'REVIEW', REVIEW: 'APPROVED', APPROVED: 'SCHEDULED' } as Record<string, string>)[campaign.status]
    : ({ DRAFT: 'APPROVAL', APPROVAL: 'SCHEDULED' } as Record<string, string>)[campaign.status];

  return (
    <div className="stack">
      <PageHeader title={campaign.name} subtitle={`${campaign.kind} · ${campaign.platform} · ${campaign.status}`} />
      <section className="card">
        <p>{campaign.content}</p>
        <div className="toolbar">
          <input className="field" placeholder="Lead id for preview" value={leadId} onChange={(event) => setLeadId(event.target.value)} />
          <Button data-testid="preview-campaign" type="button" variant="secondary" onClick={() => void api<typeof preview>(`/api/campaigns/${campaign.id}/preview`, { method: 'POST', json: { leadIds: leadId ? [leadId] : campaign.leadIds } }).then(setPreview)}>Preview</Button>
          {nextStatus ? <Button type="button" onClick={() => void api(`/api/campaigns/${campaign.id}/transition`, { method: 'POST', json: { status: nextStatus } }).then(load)}>Move to {nextStatus}</Button> : null}
          {campaign.status === 'SCHEDULED' ? <Button data-testid="execute-campaign" type="button" onClick={() => void api(`/api/campaigns/${campaign.id}/execute`, { method: 'POST' }).then(load)}>Execute mock campaign</Button> : null}
        </div>
      </section>
      {preview.map((item) => (
        <article className="card" key={item.customer}>
          <p>Customer: {item.customer}</p>
          <p>Shop: {item.shop}</p>
          <p data-testid="preview-message">{item.message}</p>
        </article>
      ))}
    </div>
  );
}

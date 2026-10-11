'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { EmptyState, PageHeader } from '@aijewel/ui';
import { api, subscribeWhatsApp } from '@/lib/api';

export default function WhatsAppPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<{ id: string; leadName: string; shopName: string | null; contactPhone: string; preview: string }[]>([]);
  const [mode, setMode] = useState<string | null>(null);
  const queryRef = useRef(q);
  queryRef.current = q;
  function load(query = q) {
    api<{ items: typeof items }>(`/api/whatsapp/conversations?q=${encodeURIComponent(query)}`).then((data) => setItems(data.items));
  }
  useEffect(() => {
    load('');
    api<{ whatsapp?: { mode?: string } }>('/api/settings').then((settings) => setMode(settings.whatsapp?.mode ?? null)).catch(() => setMode(null));
    const controller = new AbortController();
    subscribeWhatsApp((event) => {
      if (event.type === 'message.created' || event.type === 'message.status') load(queryRef.current);
    }, controller.signal);
    return () => controller.abort();
  }, []);
  return (
    <div className="stack">
      <PageHeader title="WhatsApp" subtitle={mode === 'meta' ? 'Meta WhatsApp Cloud API. Sent means Meta accepted the message. Delivered and read come from webhooks.' : 'Mock conversations with delivery status and simulated replies.'} />
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <input className="field" placeholder="Search conversations" value={q} onChange={(event) => setQ(event.target.value)} />
      </form>
      <div className="card">
        {items.length === 0 ? <EmptyState title="No conversations" body="Open a lead and choose WhatsApp." /> : items.map((item) => (
          <p key={item.id}><Link href={`/whatsapp/${item.id}`}>{item.leadName}</Link> · {item.shopName} · {item.contactPhone}<br />{item.preview}</p>
        ))}
      </div>
    </div>
  );
}

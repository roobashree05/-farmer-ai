'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';

export default function WhatsAppPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<{ id: string; leadName: string; shopName: string | null; contactPhone: string; preview: string }[]>([]);
  function load(query = q) {
    api<{ items: typeof items }>(`/api/whatsapp/conversations?q=${encodeURIComponent(query)}`).then((data) => setItems(data.items));
  }
  useEffect(() => { load(''); }, []);
  return (
    <div className="stack">
      <PageHeader title="WhatsApp" subtitle="Mock conversations with delivery status and simulated replies." />
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

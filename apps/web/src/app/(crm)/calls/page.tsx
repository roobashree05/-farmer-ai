'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';

export default function CallsPage() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<{ id: string; startedAt: string; callType: string; status: string; outcome: string | null; lead: { name: string } }[]>([]);
  useEffect(() => {
    api<typeof items>(`/api/calls${status ? `?status=${status}` : ''}`).then(setItems);
  }, [status]);
  return (
    <div className="stack">
      <PageHeader title="Calls" subtitle="Manual calls and voice-bot sessions." />
      <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">All statuses</option>
        {['COMPLETED', 'MISSED', 'ANSWERED', 'FAILED'].map((item) => <option key={item}>{item}</option>)}
      </select>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>Lead</th><th>Type</th><th>Status</th><th>Outcome</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><Link href={`/calls/${item.id}`}>{new Date(item.startedAt).toLocaleString()}</Link></td>
                <td>{item.lead.name}</td>
                <td>{item.callType}</td>
                <td>{item.status}</td>
                <td>{item.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

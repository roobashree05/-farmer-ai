'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';

export default function CampaignsPage() {
  const [items, setItems] = useState<{ id: string; name: string; kind: string; platform: string; status: string; budget: number }[]>([]);
  useEffect(() => { api<{ items: typeof items }>('/api/campaigns').then((data) => setItems(data.items)); }, []);
  return (
    <div className="stack">
      <PageHeader title="Campaigns" actions={<Link href="/campaigns/new"><Button type="button">New campaign</Button></Link>} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Kind</th><th>Platform</th><th>Status</th><th>Budget</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><Link href={`/campaigns/${item.id}`}>{item.name}</Link></td>
                <td>{item.kind}</td>
                <td>{item.platform}</td>
                <td>{item.status}</td>
                <td>{item.budget}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

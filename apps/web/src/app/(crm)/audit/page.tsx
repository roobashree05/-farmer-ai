'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [items, setItems] = useState<{ id: string; action: string; entity: string; entityId: string | null; createdAt: string; user: { email: string } | null }[]>([]);
  useEffect(() => {
    api<{ items: typeof items }>(`/api/audit?action=${encodeURIComponent(action)}`).then((data) => setItems(data.items));
  }, [action]);
  return (
    <div className="stack">
      <PageHeader title="Audit logs" subtitle="Logins, lead changes, campaigns, recordings, and knowledge updates." />
      <input className="field" placeholder="Filter by action" value={action} onChange={(event) => setAction(event.target.value)} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
                <td>{item.user?.email ?? 'system'}</td>
                <td>{item.action}</td>
                <td>{item.entity} {item.entityId ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

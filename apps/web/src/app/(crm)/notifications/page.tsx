'use client';

import { useEffect, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';

export default function NotificationsPage() {
  const [data, setData] = useState<{ unread: number; items: { id: string; title: string; body: string; type: string; readAt: string | null; createdAt: string }[] } | null>(null);
  function load() { api<NonNullable<typeof data>>('/api/notifications').then(setData); }
  useEffect(() => { load(); }, []);
  return (
    <div className="stack">
      <PageHeader title="Notifications" subtitle={`${data?.unread ?? 0} unread`} actions={<Button type="button" variant="secondary" onClick={() => void api('/api/notifications/read-all', { method: 'POST' }).then(load)}>Mark all read</Button>} />
      <div className="card">
        {data?.items.map((item) => (
          <article key={item.id}>
            <strong>{item.title}</strong> <span className="muted">{item.type}</span>
            <p>{item.body}</p>
            {!item.readAt ? <Button variant="ghost" type="button" onClick={() => void api(`/api/notifications/${item.id}/read`, { method: 'POST' }).then(load)}>Mark read</Button> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

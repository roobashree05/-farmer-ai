'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@aijewel/ui';
import { api, apiBlob } from '@/lib/api';

export default function CallDetailPage() {
  const params = useParams<{ id: string }>();
  const [call, setCall] = useState<{ id: string; transcript: string | null; summary: string | null; outcome: string | null; status: string } | null>(null);
  const [src, setSrc] = useState('');
  useEffect(() => {
    api<typeof call>(`/api/calls?leadId=`).then(() => undefined);
    api<{ items?: never }>(`/api/calls`).then(() => undefined);
    fetchCall();
    apiBlob(`/api/calls/${params.id}/recording`).then((blob) => setSrc(URL.createObjectURL(blob))).catch(() => undefined);
    async function fetchCall() {
      const calls = await api<{ id: string; transcript: string | null; summary: string | null; outcome: string | null; status: string }[]>('/api/calls');
      setCall(calls.find((item) => item.id === params.id) ?? null);
    }
  }, [params.id]);
  return (
    <div className="stack">
      <PageHeader title="Call" subtitle={call ? `${call.status} · ${call.outcome ?? ''}` : 'Loading'} />
      <section className="card">
        <p>{call?.summary}</p>
        <pre>{call?.transcript}</pre>
        {src ? <audio controls src={src} data-testid="call-audio" /> : <p className="muted">Recording is hidden without permission, or still loading.</p>}
      </section>
    </div>
  );
}

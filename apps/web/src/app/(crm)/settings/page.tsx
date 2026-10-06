'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { can } = useAuth();
  const [settings, setSettings] = useState<{ demoMode: boolean; providers: Record<string, string> } | null>(null);
  const [error, setError] = useState('');
  const [statuses, setStatuses] = useState<{ id: string; code: string; name: string; isActive: boolean }[]>([]);
  const [form, setForm] = useState({ code: '', name: '', sortOrder: 20 });
  function load() {
    api<NonNullable<typeof settings>>('/api/settings').then(setSettings);
    api<typeof statuses>('/api/settings/lead-statuses').then(setStatuses);
  }
  useEffect(() => { load(); }, []);
  async function add(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/settings/lead-statuses', { method: 'POST', json: form });
      setForm({ code: '', name: '', sortOrder: 20 });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the status');
    }
  }
  return (
    <div className="stack">
      <PageHeader title="Settings" subtitle="Providers are selected with environment variables." />
      <section className="card">
        <p>Demo mode: {settings?.demoMode ? 'on' : 'off'}</p>
        {settings ? Object.entries(settings.providers).map(([key, value]) => <p key={key}>{key}: {value}</p>) : null}
      </section>
      {error ? <p className="error">{error}</p> : null}
      {can('settings.write') ? <form className="card form-grid" onSubmit={add}>
        <input className="field" placeholder="CODE" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <input className="field" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Button type="submit">Add status</Button>
      </form> : null}
      <div className="card">
        {statuses.map((status) => <p key={status.id}>{status.code} · {status.name} · {status.isActive ? 'active' : 'inactive'}</p>)}
      </div>
    </div>
  );
}

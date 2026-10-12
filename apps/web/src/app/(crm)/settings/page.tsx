'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function SettingsPage() {
  const { can } = useAuth();
  const [settings, setSettings] = useState<{
    demoMode: boolean;
    providers: Record<string, string>;
    whatsapp?: {
      mode: string;
      configuration: string;
      connection: string;
      connectionDetail: string | null;
      missing: string[];
      invalid: string[];
      graphApiVersion: string | null;
      recommendedGraphApiVersion: string;
      publicWebhookUrl: string | null;
      checkedAt: string | null;
    };
    ai?: {
      mode: string;
      configuration: string;
      connection: string;
      connectionDetail: string | null;
      missing: string[];
      invalid: string[];
      model: string | null;
      defaultModel: string;
      checkedAt: string | null;
    };
  } | null>(null);
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
        {settings ? Object.entries(settings.providers).map(([key, value]) => <p key={key}>Provider {key}: {value}</p>) : null}
        {settings?.whatsapp ? (
          <>
            <p>WhatsApp integration: {settings.whatsapp.mode === 'meta' ? 'Meta Cloud API' : 'DEMO'}</p>
            <p>WhatsApp configuration: {settings.whatsapp.configuration}</p>
            <p>WhatsApp connection: {settings.whatsapp.connection}{settings.whatsapp.checkedAt ? ` (${new Date(settings.whatsapp.checkedAt).toLocaleString()})` : ''}</p>
            {settings.whatsapp.connectionDetail ? <p>{settings.whatsapp.connectionDetail}</p> : null}
            {settings.whatsapp.mode === 'meta' ? (
              <>
                {settings.whatsapp.graphApiVersion ? <p>Graph API version: {settings.whatsapp.graphApiVersion}</p> : <p>Recommended Graph API version: {settings.whatsapp.recommendedGraphApiVersion}</p>}
                {settings.whatsapp.missing.length > 0 ? <p>Missing WhatsApp configuration: {settings.whatsapp.missing.join(', ')}</p> : null}
                {settings.whatsapp.invalid.length > 0 ? <p>Invalid WhatsApp configuration: {settings.whatsapp.invalid.join(', ')}</p> : null}
                {settings.whatsapp.publicWebhookUrl ? <p>Webhook URL: {settings.whatsapp.publicWebhookUrl}</p> : null}
              </>
            ) : null}
          </>
        ) : null}
        {settings?.ai ? (
          <>
            <p>AI integration: {settings.ai.mode === 'anthropic' ? 'Anthropic Claude' : 'DEMO'}</p>
            <p>AI configuration: {settings.ai.configuration}</p>
            <p>AI connection: {settings.ai.connection}{settings.ai.checkedAt ? ` (${new Date(settings.ai.checkedAt).toLocaleString()})` : ''}</p>
            {settings.ai.connectionDetail ? <p>{settings.ai.connectionDetail}</p> : null}
            {settings.ai.mode === 'anthropic' ? (
              <>
                {settings.ai.model ? <p>Claude model: {settings.ai.model}</p> : <p>Default Claude model: {settings.ai.defaultModel}</p>}
                {settings.ai.missing.length > 0 ? <p>Missing AI configuration: {settings.ai.missing.join(', ')}</p> : null}
                {settings.ai.invalid.length > 0 ? <p>Invalid AI configuration: {settings.ai.invalid.join(', ')}</p> : null}
              </>
            ) : null}
          </>
        ) : null}
        {can('settings.write') && settings?.whatsapp?.mode === 'meta' ? (
          <Button type="button" variant="secondary" onClick={() => { setError(''); void api('/api/settings/whatsapp/connection-test', { method: 'POST' }).then(() => load()).catch((err) => setError(err instanceof Error ? err.message : 'Connection test failed')); }}>Test WhatsApp connection</Button>
        ) : null}
        {can('settings.write') && settings?.ai?.mode === 'anthropic' ? (
          <Button type="button" variant="secondary" onClick={() => { setError(''); void api('/api/settings/ai/connection-test', { method: 'POST' }).then(() => load()).catch((err) => setError(err instanceof Error ? err.message : 'Connection test failed')); }}>Test Claude connection</Button>
        ) : null}
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

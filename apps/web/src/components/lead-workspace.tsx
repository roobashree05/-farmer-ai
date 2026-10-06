'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Badge, Button, PageHeader } from '@aijewel/ui';
import { api, apiBlob, apiForm } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Workspace {
  lead: {
    id: string;
    displayId: number;
    name: string;
    phone: string;
    email: string | null;
    shopName: string | null;
    location: string | null;
    customerCategory: string | null;
    previousEnquiry: string | null;
    status: { code: string; name: string };
    source: { code: string; name: string };
    tags: { name: string }[];
    whatsappGroupName: string | null;
    customerId: string | null;
  };
  customer: { id: string; name: string; shopName: string | null } | null;
  notes: { id: string; body: string; author: string; createdAt: string }[];
  timeline: { id: string; type: string; summary: string; createdAt: string; actor: string | null }[];
  whatsapp: { id: string; messages: { body: string; direction: string; status: string }[] } | null;
  calls: { id: string; startedAt: string; durationSeconds: number; status: string; employee: string; outcome: string | null; notes: string | null; recording: { url: string } | null }[];
  meetings: { id: string; title: string; startAt: string; status: string }[];
  campaigns: { id: string; name: string; status: string; renderedBody: string }[];
  aiMessages: { id: string; role: string; content: string; escalateToHuman: boolean }[];
  followUps: { id: string; dueAt: string; status: string; notes: string | null }[];
}

export function LeadWorkspace({ endpoint }: { endpoint: string }) {
  const { can } = useAuth();
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [meeting, setMeeting] = useState({ date: '', time: '11:00', durationMinutes: 30, meetingType: 'DEMO', attendeeEmail: '' });
  const [slots, setSlots] = useState<{ time: string; status: string }[]>([]);
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [profile, setProfile] = useState({ name: '', email: '', shopName: '', location: '', status: '' });
  const [duplicateId, setDuplicateId] = useState('');

  function load() {
    api<Workspace>(endpoint).then((next) => {
      setData(next);
      setProfile({
        name: next.lead.name,
        email: next.lead.email ?? '',
        shopName: next.lead.shopName ?? '',
        location: next.lead.location ?? '',
        status: next.lead.status.code,
      });
    }).catch((err: Error) => setError(err.message));
  }

  async function run(work: () => Promise<unknown>) {
    setActionError('');
    try {
      await work();
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Request failed');
    }
  }

  useEffect(() => {
    load();
  }, [endpoint]);

  useEffect(() => {
    if (!data) return;
    data.calls.forEach((call) => {
      if (!call.recording || audio[call.id]) return;
      apiBlob(call.recording.url).then((blob) => {
        setAudio((current) => ({ ...current, [call.id]: URL.createObjectURL(blob) }));
      }).catch(() => undefined);
    });
  }, [data, audio]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading customer…</p>;
  const lead = data.lead;

  async function addNote(event: FormEvent) {
    event.preventDefault();
    const body = note;
    await run(async () => {
      await api(`/api/leads/${lead.id}/notes`, { method: 'POST', json: { body } });
      setNote('');
    });
  }

  async function book(event: FormEvent) {
    event.preventDefault();
    await run(() => api('/api/meetings', {
      method: 'POST',
      json: {
        leadId: lead.id,
        date: meeting.date,
        time: meeting.time,
        durationMinutes: Number(meeting.durationMinutes),
        meetingType: meeting.meetingType,
        attendeeName: lead.name,
        attendeePhone: lead.phone,
        attendeeEmail: meeting.attendeeEmail || lead.email || undefined,
      },
    }));
  }

  return (
    <div className="stack">
      <PageHeader title={lead.name} subtitle={`${lead.shopName ?? 'Independent shop'} · ${lead.location ?? 'Location not set'} · Lead ${lead.displayId}`} />
      {actionError ? <p className="error">{actionError}</p> : null}
      <div className="action-row">
        {can('calls.write') ? <Button data-testid="start-voice" type="button" onClick={() => void api(`/api/calls/voice`, { method: 'POST', json: { leadId: lead.id } }).then(load)}>Call</Button> : null}
        {can('whatsapp.send') ? <Button type="button" onClick={() => void api<{ id: string }>('/api/whatsapp/conversations', { method: 'POST', json: { leadId: lead.id } }).then((item) => { window.location.href = `/whatsapp/${item.id}`; })}>WhatsApp</Button> : null}
        <a href="#meeting"><Button type="button" variant="secondary">Schedule meeting</Button></a>
        <a href="#note"><Button type="button" variant="secondary">Add note</Button></a>
        <a href="#follow-up"><Button type="button" variant="secondary">Create follow-up</Button></a>
        <Link href={`/campaigns/new?leadId=${lead.id}`}><Button type="button" variant="secondary">Send campaign</Button></Link>
        <a href="#timeline"><Button type="button" variant="ghost">View timeline</Button></a>
        {can('customers.write') && !lead.customerId ? <Button type="button" variant="secondary" onClick={() => void run(() => api(`/api/leads/${lead.id}/convert`, { method: 'POST' }))}>Convert</Button> : null}
      </div>
      {can('leads.write') ? (
        <form className="card form-grid" onSubmit={(event) => {
          event.preventDefault();
          void run(() => api(`/api/leads/${lead.id}`, {
            method: 'PATCH',
            json: {
              name: profile.name,
              status: profile.status,
              email: profile.email,
              shopName: profile.shopName,
              location: profile.location,
            },
          }));
        }}>
          <input className="field" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
          <input className="field" placeholder="Email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
          <input className="field" placeholder="Shop" value={profile.shopName} onChange={(event) => setProfile({ ...profile, shopName: event.target.value })} />
          <input className="field" placeholder="Location" value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} />
          <select className="select" value={profile.status} onChange={(event) => setProfile({ ...profile, status: event.target.value })}>
            {['NEW', 'CONTACTED', 'QUALIFIED', 'MEETING_SCHEDULED', 'FOLLOW_UP', 'CONVERTED', 'LOST'].map((code) => <option key={code}>{code}</option>)}
          </select>
          <Button type="submit" variant="secondary">Save details</Button>
        </form>
      ) : null}
      <section className="card form-grid">
        <div><p className="muted">Phone</p><strong>{lead.phone}</strong></div>
        <div><p className="muted">Email</p><strong>{lead.email ?? '—'}</strong></div>
        <div><p className="muted">Status</p><Badge tone="info">{lead.status.name}</Badge></div>
        <div><p className="muted">Source</p><strong>{lead.source.name}</strong></div>
        <div><p className="muted">Category</p><strong>{lead.customerCategory ?? '—'}</strong></div>
        <div><p className="muted">Previous enquiry</p><strong>{lead.previousEnquiry ?? '—'}</strong></div>
        <div><p className="muted">Tags</p><strong>{lead.tags.map((tag) => tag.name).join(', ') || '—'}</strong></div>
        <div><p className="muted">WhatsApp group</p><strong>{lead.whatsappGroupName ?? '—'}</strong></div>
      </section>
      <section className="card" id="note">
        <h2>Notes</h2>
        <form className="toolbar" onSubmit={addNote}>
          <input className="field" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" />
          <Button type="submit">Save note</Button>
        </form>
        {data.notes.map((item) => <p key={item.id}><strong>{item.author}:</strong> {item.body}</p>)}
      </section>
      <section className="card" id="meeting">
        <h2>Schedule meeting</h2>
        <form className="form-grid" onSubmit={book}>
          <input className="field" data-testid="meeting-date" type="date" required value={meeting.date} onChange={(event) => {
            setMeeting({ ...meeting, date: event.target.value });
            void api<{ time: string; status: string }[]>(`/api/meetings/availability?date=${event.target.value}`).then(setSlots);
          }} />
          <select className="select" value={meeting.time} onChange={(event) => setMeeting({ ...meeting, time: event.target.value })}>
            {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '15:00', '16:00', '16:30'].map((time) => <option key={time}>{time}</option>)}
          </select>
          <select className="select" value={meeting.durationMinutes} onChange={(event) => setMeeting({ ...meeting, durationMinutes: Number(event.target.value) })}>
            {[15, 30, 45, 60].map((value) => <option key={value} value={value}>{value} min</option>)}
          </select>
          <input className="field" value={meeting.meetingType} onChange={(event) => setMeeting({ ...meeting, meetingType: event.target.value })} />
          <Button data-testid="book-meeting" type="submit">Book meeting</Button>
        </form>
        <div className="toolbar">{slots.map((slot) => <Badge key={slot.time} tone={slot.status === 'AVAILABLE' ? 'good' : 'warn'}>{slot.time} {slot.status}</Badge>)}</div>
        {data.meetings.map((item) => (
          <p key={item.id}>
            {item.title} · {new Date(item.startAt).toLocaleString()} · {item.status}
            {can('meetings.write') && item.status === 'SCHEDULED' ? (
              <Button variant="ghost" type="button" onClick={() => void run(() => api(`/api/meetings/${item.id}/cancel`, { method: 'POST' }))}>Cancel</Button>
            ) : null}
          </p>
        ))}
      </section>
      <section className="card" id="follow-up">
        <h2>Follow-ups</h2>
        <Button type="button" variant="secondary" onClick={() => void api(`/api/leads/${lead.id}/follow-ups`, { method: 'POST', json: { dueAt: new Date(Date.now() + 86400000).toISOString(), notes: 'Call back' } }).then(load)}>Create follow-up for tomorrow</Button>
        {data.followUps.map((item) => <p key={item.id}>{new Date(item.dueAt).toLocaleString()} · {item.status} · {item.notes}</p>)}
      </section>
      <section className="card">
        <h2>WhatsApp</h2>
        {data.whatsapp ? <Link href={`/whatsapp/${data.whatsapp.id}`}>Open conversation ({data.whatsapp.messages.length} messages)</Link> : <p className="muted">No conversation yet.</p>}
      </section>
      <section className="card">
        <h2>Call recordings</h2>
        {data.calls.map((call) => (
          <article key={call.id}>
            <p>{new Date(call.startedAt).toLocaleString()} · {call.employee} · {call.durationSeconds}s · {call.status} · {call.outcome}</p>
            <p>{call.notes}</p>
            {audio[call.id] ? <audio controls src={audio[call.id]} /> : null}
            {can('calls.write') ? (
              <input className="field" type="file" accept="audio/*" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const body = new FormData();
                body.set('file', file);
                void run(() => apiForm(`/api/calls/${call.id}/recording`, body));
              }} />
            ) : null}
          </article>
        ))}
      </section>
      <section className="card">
        <h2>Campaigns and AI</h2>
        {data.campaigns.map((item) => <p key={item.id}>{item.name} · {item.status}<br />{item.renderedBody}</p>)}
        {data.aiMessages.map((item) => <p key={item.id}><strong>{item.role}:</strong> {item.content} {item.escalateToHuman ? '(escalated)' : ''}</p>)}
      </section>
      {can('leads.merge') ? (
        <form className="card toolbar" onSubmit={(event) => {
          event.preventDefault();
          void run(() => api('/api/leads/merge', { method: 'POST', json: { primaryId: lead.id, duplicateId } }));
        }}>
          <input className="field" placeholder="Duplicate lead id" value={duplicateId} onChange={(event) => setDuplicateId(event.target.value)} />
          <Button type="submit" variant="secondary">Merge into this lead</Button>
        </form>
      ) : null}
      <section className="card" id="timeline">
        <h2>Activity timeline</h2>
        <div className="timeline" data-testid="lead-timeline">
          {data.timeline.map((item) => (
            <article key={item.id}>
              <strong>{item.type}</strong>
              <p>{item.summary}</p>
              <p className="muted">{item.actor} · {new Date(item.createdAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

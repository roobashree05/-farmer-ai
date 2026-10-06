'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Button, EmptyState, PageHeader } from '@aijewel/ui';
import type { LeadSummary, PageResult } from '@aijewel/types';
import { API_URL, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Filters {
  q: string;
  status: string;
  source: string;
  location: string;
}

export default function LeadsPage() {
  const { can } = useAuth();
  const [data, setData] = useState<PageResult<LeadSummary> | null>(null);
  const [filters, setFilters] = useState<Filters>({ q: '', status: '', source: '', location: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', shopName: '', location: '', email: '' });
  const [assignees, setAssignees] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [assigneeId, setAssigneeId] = useState('');

  function load(nextPage = page, nextFilters = filters) {
    const params = new URLSearchParams({ page: String(nextPage), pageSize: '25' });
    if (nextFilters.q) params.set('q', nextFilters.q);
    if (nextFilters.status) params.set('status', nextFilters.status);
    if (nextFilters.source) params.set('source', nextFilters.source);
    if (nextFilters.location) params.set('location', nextFilters.location);
    api<PageResult<LeadSummary>>(`/api/leads?${params.toString()}`)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load(1);
    if (can('leads.assign')) {
      api<{ id: string; firstName: string; lastName: string }[]>('/api/users/assignees')
        .then(setAssignees)
        .catch((err: Error) => setError(err.message));
    }
  }, []);

  async function createLead(event: FormEvent) {
    event.preventDefault();
    setError('');
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.shopName.trim() ? { shopName: form.shopName.trim() } : {}),
      ...(form.location.trim() ? { location: form.location.trim() } : {}),
    };
    try {
      await api('/api/leads', { method: 'POST', json: payload });
      setForm({ name: '', phone: '', shopName: '', location: '', email: '' });
      load(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the lead');
    }
  }

  async function bulk(action: string, extra: Record<string, string> = {}) {
    setError('');
    try {
      await api('/api/leads/bulk', { method: 'POST', json: { action, ids: selected, ...extra } });
      setSelected([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
    }
  }

  async function exportLeads() {
    setError('');
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.source) params.set('source', filters.source);
    if (filters.location) params.set('location', filters.location);
    const token = sessionStorage.getItem('aijewel.accessToken');
    const response = await fetch(`${API_URL}/api/leads/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      setError('Export failed');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leads.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = {
      q: String(data.get('q') ?? ''),
      status: String(data.get('status') ?? ''),
      source: String(data.get('source') ?? ''),
      location: String(data.get('location') ?? ''),
    };
    setFilters(next);
    setPage(1);
    load(1, next);
  }

  return (
    <div className="stack">
      <PageHeader title="Leads" subtitle="Server-side search, filters, and bulk actions. The list never loads the full database." />
      {error ? <p className="error">{error}</p> : null}
      <form className="card form-grid" onSubmit={applyFilters}>
        <input className="field" name="q" data-testid="lead-search" placeholder="Search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
        <input className="field" name="status" placeholder="Status code" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} />
        <input className="field" name="source" placeholder="Source code" value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value })} />
        <input className="field" name="location" placeholder="Location" value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} />
        <Button type="submit">Apply filters</Button>
        <Button variant="secondary" type="button" onClick={() => void exportLeads()}>Export CSV</Button>
      </form>
      {can('leads.write') ? (
        <form className="card form-grid" onSubmit={createLead}>
          <input className="field" data-testid="lead-name" placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <input className="field" data-testid="lead-phone" placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          <input className="field" placeholder="Shop" value={form.shopName} onChange={(event) => setForm({ ...form, shopName: event.target.value })} />
          <input className="field" placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          <input className="field" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Button data-testid="lead-create" type="submit">Create lead</Button>
        </form>
      ) : null}
      <div className="toolbar">
        <Button variant="secondary" type="button" disabled={!selected.length} onClick={() => void bulk('status', { status: 'CONTACTED' })}>Mark contacted</Button>
        <Button variant="secondary" type="button" disabled={!selected.length} onClick={() => void bulk('tag', { tag: 'follow-up' })}>Tag follow-up</Button>
        <Button variant="secondary" type="button" disabled={!selected.length} onClick={() => void bulk('followup', { dueAt: new Date(Date.now() + 86400000).toISOString(), notes: 'Bulk follow-up' })}>Follow up tomorrow</Button>
        <Button variant="secondary" type="button" disabled={!selected.length} onClick={() => void bulk('campaign')}>Draft campaign</Button>
        {can('leads.assign') ? (
          <>
            <select className="select" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Assign to…</option>
              {assignees.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}
            </select>
            <Button variant="secondary" type="button" disabled={!selected.length || !assigneeId} onClick={() => void bulk('assign', { assignedUserId: assigneeId })}>Assign</Button>
          </>
        ) : null}
        {can('leads.delete') ? <Button variant="danger" type="button" disabled={!selected.length} onClick={() => void bulk('delete')}>Delete</Button> : null}
      </div>
      <div className="card table-wrap">
        {!data || data.items.length === 0 ? <EmptyState title="No leads" body="Import a file or create the first lead." /> : (
          <table data-testid="leads-table">
            <thead>
              <tr><th></th><th>ID</th><th>Name</th><th>Phone</th><th>Shop</th><th>Location</th><th>Status</th><th>Source</th></tr>
            </thead>
            <tbody>
              {data.items.map((lead) => (
                <tr key={lead.id}>
                  <td><input type="checkbox" checked={selected.includes(lead.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, lead.id] : selected.filter((id) => id !== lead.id))} /></td>
                  <td>{lead.displayId}</td>
                  <td><Link href={`/leads/${lead.id}`}>{lead.name}</Link></td>
                  <td>{lead.phone}</td>
                  <td>{lead.shopName}</td>
                  <td>{lead.location}</td>
                  <td>{lead.status.name}</td>
                  <td>{lead.source.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data ? (
        <div className="toolbar">
          <Button variant="secondary" type="button" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); load(next); }}>Previous</Button>
          <span>Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))} · {data.total} leads</span>
          <Button variant="secondary" type="button" disabled={data.page * data.pageSize >= data.total} onClick={() => { const next = page + 1; setPage(next); load(next); }}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}

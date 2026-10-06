'use client';

import { useEffect, useState } from 'react';
import { PageHeader, StatCard } from '@aijewel/ui';
import type { DashboardSnapshot } from '@aijewel/types';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<DashboardSnapshot>('/api/dashboard').then(setData).catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading dashboard…</p>;
  const status = (code: string) => data.leads.byStatus.find((item) => item.code === code)?.count ?? 0;

  return (
    <div className="stack">
      <PageHeader title="Dashboard" subtitle="Pipeline, conversations, campaigns, meetings, and calls." />
      <section>
        <h2>Leads</h2>
        <div className="grid-stats" data-testid="dashboard-leads">
          <StatCard label="Total" value={data.leads.total} />
          <StatCard label="New" value={status('NEW')} />
          <StatCard label="Qualified" value={status('QUALIFIED')} />
          <StatCard label="Follow-up" value={status('FOLLOW_UP')} />
          <StatCard label="Converted" value={status('CONVERTED')} />
          <StatCard label="Lost" value={status('LOST')} />
        </div>
      </section>
      <section>
        <h2>WhatsApp</h2>
        <div className="grid-stats">
          <StatCard label="Active chats" value={data.whatsapp.activeChats} />
          <StatCard label="Messages" value={data.whatsapp.messages} />
          <StatCard label="Responses" value={data.whatsapp.responses} />
          <StatCard label="Read rate" value={`${Math.round(data.whatsapp.readRate * 100)}%`} />
        </div>
      </section>
      <section>
        <h2>Marketing</h2>
        <div className="grid-stats">
          <StatCard label="Campaigns" value={data.marketing.campaigns} />
          <StatCard label="Scheduled" value={data.marketing.scheduled} />
          <StatCard label="Leads generated" value={data.marketing.leadsGenerated} />
          <StatCard label="Cost per lead" value={data.marketing.costPerLead.toFixed(0)} />
        </div>
      </section>
      <section>
        <h2>Meetings</h2>
        <div className="grid-stats">
          <StatCard label="Upcoming" value={data.meetings.upcoming} />
          <StatCard label="Completed" value={data.meetings.completed} />
          <StatCard label="Cancelled" value={data.meetings.cancelled} />
        </div>
      </section>
      <section>
        <h2>Calls</h2>
        <div className="grid-stats">
          <StatCard label="Manual" value={data.calls.manual} />
          <StatCard label="Automated" value={data.calls.automated} />
          <StatCard label="Answered" value={data.calls.answered} />
          <StatCard label="Missed" value={data.calls.missed} />
        </div>
      </section>
      <section className="card">
        <h2>Recent activity</h2>
        <div className="timeline">
          {data.recentActivity.map((item) => (
            <article key={item.id}>
              <strong>{item.leadName}</strong>
              <p>{item.summary}</p>
              <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

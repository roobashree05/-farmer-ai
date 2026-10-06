'use client';

import { useEffect, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api, API_URL } from '@/lib/api';

interface Report {
  totals: { spend: number; impressions: number; reach: number; clicks: number; ctr: number; leads: number; costPerLead: number; engagement: number; conversions: number };
  rows: { campaign: string; date: string; spend: number; clicks: number; leads: number }[];
}

export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  function load() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (campaignId) params.set('campaignId', campaignId);
    api<Report>(`/api/reports/campaigns?${params.toString()}`).then(setReport);
  }
  useEffect(() => { load(); }, []);
  const max = Math.max(...(report?.rows.map((row) => row.clicks) ?? [1]), 1);
  return (
    <div className="stack">
      <PageHeader title="Reports" subtitle="Mock campaign metrics with date and campaign filters." />
      <form className="toolbar" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <input className="field" placeholder="Campaign id" value={campaignId} onChange={(event) => setCampaignId(event.target.value)} />
        <Button type="submit">Filter</Button>
        <Button variant="secondary" type="button" onClick={() => void download(from, to, campaignId)}>Export CSV</Button>
      </form>
      {report ? (
        <>
          <div className="grid-stats">
            <article className="stat-card"><p className="stat-label">Spend</p><p className="stat-value">{report.totals.spend.toFixed(0)}</p></article>
            <article className="stat-card"><p className="stat-label">Impressions</p><p className="stat-value">{report.totals.impressions}</p></article>
            <article className="stat-card"><p className="stat-label">CTR</p><p className="stat-value">{(report.totals.ctr * 100).toFixed(2)}%</p></article>
            <article className="stat-card"><p className="stat-label">Leads</p><p className="stat-value">{report.totals.leads}</p></article>
            <article className="stat-card"><p className="stat-label">Cost / lead</p><p className="stat-value">{report.totals.costPerLead.toFixed(0)}</p></article>
          </div>
          <svg className="chart" viewBox={`0 0 ${Math.max(report.rows.length, 1) * 48} 160`}>
            {report.rows.map((row, index) => {
              const height = (row.clicks / max) * 120;
              return <rect key={`${row.campaign}-${row.date}-${index}`} x={index * 48 + 8} y={140 - height} width="28" height={height} fill="#8c6a3d" />;
            })}
          </svg>
        </>
      ) : null}
    </div>
  );
}

async function download(from: string, to: string, campaignId: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (campaignId) params.set('campaignId', campaignId);
  const token = sessionStorage.getItem('aijewel.accessToken');
  const response = await fetch(`${API_URL}/api/reports/campaigns/export?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'campaign-report.csv';
  link.click();
}

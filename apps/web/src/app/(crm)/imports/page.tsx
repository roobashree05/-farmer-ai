'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api, apiForm } from '@/lib/api';

export default function ImportsPage() {
  const [summary, setSummary] = useState<string>('');
  const [history, setHistory] = useState<{ id: string; fileName: string; totalRows: number; successful: number; duplicates: number; invalid: number; createdAt: string }[]>([]);
  function load() { api<{ items: typeof history }>('/api/leads/imports').then((data) => setHistory(data.items)); }
  useEffect(() => { load(); }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await apiForm<{ total: number; successful: number; duplicates: number; invalid: number }>('/api/leads/import', form);
    setSummary(`Total rows: ${result.total}. Successful: ${result.successful}. Duplicates: ${result.duplicates}. Invalid: ${result.invalid}.`);
    load();
  }

  return (
    <div className="stack">
      <PageHeader title="Imports" subtitle="CSV files and the 500-contact Hyderabad WhatsApp group." />
      <form className="card stack" onSubmit={upload}>
        <input name="file" type="file" accept=".csv,text/csv" required />
        <input className="field" name="mapping" placeholder='Optional mapping JSON, e.g. {"name":"Full Name","phone":"Mobile"}' />
        <Button type="submit">Import CSV</Button>
      </form>
      <div className="card">
        <Button data-testid="import-group" type="button" onClick={() => void apiForm<typeof summary extends string ? { total: number; successful: number; duplicates: number; invalid: number } : never>('/api/leads/import/whatsapp-group', new FormData()).then((result) => {
          setSummary(`Total rows: ${result.total}. Successful: ${result.successful}. Duplicates: ${result.duplicates}. Invalid: ${result.invalid}.`);
          load();
        })}>Import AIJewel Hyderabad Jewellery Group (500)</Button>
        {summary ? <p data-testid="import-summary">{summary}</p> : null}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>File</th><th>Total</th><th>Successful</th><th>Duplicates</th><th>Invalid</th></tr></thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
                <td>{item.fileName}</td>
                <td>{item.totalRows}</td>
                <td>{item.successful}</td>
                <td>{item.duplicates}</td>
                <td>{item.invalid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

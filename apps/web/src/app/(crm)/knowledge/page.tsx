'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Entry { id: string; category: string; name: string; isActive: boolean; documents: { id: string; title: string; content: string; isActive: boolean }[] }

export default function KnowledgePage() {
  const { can } = useAuth();
  const [items, setItems] = useState<Entry[]>([]);
  const [form, setForm] = useState({ category: 'FAQ', name: '', title: '', content: '' });
  function load() { api<Entry[]>('/api/knowledge-base').then(setItems); }
  useEffect(() => { load(); }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    const category = await api<{ id: string }>('/api/knowledge-base', { method: 'POST', json: { category: form.category, name: form.name } });
    await api(`/api/knowledge-base/${category.id}/documents`, { method: 'POST', json: { title: form.title, content: form.content } });
    setForm({ category: 'FAQ', name: '', title: '', content: '' });
    load();
  }

  return (
    <div className="stack">
      <PageHeader title="Knowledge base" subtitle="Answers stay inside these entries. The mock AI will not invent prices." />
      {can('knowledge.write') ? (
        <form className="card form-grid" onSubmit={create}>
          <select className="select" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            {['COMPANY', 'PRODUCT', 'PRICING', 'FAQ', 'SUPPORT', 'WARRANTY', 'DEMO', 'SALES'].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className="field" placeholder="Category name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <input className="field" placeholder="Entry title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <textarea className="textarea" placeholder="Entry content" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required />
          <Button type="submit">Add entry</Button>
        </form>
      ) : null}
      {items.map((item) => (
        <section className="card" key={item.id}>
          <h2>{item.category} · {item.name}</h2>
          {item.documents.map((doc) => (
            <article key={doc.id}>
              <strong>{doc.title}</strong> {doc.isActive ? '' : '(inactive)'}
              <p>{doc.content}</p>
              {can('knowledge.write') ? (
                <DocumentEditor doc={doc} onSaved={load} />
              ) : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function DocumentEditor({ doc, onSaved }: { doc: { id: string; title: string; content: string; isActive: boolean }; onSaved: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [error, setError] = useState('');
  return (
    <form className="stack" onSubmit={(event) => {
      event.preventDefault();
      setError('');
      api(`/api/knowledge-base/documents/${doc.id}`, { method: 'PATCH', json: { title, content } })
        .then(onSaved)
        .catch((err: Error) => setError(err.message));
    }}>
      <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea className="textarea" value={content} onChange={(event) => setContent(event.target.value)} />
      {error ? <p className="error">{error}</p> : null}
      <div className="toolbar">
        <Button type="submit" variant="secondary">Save entry</Button>
        <Button variant="secondary" type="button" onClick={() => void api(`/api/knowledge-base/documents/${doc.id}`, { method: 'PATCH', json: { isActive: !doc.isActive } }).then(onSaved)}>{doc.isActive ? 'Deactivate' : 'Activate'}</Button>
        <Button variant="danger" type="button" onClick={() => void api(`/api/knowledge-base/documents/${doc.id}`, { method: 'DELETE' }).then(onSaved)}>Delete</Button>
      </div>
    </form>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Button, PageHeader } from '@aijewel/ui';
import { api, subscribeWhatsApp } from '@/lib/api';

interface Message { id: string; direction: string; body: string; status: string; createdAt: string; errorCode?: string | null }
interface Conversation { id: string; contactPhone: string; lead?: { name: string } | null; messages: Message[] }

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [body, setBody] = useState('Can you tell me about AIJewel warranty?');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<string | null>(null);

  function load() {
    api<Conversation>(`/api/whatsapp/conversations/${params.id}`).then(setConversation);
  }
  useEffect(() => {
    load();
    api<{ whatsapp?: { mode?: string } }>('/api/settings').then((settings) => setMode(settings.whatsapp?.mode ?? null)).catch(() => setMode(null));
    const controller = new AbortController();
    subscribeWhatsApp((event) => {
      if (event.type !== 'message.created' && event.type !== 'message.status') return;
      if (!event.conversationId || event.conversationId === params.id) load();
    }, controller.signal);
    return () => controller.abort();
  }, [params.id]);

  async function send(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api(`/api/whatsapp/conversations/${params.id}/messages`, { method: 'POST', json: { body } });
      setBody('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the message');
      load();
    }
  }

  if (!conversation) return <p>Loading conversation…</p>;
  return (
    <div className="stack">
      <PageHeader title={conversation.lead?.name ?? conversation.contactPhone} subtitle={conversation.contactPhone} />
      {mode === 'meta' ? <p className="muted">Meta accepted a sent message. Delivered and read arrive from WhatsApp webhooks.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="card thread" data-testid="whatsapp-thread">
        {conversation.messages.map((message) => (
          <div key={message.id} className={`bubble ${message.direction === 'OUTBOUND' ? 'out' : 'in'}`}>
            <p>{message.body}</p>
            <p className="muted">{new Date(message.createdAt).toLocaleString()} <Badge tone={message.status === 'FAILED' ? 'bad' : 'good'}>{message.status}</Badge>{message.errorCode ? ` ${message.errorCode}` : ''}</p>
          </div>
        ))}
      </div>
      <form className="toolbar" onSubmit={send}>
        <input className="field" data-testid="whatsapp-body" value={body} onChange={(event) => setBody(event.target.value)} />
        <Button data-testid="whatsapp-send" type="submit">Send</Button>
      </form>
    </div>
  );
}

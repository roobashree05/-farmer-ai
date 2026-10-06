'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';

interface Item { id: string; type: string; title: string; start: string; end: string; status: string; platform: string }

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [items, setItems] = useState<Item[]>([]);

  const range = useMemo(() => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    if (view === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime() + 7 * 86400000);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [cursor, view]);

  useEffect(() => {
    api<Item[]>(`/api/calendar?from=${range.start.toISOString()}&to=${range.end.toISOString()}`).then(setItems);
  }, [range]);

  const days: Date[] = [];
  if (view === 'month') {
    const first = new Date(range.start);
    first.setDate(first.getDate() - first.getDay());
    for (let index = 0; index < 42; index += 1) days.push(new Date(first.getTime() + index * 86400000));
  } else if (view === 'week') {
    for (let index = 0; index < 7; index += 1) days.push(new Date(range.start.getTime() + index * 86400000));
  } else {
    days.push(new Date(range.start));
  }

  return (
    <div className="stack">
      <PageHeader title="Marketing calendar" subtitle="Campaigns, posts, and meetings." actions={
        <div className="toolbar">
          <Button variant="secondary" type="button" onClick={() => setCursor(new Date(cursor.getTime() - 86400000 * (view === 'month' ? 30 : view === 'week' ? 7 : 1)))}>Previous</Button>
          <Button variant="secondary" type="button" onClick={() => setCursor(new Date())}>Today</Button>
          <Button variant="secondary" type="button" onClick={() => setCursor(new Date(cursor.getTime() + 86400000 * (view === 'month' ? 30 : view === 'week' ? 7 : 1)))}>Next</Button>
          {(['day', 'week', 'month'] as const).map((item) => <Button key={item} variant={view === item ? 'primary' : 'ghost'} type="button" onClick={() => setView(item)}>{item}</Button>)}
        </div>
      } />
      <div className="month-scroll">
        <div className={view === 'month' || view === 'week' ? 'month-grid' : 'stack'}>
          {days.map((day) => {
            const key = day.toDateString();
            const dayItems = items.filter((item) => new Date(item.start).toDateString() === key);
            return (
              <div className="day-cell" key={key}>
                <strong>{day.getDate()} {day.toLocaleDateString(undefined, { weekday: 'short' })}</strong>
                {dayItems.map((item) => (
                  <p key={item.id}>
                    {item.type}: {item.title} · {item.status}
                    {item.type === 'MEETING' && item.status === 'SCHEDULED' ? (
                      <button className="btn btn-ghost" type="button" onClick={() => void api(`/api/meetings/${item.id}/cancel`, { method: 'POST' }).then(() => {
                        api<Item[]>(`/api/calendar?from=${range.start.toISOString()}&to=${range.end.toISOString()}`).then(setItems);
                      })}>Cancel</button>
                    ) : null}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

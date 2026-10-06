'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const LINKS = [
  ['/', 'Dashboard'],
  ['/leads', 'Leads'],
  ['/customers', 'Customers'],
  ['/whatsapp', 'WhatsApp'],
  ['/campaigns', 'Campaigns'],
  ['/calendar', 'Calendar'],
  ['/calls', 'Calls'],
  ['/knowledge', 'Knowledge Base'],
  ['/reports', 'Reports'],
  ['/notifications', 'Notifications'],
  ['/imports', 'Imports'],
  ['/users', 'Users'],
  ['/settings', 'Settings'],
  ['/audit', 'Audit Logs'],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ leads: { id: string; name: string; phone: string }[]; campaigns: { id: string; name: string }[]; conversations: { id: string; lead: { name: string } }[] } | null>(null);

  async function onSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults(null);
      return;
    }
    const data = await api<NonNullable<typeof results>>(`/api/search?q=${encodeURIComponent(value)}`);
    setResults(data);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <strong>AIJewel</strong>
          <span>CRM for jewellery retail</span>
        </div>
        <nav>
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={`nav-link ${pathname === href ? 'active' : ''}`} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="btn btn-secondary menu-toggle" type="button" onClick={() => setOpen((value) => !value)}>
            Menu
          </button>
          <div className="search-box">
            <input data-testid="global-search" placeholder="Search name, phone, shop, lead ID" value={query} onChange={(event) => void onSearch(event.target.value)} />
            {results ? (
              <div className="search-results">
                {results.leads.map((lead) => (
                  <button key={lead.id} className="btn btn-ghost" type="button" onClick={() => { setResults(null); router.push(`/leads/${lead.id}`); }}>
                    {lead.name} · {lead.phone}
                  </button>
                ))}
                {results.campaigns.map((campaign) => (
                  <button key={campaign.id} className="btn btn-ghost" type="button" onClick={() => { setResults(null); router.push(`/campaigns/${campaign.id}`); }}>
                    Campaign · {campaign.name}
                  </button>
                ))}
                {results.conversations.map((conversation) => (
                  <button key={conversation.id} className="btn btn-ghost" type="button" onClick={() => { setResults(null); router.push(`/whatsapp/${conversation.id}`); }}>
                    WhatsApp · {conversation.lead.name}
                  </button>
                ))}
                {results.leads.length + results.campaigns.length + results.conversations.length === 0 ? <p className="muted">No matches</p> : null}
              </div>
            ) : null}
          </div>
          <div className="toolbar">
            <span className="muted">{user ? `${user.firstName} · ${user.role}` : ''}</span>
            <button className="btn btn-secondary" type="button" onClick={() => void logout()}>Logout</button>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

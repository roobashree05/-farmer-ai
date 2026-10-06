'use client';

import { Shell } from '@/components/shell';
import { useAuth } from '@/lib/auth';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  if (!ready || !user) return <main className="content">Loading CRM…</main>;
  return <Shell>{children}</Shell>;
}

'use client';

import { useParams } from 'next/navigation';
import { LeadWorkspace } from '@/components/lead-workspace';

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  return <LeadWorkspace endpoint={`/api/leads/${params.id}/workspace`} />;
}

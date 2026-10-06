'use client';

import { useParams } from 'next/navigation';
import { LeadWorkspace } from '@/components/lead-workspace';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  return <LeadWorkspace endpoint={`/api/customers/${params.id}/workspace`} />;
}

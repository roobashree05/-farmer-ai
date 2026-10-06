'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';

export default function CustomersPage() {
  const [data, setData] = useState<{ items: { id: string; name: string; phone: string; shopName: string | null; location: string | null; category: string | null }[]; total: number } | null>(null);
  useEffect(() => {
    api<NonNullable<typeof data>>('/api/customers?page=1&pageSize=50').then(setData);
  }, []);
  return (
    <div className="stack">
      <PageHeader title="Customers" subtitle={`${data?.total ?? 0} converted customers`} />
      <div className="card table-wrap">
        {!data || data.items.length === 0 ? <EmptyState title="No customers yet" body="Convert a qualified lead from the lead page." /> : (
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Shop</th><th>Location</th><th>Category</th></tr></thead>
            <tbody>
              {data.items.map((customer) => (
                <tr key={customer.id}>
                  <td><Link href={`/customers/${customer.id}`}>{customer.name}</Link></td>
                  <td>{customer.phone}</td>
                  <td>{customer.shopName}</td>
                  <td>{customer.location}</td>
                  <td>{customer.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

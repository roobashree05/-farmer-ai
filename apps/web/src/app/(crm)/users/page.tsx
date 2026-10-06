'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, PageHeader } from '@aijewel/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface UserRow { id: string; email: string; firstName: string; lastName: string; isActive: boolean; role: { name: string } }

export default function UsersPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'SALES' });
  const [error, setError] = useState('');
  function load() { api<UserRow[]>('/api/users').then(setUsers); }
  useEffect(() => { load(); }, []);
  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/users', { method: 'POST', json: form });
      setForm({ email: '', password: '', firstName: '', lastName: '', role: 'SALES' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the user');
    }
  }

  async function update(id: string, json: Record<string, unknown>) {
    setError('');
    try {
      await api(`/api/users/${id}`, { method: 'PATCH', json });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the user');
    }
  }
  return (
    <div className="stack">
      <PageHeader title="Users" subtitle="Roles are enforced by the API, not only by hiding buttons." />
      {error ? <p className="error">{error}</p> : null}
      {can('users.write') ? (
        <form className="card form-grid" onSubmit={create}>
          <input className="field" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <input className="field" placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          <input className="field" placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
          <input className="field" placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
          <select className="select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            {['ADMIN', 'MARKETING_MANAGER', 'MARKETING_EXECUTIVE', 'SALES', 'MANAGEMENT'].map((role) => <option key={role}>{role}</option>)}
          </select>
          <Button type="submit">Create user</Button>
        </form>
      ) : null}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.firstName} {user.lastName}</td>
                <td>{user.email}</td>
                <td>
                  {can('users.write') ? (
                    <select className="select" value={user.role.name} onChange={(event) => void update(user.id, { role: event.target.value })}>
                      {['ADMIN', 'MARKETING_MANAGER', 'MARKETING_EXECUTIVE', 'SALES', 'MANAGEMENT'].map((role) => <option key={role}>{role}</option>)}
                    </select>
                  ) : user.role.name}
                </td>
                <td>
                  {user.isActive ? 'Yes' : 'No'}
                  {can('users.write') ? <Button variant="ghost" type="button" onClick={() => void update(user.id, { isActive: !user.isActive })}>{user.isActive ? 'Deactivate' : 'Activate'}</Button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

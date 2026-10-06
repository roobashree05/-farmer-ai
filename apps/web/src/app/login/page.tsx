'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@aijewel/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login, ready } = useAuth();
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_DEMO_EMAIL ?? 'admin@aijewel.local');
  const [password, setPassword] = useState(process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    }
  }

  return (
    <main className="login-screen">
      <section className="login-hero">
        <p>AIJewel</p>
        <h1>One desk for leads, WhatsApp, campaigns, and calls.</h1>
        <p>Local demo mode uses mock providers, so the full workflow runs without Meta or telephony accounts.</p>
      </section>
      <section className="login-panel">
        <h2>Sign in</h2>
        <form className="stack" onSubmit={onSubmit}>
          <label className="stack">
            Email
            <input className="field" data-testid="login-email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="stack">
            Password
            <input className="field" data-testid="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <Button data-testid="login-submit" type="submit" disabled={!ready}>Sign in</Button>
        </form>
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? (
          <p className="muted">Demo admin: {process.env.NEXT_PUBLIC_DEMO_EMAIL}. Password is the local SEED_PASSWORD.</p>
        ) : null}
      </section>
    </main>
  );
}

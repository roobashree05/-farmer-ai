'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AuthUser } from '@aijewel/types';
import { api } from './api';

interface AuthState {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = sessionStorage.getItem('aijewel.accessToken');
    if (!token) {
      setReady(true);
      return;
    }
    api<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => {
        sessionStorage.clear();
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user && pathname !== '/login') router.replace('/login');
    if (user && pathname === '/login') router.replace('/');
  }, [ready, user, pathname, router]);

  async function login(email: string, password: string) {
    const result = await api<{ accessToken: string; refreshToken: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      json: { email, password },
    });
    sessionStorage.setItem('aijewel.accessToken', result.accessToken);
    sessionStorage.setItem('aijewel.refreshToken', result.refreshToken);
    setUser(result.user);
    router.replace('/');
  }

  async function logout() {
    const refreshToken = sessionStorage.getItem('aijewel.refreshToken');
    if (refreshToken) {
      await api('/api/auth/logout', { method: 'POST', json: { refreshToken } }).catch(() => undefined);
    }
    sessionStorage.clear();
    setUser(null);
    router.replace('/login');
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, can: (permission) => Boolean(user?.permissions.includes(permission)) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}

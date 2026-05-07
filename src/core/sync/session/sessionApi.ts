import { apiFetch } from '../apiFetch';

export type AuthProvider = 'google' | 'github';

export interface SessionUser {
  userId: string;
  provider: AuthProvider;
  email: string;
  displayName?: string;
}

/** Returns the user if authenticated, null on 401, throws on transport/server errors. */
export async function getMe(): Promise<SessionUser | null> {
  const res = await apiFetch('/api/auth/me');
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`/api/auth/me failed (${res.status})`);
  return (await res.json()) as SessionUser;
}

/** POST /api/auth/logout. Idempotent: succeeds for 204 or 401. */
export async function signOut(): Promise<void> {
  const res = await apiFetch('/api/auth/logout', { method: 'POST' });
  if (!res.ok && res.status !== 401) {
    throw new Error(`/api/auth/logout failed (${res.status})`);
  }
}

export function signInUrl(provider: AuthProvider): string {
  return `/api/auth/login/${provider}`;
}

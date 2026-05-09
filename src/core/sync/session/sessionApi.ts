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

/**
 * DELETE /api/sync/account. Server-side cascade clears every session,
 * blob, and KV key for the signed-in account, then clears the cookie
 * on the responding device. 401 is treated as success: the session
 * was already invalid, so the account is — from this client's view —
 * gone.
 */
export async function deleteAccount(): Promise<void> {
  const res = await apiFetch('/api/sync/account', { method: 'DELETE' });
  if (!res.ok && res.status !== 401) {
    throw new Error(`/api/sync/account DELETE failed (${res.status})`);
  }
}

export function signInUrl(provider: AuthProvider): string {
  return `/api/auth/login/${provider}`;
}

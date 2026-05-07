import { createHash } from 'node:crypto';

export type AuthProvider = 'google' | 'github';

/**
 * Derive a stable, pseudonymous user id from `(provider, providerSubject)`.
 *
 * The raw provider subject (e.g. Google `sub`) is stored separately in
 * `users:{uid}:profile` for support/debugging, but the `uid` we use as a
 * primary key is intentionally a hash so that:
 *   - It can't be reversed into a Google/GitHub account id by anyone with
 *     read access to a single Redis key (e.g. an index hash).
 *   - It's URL/path-safe for use in `users/{uid}/...` Blob paths.
 *   - It's stable across re-logins: same provider+subject always maps here.
 *
 * 32 hex chars = 128 bits of the hash; collision odds are negligible at our
 * scale (<10^9 users would need <10^-19 probability).
 */
export function deriveUserId(provider: AuthProvider, providerSubject: string): string {
  return createHash('sha256').update(`${provider}:${providerSubject}`).digest('hex').slice(0, 32);
}

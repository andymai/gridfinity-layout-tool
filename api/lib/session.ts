import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import { getRedis } from './rateLimit.js';
import { ErrorCode } from './shared.js';
import { logger } from './logger.js';
import { sessionKey, userSessionsKey } from './redisKeys.js';
import { readSessionCookie } from './cookies.js';
import type { AuthProvider } from './userId.js';

export interface SessionRecord {
  userId: string;
  provider: AuthProvider;
  createdAt: number;
  expiresAt: number;
}

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generate a 32-byte (64 hex char) opaque session token.
 *
 * Tokens are random and looked up by exact match in KV — no signing needed
 * because there's no payload to forge: a wrong/tampered token simply maps
 * to no record (lookup returns null → 401).
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Persist a session in Redis atomically. The session payload (with TTL) and
 * its membership in the per-user cleanup set must land together — pipelined
 * so a transient failure can't leave a valid session orphaned from the
 * cascade-delete path used at account deletion time.
 *
 * Also opportunistically prunes the per-user session set: members whose
 * underlying `session:{token}` key has expired (Redis TTL fired) are
 * SREM'd. Without this, the set would grow indefinitely as users sign in
 * across devices over months. We do this on the write path because the
 * cost is bounded by the set size — most users have <10 sessions ever.
 */
export async function createSession(
  redis: Redis,
  token: string,
  record: SessionRecord
): Promise<void> {
  await pruneExpiredUserSessions(redis, record.userId);

  const pipeline = redis.pipeline();
  pipeline.set(sessionKey(token), JSON.stringify(record), 'EX', SESSION_TTL_SECONDS);
  pipeline.sadd(userSessionsKey(record.userId), token);
  const results = await pipeline.exec();
  // ioredis returns null on connection-level failure; throw so the caller
  // (the OAuth callback handler) can surface a 503 instead of returning a
  // session cookie that points to nothing.
  if (results === null) {
    throw new Error('Session pipeline failed: redis connection lost');
  }
  for (const [err] of results) {
    if (err) throw err;
  }
}

/**
 * Remove tokens from the user's session set whose underlying session record
 * has already expired via TTL. Best-effort: failures here don't block the
 * sign-in itself, since the worst case is a slightly larger set on next try.
 */
async function pruneExpiredUserSessions(redis: Redis, userId: string): Promise<void> {
  try {
    const tokens = await redis.smembers(userSessionsKey(userId));
    if (tokens.length === 0) return;
    const pipeline = redis.pipeline();
    for (const t of tokens) pipeline.exists(sessionKey(t));
    const results = (await pipeline.exec()) ?? [];
    const stale: string[] = [];
    for (let i = 0; i < tokens.length && i < results.length; i++) {
      const [err, exists] = results[i];
      if (err) continue;
      if (exists === 0) stale.push(tokens[i]);
    }
    if (stale.length > 0) {
      await redis.srem(userSessionsKey(userId), ...stale);
    }
  } catch {
    // Best-effort; don't fail sign-in if the prune pass errors.
  }
}

/**
 * Look up a session by token. Returns null if missing, expired, or malformed.
 */
export async function readSession(redis: Redis, token: string): Promise<SessionRecord | null> {
  const raw = await redis.get(sessionKey(token));
  if (!raw) return null;
  const parsed = parseSessionRecord(raw);
  if (!parsed) return null;
  if (parsed.expiresAt < Date.now()) return null;
  return parsed;
}

/**
 * Delete a session token. Also removes it from the per-user set.
 */
export async function deleteSession(redis: Redis, token: string): Promise<void> {
  const raw = await redis.get(sessionKey(token));
  await redis.del(sessionKey(token));
  if (!raw) return;
  const parsed = parseSessionRecord(raw);
  if (parsed) {
    await redis.srem(userSessionsKey(parsed.userId), token);
  }
}

function parseSessionRecord(raw: string): SessionRecord | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Partial<SessionRecord>;
    if (typeof record.userId !== 'string') return null;
    if (typeof record.expiresAt !== 'number') return null;
    if (typeof record.createdAt !== 'number') return null;
    if (record.provider !== 'google' && record.provider !== 'github') return null;
    return record as SessionRecord;
  } catch {
    return null;
  }
}

/**
 * CSRF defense check, independent of session validity.
 *
 * Layered:
 *   1. SameSite=Lax cookie blocks cross-site form-POSTs by default.
 *   2. Origin / Sec-Fetch-Site header check rejects cross-site fetches.
 *   3. For non-safe methods, required `X-Requested-With: gflt` header — set
 *      only by our client `apiFetch`. Cross-origin attackers can't set
 *      custom headers without a CORS preflight, which we never grant.
 *
 * Used by `requireSession` and also by endpoints that don't require an
 * existing session (e.g. logout, which is idempotent).
 *
 * On failure, sends a 403 JSON error response and returns false.
 */
export function checkCsrfDefense(req: VercelRequest, res: VercelResponse): boolean {
  if (!isOriginAllowed(req)) {
    res.status(403).json({ error: 'Forbidden origin', code: ErrorCode.UNAUTHORIZED });
    return false;
  }
  if (req.method && !SAFE_METHODS.has(req.method)) {
    const xrw = headerValue(req, 'x-requested-with');
    if (xrw !== 'gflt') {
      res.status(403).json({ error: 'Missing CSRF header', code: ErrorCode.UNAUTHORIZED });
      return false;
    }
  }
  return true;
}

/**
 * Validate the session cookie and CSRF defenses. On failure, sends a JSON
 * error response and returns null. Caller should `if (!session) return;`.
 */
export async function requireSession(
  req: VercelRequest,
  res: VercelResponse
): Promise<SessionRecord | null> {
  if (!checkCsrfDefense(req, res)) return null;

  const token = readSessionCookie(req);
  if (!token) {
    res.status(401).json({ error: 'Not signed in', code: ErrorCode.UNAUTHORIZED });
    return null;
  }

  const redis = getRedis();
  if (!redis) {
    if (process.env.VERCEL_ENV === 'production') {
      logger.error('Session check failed: Redis unavailable');
      res.status(503).json({
        error: 'Service temporarily unavailable',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
      return null;
    }
    res.status(401).json({ error: 'Not signed in', code: ErrorCode.UNAUTHORIZED });
    return null;
  }

  const session = await readSession(redis, token);
  if (!session) {
    res.status(401).json({ error: 'Session expired', code: ErrorCode.UNAUTHORIZED });
    return null;
  }
  return session;
}

/**
 * Allow same-origin requests only. The deployment serves both the SPA and
 * the API from one host, so any cross-origin request to an API path is
 * either an unauthenticated test or an attack.
 *
 * `Sec-Fetch-Site: same-origin|same-site|none` is the modern signal; we
 * fall back to the `Origin` header for older browsers.
 */
function isOriginAllowed(req: VercelRequest): boolean {
  const fetchSite = headerValue(req, 'sec-fetch-site');
  if (fetchSite) {
    return fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none';
  }
  const origin = headerValue(req, 'origin');
  if (!origin) {
    // No Origin and no Sec-Fetch-Site: legacy GET / curl. Only safe methods
    // ever reach here because mutating ones fail the X-Requested-With check.
    return true;
  }
  const host = headerValue(req, 'host');
  if (!host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

function headerValue(req: VercelRequest, name: string): string | undefined {
  const v = req.headers[name];
  if (Array.isArray(v)) return v[0];
  return v;
}

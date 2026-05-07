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
 * Persist a session in Redis. Adds the token to the per-user set so account
 * deletion can cascade (DEL every session this user owns).
 */
export async function createSession(
  redis: Redis,
  token: string,
  record: SessionRecord
): Promise<void> {
  await redis.set(sessionKey(token), JSON.stringify(record), 'EX', SESSION_TTL_SECONDS);
  await redis.sadd(userSessionsKey(record.userId), token);
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
    if (typeof record.userId !== 'string' || typeof record.expiresAt !== 'number') return null;
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

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Cookie helpers for the auth flow.
 *
 * Three cookies in play:
 *   1. Session cookie  — `__Host-gflt_session` (prod) / `gflt_session` (dev). 30d TTL.
 *      Holds the opaque session token; verified by KV lookup, not signature.
 *   2. OAuth state     — `gflt_oauth_state`. Short-lived (10 min). CSRF token for
 *      the OAuth round-trip; compared byte-for-byte against the provider's `state`
 *      param on callback.
 *   3. PKCE verifier   — `gflt_oauth_verifier`. Short-lived (10 min). Only set for
 *      providers that use PKCE (Google). GitHub doesn't use PKCE.
 *
 * Why no HMAC signing: with `HttpOnly + Secure + SameSite=Lax`, client JS can't
 * read or write these cookies. Browser-enforced cookie isolation provides the
 * integrity guarantee. Session tokens are opaque random values looked up in KV;
 * tampering yields a key that doesn't exist (lookup returns null → 401).
 *
 * The `__Host-` prefix in production enforces Path=/ + Secure + no Domain
 * attribute, which prevents subdomain confusion attacks. The prefix requires
 * Secure (HTTPS), so we drop it in local dev where HTTP is fine.
 */

const SESSION_COOKIE_NAME_PROD = '__Host-gflt_session';
const SESSION_COOKIE_NAME_DEV = 'gflt_session';
const STATE_COOKIE_NAME = 'gflt_oauth_state';
const VERIFIER_COOKIE_NAME = 'gflt_oauth_verifier';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const OAUTH_TEMP_MAX_AGE_SECONDS = 10 * 60; // 10 minutes

function isSecureContext(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
}

export function getSessionCookieName(): string {
  return isSecureContext() ? SESSION_COOKIE_NAME_PROD : SESSION_COOKIE_NAME_DEV;
}

interface CookieOptions {
  maxAgeSeconds: number;
  /** Override Secure for the session cookie in dev (HTTP). */
  secure?: boolean;
}

function buildCookie(name: string, value: string, opts: CookieOptions): string {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${opts.maxAgeSeconds}`,
  ];
  if (opts.secure ?? isSecureContext()) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function buildClearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
    isSecureContext() ? '; Secure' : ''
  }`;
}

export function setSessionCookie(res: VercelResponse, token: string): void {
  appendSetCookie(
    res,
    buildCookie(getSessionCookieName(), token, {
      maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    })
  );
}

export function clearSessionCookie(res: VercelResponse): void {
  appendSetCookie(res, buildClearCookie(getSessionCookieName()));
}

export function setOAuthStateCookie(res: VercelResponse, state: string): void {
  appendSetCookie(
    res,
    buildCookie(STATE_COOKIE_NAME, state, { maxAgeSeconds: OAUTH_TEMP_MAX_AGE_SECONDS })
  );
}

export function setOAuthVerifierCookie(res: VercelResponse, verifier: string): void {
  appendSetCookie(
    res,
    buildCookie(VERIFIER_COOKIE_NAME, verifier, { maxAgeSeconds: OAUTH_TEMP_MAX_AGE_SECONDS })
  );
}

export function clearOAuthCookies(res: VercelResponse): void {
  appendSetCookie(res, buildClearCookie(STATE_COOKIE_NAME));
  appendSetCookie(res, buildClearCookie(VERIFIER_COOKIE_NAME));
}

export function readSessionCookie(req: VercelRequest): string | null {
  return readCookie(req, getSessionCookieName());
}

export function readOAuthStateCookie(req: VercelRequest): string | null {
  return readCookie(req, STATE_COOKIE_NAME);
}

export function readOAuthVerifierCookie(req: VercelRequest): string | null {
  return readCookie(req, VERIFIER_COOKIE_NAME);
}

function readCookie(req: VercelRequest, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/**
 * Append a Set-Cookie header without clobbering any prior value. Vercel's
 * `res.setHeader` replaces; using `appendHeader` (Node 18+) accumulates.
 */
function appendSetCookie(res: VercelResponse, value: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (existing === undefined) {
    res.setHeader('Set-Cookie', value);
    return;
  }
  const arr = Array.isArray(existing) ? existing.map(String) : [String(existing)];
  arr.push(value);
  res.setHeader('Set-Cookie', arr);
}

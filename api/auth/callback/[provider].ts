import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import {
  rateLimited,
  serviceUnavailable,
  singleParam,
  ErrorCode,
  sendError,
} from '../../lib/shared.js';
import { logger } from '../../lib/logger.js';
import { checkRateLimit, getClientIP, getRedis } from '../../lib/rateLimit.js';
import {
  clearOAuthCookies,
  readOAuthStateCookie,
  readOAuthVerifierCookie,
  setSessionCookie,
} from '../../lib/cookies.js';
import {
  createSession,
  generateSessionToken,
  SESSION_TTL_SECONDS,
  type SessionRecord,
} from '../../lib/session.js';
import { resolveUserId, type AuthProvider } from '../../lib/userId.js';
import { userProfileKey } from '../../lib/redisKeys.js';
import { deriveDonorCandidates, linkSupporterAccount } from '../../lib/supporterLink.js';
import { getProvider, isSupportedProvider, type ProviderProfile } from '../providers/index.js';

interface UserProfileRecord {
  userId: string;
  provider: AuthProvider;
  providerSubject: string;
  email: string;
  displayName?: string;
  handle?: string;
  createdAt: number;
  /**
   * Salted hashes of this account's provider-verified addresses, in the same
   * derivation Ko-fi donor records are keyed by.
   *
   * Stored rather than recomputed so someone who supports AFTER signing in can
   * still be matched — the common ordering, and one that would otherwise wait
   * up to a 30-day session for the next sign-in. Hashes only: the addresses
   * themselves are never persisted beyond the primary the profile already
   * held.
   */
  donorCandidates?: string[];
}

const PROFILE_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year, refreshed on each sign-in

/**
 * GET /api/auth/callback/{google|github}
 *
 * Receives `?code=...&state=...` from the provider, validates state against
 * the cookie, asks the provider abstraction to exchange the code, derives
 * a stable userId, upserts the user profile, mints a session, and
 * redirects to the SPA root.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return;

  const provider = req.query.provider;
  if (typeof provider !== 'string' || !isSupportedProvider(provider)) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Unsupported provider');
    return;
  }

  const rate = await checkRateLimit(getClientIP(req), 'auth.callback');
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds, 'Too many sign-in attempts. Try again later.');
    return;
  }

  const code = singleParam(req.query.code);
  const state = singleParam(req.query.state);
  const cookieState = readOAuthStateCookie(req);
  if (!code || !state || !cookieState || state !== cookieState) {
    clearOAuthCookies(res);
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid OAuth state');
    return;
  }

  let profile: ProviderProfile;
  try {
    profile = await getProvider(provider).exchangeCode({
      code,
      codeVerifier: readOAuthVerifierCookie(req) ?? undefined,
    });
  } catch (error) {
    logger.error('OAuth code exchange failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    clearOAuthCookies(res);
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'OAuth exchange failed');
    return;
  }

  const redis = getRedis();
  if (!redis) {
    if (process.env.VERCEL_ENV === 'production') {
      logger.error('Sign-in failed: Redis unavailable');
      clearOAuthCookies(res);
      serviceUnavailable(res);
      return;
    }
    clearOAuthCookies(res);
    serviceUnavailable(res, 'Redis not configured');
    return;
  }

  // Resolves through the salted identity map: an existing account keeps its
  // id (including a pre-map account, adopted on first sign-in after deploy),
  // a new one gets a random, unreversible id.
  const userId = await resolveUserId(redis, provider, profile.subject);
  if (userId === null) {
    logger.error('Sign-in failed: TOKEN_SALT is not configured');
    clearOAuthCookies(res);
    serviceUnavailable(res);
    return;
  }
  const now = Date.now();

  const donorCandidates = deriveDonorCandidates(profile.verifiedEmails);
  const profileKey = userProfileKey(userId);
  const existing = safeParse(await redis.get(profileKey));
  const profileRecord: UserProfileRecord = existing
    ? {
        ...existing,
        email: profile.email,
        displayName: profile.displayName,
        handle: profile.handle,
        donorCandidates,
      }
    : {
        userId,
        provider,
        providerSubject: profile.subject,
        email: profile.email,
        displayName: profile.displayName,
        handle: profile.handle,
        createdAt: now,
        donorCandidates,
      };
  // Profile TTL is bumped on every successful sign-in. Active users keep
  // their profile alive; abandoned accounts age out automatically a year
  // after their last login (matches the project pattern of TTL'd KV keys).
  await redis.set(profileKey, JSON.stringify(profileRecord), 'EX', PROFILE_TTL_SECONDS);

  // Recognize a Ko-fi supporter silently, so the common case needs no claim UI
  // at all. Never load-bearing for sign-in: a failure here costs a badge, and
  // failing the sign-in over it would be absurd.
  try {
    await linkSupporterAccount(redis, userId, donorCandidates);
  } catch (error) {
    logger.warn('Supporter link failed during sign-in', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const token = generateSessionToken();
  const sessionRecord: SessionRecord = {
    userId,
    provider,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
  await createSession(redis, token, sessionRecord);

  clearOAuthCookies(res);
  setSessionCookie(res, token);
  res.redirect(302, '/');
}

function safeParse(raw: string | null): UserProfileRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Partial<UserProfileRecord>;
    if (typeof record.userId !== 'string') return null;
    if (typeof record.providerSubject !== 'string') return null;
    if (typeof record.email !== 'string') return null;
    if (typeof record.createdAt !== 'number') return null;
    if (record.provider !== 'google' && record.provider !== 'github') return null;
    // Always re-derived from this sign-in's verified addresses, so a malformed
    // stored value is dropped rather than carried forward.
    if (!Array.isArray(record.donorCandidates)) delete record.donorCandidates;
    return record as UserProfileRecord;
  } catch {
    return null;
  }
}

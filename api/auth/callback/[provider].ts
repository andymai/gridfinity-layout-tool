import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import { ErrorCode } from '../../lib/shared.js';
import { logger } from '../../lib/logger.js';
import { getRedis } from '../../lib/rateLimit.js';
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
import { deriveUserId, type AuthProvider } from '../../lib/userId.js';
import { userProfileKey } from '../../lib/redisKeys.js';
import {
  buildGitHubClient,
  buildGoogleClient,
  fetchGitHubProfile,
  googleProfileFromIdToken,
  isSupportedProvider,
  type ProviderProfile,
} from '../providers.js';

interface UserProfileRecord {
  userId: string;
  provider: AuthProvider;
  providerSubject: string;
  email: string;
  displayName?: string;
  createdAt: number;
}

/**
 * GET /api/auth/callback/{google|github}
 *
 * Receives `?code=...&state=...` from the provider, validates state against
 * the cookie, exchanges the code, derives a stable userId, upserts the user
 * profile, mints a session, and redirects to the SPA root.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return;

  const provider = req.query.provider;
  if (typeof provider !== 'string' || !isSupportedProvider(provider)) {
    res.status(400).json({ error: 'Unsupported provider', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const code = singleParam(req.query.code);
  const state = singleParam(req.query.state);
  const cookieState = readOAuthStateCookie(req);
  if (!code || !state || !cookieState || state !== cookieState) {
    clearOAuthCookies(res);
    res.status(400).json({ error: 'Invalid OAuth state', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  let profile: ProviderProfile;
  try {
    if (provider === 'google') {
      const verifier = readOAuthVerifierCookie(req);
      if (!verifier) {
        clearOAuthCookies(res);
        res.status(400).json({
          error: 'Missing PKCE verifier',
          code: ErrorCode.VALIDATION_ERROR,
        });
        return;
      }
      const tokens = await buildGoogleClient().validateAuthorizationCode(code, verifier);
      profile = googleProfileFromIdToken(tokens.idToken());
    } else {
      const tokens = await buildGitHubClient().validateAuthorizationCode(code);
      profile = await fetchGitHubProfile(tokens.accessToken());
    }
  } catch (error) {
    logger.error('OAuth code exchange failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    clearOAuthCookies(res);
    res.status(400).json({ error: 'OAuth exchange failed', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const redis = getRedis();
  if (!redis) {
    if (process.env.VERCEL_ENV === 'production') {
      logger.error('Sign-in failed: Redis unavailable');
      clearOAuthCookies(res);
      res.status(503).json({
        error: 'Service temporarily unavailable',
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
      return;
    }
    clearOAuthCookies(res);
    res.status(503).json({ error: 'Redis not configured', code: ErrorCode.SERVICE_UNAVAILABLE });
    return;
  }

  const userId = deriveUserId(provider, profile.subject);
  const now = Date.now();

  const profileKey = userProfileKey(userId);
  const existing = safeParse(await redis.get(profileKey));
  const profileRecord: UserProfileRecord = existing
    ? { ...existing, email: profile.email, displayName: profile.displayName }
    : {
        userId,
        provider,
        providerSubject: profile.subject,
        email: profile.email,
        displayName: profile.displayName,
        createdAt: now,
      };
  await redis.set(profileKey, JSON.stringify(profileRecord));

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

function singleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function safeParse(raw: string | null): UserProfileRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Partial<UserProfileRecord>;
    if (typeof record.userId !== 'string') return null;
    return record as UserProfileRecord;
  } catch {
    return null;
  }
}

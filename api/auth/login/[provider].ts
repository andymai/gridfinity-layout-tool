import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import { ErrorCode } from '../../lib/shared.js';
import { logger } from '../../lib/logger.js';
import { checkRateLimit, getClientIP } from '../../lib/rateLimit.js';
import { setOAuthStateCookie, setOAuthVerifierCookie } from '../../lib/cookies.js';
import { createOAuthState, getProvider, isSupportedProvider } from '../providers/index.js';

/**
 * GET /api/auth/login/{google|github}
 *
 * Generates an OAuth state cookie (CSRF token for the round-trip), asks
 * the provider for an authorization URL (and PKCE verifier if needed),
 * stashes the verifier in a short-lived cookie, then 302-redirects.
 *
 * The endpoint touches no OAuth library directly — all provider-specific
 * concerns live behind `getProvider(...)`.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return;

  const provider = req.query.provider;
  if (typeof provider !== 'string' || !isSupportedProvider(provider)) {
    res.status(400).json({ error: 'Unsupported provider', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  const rate = await checkRateLimit(getClientIP(req), 'auth.start');
  if (!rate.allowed) {
    res.status(429).json({
      error: 'Too many sign-in attempts. Try again later.',
      code: ErrorCode.RATE_LIMITED,
      retryAfter: rate.retryAfterSeconds,
    });
    return;
  }

  try {
    const state = createOAuthState();
    setOAuthStateCookie(res, state);

    const { url, codeVerifier } = getProvider(provider).buildAuthorizationUrl(state);
    if (codeVerifier) setOAuthVerifierCookie(res, codeVerifier);

    res.redirect(302, url.toString());
  } catch (error) {
    logger.error('OAuth login init failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Sign-in unavailable', code: ErrorCode.CONFIGURATION_ERROR });
  }
}

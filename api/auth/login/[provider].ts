import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import { rateLimited, ErrorCode, sendError } from '../../lib/shared.js';
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
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Unsupported provider');
    return;
  }

  const rate = await checkRateLimit(getClientIP(req), 'auth.start');
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds, 'Too many sign-in attempts. Try again later.');
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
    sendError(res, 500, ErrorCode.CONFIGURATION_ERROR, 'Sign-in unavailable');
  }
}

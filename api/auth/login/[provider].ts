import { generateCodeVerifier, generateState } from 'arctic';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../../lib/method.js';
import { ErrorCode } from '../../lib/shared.js';
import { logger } from '../../lib/logger.js';
import { setOAuthStateCookie, setOAuthVerifierCookie } from '../../lib/cookies.js';
import {
  buildGitHubClient,
  buildGoogleClient,
  GITHUB_SCOPES,
  GOOGLE_SCOPES,
  isSupportedProvider,
} from '../providers.js';

/**
 * GET /api/auth/login/{google|github}
 *
 * Generates OAuth state (and PKCE verifier for Google), stores them in
 * short-lived HttpOnly cookies, and 302-redirects to the provider's
 * authorization endpoint.
 *
 * The state cookie is the entire CSRF defense for the round-trip: the
 * callback compares the cookie value with the `state` query param Google
 * sends back. An attacker who can't write our HttpOnly cookie can't forge
 * a callback that we'll accept.
 */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (!requireMethod(req, res, ['GET'])) return;

  const provider = req.query.provider;
  if (typeof provider !== 'string' || !isSupportedProvider(provider)) {
    res.status(400).json({ error: 'Unsupported provider', code: ErrorCode.VALIDATION_ERROR });
    return;
  }

  try {
    const state = generateState();
    setOAuthStateCookie(res, state);

    let url: URL;
    if (provider === 'google') {
      const verifier = generateCodeVerifier();
      setOAuthVerifierCookie(res, verifier);
      url = buildGoogleClient().createAuthorizationURL(state, verifier, [...GOOGLE_SCOPES]);
    } else {
      url = buildGitHubClient().createAuthorizationURL(state, [...GITHUB_SCOPES]);
    }

    res.redirect(302, url.toString());
  } catch (error) {
    logger.error('OAuth login init failed', {
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Sign-in unavailable', code: ErrorCode.CONFIGURATION_ERROR });
  }
}

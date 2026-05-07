import { Google, generateCodeVerifier } from 'arctic';
import { getBaseUrl } from '../../lib/shared.js';
import type { OAuthProvider, ProviderProfile } from './types.js';

const SCOPES = ['openid', 'profile', 'email'] as const;

interface GoogleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

function callbackUrl(): string {
  const base = process.env.OAUTH_REDIRECT_BASE_URL?.replace(/\/$/, '') || getBaseUrl();
  return `${base}/api/auth/callback/google`;
}

function client(): Google {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
  }
  return new Google(clientId, clientSecret, callbackUrl());
}

/**
 * Decode a JWT id_token *without* signature verification.
 *
 * We trust the id_token because we just received it over TLS directly from
 * Google's token endpoint via the Arctic client — no third party can
 * interpose. Adding RSA signature verification would require fetching JWKS,
 * which buys nothing in this trust model.
 */
function decodeIdToken(idToken: string): GoogleIdTokenPayload {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed id_token');
  const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
  try {
    return JSON.parse(payloadJson) as GoogleIdTokenPayload;
  } catch {
    throw new Error('Malformed id_token payload');
  }
}

export const googleProvider: OAuthProvider = {
  buildAuthorizationUrl(state) {
    const codeVerifier = generateCodeVerifier();
    const url = client().createAuthorizationURL(state, codeVerifier, [...SCOPES]);
    return { url, codeVerifier };
  },

  async exchangeCode({ code, codeVerifier }): Promise<ProviderProfile> {
    if (!codeVerifier) throw new Error('Google requires a PKCE verifier');
    const tokens = await client().validateAuthorizationCode(code, codeVerifier);
    const payload = decodeIdToken(tokens.idToken());
    if (!payload.sub) throw new Error('Google id_token missing sub');
    if (!payload.email || payload.email_verified === false) {
      throw new Error('Google account has no verified email');
    }
    return { subject: payload.sub, email: payload.email, displayName: payload.name };
  },
};

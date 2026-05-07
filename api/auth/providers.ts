import { GitHub, Google } from 'arctic';
import type { AuthProvider } from '../lib/userId.js';
import { getBaseUrl } from '../lib/shared.js';

export const SUPPORTED_PROVIDERS = ['google', 'github'] as const;

export function isSupportedProvider(value: unknown): value is AuthProvider {
  return typeof value === 'string' && (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

function redirectBaseUrl(): string {
  return process.env.OAUTH_REDIRECT_BASE_URL?.replace(/\/$/, '') || getBaseUrl();
}

function callbackUrl(provider: AuthProvider): string {
  return `${redirectBaseUrl()}/api/auth/callback/${provider}`;
}

/** Lazy-construct an Arctic Google client; throws if env vars missing. */
export function buildGoogleClient(): Google {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
  }
  return new Google(clientId, clientSecret, callbackUrl('google'));
}

/** Lazy-construct an Arctic GitHub client; throws if env vars missing. */
export function buildGitHubClient(): GitHub {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured');
  }
  return new GitHub(clientId, clientSecret, callbackUrl('github'));
}

export const GOOGLE_SCOPES = ['openid', 'profile', 'email'] as const;
export const GITHUB_SCOPES = ['read:user', 'user:email'] as const;

export interface ProviderProfile {
  /** Stable id at the provider (Google `sub` / GitHub numeric id). */
  subject: string;
  email: string;
  displayName?: string;
}

interface GoogleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Decode a JWT id_token *without* signature verification.
 *
 * We trust the id_token because we just received it over TLS directly from
 * Google's token endpoint via Arctic — no third party can interpose. Adding
 * RSA signature verification would require fetching JWKS, which buys us
 * nothing in this trust model.
 */
export function decodeGoogleIdToken(idToken: string): GoogleIdTokenPayload {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed id_token');
  const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
  try {
    return JSON.parse(payload) as GoogleIdTokenPayload;
  } catch {
    throw new Error('Malformed id_token payload');
  }
}

export function googleProfileFromIdToken(idToken: string): ProviderProfile {
  const payload = decodeGoogleIdToken(idToken);
  if (!payload.sub) throw new Error('Google id_token missing sub');
  if (!payload.email || payload.email_verified === false) {
    throw new Error('Google account has no verified email');
  }
  return { subject: payload.sub, email: payload.email, displayName: payload.name };
}

/**
 * Fetch a GitHub user's profile and primary verified email.
 * GitHub's /user endpoint omits `email` if the user has hidden it, so we
 * always follow up with /user/emails to find a verified address.
 */
export async function fetchGitHubProfile(accessToken: string): Promise<ProviderProfile> {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': 'gridfinity-layout-tool',
  };
  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) throw new Error(`GitHub /user ${userRes.status}`);
  const user = (await userRes.json()) as GitHubUser;

  let email = user.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
    if (!emailsRes.ok) throw new Error(`GitHub /user/emails ${emailsRes.status}`);
    const emails = (await emailsRes.json()) as GitHubEmail[];
    const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
    email = primary?.email ?? null;
  }
  if (!email) throw new Error('GitHub account has no verified email');

  return {
    subject: String(user.id),
    email,
    displayName: user.name ?? user.login,
  };
}

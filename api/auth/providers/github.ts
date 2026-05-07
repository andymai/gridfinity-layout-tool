import { GitHub } from 'arctic';
import { getBaseUrl } from '../../lib/shared.js';
import type { OAuthProvider, ProviderProfile } from './types.js';

const SCOPES = ['read:user', 'user:email'] as const;

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

function callbackUrl(): string {
  const base = process.env.OAUTH_REDIRECT_BASE_URL?.replace(/\/$/, '') || getBaseUrl();
  return `${base}/api/auth/callback/github`;
}

function client(): GitHub {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured');
  }
  return new GitHub(clientId, clientSecret, callbackUrl());
}

/**
 * Fetch the GitHub user's profile + primary verified email.
 *
 * `/user` omits `email` if the user has hidden it, so we always follow up
 * with `/user/emails` and pick the primary verified address. Skipping that
 * fallback would fail sign-in for ~30% of GitHub users who hide their
 * email by default.
 */
async function fetchProfile(accessToken: string): Promise<ProviderProfile> {
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

export const githubProvider: OAuthProvider = {
  buildAuthorizationUrl(state) {
    const url = client().createAuthorizationURL(state, [...SCOPES]);
    return { url };
  },

  async exchangeCode({ code }): Promise<ProviderProfile> {
    const tokens = await client().validateAuthorizationCode(code);
    return fetchProfile(tokens.accessToken());
  },
};

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
 * Fetch the GitHub user's profile + every verified email on the account.
 *
 * `/user` omits `email` if the user has hidden it, so `/user/emails` is
 * fetched unconditionally rather than as a fallback for those users: the full
 * verified list is what lets a Ko-fi donor record be matched to this account
 * (`api/lib/supporterLink.ts`) when
 * someone paid from a different address than their public one — which is the
 * common case, not the exotic one. A failure there is soft: sign-in still
 * succeeds on `/user`'s address alone, it just matches fewer supporters.
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

  const verified = await fetchVerifiedEmails(headers, !user.email);
  const email = user.email ?? verified[0] ?? null;
  if (!email) throw new Error('GitHub account has no verified email');

  return {
    subject: String(user.id),
    email,
    verifiedEmails: verified.includes(email) ? verified : [email, ...verified],
    displayName: user.name ?? user.login,
    handle: user.login,
  };
}

/**
 * Verified addresses, primary first.
 *
 * `required` is true only when `/user` gave us no address at all — then this
 * call is load-bearing for sign-in and its failure must propagate. Otherwise a
 * failure costs supporter matching, not access, so it is swallowed.
 */
async function fetchVerifiedEmails(
  headers: Record<string, string>,
  required: boolean
): Promise<string[]> {
  let emails: GitHubEmail[];
  try {
    const res = await fetch('https://api.github.com/user/emails', { headers });
    if (!res.ok) throw new Error(`GitHub /user/emails ${res.status}`);
    emails = (await res.json()) as GitHubEmail[];
  } catch (error) {
    if (required) throw error;
    return [];
  }
  if (!Array.isArray(emails)) return [];
  return emails
    .filter((e) => e?.verified && typeof e.email === 'string')
    .sort((a, b) => Number(b.primary) - Number(a.primary))
    .map((e) => e.email);
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

import type { AuthProvider } from '../../lib/userId.js';

export type { AuthProvider };

/**
 * Profile fields the OAuth callback endpoint needs after a successful
 * code exchange. Each `OAuthProvider` implementation extracts these
 * from whatever shape the upstream provider returns.
 */
export interface ProviderProfile {
  /** Stable id at the provider (Google `sub` / GitHub numeric id). */
  subject: string;
  email: string;
  displayName?: string;
}

/**
 * Lib-agnostic contract for an OAuth 2.0 provider.
 *
 * The auth endpoints call only this interface — they have no awareness
 * of which library produced it (currently Arctic). Replacing Arctic is
 * a matter of rewriting the two files that implement this interface;
 * the endpoints, session store, cookie helpers, and tests are all
 * insulated.
 */
export interface OAuthProvider {
  /**
   * Build the URL the user should be redirected to. The `state` is the
   * CSRF token the caller has already generated and stashed in a
   * cookie — providers don't generate it themselves so the caller can
   * decide cookie / lifetime / format.
   */
  buildAuthorizationUrl(state: string): {
    url: URL;
    /**
     * PKCE verifier, returned only for providers that require PKCE
     * (e.g. Google). The caller must stash it in a short-lived cookie
     * and pass the same value to `exchangeCode`.
     */
    codeVerifier?: string;
  };

  /**
   * Exchange the authorization code for a profile.
   *
   * Throws on any verification failure: malformed token, missing PKCE
   * verifier when one is required, unverified email, missing subject,
   * etc. The caller maps the throw to a 400 response.
   */
  exchangeCode(input: { code: string; codeVerifier?: string }): Promise<ProviderProfile>;
}

export const SUPPORTED_PROVIDERS = ['google', 'github'] as const;

export function isSupportedProvider(value: unknown): value is AuthProvider {
  return typeof value === 'string' && (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

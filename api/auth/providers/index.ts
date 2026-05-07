import { googleProvider } from './google.js';
import { githubProvider } from './github.js';
import type { AuthProvider, OAuthProvider } from './types.js';

export type { OAuthProvider, ProviderProfile, AuthProvider } from './types.js';
export { SUPPORTED_PROVIDERS, isSupportedProvider } from './types.js';

const PROVIDERS: Record<AuthProvider, OAuthProvider> = {
  google: googleProvider,
  github: githubProvider,
};

/**
 * Resolve a provider by name. Throws if `name` isn't a supported value;
 * callers should validate via `isSupportedProvider` first.
 */
export function getProvider(name: AuthProvider): OAuthProvider {
  return PROVIDERS[name];
}

/**
 * Generate a CSRF-grade random state string for the OAuth round-trip.
 * 16 bytes (32 hex chars) = 128 bits of entropy, plenty for an
 * unguessable nonce. The caller stashes this in an HttpOnly cookie
 * and the callback compares it byte-for-byte against the `state`
 * query param the provider returns.
 */
export function createOAuthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

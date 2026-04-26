import { getPosthogInstance } from '@/shared/analytics/posthog/init';

/** PostHog flag that gates the client-side smoke harness. */
const FLAG_KEY = 'pwa-smoke-gate-enabled';

/** Hard cap on how long we'll wait for PostHog to deliver flag values. */
const FLAG_RESOLVE_TIMEOUT_MS = 2000;

/**
 * Module-level cache. The flag value doesn't change within a session (PostHog
 * delivers it once), so memoize the in-flight promise and its result so
 * repeated callers don't each register a new `onFeatureFlags` callback —
 * those accumulate in posthog-js and are never cleaned up.
 */
let cached: Promise<boolean> | null = null;

/**
 * Resolve the smoke-gate feature flag. Returns `false` on any failure path —
 * PostHog blocked by an adblocker, EU consent denied, dev mode, init failure,
 * or just slow flag delivery. Failure-mode parity with "flag disabled" is
 * deliberate: a misbehaving flag plumbing must never leave the user stuck on
 * an unverified bundle.
 */
export function getSmokeGateFlag(): Promise<boolean> {
  if (cached) return cached;

  cached = new Promise<boolean>((resolve) => {
    const posthog = getPosthogInstance();
    if (!posthog) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timeoutId = window.setTimeout(() => finish(false), FLAG_RESOLVE_TIMEOUT_MS);

    // posthog-js fires `onFeatureFlags` once flags are available (either from
    // localStorage cache or after the first network round-trip). Use it
    // instead of polling getFeatureFlag, which can return undefined indefinitely.
    try {
      posthog.onFeatureFlags(() => {
        window.clearTimeout(timeoutId);
        const value = posthog.getFeatureFlag(FLAG_KEY);
        finish(value === true);
      });
    } catch {
      window.clearTimeout(timeoutId);
      finish(false);
    }
  });

  return cached;
}

/** Test-only — reset the module-level memo between tests. */
export function _resetSmokeGateFlagCache(): void {
  cached = null;
}

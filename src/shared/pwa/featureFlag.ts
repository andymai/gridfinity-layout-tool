import { getPosthogInstance } from '@/shared/analytics/posthog/init';

/** PostHog flag that gates the client-side smoke harness. */
const FLAG_KEY = 'pwa-smoke-gate-enabled';

/** Hard cap on how long we'll wait for PostHog to deliver flag values. */
const FLAG_RESOLVE_TIMEOUT_MS = 2000;

/**
 * Resolve the smoke-gate feature flag. Returns `false` on any failure path —
 * PostHog blocked by an adblocker, EU consent denied, dev mode, init failure,
 * or just slow flag delivery. Failure-mode parity with "flag disabled" is
 * deliberate: a misbehaving flag plumbing must never leave the user stuck on
 * an unverified bundle.
 */
export async function getSmokeGateFlag(): Promise<boolean> {
  const posthog = getPosthogInstance();
  if (!posthog) return false;

  // posthog-js fires `onFeatureFlags` once flags are available (either from
  // localStorage cache or after the first network round-trip). Use it instead
  // of polling getFeatureFlag, which can return undefined indefinitely.
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const timeoutId = window.setTimeout(() => finish(false), FLAG_RESOLVE_TIMEOUT_MS);

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
}

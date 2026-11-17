import { whenPosthogReady } from './init';

export type FlagResolution =
  { loaded: true; value: string | boolean | undefined } | { loaded: false };

/**
 * Wait for the server's flag values and read one, which sends the
 * `$feature_flag_called` exposure. A timeout or a failed load reads nothing,
 * so a caller that gives up never records an exposure it did not act on.
 *
 * posthog-js fires `onFeatureFlags` only after a server response, never for
 * values cached in localStorage, so the first callback is authoritative: a
 * missing flag reads as `loaded` with an undefined value, not as a wait.
 */
export function resolveFeatureFlag(key: string, timeoutMs: number): Promise<FlagResolution> {
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;

    const finish = (result: FlagResolution): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      // Deferred: onFeatureFlags calls back synchronously when flags are
      // already in, before its return value is assigned to `unsubscribe`.
      queueMicrotask(() => unsubscribe?.());
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => finish({ loaded: false }), timeoutMs);

    void whenPosthogReady().then((posthog) => {
      if (!posthog || settled) {
        finish({ loaded: false });
        return;
      }
      try {
        unsubscribe = posthog.onFeatureFlags((_flags, _variants, context) => {
          // Reading the flag sends the exposure, so a late callback must not read it.
          if (settled) return;
          if (context?.errorsLoading) {
            finish({ loaded: false });
            return;
          }
          finish({ loaded: true, value: posthog.getFeatureFlag(key, { fresh: true }) });
        });
      } catch {
        finish({ loaded: false });
      }
    });
  });
}

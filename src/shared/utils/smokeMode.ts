/**
 * Smoke mode is triggered by `?smoke=1` in the URL. It enables a stripped-down boot
 * path used by the Playwright/iframe harness to verify a deploy: skips IndexedDB
 * layout/library hydration, the wwwMigration recovery + redirect paths, PostHog
 * init, and ML telemetry. Settings-store reads of `localStorage` (locale prefs)
 * still happen — that's fine for a smoke target.
 *
 * See `src/shell/smokeBoot.tsx` for the boot sequence and
 * `.github/workflows/smoke-*.yml` / `src/shared/pwa/smokeGate.ts` (PR #2) for callers.
 */
export function isSmokeMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('smoke') === '1';
}

export const SMOKE_MESSAGE_TYPE = 'pwa-smoke-result' as const;

export interface SmokeResultMessage {
  type: typeof SMOKE_MESSAGE_TYPE;
  smokeOk: boolean;
  version: string;
  gitSha: string;
  buildTime: string;
  reason?: string;
}

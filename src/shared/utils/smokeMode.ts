/**
 * Smoke mode is triggered by `?smoke=1` in the URL. It boots the app with a synthetic
 * fixture (no storage reads) so a Playwright/iframe harness can verify a deploy without
 * touching real user state. See `src/shell/smokeBoot.ts` for the boot sequence and
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

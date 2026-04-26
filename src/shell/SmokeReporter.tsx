import { useEffect } from 'react';
import { SMOKE_MESSAGE_TYPE, type SmokeResultMessage } from '@/shared/utils/smokeMode';

interface SmokeBuildInfo {
  version: string;
  gitSha: string;
  buildTime: string;
}

/**
 * One-shot reporter mounted inside the smoke React tree. Fires postMessage once
 * the app's effects have run (which means React mounted without throwing). Also
 * exposes build info on `window.__SMOKE_BUILD_INFO__` so Playwright can compare
 * it against `/version.json` — vite `define` constants are inlined as literals
 * and not addressable from outside the bundle.
 */
export function SmokeReporter(): null {
  useEffect(() => {
    const info: SmokeBuildInfo = {
      version: __APP_VERSION__,
      gitSha: __GIT_SHA__,
      buildTime: __BUILD_TIME__,
    };
    (window as unknown as { __SMOKE_BUILD_INFO__: SmokeBuildInfo }).__SMOKE_BUILD_INFO__ = info;

    if (window.parent === window) return;
    const payload: SmokeResultMessage = {
      type: SMOKE_MESSAGE_TYPE,
      smokeOk: true,
      ...info,
    };
    try {
      window.parent.postMessage(payload, window.location.origin);
    } catch {
      // best-effort
    }
  }, []);
  return null;
}

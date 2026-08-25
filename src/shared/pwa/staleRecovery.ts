/**
 * One-shot self-heal for a client whose cached bundle has actually failed.
 *
 * The PWA's normal updater (`usePWAUpdate`) fixes the *next* load: a returning
 * user is served the old precached shell + old runtime-cached wasm, so the
 * current page can fail (e.g. kernel init) before any update applies. This
 * recovers the *current* visit: drop the precache + wasm caches, unregister the
 * service worker (so the reload bypasses it and fetches the latest from the
 * network), then hard-reload.
 *
 * Guarded by a per-session flag so a genuinely broken new bundle can't loop:
 * we recover at most once per tab session.
 *
 * MUST stay wired to observed breakage, never to a version comparison. A
 * boot-time `gitSha !== __GIT_SHA__` test used to trigger this as well, which at
 * several deploys a day fired for nearly every returning visitor — throwing away
 * warm caches and forcing a full reload mid-session on deploys where nothing was
 * wrong. Removing that interruption is all the removal was shown to buy: a
 * two-build deploy-skew reproduction found no asset 404s either with the check
 * or without it, so it was never established as a cause of the load failures it
 * was written to repair.
 * `handleWasmLoadFailure` is the correct shape: it recovers only when a load has
 * already failed with a stale-asset error.
 *
 * Which caches count as suspect is the caller's call (`dropWasmCache`): a kernel
 * failure implicates the wasm binary, a route-chunk failure does not, and the
 * wasm cache holds multiple megabytes whose hash usually survives a deploy.
 */

import { getPosthogInstance } from '@/shared/analytics/posthog/init';
import { PRECACHE_PREFIX, WASM_CACHE } from './cacheNames';

/** sessionStorage key — set once a recovery has been attempted this tab session. */
export const STALE_RECOVERY_FLAG = 'pwa-stale-recovery-done';

function alreadyRecovered(): boolean {
  try {
    return sessionStorage.getItem(STALE_RECOVERY_FLAG) !== null;
  } catch {
    return false;
  }
}

function markRecovered(): void {
  try {
    sessionStorage.setItem(STALE_RECOVERY_FLAG, Date.now().toString());
  } catch {
    // best-effort — if storage is unavailable we accept the small loop risk
  }
}

async function clearStaleCaches(dropWasmCache: boolean): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(PRECACHE_PREFIX) || (dropWasmCache && k === WASM_CACHE))
        .map((k) => caches.delete(k))
    );
  } catch {
    // best-effort
  }
}

async function unregisterServiceWorkers(): Promise<void> {
  if (typeof navigator === 'undefined') return;
  // `navigator.serviceWorker` is typed as always-present but is genuinely
  // undefined in insecure contexts / unsupported browsers.
  const swContainer = navigator.serviceWorker as ServiceWorkerContainer | undefined;
  if (!swContainer) return;
  try {
    const regs = await swContainer.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // best-effort
  }
}

interface RecoverOptions {
  /**
   * Also drop the wasm cache. Only for a caller whose failure implicates the
   * wasm binary (see the module docstring).
   */
  readonly dropWasmCache?: boolean;
}

/**
 * Attempt a one-time stale-bundle recovery. Returns true if a recovery was
 * started (caches cleared + reload triggered), false if it was skipped because
 * one already ran this session or the browser reports no network.
 *
 * Recovery ends by unregistering the service worker, so running it offline
 * would trade an in-app error for the browser's own network error page and
 * leave the user without the offline shell, with no fresher bundle reachable
 * to justify the trade. `navigator.onLine` is only trusted in this direction:
 * it reports true on a captive portal, but false only when the browser is
 * certain there is no network.
 */
export async function recoverStaleBundle(
  reason: string,
  { dropWasmCache = false }: RecoverOptions = {}
): Promise<boolean> {
  if (alreadyRecovered()) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  markRecovered();

  try {
    getPosthogInstance()?.capture('pwa_stale_recovery', {
      reason,
      from_version: __APP_VERSION__,
      from_sha: __GIT_SHA__,
    });
  } catch {
    // never let telemetry block recovery
  }

  await clearStaleCaches(dropWasmCache);
  await unregisterServiceWorkers();

  window.location.reload();
  return true;
}

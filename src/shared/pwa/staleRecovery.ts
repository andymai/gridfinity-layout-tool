/**
 * One-shot self-heal for a client stuck on a stale cached bundle.
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

async function clearStaleCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith(PRECACHE_PREFIX) || k === WASM_CACHE)
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

/**
 * Attempt a one-time stale-bundle recovery. Returns true if a recovery was
 * started (caches cleared + reload triggered), false if it was skipped because
 * one already ran this session.
 */
export async function recoverStaleBundle(reason: string): Promise<boolean> {
  if (alreadyRecovered()) return false;
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

  await clearStaleCaches();
  await unregisterServiceWorkers();

  window.location.reload();
  return true;
}

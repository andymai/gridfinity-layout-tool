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
 * MUST stay wired to observed breakage, never to a version comparison. It was
 * additionally triggered by a boot-time `gitSha !== __GIT_SHA__` test (#2049),
 * which at ~6 deploys/day fired for nearly every returning visitor — 29.7% of
 * them in a 30-day window — throwing away warm caches and forcing a full reload
 * mid-session on deploys where nothing was wrong. That cost is what removing it
 * (#3512) recovers, and it is all that was established: a two-build deploy-skew
 * reproduction found no asset 404s either with the check or without it, so the
 * check was not shown to cause the load failures it was written to repair.
 * `handleWasmLoadFailure` is the correct shape: it recovers only when a load has
 * already failed with a stale-asset error.
 *
 * The wasm cache is dropped along with the precache deliberately — the one
 * surviving caller reaches here *because* a wasm artifact failed to load, so it
 * is the suspect rather than a bystander.
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

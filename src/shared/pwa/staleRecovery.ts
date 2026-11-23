/**
 * One-shot self-heal for a client whose cached bundle has actually failed.
 *
 * The PWA's normal updater (`usePWAUpdate`) fixes the *next* load: a returning
 * user is served the old precached shell + old runtime-cached wasm, so the
 * current page can fail (e.g. kernel init) before any update applies. This
 * recovers the *current* visit: drop the precache (plus the wasm cache, for a
 * caller that implicates it), unregister the service worker (so the reload
 * bypasses it and fetches the latest from the network), then hard-reload.
 *
 * Guarded by a sessionStorage flag so a genuinely broken new bundle can't loop.
 * The flag is scoped to the build that set it: a reload that lands on a newer
 * build has nothing to loop on, so the next deploy's miss can recover again. On
 * the same build it holds for `GUARD_WINDOW_MS`, so a reload that came back to
 * the same build (e.g. one the old worker still served) is not a dead end for
 * the rest of the tab.
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

/** sessionStorage key — set when an automatic recovery starts. */
export const STALE_RECOVERY_FLAG = 'pwa-stale-recovery-done';

const GUARD_WINDOW_MS = 10 * 60 * 1000;

interface GuardRecord {
  readonly sha: string;
  readonly at: number;
}

// Inlined in `errorFilters.ts` too, which cannot import this module.
const CHUNK_LOAD_ERROR =
  /(?:Failed to fetch|error loading) dynamically imported module|Importing a module script failed/;

/** A lazy chunk that failed to import — the returning-user stale-bundle miss. */
export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_LOAD_ERROR.test(error.message);
}

// Module state, not sessionStorage: it must die with the page, so a reload that
// lands on the same broken build is refused by the guard instead of suspending.
let recoveryInFlight = false;

function guardHolds(): boolean {
  try {
    const raw = sessionStorage.getItem(STALE_RECOVERY_FLAG);
    if (raw === null) return false;
    const { sha, at } = JSON.parse(raw) as Partial<GuardRecord>;
    return sha === __GIT_SHA__ && typeof at === 'number' && Date.now() - at < GUARD_WINDOW_MS;
  } catch {
    return false;
  }
}

function markRecovered(): void {
  try {
    const record: GuardRecord = { sha: __GIT_SHA__, at: Date.now() };
    sessionStorage.setItem(STALE_RECOVERY_FLAG, JSON.stringify(record));
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
  /**
   * User-initiated recovery: skip the once-per-session guard and the
   * `navigator.onLine` check. A person clicking "reload" can't loop the way an
   * automatic retry can, and an offline reload failing visibly is the outcome
   * they asked for. Used by the ErrorBoundary's chunk-load "Reload" action,
   * where the automatic guard is typically already spent.
   */
  readonly force?: boolean;
}

/**
 * Attempt a stale-bundle recovery. Returns true if a recovery was started
 * (caches cleared + reload triggered) or one is already running in this page,
 * so the caller can wait for the reload instead of surfacing its failure.
 * Returns false if it was skipped because the guard holds or the browser
 * reports no network. A `force` caller is never skipped.
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
  { dropWasmCache = false, force = false }: RecoverOptions = {}
): Promise<boolean> {
  if (!force) {
    if (recoveryInFlight) return true;
    if (guardHolds()) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    markRecovered();
  }
  recoveryInFlight = true;

  try {
    getPosthogInstance()?.capture('pwa_stale_recovery', {
      reason,
      forced: force,
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

export function __resetForTests(): void {
  recoveryInFlight = false;
}

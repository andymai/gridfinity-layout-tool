/**
 * Background thumbnail regeneration.
 *
 * Runs one boot-time pass through saved designs and regenerates any missing
 * or outdated thumbnails on idle time. Without this, fresh / imported / version-
 * bumped designs only get their thumbnail on the user's *next* modal open —
 * which is exactly when they notice it's missing.
 *
 * Coordination contract:
 *  - **Sync**: signed-in users wait for the sync store to leave `'syncing'`
 *    (and have a `lastSyncedAt`). Anonymous / signed-out users start immediately.
 *  - **Live work**: the shared bridge is single-flight. Whenever the designer's
 *    `generationStatus === 'generating'`, the next thumbnail tick yields and
 *    resumes when status clears.
 *  - **Tab hidden**: paused. `requestIdleCallback` already deprioritises hidden
 *    tabs, but the explicit gate avoids weird half-stalled batches.
 *  - **Bridge lifecycle**: acquired once for the whole batch, released at end,
 *    so the bridge stays warm if the user lands in the designer mid-scan.
 *
 * Errors are logged + counted; failed designs aren't marked processed, so the
 * next session retries them.
 */

import { useEffect } from 'react';
import { isOk } from '@/core/result';
import { bridgeManager } from '@/shared/generation/bridge';
import { trackEvent } from '@/shared/analytics/posthog';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSyncStatusStore } from '@/core/sync/status';
import { useDesignerStore } from '../store';
import { listDesigns, updateDesignThumbnail } from '../storage/DesignerStorage';
import { upsertRegistryEntry } from '../store/customBinRegistry';
import { regenerateThumbnail } from '../utils/thumbnailRegenerator';
import { updateThumbnailCache } from './useDesignThumbnail';
import { THUMBNAIL_VERSION } from '../types';
import type { SavedDesign } from '../types';

/** localStorage key for the persisted preview color (mirrors PreviewCanvas). */
const PREVIEW_COLOR_KEY = 'gridfinity-designer-preview-color';

/** Fallback preview color when localStorage has no preference. */
const DEFAULT_PREVIEW_COLOR = '#d4d8dc';

/**
 * Schedule a callback on the next idle moment. Uses `requestIdleCallback`
 * when available; falls back to `setTimeout(fn, 0)` for older browsers and
 * Node test environments. Returns a cancel function.
 */
function scheduleIdle(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    const id = setTimeout(callback, 0);
    return () => clearTimeout(id);
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback);
    // Capture the cancel function by reference so the closure is robust to
    // test-environment polyfills being torn down before React commits the
    // effect cleanup.
    const cancel = window.cancelIdleCallback.bind(window);
    return () => cancel(id);
  }
  const id = window.setTimeout(callback, 0);
  return () => window.clearTimeout(id);
}

/** Wait until the next time `predicate()` returns true, polling on each rAF. */
function waitUntil(predicate: () => boolean, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
      return;
    }
    if (predicate()) {
      resolve();
      return;
    }
    const check = (): void => {
      if (signal.aborted) {
        reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
        return;
      }
      if (predicate()) {
        resolve();
        return;
      }
      if (typeof window === 'undefined') {
        setTimeout(check, 50);
        return;
      }
      window.requestAnimationFrame(check);
    };
    if (typeof window === 'undefined') {
      setTimeout(check, 50);
      return;
    }
    window.requestAnimationFrame(check);
  });
}

/** Read the user's persisted preview color, or fall back to default. */
function readPreviewColor(): string {
  if (typeof window === 'undefined') return DEFAULT_PREVIEW_COLOR;
  try {
    return window.localStorage.getItem(PREVIEW_COLOR_KEY) ?? DEFAULT_PREVIEW_COLOR;
  } catch {
    return DEFAULT_PREVIEW_COLOR;
  }
}

/** True iff this design needs its thumbnail regenerated. */
function needsRegen(design: SavedDesign): boolean {
  return !design.thumbnail || (design.thumbnailVersion ?? 0) < THUMBNAIL_VERSION;
}

/**
 * Snapshot of all the "may we proceed?" gates. Captured lazily on each tick
 * so the loop doesn't burn CPU between awaits when the user is mid-edit.
 */
interface GateSnapshot {
  readonly tabHidden: boolean;
  readonly generating: boolean;
}

function readGates(): GateSnapshot {
  const tabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const generating = useDesignerStore.getState().generation.status === 'generating';
  return { tabHidden, generating };
}

/**
 * Wait for sync to settle. For anonymous / signed-out users, resolves
 * immediately. For authenticated users, resolves once the sync store is no
 * longer `'syncing'` AND `lastSyncedAt` is set — meaning the initial pull
 * has completed at least once. Offline / error states also resolve so we
 * still regenerate locally-available designs.
 */
async function waitForSyncSettled(signal: AbortSignal): Promise<void> {
  const sessionStatus = useSessionStore.getState().status;
  if (sessionStatus !== 'authenticated') return;

  await waitUntil(() => {
    const { state, lastSyncedAt } = useSyncStatusStore.getState();
    if (state === 'idle' && lastSyncedAt !== undefined) return true;
    // Offline / error: settle anyway so local-only designs still get thumbs.
    return state === 'offline' || state === 'error';
  }, signal);
}

interface BatchResult {
  readonly total: number;
  readonly regenerated: number;
  readonly failed: number;
}

/**
 * Run one regeneration pass over `designs`, yielding back to the event loop
 * between each item and respecting `signal`.
 */
async function runBatch(
  designs: readonly SavedDesign[],
  signal: AbortSignal
): Promise<BatchResult> {
  let regenerated = 0;
  let failed = 0;

  // Acquire the bridge once for the whole batch; release in finally.
  await bridgeManager.acquire();
  try {
    for (const design of designs) {
      if (signal.aborted) break;

      // Pause when the user is actively generating in the designer OR when the
      // tab is hidden. Resume when both clear.
      try {
        await waitUntil(() => {
          const gates = readGates();
          return !gates.generating && !gates.tabHidden;
        }, signal);
      } catch {
        // Aborted while waiting — stop the batch.
        break;
      }

      const color = readPreviewColor();
      // `regenerateThumbnail` returns `null` when `signal` aborts mid-flight,
      // so the `if (!thumbnail) continue` arm covers both render failure and
      // mid-batch unmount — no extra abort check needed.
      const thumbnail = await regenerateThumbnail(design.params, { signal, color });
      if (!thumbnail) {
        failed += 1;
        continue;
      }

      // IndexedDB write is non-cancellable but fast (~ms); finishing it even
      // after abort is harmless — the registered thumbnail just becomes
      // available to the next session.
      const writeResult = await updateDesignThumbnail(design.id, thumbnail);
      if (!isOk(writeResult)) {
        failed += 1;
        continue;
      }

      regenerated += 1;
      upsertRegistryEntry({
        id: design.id,
        name: design.name,
        width: design.params.width,
        depth: design.params.depth,
        height: design.params.height,
        updatedAt: writeResult.value.updatedAt,
      });
      updateThumbnailCache(design.id, thumbnail);

      // Yield to the event loop between designs so user input doesn't pile up.
      await new Promise<void>((resolve) => scheduleIdle(resolve));
    }
  } finally {
    bridgeManager.release();
  }

  return { total: designs.length, regenerated, failed };
}

/**
 * Module-scoped one-shot guard. Lives outside React so StrictMode double-
 * mounts and unrelated remounts (different consumer trees) coalesce into a
 * single scan per page load. Exported for tests via `__resetForTests`.
 */
let sessionStarted = false;

/**
 * One-shot per session: scan IndexedDB for designs needing thumbnails and
 * regenerate them in the background. Mount in the top-level app shell.
 */
export function useBackgroundThumbnailRegen(): void {
  useEffect(() => {
    if (sessionStarted) return;
    sessionStarted = true;

    const controller = new AbortController();

    const start = async (): Promise<void> => {
      try {
        await waitForSyncSettled(controller.signal);

        const listResult = await listDesigns();
        if (!isOk(listResult)) return;

        const stale = listResult.value.filter(needsRegen);
        if (stale.length === 0) return;

        const startedAt = performance.now();
        const summary = await runBatch(stale, controller.signal);
        const elapsedMs = Math.round(performance.now() - startedAt);

        // Skip telemetry if we got cancelled mid-batch (no work attributable
        // to a real "scan completed" event); waitForSyncSettled throws on
        // abort, so reaching here with an aborted signal means runBatch
        // returned a partial summary the user shouldn't see logged.
        if (controller.signal.aborted) return;

        trackEvent('bin_designer_bg_thumbnail_regen', {
          designs_total: summary.total,
          designs_regenerated: summary.regenerated,
          designs_failed: summary.failed,
          total_ms: elapsedMs,
        });
      } catch {
        // Swallow — failures are surfaced via the per-design `failed` counter.
        // A hard abort just means the user left or the hook unmounted.
      }
    };

    const cancelScheduled = scheduleIdle(() => {
      void start();
    });

    return () => {
      controller.abort();
      cancelScheduled();
      // Don't reset `sessionStarted` — one-shot per page load.
    };
  }, []);
}

/** Test-only: reset the one-shot guard between cases. */
export function __resetForTests(): void {
  sessionStarted = false;
}

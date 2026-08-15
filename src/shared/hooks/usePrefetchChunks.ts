import { useEffect } from 'react';
import { useResponsive } from './useResponsive';
import { scheduleIdleCallback, cancelIdleCallback } from '@/shared/utils/idle';
import { shouldSkipPrefetch } from '@/shared/utils/prefetchPolicy';
import { preloadBrepkitWasm, preloadOcctWasm } from '@/shared/generation/wasmPreload';
import { useLabsStore } from '@/core/store/labs';

/** How long to wait after mount before starting prefetch (ms) */
const PREFETCH_DELAY_MS = 3000;

/** Fire-and-forget dynamic import — errors are silently swallowed. */
function prefetch(importFn: () => Promise<unknown>): void {
  importFn().catch(() => {
    /* chunk will load normally when actually needed */
  });
}

/**
 * Prime the geometry kernel the active Labs engine will actually use. Both
 * editors below need it, and it is by far the largest asset either pulls.
 */
export function warmGeometryKernel(): void {
  if (useLabsStore.getState().isFeatureEnabled('brepkit_kernel')) {
    preloadBrepkitWasm();
  } else {
    preloadOcctWasm();
  }
}

/**
 * Per-destination warmers, kept beside the idle tiers so what a destination
 * costs is stated once. Each is safe to call repeatedly; the callers that
 * matter (`useIntentPrefetch`) dedupe anyway.
 *
 * Route chunks only — deliberately NOT the geometry kernel, even though both
 * editors need one. Starting a 22MB binary on a hover puts it in front of the
 * ~500KB the panel is actually waiting for: measured on a 4Mbps link, warming
 * the kernel on intent made the click *slower* than doing nothing. The kernel
 * has its own budget — the idle tier below, 3s after mount and off the
 * critical path of any navigation the user has started.
 */
export function warmDesigner(): void {
  prefetch(() => import('@/features/bin-designer/components/DesignerPage'));
}

export function warmBaseplate(): void {
  prefetch(() => import('@/features/baseplate'));
}

export function warmCommunity(): void {
  prefetch(() => import('@/features/community'));
}

/** The designer's own way into the showcase — a modal, not the /community route. */
export function warmDesignGallery(): void {
  prefetch(() => import('@/shell/Modals/DesignGalleryModal'));
}

/**
 * Prefetches lazy-loaded feature chunks during browser idle time.
 *
 * Runs once after mount with a delay, then uses `requestIdleCallback`
 * to load chunks in prioritized tiers without blocking the main thread.
 * Tiers are chained so each waits for the previous tier's idle slot.
 *
 * Skips prefetching on:
 * - Mobile and tablet devices (limited resources). Those devices are covered
 *   by pointer-intent prefetch instead (`useIntentPrefetch`), which spends
 *   bandwidth only on a destination someone is already reaching for.
 * - Data-saver mode or slow connections (2G / slow-2G)
 */
export function usePrefetchChunks(): void {
  const { isMobile, isTablet } = useResponsive();

  useEffect(() => {
    // Skip on mobile/tablet — they have limited CPU and memory
    if (isMobile || isTablet) return;

    // Skip on data-saver or very slow connections
    if (shouldSkipPrefetch()) return;

    const idleHandles: number[] = [];

    function scheduleNext(fn: () => void): void {
      idleHandles.push(scheduleIdleCallback(fn));
    }

    const timer = setTimeout(() => {
      // Tier 0: Preload WASM binary — large asset needed by designer & baseplate
      scheduleNext(() => {
        warmGeometryKernel();

        // Tier 1: High priority — the other two editors in the tool switcher,
        // plus the modals most users open early. All three editors are one
        // click apart, so none of them should be the one that isn't ready.
        scheduleNext(() => {
          prefetch(() => import('@/features/print-export/components/PrintModal'));
          prefetch(() => import('@/features/layout-library/components/LayoutManagerModal'));
          prefetch(() => import('@/features/bin-designer/components/DesignerPage'));
          prefetch(() => import('@/features/baseplate'));
          prefetch(() => import('@/shell/Modals/SettingsModal'));

          // Tier 2: Medium priority — commonly used but not immediately
          scheduleNext(() => {
            prefetch(() => import('@/features/inspiration-gallery'));
            prefetch(() => import('@/features/community'));
            prefetch(() => import('@/shell/Modals/HelpModal'));

            // Tier 3: Low priority — rarely needed on desktop
            scheduleNext(() => {
              prefetch(() => import('@/features/labs/components/LabsDrawer'));
              prefetch(() => import('@/shell/Collab/CollabProvider'));
            });
          });
        });
      });
    }, PREFETCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      idleHandles.forEach((handle) => cancelIdleCallback(handle));
    };
  }, [isMobile, isTablet]);
}

import { useEffect } from 'react';
import { useResponsive } from './useResponsive';
import { scheduleIdleCallback, cancelIdleCallback } from '@/shared/utils/idle';
import {
  preloadWasmBinary,
  preloadBrepkitWasm,
  preloadOcctWasm,
} from '@/shared/generation/wasmPreload';
import { useLabsStore } from '@/core/store/labs';

/** How long to wait after mount before starting prefetch (ms) */
const PREFETCH_DELAY_MS = 3000;

/**
 * Connection info from the Network Information API.
 * Not available in all browsers, so every property is optional.
 */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Returns true when the browser signals it wants to conserve bandwidth
 * (data-saver enabled or very slow connection).
 */
function shouldSkipForNetwork(): boolean {
  const connection = (navigator as { connection?: NetworkInformation }).connection;
  if (!connection) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g'
  );
}

/** Fire-and-forget dynamic import — errors are silently swallowed. */
function prefetch(importFn: () => Promise<unknown>): void {
  importFn().catch(() => {
    /* chunk will load normally when actually needed */
  });
}

/**
 * Prefetches lazy-loaded feature chunks during browser idle time.
 *
 * Runs once after mount with a delay, then uses `requestIdleCallback`
 * to load chunks in prioritized tiers without blocking the main thread.
 * Tiers are chained so each waits for the previous tier's idle slot.
 *
 * Skips prefetching on:
 * - Mobile and tablet devices (limited resources)
 * - Data-saver mode or slow connections (2G / slow-2G)
 */
export function usePrefetchChunks(): void {
  const { isMobile, isTablet } = useResponsive();

  useEffect(() => {
    // Skip on mobile/tablet — they have limited CPU and memory
    if (isMobile || isTablet) return;

    // Skip on data-saver or very slow connections
    if (shouldSkipForNetwork()) return;

    const idleHandles: number[] = [];

    function scheduleNext(fn: () => void): void {
      idleHandles.push(scheduleIdleCallback(fn));
    }

    const timer = setTimeout(() => {
      // Tier 0: Preload WASM binary — large asset needed by designer & baseplate
      scheduleNext(() => {
        const labs = useLabsStore.getState();
        if (labs.isFeatureEnabled('brepkit_kernel')) {
          preloadBrepkitWasm();
        } else if (labs.isFeatureEnabled('occt_wasm_kernel')) {
          preloadOcctWasm();
        } else {
          preloadWasmBinary();
        }

        // Tier 1: High priority — features most users navigate to quickly
        scheduleNext(() => {
          prefetch(() => import('@/features/print-export/components/PrintModal'));
          prefetch(() => import('@/features/layout-library/components/LayoutManagerModal'));
          prefetch(() => import('@/features/bin-designer/components/DesignerPage'));
          prefetch(() => import('@/shell/Modals/SettingsModal'));

          // Tier 2: Medium priority — commonly used but not immediately
          scheduleNext(() => {
            prefetch(() => import('@/features/inspiration-gallery'));
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

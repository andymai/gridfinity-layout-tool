/**
 * Auto-save hook for creating periodic layout snapshots.
 *
 * Creates a snapshot every 2 minutes when the layout has changed,
 * using idle callbacks to avoid blocking the main thread.
 *
 * Also creates an initial snapshot on first mount when no snapshots
 * exist yet for the active layout (bootstraps version history).
 */

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSnapshotStore } from '@/core/store/snapshots';
import { isRealLayoutId } from '@/core/constants';
import { scheduleIdleCallback, cancelIdleCallback } from '@/shared/utils';

const SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Cheap change-detection hash. Uses string length as a fast proxy —
 * sufficient for 2-minute intervals where exact dedup isn't critical.
 */
function computeLayoutHash(layout: object): number {
  const str = JSON.stringify(layout);
  // djb2 hash — fast, low collision for structural changes
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Periodically snapshots the active layout to IndexedDB for version history.
 *
 * - Creates an initial snapshot on first mount (if none exist)
 * - Runs on a 2-minute interval thereafter
 * - Only snapshots if the layout has changed since the last snapshot
 * - Skips shared preview layouts
 * - Uses idle callbacks to avoid blocking
 */
export function useSnapshotAutoSave(): void {
  const { layout, activeLayoutId } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
    }))
  );

  const lastSnapshotHashRef = useRef<number>(computeLayoutHash(layout));
  const intervalRef = useRef<number | undefined>(undefined);
  const idleRef = useRef<number | undefined>(undefined);
  const layoutRef = useRef(layout);
  const activeLayoutIdRef = useRef(activeLayoutId);
  const initialSnapshotCreatedRef = useRef(false);

  // Keep refs in sync; reset bootstrap flag on layout switch
  useEffect(() => {
    layoutRef.current = layout;
    if (activeLayoutIdRef.current !== activeLayoutId) {
      initialSnapshotCreatedRef.current = false;
      lastSnapshotHashRef.current = computeLayoutHash(layout);
    }
    activeLayoutIdRef.current = activeLayoutId;
  }, [layout, activeLayoutId]);

  // Bootstrap: create initial snapshot if none exist for this layout
  useEffect(() => {
    if (initialSnapshotCreatedRef.current) return;
    if (!isRealLayoutId(activeLayoutId)) return;
    if (layout.bins.length === 0) return;

    initialSnapshotCreatedRef.current = true;

    const capturedLayoutId = activeLayoutId;
    const store = useSnapshotStore.getState();
    void store.loadForLayout(capturedLayoutId).then(() => {
      // Verify layout hasn't switched while we were loading
      if (activeLayoutIdRef.current !== capturedLayoutId) return;
      const { snapshots } = useSnapshotStore.getState();
      if (snapshots.length === 0) {
        void store.addSnapshot(capturedLayoutId, layoutRef.current);
      }
    });
  }, [activeLayoutId, layout]);

  // Periodic snapshot interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (idleRef.current) {
      cancelIdleCallback(idleRef.current);
    }

    intervalRef.current = window.setInterval(() => {
      const currentLayout = layoutRef.current;
      const currentLayoutId = activeLayoutIdRef.current;

      // Skip shared preview
      if (!isRealLayoutId(currentLayoutId)) {
        return;
      }

      // Cheap change detection
      const hash = computeLayoutHash(currentLayout);
      if (hash === lastSnapshotHashRef.current) {
        return;
      }

      lastSnapshotHashRef.current = hash;

      idleRef.current = scheduleIdleCallback(() => {
        useSnapshotStore
          .getState()
          .addSnapshot(currentLayoutId, currentLayout)
          .catch(() => {
            // Swallow IndexedDB failures during auto-save — not user-facing
          });
      });
    }, SNAPSHOT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (idleRef.current) {
        cancelIdleCallback(idleRef.current);
      }
    };
  }, []); // Run once — refs handle state changes
}

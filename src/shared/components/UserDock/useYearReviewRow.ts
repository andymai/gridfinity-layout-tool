import { useEffect, useSyncExternalStore } from 'react';
import { isOk } from '@/core/result';
import { useLibraryStore } from '@/core/store/library';
import { getDesignStorePort } from '@/core/storage/designStorePort';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSyncStatusStore } from '@/core/sync/status';
import { cancelIdleCallback, scheduleIdleCallback } from '@/shared/utils/idle';
import { readDockRowState, rememberYearWork, subscribeDockRow } from '@/shared/yearReview/dockRow';
import { isYearReviewOpen, YEAR_REVIEW_YEAR } from '@/shared/yearReview/window';
import { designCountsForYear, layoutCountsForYear, yearBounds } from '@/shared/yearReview/yearWork';

let designCheck: Promise<boolean> | null = null;

/** One store read per page load, however many docks mount. */
function designsHaveYearWork(): Promise<boolean> {
  if (designCheck) return designCheck;
  const port = getDesignStorePort();
  if (!port) return Promise.resolve(false);
  const bounds = yearBounds(YEAR_REVIEW_YEAR);
  designCheck = port.listDesignSummaries({ thumbnails: false }).then(
    (listed) => isOk(listed) && listed.value.some((design) => designCountsForYear(design, bounds)),
    () => false
  );
  return designCheck;
}

/** For tests: let the next mount read the design store again. */
export function resetYearReviewDesignCheck(): void {
  designCheck = null;
}

export interface YearReviewRow {
  readonly visible: boolean;
  /** True until the user opens the review by any door. */
  readonly unseen: boolean;
}

export function useYearReviewRow(): YearReviewRow {
  const state = useSyncExternalStore(subscribeDockRow, readDockRowState);
  const open = !state.hidden && isYearReviewOpen();
  const checking = open && !state.hasWork;

  // `preview.binMap` leaves out the stash, so a stashed bin is not a placed one.
  const layoutWork = useLibraryStore((s) => {
    if (!checking) return false;
    const bounds = yearBounds(YEAR_REVIEW_YEAR);
    return s.library.entries.some((entry) =>
      layoutCountsForYear(
        { createdAt: entry.createdAt, gridBinCount: entry.preview.binMap?.length ?? 0 },
        bounds
      )
    );
  });

  // A signed-in user's designs are complete only after the first pull.
  const settled = useSessionStore((s) => s.status !== 'unknown');
  const synced = useSyncStatusStore(
    (s) =>
      (s.state === 'idle' && s.lastSyncedAt !== undefined) ||
      s.state === 'offline' ||
      s.state === 'error'
  );
  const signedIn = useSessionStore((s) => s.status === 'authenticated');
  const ready = settled && (!signedIn || synced);

  useEffect(() => {
    if (layoutWork) rememberYearWork();
  }, [layoutWork]);

  const checkDesigns = checking && !layoutWork && ready;
  useEffect(() => {
    if (!checkDesigns) return;
    const handle = scheduleIdleCallback(() => {
      void designsHaveYearWork().then((yes) => {
        if (yes) rememberYearWork();
      });
    });
    return () => cancelIdleCallback(handle);
  }, [checkDesigns]);

  return { visible: open && (state.hasWork || layoutWork), unseen: !state.seen };
}

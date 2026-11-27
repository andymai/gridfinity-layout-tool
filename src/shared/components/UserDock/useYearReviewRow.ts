import { useEffect, useState, useSyncExternalStore } from 'react';
import { isOk } from '@/core/result';
import { useLibraryStore } from '@/core/store/library';
import { getDesignStorePort } from '@/core/storage/designStorePort';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useSyncStatusStore } from '@/core/sync/status';
import { cancelIdleCallback, scheduleIdleCallback } from '@/shared/utils/idle';
import { readDockRowState, rememberYearWork, subscribeDockRow } from '@/shared/yearReview/dockRow';
import {
  isYearReviewOpen,
  nextYearReviewChange,
  YEAR_REVIEW_YEAR,
} from '@/shared/yearReview/window';
import { designCountsForYear, layoutCountsForYear, yearBounds } from '@/shared/yearReview/yearWork';

interface DesignCheck {
  /** Whose designs the store held: this device's, or a signed-in account's. */
  readonly scope: 'device' | 'account';
  /** False for a read before the account's first pull, while sync was down. */
  readonly complete: boolean;
  readonly result: Promise<boolean>;
}

let designCheck: DesignCheck | null = null;

/**
 * One store read per page load, however many docks mount. A read before the
 * first pull only stands until a complete one can replace it.
 */
function designsHaveYearWork(scope: DesignCheck['scope'], complete: boolean): Promise<boolean> {
  if (designCheck?.scope === scope && (designCheck.complete || !complete)) {
    return designCheck.result;
  }
  const port = getDesignStorePort();
  if (!port) return Promise.resolve(false);
  const bounds = yearBounds(YEAR_REVIEW_YEAR);
  const result = port.listDesignSummaries({ thumbnails: false }).then(
    (listed) => isOk(listed) && listed.value.some((design) => designCountsForYear(design, bounds)),
    () => false
  );
  designCheck = { scope, complete, result };
  return result;
}

// setTimeout overflows above 2^31 - 1 ms and fires at once.
const MAX_TIMEOUT_MS = 2_147_483_647;

/** The window state, kept current in a tab that stays open across a boundary. */
function useYearReviewOpen(): boolean {
  const [open, setOpen] = useState(() => isYearReviewOpen());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const next = nextYearReviewChange();
      if (next === null) return;
      timer = setTimeout(tick, Math.min(Math.max(next - Date.now(), 0), MAX_TIMEOUT_MS));
    };
    // A sleeping device can skip a timer, so a tab that comes back checks again.
    const tick = () => {
      clearTimeout(timer);
      setOpen(isYearReviewOpen());
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return open;
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
  const windowOpen = useYearReviewOpen();
  const open = !state.hidden && windowOpen;
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

  // A signed-in user's designs are complete only after the first pull. While
  // sync is down before it, the device's designs can still give a yes.
  const settled = useSessionStore((s) => s.status !== 'unknown');
  const signedIn = useSessionStore((s) => s.status === 'authenticated');
  const pulled = useSyncStatusStore((s) => s.lastPulledAt !== undefined);
  const syncDown = useSyncStatusStore((s) => s.state === 'offline' || s.state === 'error');
  const complete = !signedIn || pulled;
  const ready = settled && (complete || syncDown);

  useEffect(() => {
    if (layoutWork) rememberYearWork();
  }, [layoutWork]);

  const checkDesigns = checking && !layoutWork && ready;
  useEffect(() => {
    if (!checkDesigns) return;
    const handle = scheduleIdleCallback(() => {
      void designsHaveYearWork(signedIn ? 'account' : 'device', complete).then((yes) => {
        if (yes) rememberYearWork();
      });
    });
    return () => cancelIdleCallback(handle);
  }, [checkDesigns, signedIn, complete]);

  return { visible: open && (state.hasWork || layoutWork), unseen: !state.seen };
}

import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useLibraryStore, useToastStore } from '@/core/store';
import { saveLayoutWithMetadata } from '@/core/storage';
import type { SaveResult } from '@/core/storage';
import { isRealLayoutId } from '@/core/constants';
import { scheduleIdleCallback, cancelIdleCallback } from '@/shared/utils';
import { err, isErr, getUserMessage, isRetryable, storageUnavailable } from '@/core/result';
import type { Result, StorageError } from '@/core/result';
import type { Layout, LayoutId } from '@/core/types';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { captureException, trackLayoutSaveFailure } from '@/shared/analytics/posthog';
import type { SaveStatus } from '@/shared/types/saveStatus';
import { useBeforeUnloadGuard } from './useBeforeUnloadGuard';

export type { SaveStatus };

const SAVE_DEBOUNCE_MS = 1000;
const SAVED_DISPLAY_MS = 2500;
// Maximum time to wait for idle before forcing save (ensures data isn't lost)
const IDLE_TIMEOUT_MS = 2000;
// The last delay repeats until a save lands: a full disk only recovers when
// the maker frees space, which can take any amount of time.
const RETRY_DELAYS_MS = [2000, 5000, 15000, 30000, 60000] as const;
const SAVE_FAILED_TOAST_KEY = 'layout-save-failed';

type SaveTrigger = 'edit' | 'retry';

interface SavedLayout {
  readonly id: LayoutId | null;
  readonly layout: Layout;
}

interface LayoutSaver {
  schedule: () => void;
  retryNow: () => void;
  dispose: () => void;
}

function reportSaveCrash(error: unknown): void {
  captureException(error instanceof Error ? error : new Error(String(error)), {
    source: 'layout_autosave',
  });
}

async function writeLayout(
  savingLayoutId: LayoutId,
  layout: Layout
): Promise<Result<SaveResult, StorageError>> {
  try {
    // Get fresh library state at save time (may have changed since the save was scheduled)
    return await saveLayoutWithMetadata(savingLayoutId, layout, useLibraryStore.getState().library);
  } catch (error: unknown) {
    reportSaveCrash(error);
    return err(storageUnavailable('indexedDB', error));
  }
}

function addFailureToast(message: string, duration: number | undefined): void {
  useToastStore
    .getState()
    .addToast({ message, type: 'error', duration, key: SAVE_FAILED_TOAST_KEY });
}

function dismissFailureToast(): void {
  const { toasts, removeToast } = useToastStore.getState();
  for (const toast of toasts) {
    if (toast.key === SAVE_FAILED_TOAST_KEY) removeToast(toast.id);
  }
}

/**
 * Writes the open layout one save at a time, and retries a failed save until
 * one lands. Each save reads the layout and its id from the store as it starts,
 * so a retry writes the current edits, under the id they belong to.
 */
function createLayoutSaver(
  onStatus: (status: SaveStatus) => void,
  onSaved: (saved: SavedLayout) => void
): LayoutSaver {
  let debounceTimer: number | undefined;
  let idleHandle: number | undefined;
  let retryTimer: number | undefined;
  let savedTimer: number | undefined;
  let inFlight = false;
  let queued: SaveTrigger | null = null;
  let failureCount = 0;
  let hasShownError = false;
  let disposed = false;

  // TypeScript keeps `disposed` narrowed to false across an await; a call
  // reads the live value.
  const isDisposed = (): boolean => disposed;

  function cancelPendingSave(): void {
    window.clearTimeout(debounceTimer);
    debounceTimer = undefined;
    if (idleHandle !== undefined) cancelIdleCallback(idleHandle);
    idleHandle = undefined;
  }

  function start(trigger: SaveTrigger): void {
    attempt(trigger).catch(reportSaveCrash);
  }

  async function attempt(trigger: SaveTrigger): Promise<void> {
    if (disposed) return;
    // Two writes of one layout can finish out of order, and then the older one
    // stays in storage. A save asked for meanwhile runs next, with newer state.
    if (inFlight) {
      queued = queued === 'edit' ? 'edit' : trigger;
      return;
    }

    const { layout, activeLayoutId: savingLayoutId } = useLayoutStore.getState();
    if (!isRealLayoutId(savingLayoutId)) return;

    window.clearTimeout(retryTimer);
    retryTimer = undefined;
    inFlight = true;
    const result = await writeLayout(savingLayoutId, layout);
    inFlight = false;
    if (isDisposed()) return;

    if (isErr(result)) {
      handleFailure(result.error, trigger);
    } else if (useLayoutStore.getState().activeLayoutId === savingLayoutId) {
      handleSuccess(savingLayoutId, layout, result.value);
    } else if (failureCount === 0) {
      // The user switched layouts during the save. The data is in storage, but
      // the returned library would overwrite the new layout's library state.
      onStatus('idle');
    }

    const next = queued;
    queued = null;
    if (next) start(next);
  }

  function handleSuccess(savingLayoutId: LayoutId, layout: Layout, saved: SaveResult): void {
    useLibraryStore.getState().setLibrary(saved.library);

    failureCount = 0;
    hasShownError = false;
    dismissFailureToast();

    // Track layout snapshot for ML telemetry (rate-limited internally)
    mlTracking.trackSnapshot('save');

    onSaved({ id: savingLayoutId, layout });
    onStatus('saved');
    window.clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => {
      onStatus('idle');
    }, SAVED_DISPLAY_MS);
  }

  function handleFailure(error: StorageError, trigger: SaveTrigger): void {
    failureCount++;
    // Retries stay out of analytics: one runs every minute for as long as the
    // disk stays full.
    if (trigger === 'edit') {
      trackLayoutSaveFailure(error.code, error.message, failureCount);
    }
    // A save that succeeded just before this queued one started a timer back to idle.
    window.clearTimeout(savedTimer);
    onStatus('error');

    const message = getUserMessage(error);
    if (failureCount >= 3 && !hasShownError) {
      hasShownError = true;
      addFailureToast(message, 0);
    } else if (!hasShownError && failureCount === 1) {
      // A retryable error usually clears on the next retry, so its toast auto-dismisses.
      addFailureToast(message, isRetryable(error.code) ? undefined : 0);
    }

    const delay = RETRY_DELAYS_MS[Math.min(failureCount, RETRY_DELAYS_MS.length) - 1];
    retryTimer = window.setTimeout(() => {
      retryTimer = undefined;
      start('retry');
    }, delay);
  }

  return {
    schedule(): void {
      cancelPendingSave();
      window.clearTimeout(savedTimer);
      if (!isRealLayoutId(useLayoutStore.getState().activeLayoutId)) return;

      debounceTimer = window.setTimeout(() => {
        debounceTimer = undefined;
        // While a save is failed, the header keeps saying so until one lands.
        if (failureCount === 0) onStatus('saving');

        // Schedule storage operations during browser idle time to improve INP
        idleHandle = scheduleIdleCallback(
          () => {
            idleHandle = undefined;
            start('edit');
          },
          { timeout: IDLE_TIMEOUT_MS }
        );
      }, SAVE_DEBOUNCE_MS);
    },

    retryNow(): void {
      if (failureCount > 0) start('retry');
    },

    dispose(): void {
      disposed = true;
      cancelPendingSave();
      window.clearTimeout(retryTimer);
      window.clearTimeout(savedTimer);
    },
  };
}

/**
 * Auto-save hook for the multi-layout system. Saves the active layout to its
 * storage key and updates the library entry, retries a failed save until one
 * lands, and asks before the tab unloads while an edit is not saved.
 * Returns the current save status for UI display.
 */
export function useAutoSave(): SaveStatus {
  const { layout, activeLayoutId } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
    }))
  );

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saved, setSaved] = useState<SavedLayout>(() => ({ id: activeLayoutId, layout }));
  const saverRef = useRef<LayoutSaver | null>(null);

  // A layout that was just opened is its stored copy until it is edited.
  if (saved.id !== activeLayoutId) {
    setSaved({ id: activeLayoutId, layout });
  }
  const savedLayout = saved.id === activeLayoutId ? saved.layout : layout;
  const failed = saveStatus === 'error';
  useBeforeUnloadGuard(isRealLayoutId(activeLayoutId) && (failed || layout !== savedLayout));

  useEffect(() => {
    const saver = createLayoutSaver(setSaveStatus, setSaved);
    saverRef.current = saver;
    return () => {
      saver.dispose();
      saverRef.current = null;
    };
  }, []);

  // The saver reads the layout from the store when it writes, so this effect
  // only has to restart the debounce on each change.
  useEffect(() => {
    saverRef.current?.schedule();
  }, [layout, activeLayoutId]);

  useEffect(() => {
    if (!failed) return;
    const retryNow = (): void => saverRef.current?.retryNow();
    window.addEventListener('focus', retryNow);
    window.addEventListener('online', retryNow);
    return () => {
      window.removeEventListener('focus', retryNow);
      window.removeEventListener('online', retryNow);
    };
  }, [failed]);

  return saveStatus;
}

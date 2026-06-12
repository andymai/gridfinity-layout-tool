/**
 * Single source of behavior for the user's "default for new bins".
 *
 * Wraps the storage layer (`defaultParamsStorage`) + the reactive flag store
 * (`binDefaults`) + toasts so every surface — the Saved Designs ⋯ menu, the
 * parameter-panel footer, the Settings tab, and the command palette (via a
 * window-event bridge into the designer) — shares identical behavior.
 */

import { useCallback } from 'react';
import { isOk, getUserMessage } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '../store';
import { useBinDefaultsStore } from '../store/binDefaults';
import {
  saveDefaultParams,
  clearDefaultParams,
  hasCustomDefault as storageHasCustomDefault,
} from '../storage/defaultParamsStorage';

export interface UseBinDefaults {
  /** Whether a custom default for new bins is currently stored (reactive). */
  hasCustomDefault: boolean;
  /** Capture the current designer params as the default for new bins. */
  setCurrentAsDefault: () => void;
  /** Clear the custom default, reverting new bins to factory defaults. */
  resetToFactory: () => void;
}

export function useBinDefaults(): UseBinDefaults {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const hasCustomDefault = useBinDefaultsStore((s) => s.hasCustomDefault);
  const markSaved = useBinDefaultsStore((s) => s.markSaved);
  const markCleared = useBinDefaultsStore((s) => s.markCleared);
  const refresh = useBinDefaultsStore((s) => s.refresh);

  const setCurrentAsDefault = useCallback(() => {
    const result = saveDefaultParams(useDesignerStore.getState().params);
    if (isOk(result)) {
      markSaved();
      addToast({ message: t('binDesigner.savedAsDefault'), type: 'success', duration: 2000 });
    } else {
      addToast({ message: getUserMessage(result.error), type: 'error', duration: 4000 });
    }
  }, [addToast, t, markSaved]);

  const resetToFactory = useCallback(() => {
    // Idempotent: surfaces like the command palette can invoke this with no
    // custom default stored. Decide from localStorage (the source of truth),
    // not the reactive mirror, which could be stale if another tab changed it.
    if (!storageHasCustomDefault()) {
      // Reconcile a stale mirror (e.g. cleared in another tab) before reporting.
      refresh();
      addToast({ message: t('binDesigner.alreadyFactoryDefaults'), type: 'info', duration: 2000 });
      return;
    }
    clearDefaultParams();
    markCleared();
    addToast({
      message: t('binDesigner.factoryDefaultsRestored'),
      type: 'success',
      duration: 2000,
    });
  }, [addToast, t, markCleared, refresh]);

  return { hasCustomDefault, setCurrentAsDefault, resetToFactory };
}

import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store';
import { onEngineEvent, type EngineEvent } from './engine';
import { useSyncStatusStore } from './status';

const OFFLINE_DEBOUNCE_MS = 4_000;

/**
 * Surface engine and offline events as toasts. The "no header status
 * indicator" decision (see plan) means this is the only place where the
 * sync feature speaks to the user — silent on the happy path, vocal on
 * the cases where the user needs to know something happened.
 */
export function useSyncToasts(): void {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const offlineToastFiredAt = useRef<number>(0);

  useEffect(() => {
    return onEngineEvent((event: EngineEvent) => {
      if (event.type === 'remote-replaced-local') {
        addToast(t('sync.conflictPulled'), 'info');
        return;
      }
      if (event.reason === 'deleted-elsewhere') addToast(t('sync.deletedElsewhere'), 'info');
      else if (event.reason === 'quota') addToast(t('sync.quotaExceeded'), 'error');
      else if (event.reason === 'gave-up') addToast(t('sync.pushFailed'), 'error');
    });
  }, [addToast, t]);

  useEffect(() => {
    return useSyncStatusStore.subscribe((state, prev) => {
      // Only fire on the transition INTO offline, not while it stays.
      if (state.state !== 'offline' || prev.state === 'offline') return;
      const now = Date.now();
      if (now - offlineToastFiredAt.current < OFFLINE_DEBOUNCE_MS) return;
      offlineToastFiredAt.current = now;
      addToast(t('sync.workingOffline'), 'info');
    });
  }, [addToast, t]);
}

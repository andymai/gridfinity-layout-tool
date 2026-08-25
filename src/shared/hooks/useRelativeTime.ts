import { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n';

/**
 * Shared tick counter — one 30-second interval for all useRelativeTime instances.
 * Uses useSyncExternalStore to avoid per-instance setInterval overhead.
 */
let tick = 0;
let listenerCount = 0;
let intervalId: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  listenerCount++;
  if (listenerCount === 1) {
    intervalId = setInterval(() => {
      tick++;
      for (const listener of listeners) listener();
    }, 30_000);
  }
  return () => {
    listeners.delete(callback);
    listenerCount--;
    if (listenerCount === 0 && intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };
}

function getSnapshot(): number {
  return tick;
}

/**
 * Formats a timestamp as a relative time string ("2 min ago", "1 hour ago", etc.).
 * All instances share a single 30-second interval for re-renders.
 */
export function useRelativeTime(timestamp: number): string {
  const t = useTranslation();
  useSyncExternalStore(subscribe, getSnapshot);
  return formatRelativeTime(timestamp, t);
}

export function formatRelativeTime(
  timestamp: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return t('snapshots.justNow');
  if (seconds < 3600) return t('snapshots.minutesAgo', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('snapshots.hoursAgo', { count: Math.floor(seconds / 3600) });
  return t('snapshots.daysAgo', { count: Math.floor(seconds / 86400) });
}

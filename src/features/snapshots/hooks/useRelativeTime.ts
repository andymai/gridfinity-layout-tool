import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';

/**
 * Formats a timestamp as a relative time string ("2 min ago", "1 hour ago", etc.).
 * Re-renders periodically to keep the string fresh.
 */
export function useRelativeTime(timestamp: number): string {
  const t = useTranslation();
  const [, setTick] = useState(0);

  useEffect(() => {
    // Refresh every 30 seconds to keep relative times current
    const interval = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

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

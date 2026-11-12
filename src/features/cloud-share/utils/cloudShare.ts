import type { LayoutEntry } from '@/core/types';

/**
 * Format a timestamp as a localized date string.
 */
export function formatShareDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * A share id is usually its layout's id, but a layout that re-shared under a
 * fresh id holds the share's id in `cloudShare.id`.
 */
export function isOwnedShare(entries: readonly LayoutEntry[], shareId: string): boolean {
  return entries.some((entry) => entry.id === shareId || entry.cloudShare?.id === shareId);
}

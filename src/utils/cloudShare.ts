/**
 * Shared utilities for cloud sharing functionality.
 * Used by both CloudShareTab and MobileCloudSharePanel.
 */

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

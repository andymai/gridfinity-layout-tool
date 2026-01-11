/**
 * Shared utilities for cloud sharing functionality.
 * Used by both CloudShareTab and MobileCloudSharePanel.
 */

import type { ShareExpiration } from '../types';

/**
 * Expiration options for cloud shares.
 * Defined at module level to avoid recreation on render.
 */
export const EXPIRATION_OPTIONS: { value: ShareExpiration; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

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
 * Calculate days remaining from a timestamp.
 * Uses a reference time to avoid hydration issues.
 */
export function calculateDaysRemaining(expiresAt: number, referenceTime: number): number {
  const days = Math.ceil((expiresAt - referenceTime) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

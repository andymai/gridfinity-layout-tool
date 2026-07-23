import type { LayoutPreview } from './preview';
/**
 * Permission level for collaborative editing.
 */
export type SharePermission = 'view' | 'edit';

/**
 * Cloud share metadata stored locally for re-sharing.
 * Shares are permanent (no expiration) as of collaborative editing update.
 */
export interface CloudShareInfo {
  id: string; // 12-char share ID
  deleteToken: string; // 32-char hex token (stored locally only)
  sharedAt: number; // Unix timestamp
  permission: SharePermission; // Permission level ('view' or 'edit')
  lastUpdatedAt?: number; // Unix timestamp of last server update
  // Note: expiresAt removed - shares are now permanent
}

/**
 * Entry for a layout shared with you by another user.
 * Unlike LayoutEntry, this references a cloud share you don't own.
 */
export interface SharedWithMeEntry {
  id: string; // Local UUID for this entry
  sourceShareId: string; // Cloud share ID (12-char)
  name: string; // Layout name at time of access
  authorName?: string; // Author who shared it
  permission: SharePermission; // 'view' | 'edit'
  addedAt: number; // When first accessed
  lastAccessedAt: number; // When last accessed
  preview?: LayoutPreview; // Cached preview
  status: 'available' | 'deleted' | 'unknown';
}

import { isLaterRevision } from '@/shared/utils/roomLinkStamp';

/**
 * Per owned share, the share link's `lastUpdatedAt` from the last time this
 * browser saved its own copy of the layout to the link. When the owner joins
 * the share's room, this is the revision of the owner's copy: a copy saved to
 * the link after the room's recorded revision (edited while the share was
 * view-only, or before the room loaded) is newer than the room.
 */
const STORAGE_KEY = 'gridfinity-owned-share-revisions';

function readAll(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function readOwnCopyRevision(shareId: string): string | undefined {
  const revision = readAll()[shareId];
  return typeof revision === 'string' ? revision : undefined;
}

export function recordOwnCopyRevision(shareId: string, revision: string): void {
  const all = readAll();
  const current = all[shareId];
  if (typeof current === 'string' && isLaterRevision(current, revision)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [shareId]: revision }));
  } catch {
    // Storage unavailable: the owner's next join keeps the room's layout.
  }
}

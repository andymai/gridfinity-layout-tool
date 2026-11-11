import type { Layout } from '@/core/types';
import { isLaterRevision, stampFor, type RoomLinkStamp } from '@/shared/utils/roomLinkStamp';

/**
 * Per owned share, the share link's `lastUpdatedAt` and the fingerprint of the
 * layout from the last time a tab of this browser saved its own copy to the
 * link. When the owner joins the share's room, the revision belongs to the
 * owner's copy only if the copy is that layout: another tab can save a
 * different layout, and a copy can change after its save.
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

// An earlier record format stored the revision alone. Without a fingerprint
// no copy matches it, so the room's layout wins on join.
function toSave(value: unknown): RoomLinkStamp | undefined {
  if (typeof value === 'string') return { linkUpdatedAt: value };
  if (value === null || typeof value !== 'object') return undefined;
  const { linkUpdatedAt, linkFingerprint } = value as Record<string, unknown>;
  if (typeof linkUpdatedAt !== 'string' || typeof linkFingerprint !== 'string') return undefined;
  return { linkUpdatedAt, linkFingerprint };
}

export function readOwnCopyRevision(shareId: string): RoomLinkStamp | undefined {
  return toSave(readAll()[shareId]);
}

export function recordOwnCopyRevision(shareId: string, revision: string, layout: Layout): void {
  const all = readAll();
  if (isLaterRevision(toSave(all[shareId])?.linkUpdatedAt, revision)) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...all, [shareId]: stampFor(layout, revision) })
    );
  } catch {
    // Storage unavailable: the owner's next join keeps the room's layout.
  }
}

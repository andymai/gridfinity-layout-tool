import type { Layout } from '@/core/types';
import { hashDesignContent } from './binParamsHash';
import { getGridBins } from './bins';

/**
 * What a collab room knows about the share link that the owner saves it to:
 * the link's server `lastUpdatedAt`, and the fingerprint of the room layout
 * that the link held at that revision. A room whose layout no longer matches
 * the fingerprint holds edits that the link does not have yet.
 */
export interface RoomLinkStamp {
  readonly linkUpdatedAt?: string;
  readonly linkFingerprint?: string;
}

export type JoinOutcome = 'push-copy' | 'adopt-room';

/**
 * The top-level fields that a share stores: what `validateShareLayout` in
 * api/lib/validation.ts keeps, less what `withoutLibraryPlacement` removes.
 * A fetched copy has only these, so the owner's layout is compared on them too.
 */
const SHARED_LAYOUT_FIELDS = [
  'version',
  'name',
  'drawer',
  'layers',
  'bins',
  'categories',
  'printBedSize',
  'printBedDepth',
  'gridUnitMm',
  'gridUnitMmY',
  'heightUnitMm',
  'magnetAnchor',
  'lowProfileBase',
  'baseplateParams',
] as const satisfies readonly (keyof Layout)[];

/** Staging bins do not count: they never cause a share save. */
export function roomLayoutFingerprint(layout: Layout): string {
  const shared: Record<string, unknown> = {};
  for (const field of SHARED_LAYOUT_FIELDS) shared[field] = layout[field];
  shared.bins = getGridBins(layout.bins);
  return hashDesignContent(shared);
}

export function stampFor(layout: Layout, linkUpdatedAt: string | undefined): RoomLinkStamp {
  return {
    ...(linkUpdatedAt ? { linkUpdatedAt } : {}),
    linkFingerprint: roomLayoutFingerprint(layout),
  };
}

/**
 * The link revision of `copy`, when `save` records that revision for this same
 * layout. A save without a fingerprint, or of another layout, says nothing
 * about the copy.
 */
export function revisionOfCopy(copy: Layout, save: RoomLinkStamp | undefined): string | undefined {
  if (save?.linkFingerprint === undefined) return undefined;
  return save.linkFingerprint === roomLayoutFingerprint(copy) ? save.linkUpdatedAt : undefined;
}

export function isLaterRevision(revision: string | undefined, than: string | undefined): boolean {
  if (!revision || !than) return false;
  const a = Date.parse(revision);
  const b = Date.parse(than);
  return Number.isFinite(a) && Number.isFinite(b) && a > b;
}

/**
 * Decide which layout a browser keeps when it joins a room: its own copy
 * (fetched from the share link, or the owner's saved one) or the room's.
 *
 * The copy replaces the room only when the room holds nothing the link lacks
 * and the copy comes from a later link revision than the one the room
 * recorded. A room without a stamp predates the stamp, so its revision is
 * unknown and its content wins over the copy.
 */
export function resolveJoin(input: {
  readonly copy: Layout;
  readonly copyRevision: string | undefined;
  readonly room: Layout;
  readonly stamp: RoomLinkStamp;
}): JoinOutcome {
  const { copy, copyRevision, room, stamp } = input;
  if (stamp.linkFingerprint === undefined) {
    if (getGridBins(room.bins).length > 0) return 'adopt-room';
    return getGridBins(copy.bins).length > 0 ? 'push-copy' : 'adopt-room';
  }
  const roomFingerprint = roomLayoutFingerprint(room);
  if (roomFingerprint !== stamp.linkFingerprint) return 'adopt-room';
  if (!isLaterRevision(copyRevision, stamp.linkUpdatedAt)) return 'adopt-room';
  return roomLayoutFingerprint(copy) === roomFingerprint ? 'adopt-room' : 'push-copy';
}

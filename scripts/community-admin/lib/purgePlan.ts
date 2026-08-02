import {
  communityAuthorKey,
  communityChildrenKey,
  communityDesignKey,
  communityIndexKey,
  communityLikesKey,
  communityReportReasonKey,
  communityReportsKey,
  COMMUNITY_INDEX_SORTS,
} from '../../../api/lib/redisKeys.js';
import { communityDesignBlobPath } from '../../../api/lib/communityStore.js';
import type {
  CommunityCardRecord,
  CommunityDesignRecord,
} from '../../../api/lib/communityStore.js';

export interface PurgeCleanupPlan {
  /** Blob paths/URLs to delete: the design JSON, then any known thumbnails and mesh. */
  blobPaths: string[];
  hashKey: string;
  indexKeys: string[];
  likesKey: string;
  reportsKey: string;
  /** HASH of report-reason tallies; deleted alongside reportsKey so a purge leaves nothing behind. */
  reportReasonKey: string;
  /** SET of this design's own remixes: deleted as bookkeeping, the remixes themselves are untouched. */
  childrenKey: string;
  /** community:author:{publicId}, or null when neither the blob nor the card resolved an author. */
  authorKey: string | null;
  /** community:children:{parentId}, present only when this design is itself a remix. */
  parentChildKey: string | null;
}

/**
 * Enumerate every blob path and Redis key a purge must touch, without doing
 * any I/O. Kept pure and separate from the `purge` command so the key
 * enumeration itself is unit-testable without mocking Redis or Blob.
 *
 * "children keep snapshots" (community-showcase-plan.md 5.8): a remix's
 * lineage.parentId is allowed to point at a design that no longer resolves,
 * so this plan never reaches into a child's own record. It only reaches into
 * this design's parent's children set, to drop the now-dangling reference to it.
 */
export function planPurgeCleanup(
  designId: string,
  record: CommunityDesignRecord | null,
  card: CommunityCardRecord | null
): PurgeCleanupPlan {
  const blobPaths = [communityDesignBlobPath(designId)];
  if (record) {
    blobPaths.push(...record.thumbnails);
    if (record.meshUrl) blobPaths.push(record.meshUrl);
  }

  const authorPublicId = record?.authorPublicId ?? card?.authorPublicId ?? null;
  const parentId = record?.lineage?.parentId ?? null;

  return {
    blobPaths,
    hashKey: communityDesignKey(designId),
    indexKeys: COMMUNITY_INDEX_SORTS.map((sort) => communityIndexKey(sort)),
    likesKey: communityLikesKey(designId),
    reportsKey: communityReportsKey(designId),
    reportReasonKey: communityReportReasonKey(designId),
    childrenKey: communityChildrenKey(designId),
    authorKey: authorPublicId ? communityAuthorKey(authorPublicId) : null,
    parentChildKey: parentId ? communityChildrenKey(parentId) : null,
  };
}

import type {
  CommunityCard,
  CommunityCategory,
  CommunityDesign,
  CommunityFeatureReason,
  CommunityHiddenReason,
} from '@/shared/types/community';
import { COMMUNITY_CATEGORIES, COMMUNITY_FEATURE_REASONS } from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { isRecord } from '@/shared/utils/isRecord';

export function isCommunityDesign(value: unknown): value is CommunityDesign {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.authorPublicId === 'string' &&
    typeof value.authorName === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    isKnownCategory(value.category) &&
    Array.isArray(value.techniques) &&
    value.techniques.every(isKnownTechnique) &&
    (isRecord(value.params) ||
      (value.kind === 'assembly' && isRecord(value.envelope) && isRecord(value.structure))) &&
    isRecord(value.metrics) &&
    (value.lineage === null || isRecord(value.lineage)) &&
    Array.isArray(value.thumbnails) &&
    typeof value.meshUrl === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.status === 'live' || value.status === 'hidden' || value.status === 'removed')
  );
}

export function isDesignResponse(value: unknown): value is { design: CommunityDesign } {
  return isRecord(value) && isCommunityDesign(value.design);
}

export function isDetailResponse(value: unknown): value is {
  design: CommunityDesign;
  isOwner?: boolean;
  counts?: unknown;
  likedByMe?: unknown;
  authorIsSupporter?: unknown;
  hiddenReason?: unknown;
  hiddenReasonCategory?: unknown;
} {
  return isDesignResponse(value) && (!('isOwner' in value) || typeof value.isOwner === 'boolean');
}

const KNOWN_TECHNIQUES: readonly string[] = Object.keys(TECHNIQUE_CONFIG);

export function isKnownCategory(value: unknown): value is CommunityCategory {
  return typeof value === 'string' && (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

export function isKnownTechnique(value: unknown): boolean {
  return typeof value === 'string' && KNOWN_TECHNIQUES.includes(value);
}

export function isKnownFeatureReason(value: unknown): value is CommunityFeatureReason {
  return (
    typeof value === 'string' && (COMMUNITY_FEATURE_REASONS as readonly string[]).includes(value)
  );
}

export function isCommunityCard(value: unknown): value is CommunityCard {
  if (!isRecord(value)) return false;
  const counts: unknown = value.counts;
  const metrics: unknown = value.metrics;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.authorName === 'string' &&
    typeof value.authorPublicId === 'string' &&
    isKnownCategory(value.category) &&
    Array.isArray(value.techniques) &&
    value.techniques.every(isKnownTechnique) &&
    isRecord(metrics) &&
    typeof metrics.width === 'number' &&
    typeof metrics.depth === 'number' &&
    typeof metrics.height === 'number' &&
    typeof metrics.gridUnitMm === 'number' &&
    typeof value.thumbnailUrl === 'string' &&
    typeof value.isRemix === 'boolean' &&
    (value.parentId === undefined || typeof value.parentId === 'string') &&
    typeof value.featured === 'boolean' &&
    // A reason outside the union fails the whole card rather than flowing
    // through as a typed value the UI will index into a label map.
    (value.featureReason === undefined || isKnownFeatureReason(value.featureReason)) &&
    isRecord(counts) &&
    typeof counts.likes === 'number' &&
    typeof counts.remixes === 'number' &&
    typeof counts.exports === 'number' &&
    isOptionalNumber(counts.opens) &&
    isOptionalNumber(counts.views) &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.status === 'live' || value.status === 'hidden' || value.status === 'removed') &&
    (value.hiddenReason === undefined || parseHiddenReason(value.hiddenReason) !== null)
  );
}

export interface CommunityListPage {
  items: CommunityCard[];
  nextCursor: string | null;
  /** Ids on this page the session user has liked; empty for anonymous callers. */
  likedIds?: string[];
  /**
   * Author public ids on this page whose supporter badge is public. Keyed by
   * author rather than by design, so one publisher with several cards on a
   * page costs one entry. Optional: an older deployment omits it and nothing
   * is badged.
   */
  supporterAuthorIds?: string[];
  /**
   * Slots in the server's index, so the whole thing can be requested as
   * concurrent windows. Optional: an older deployment omits it and the fetch
   * falls back to paging sequentially.
   */
  indexSlots?: unknown;
}

export function isListPage(value: unknown): value is CommunityListPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isCommunityCard) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string') &&
    (value.likedIds === undefined ||
      (Array.isArray(value.likedIds) && value.likedIds.every((id) => typeof id === 'string'))) &&
    (value.supporterAuthorIds === undefined ||
      (Array.isArray(value.supporterAuthorIds) &&
        value.supporterAuthorIds.every((id) => typeof id === 'string'))) &&
    // indexSlots is deliberately not validated here. It is an optimisation
    // hint, and a corrupt hint must not reject a page of real designs; it is
    // read through readIndexSlots, which treats anything unusable as absent.
    true
  );
}

/**
 * The server switches the client cannot infer. `community_showcase` is a
 * per-user Labs flag over the UI; these are deployment kill switches, and
 * nothing local reflects them.
 */
export interface CommunityCapabilities {
  publishEnabled: boolean;
  printsEnabled: boolean;
  requireDescription: boolean;
}

export function isCapabilities(value: unknown): value is CommunityCapabilities {
  return (
    isRecord(value) &&
    typeof value.publishEnabled === 'boolean' &&
    typeof value.printsEnabled === 'boolean' &&
    typeof value.requireDescription === 'boolean'
  );
}

export function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

export function parseHiddenReason(value: unknown): CommunityHiddenReason | null {
  return value === 'reports' || value === 'denylist' || value === 'moderation' ? value : null;
}

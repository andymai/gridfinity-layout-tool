/**
 * Community design showcase data model (issue #3050 §5.2).
 *
 * MIRROR: `COMMUNITY_CATEGORIES`/`CommunityCategory` here must match the
 * identically-named runtime tuple/type in `api/lib/communityValidation.ts`
 * (api/ cannot import from src/, so the members are duplicated, not shared).
 * Update both sides together; the cross-boundary equality test in
 * `community.test.ts` guards against drift.
 */
import type { BinParams } from '@/shared/types/bin';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';

export const COMMUNITY_CATEGORIES = [
  'tools',
  'hardware',
  'kitchen',
  'office',
  'crafts',
  'electronics',
  'toys-games',
  'other',
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

/**
 * MIRROR: must match `COMMUNITY_INDEX_SORTS`/`CommunityIndexSort` in
 * `api/lib/redisKeys.ts` (one Redis sorted-set index per mode). Guarded by
 * the cross-boundary equality test in `community.test.ts`.
 */
export const COMMUNITY_INDEX_SORTS = ['newest', 'remixes', 'likes'] as const;

export type CommunityIndexSort = (typeof COMMUNITY_INDEX_SORTS)[number];

/**
 * `hidden` = auto-hidden after the report threshold or a deny-listed author;
 * `removed` = owner unpublish / admin purge. Updating a design never changes
 * its status (community-showcase-plan.md §1 "Updates").
 */
export type CommunityDesignStatus = 'live' | 'hidden' | 'removed';

/**
 * MIRROR: must match `COMMUNITY_REPORT_REASONS`/`CommunityReportReason` and
 * `COMMUNITY_REPORT_NOTE_MAX_LENGTH` in `api/lib/communityValidation.ts`
 * (api/ cannot import from src/, so the members are duplicated, not shared).
 * Registered in scripts/check-union-exhaustiveness.sh.
 */
export const COMMUNITY_REPORT_REASONS = ['inappropriate', 'spam', 'broken', 'stolen'] as const;

export type CommunityReportReason = (typeof COMMUNITY_REPORT_REASONS)[number];

export const COMMUNITY_REPORT_NOTE_MAX_LENGTH = 500;

export interface CommunityDesignMetrics {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly gridUnitMm: number;
}

/** Publish-form fields preserved across an OAuth round trip or re-auth. */
export interface CommunityPublishDraft {
  readonly name: string;
  readonly description: string;
  readonly category: CommunityCategory | null;
}

/** Snapshot naming so lineage still reads sensibly after the parent/root is deleted or renamed. */
export interface CommunityDesignLineage {
  readonly parentId: string;
  readonly rootId: string;
  readonly parentName: string;
  readonly parentAuthorName: string;
  readonly rootAuthorName: string;
}

/** Public counters on a card; rendered as plain text pre-PR-6 (no like/report actions). */
export interface CommunityDesignCounts {
  readonly likes: number;
  readonly remixes: number;
  readonly exports: number;
}

/**
 * Lightweight card-metadata shape served by the paginated list index
 * (`GET /api/community`): powers gallery grids, search, filters, and
 * shelves entirely client-side. Omits `params`/`description`/`lineage`
 * detail/`meshUrl`/`photos`, which only the detail fetch needs.
 *
 * MIRROR: field-for-field the server's `CommunityListItem`
 * (`api/community.ts` `toListItem`); note `thumbnailUrl` is the first
 * capture angle only, unlike the detail record's `thumbnails` array.
 */
export interface CommunityCard {
  readonly id: string;
  readonly name: string;
  readonly authorName: string;
  readonly authorPublicId: string;
  readonly category: CommunityCategory;
  readonly techniques: readonly ExampleTechnique[];
  readonly metrics: CommunityDesignMetrics;
  readonly thumbnailUrl: string;
  /** True when `lineage` is non-null on the full record; drives the card's corner remix glyph. */
  readonly isRemix: boolean;
  /**
   * Direct-remix lineage pointer, '' for originals: powers the detail view's
   * builds-on-this list. Optional so fixtures and pre-field snapshots keep
   * compiling; absent reads as no known parent.
   */
  readonly parentId?: string;
  readonly featured: boolean;
  readonly counts: CommunityDesignCounts;
  /**
   * Whether the session user has liked this design, seeded client-side from
   * the list response's per-page `likedIds`. Optional so fixtures and
   * anonymous-era snapshots without the field keep compiling; absent reads
   * as not-liked.
   */
  readonly likedByMe?: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: CommunityDesignStatus;
}

/** Full published-design record, as returned by `GET /api/community/[id]`. */
export interface CommunityDesign {
  readonly id: string;
  /** sha256(TOKEN_SALT + ':community:' + userId).slice(0, 32), the deriveDonorId pattern, never the raw userId. */
  readonly authorPublicId: string;
  readonly authorName: string;
  readonly name: string;
  readonly description: string;
  readonly category: CommunityCategory;
  /** Derived server-side by `deriveCommunityTechniques` at publish/update time, not client-supplied. */
  readonly techniques: readonly ExampleTechnique[];
  readonly params: BinParams;
  readonly metrics: CommunityDesignMetrics;
  readonly lineage: CommunityDesignLineage | null;
  /** 2-3 WebP 384px blob URLs. */
  readonly thumbnails: readonly string[];
  /** Publisher-exported GLB, revision-stamped path (`<id>-<rev>.glb`), immutably cacheable. */
  readonly meshUrl: string;
  /** Reserved for post-graduation publisher photos; empty until then. */
  readonly photos: readonly string[];
  readonly featured: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: CommunityDesignStatus;
}

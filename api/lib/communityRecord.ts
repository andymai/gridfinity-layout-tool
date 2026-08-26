/**
 * Record-derived values shared by the publish (api/community.ts) and update
 * (api/community/[id].ts) paths. The card is a pure projection of the design
 * record: any new record field the gallery needs must be added here once, so
 * a design edited after publish cannot silently drop it from its card.
 */

import { getBaseUrl } from './shared.js';
import type { CommunityCardMetadata, CommunityDesignRecord } from './communityStore.js';

// Matches the client's publicDesignUrl: /community/d/<id> is the canonical route.
export function communityDesignUrl(designId: string): string {
  return `${getBaseUrl()}/community/d/${designId}`;
}

export function cardFromRecord(record: CommunityDesignRecord): CommunityCardMetadata {
  return {
    id: record.id,
    name: record.name,
    authorPublicId: record.authorPublicId,
    authorName: record.authorName,
    category: record.category,
    techniques: record.techniques,
    kind: record.kind ?? '',
    width: record.metrics.width,
    depth: record.metrics.depth,
    height: record.metrics.height,
    gridUnitMm: record.metrics.gridUnitMm,
    thumbnailUrl: record.thumbnails[0] ?? '',
    isRemix: record.lineage !== null,
    parentId: record.lineage?.parentId ?? '',
    featured: record.featured,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
  };
}

export const DUPLICATE_DESIGN_RESPONSE = {
  error:
    'This matches a design that has already been published (or a built-in example). Make it your own before publishing.',
  code: 'DUPLICATE_DESIGN',
} as const;

export const REMIX_UNCHANGED_RESPONSE = {
  error: 'Change the design before publishing your remix.',
  code: 'REMIX_UNCHANGED',
} as const;

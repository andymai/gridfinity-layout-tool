/**
 * Storage helpers for community showcase designs.
 *
 * Split storage: the full design record lives in a JSON blob (one fetch per
 * detail view), while the card metadata browsing needs lives in a Redis hash
 * per design (paged via pipelined HGETALL) plus one sorted set per gallery
 * sort. Counters (likes/remixes/exports) are HINCRBY-managed fields on the
 * same hash and are never written by the metadata writer, so a publish update
 * can't clobber them.
 */

import { createHash } from 'node:crypto';
import type { ChainableCommander, Redis } from 'ioredis';
import { deleteBlob, getJson, putJson } from './blobStore.js';
import type { CommunityCategory, CommunityTechnique } from './communityValidation.js';
import {
  COMMUNITY_INDEX_SORTS,
  communityDesignKey,
  communityIndexKey,
  communityLikedKey,
  communityLikesKey,
} from './redisKeys.js';

export type CommunityDesignStatus = 'live' | 'hidden' | 'removed';

/**
 * Why a hidden design is hidden, written on the card hash by the hide paths
 * (report auto-hide, deny-list sweep, manual moderation hide) and surfaced
 * only to the owner.
 * MIRROR: must match `CommunityHiddenReason` in `src/shared/types/community.ts`.
 */
export type CommunityHiddenReason = 'reports' | 'denylist' | 'moderation';

export interface CommunityLineage {
  parentId: string;
  rootId: string;
  parentName: string;
  parentAuthorName: string;
  rootAuthorName: string;
}

export interface CommunityDesignMetrics {
  width: number;
  depth: number;
  height: number;
  gridUnitMm: number;
}

/**
 * MIRROR: outer-dimension math matches `binDimensions` in
 * `src/features/bin-designer/utils/binDimensions.ts` (api/ cannot import from
 * src/); the pitch/height defaults and tolerance mirror `GRIDFINITY_SPEC` in
 * `src/shared/printSettings/gridfinityGeometry.ts`. Update both sides together.
 */
const DEFAULT_GRID_UNIT_MM = 42;
const DEFAULT_HEIGHT_UNIT_MM = 7;
const BIN_TOLERANCE_MM = 0.5;

/**
 * Anonymous dedupe window for the open/export counters. Dedupe sets are keyed
 * by 7-day bucket (redisKeys.ts) and expire this long after their last write,
 * so a genuine repeat print/remix still accrues credit each new window
 * instead of capping at "unique clients ever", while no key outlives its
 * bucket by more than one window or grows unboundedly.
 */
export const COMMUNITY_DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

/** The 7-day window index used to key the open/export dedupe sets. */
export function communityDedupeBucket(nowMs: number): number {
  return Math.floor(nowMs / (COMMUNITY_DEDUPE_TTL_SECONDS * 1000));
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Single derivation for publish and update: metrics are stored in millimetres,
 * so both handlers must share it or an edit would silently switch the card to
 * a different unit system.
 */
export function deriveCommunityMetrics(params: Record<string, unknown>): CommunityDesignMetrics {
  const gridUnitMm = positiveNumber(params.gridUnitMm, DEFAULT_GRID_UNIT_MM);
  const heightUnitMm = positiveNumber(params.heightUnitMm, DEFAULT_HEIGHT_UNIT_MM);
  return {
    width: positiveNumber(params.width, 1) * gridUnitMm - BIN_TOLERANCE_MM,
    depth: positiveNumber(params.depth, 1) * gridUnitMm - BIN_TOLERANCE_MM,
    height: positiveNumber(params.height, 1) * heightUnitMm,
    gridUnitMm,
  };
}

export interface CommunityDesignRecord {
  id: string;
  authorPublicId: string;
  authorName: string;
  name: string;
  description: string;
  category: CommunityCategory;
  techniques: CommunityTechnique[];
  params: Record<string, unknown>;
  metrics: CommunityDesignMetrics;
  lineage: CommunityLineage | null;
  /** Blob URLs of the revision-stamped WebP captures. */
  thumbnails: string[];
  /** Blob URL of the revision-stamped publisher-exported GLB. */
  meshUrl: string;
  /** Reserved for post-graduation publisher photos; empty until then. */
  photos: string[];
  featured: boolean;
  createdAt: number;
  updatedAt: number;
  status: CommunityDesignStatus;
}

/**
 * Every community blob path carries a salted segment because blobs are
 * world-readable and the store hostname leaks through every card's
 * thumbnailUrl: a path derivable from the design id alone would let anyone
 * fetch a hidden or removed design's record, thumbnails, or mesh directly,
 * bypassing the API's moderation 404. Salting keeps paths deterministic for
 * the server while unguessable to anyone without TOKEN_SALT.
 */
function communityPathSecret(designId: string, purpose: string): string {
  const salt = process.env.TOKEN_SALT;
  if (!salt) {
    throw new Error('TOKEN_SALT is required to derive community blob paths');
  }
  return createHash('sha256').update(`${salt}:${purpose}:${designId}`).digest('hex').slice(0, 16);
}

export function communityDesignBlobPath(designId: string): string {
  return `community/designs/${designId}-${communityPathSecret(designId, 'community-record')}.json`;
}

/** Revision-stamped so updated thumbnails get fresh, immutably-cacheable URLs. */
export function communityThumbBlobPath(designId: string, rev: number, angle: number): string {
  const secret = communityPathSecret(designId, 'community-assets');
  return `community/thumbs/${designId}-${secret}-${rev}-${angle}.webp`;
}

/** Revision-stamped so an updated GLB gets a fresh, immutably-cacheable URL. */
export function communityMeshBlobPath(designId: string, rev: number): string {
  return `community/meshes/${designId}-${communityPathSecret(designId, 'community-assets')}-${rev}.glb`;
}

export interface WriteCommunityDesignOptions {
  /**
   * First publish keeps the CAS default (false) so a racing duplicate publish
   * throws instead of silently overwriting; updates pass true.
   */
  allowOverwrite?: boolean;
}

export async function writeCommunityDesignBlob(
  design: CommunityDesignRecord,
  options: WriteCommunityDesignOptions = {}
): Promise<string> {
  const result = await putJson(communityDesignBlobPath(design.id), design, {
    allowOverwrite: options.allowOverwrite ?? false,
  });
  return result.url;
}

export async function readCommunityDesignBlob(
  designId: string
): Promise<CommunityDesignRecord | null> {
  return getJson<CommunityDesignRecord>(communityDesignBlobPath(designId));
}

export async function deleteCommunityDesignBlob(designId: string): Promise<void> {
  await deleteBlob(communityDesignBlobPath(designId));
}

/** Card metadata as browsed in the gallery: everything but the counters. */
export interface CommunityCardMetadata {
  id: string;
  name: string;
  authorPublicId: string;
  authorName: string;
  category: CommunityCategory;
  techniques: CommunityTechnique[];
  width: number;
  depth: number;
  height: number;
  gridUnitMm: number;
  thumbnailUrl: string;
  isRemix: boolean;
  /** Lineage parent id, or '' when not a remix. Duplicated from the blob
   *  record so a retried DELETE can clean the parent's children set after
   *  the blob is already gone. */
  parentId: string;
  featured: boolean;
  createdAt: number;
  updatedAt: number;
  status: CommunityDesignStatus;
}

export interface CommunityCardRecord extends CommunityCardMetadata {
  likes: number;
  remixes: number;
  exports: number;
  /**
   * Owner-only stat: how many times the design was opened for remixing.
   * Never served publicly. Optional in the type for fixture ergonomics;
   * parseCard always yields a number.
   */
  opens?: number;
  /** Owner-only stat: deduped detail views. Never served publicly. Optional like `opens`. */
  views?: number;
  /** Present only after a hide; consulted only while status is 'hidden'. */
  hiddenReason?: CommunityHiddenReason;
}

export async function writeCommunityCard(redis: Redis, card: CommunityCardMetadata): Promise<void> {
  await redis.hset(communityDesignKey(card.id), {
    id: card.id,
    name: card.name,
    authorPublicId: card.authorPublicId,
    authorName: card.authorName,
    category: card.category,
    techniques: JSON.stringify(card.techniques),
    width: String(card.width),
    depth: String(card.depth),
    height: String(card.height),
    gridUnitMm: String(card.gridUnitMm),
    thumbnailUrl: card.thumbnailUrl,
    isRemix: card.isRemix ? '1' : '0',
    parentId: card.parentId,
    featured: card.featured ? '1' : '0',
    createdAt: String(card.createdAt),
    updatedAt: String(card.updatedAt),
    status: card.status,
  });
}

function parseCard(fields: Record<string, string | undefined>): CommunityCardRecord | null {
  if (fields.id === undefined) return null;
  let techniques: CommunityTechnique[] = [];
  try {
    const parsed: unknown = JSON.parse(fields.techniques ?? '[]');
    if (Array.isArray(parsed)) techniques = parsed as CommunityTechnique[];
  } catch {
    techniques = [];
  }
  const status = fields.status;
  if (status !== 'live' && status !== 'hidden' && status !== 'removed') return null;
  return {
    id: fields.id,
    name: fields.name ?? '',
    authorPublicId: fields.authorPublicId ?? '',
    authorName: fields.authorName ?? '',
    category: (fields.category ?? 'other') as CommunityCategory,
    techniques,
    width: Number(fields.width ?? 0),
    depth: Number(fields.depth ?? 0),
    height: Number(fields.height ?? 0),
    gridUnitMm: Number(fields.gridUnitMm ?? 0),
    thumbnailUrl: fields.thumbnailUrl ?? '',
    isRemix: fields.isRemix === '1',
    parentId: fields.parentId ?? '',
    featured: fields.featured === '1',
    createdAt: Number(fields.createdAt ?? 0),
    updatedAt: Number(fields.updatedAt ?? 0),
    status,
    likes: Number(fields.likes ?? 0),
    remixes: Number(fields.remixes ?? 0),
    exports: Number(fields.exports ?? 0),
    opens: Number(fields.opens ?? 0),
    views: Number(fields.views ?? 0),
    ...((fields.hiddenReason === 'reports' ||
      fields.hiddenReason === 'denylist' ||
      fields.hiddenReason === 'moderation') && {
      hiddenReason: fields.hiddenReason,
    }),
  };
}

/**
 * Pipelined HGETALL for a page of card ids. The result array is positional:
 * a missing or malformed hash yields null at its id's index rather than
 * shifting the page.
 */
export async function readCommunityCards(
  redis: Redis,
  designIds: readonly string[]
): Promise<(CommunityCardRecord | null)[]> {
  if (designIds.length === 0) return [];
  const pipeline = redis.pipeline();
  for (const id of designIds) {
    pipeline.hgetall(communityDesignKey(id));
  }
  const results = await pipeline.exec();
  // A null exec would otherwise read as an empty page while ids exist, which
  // stalls list pagination (offset only advances per returned card).
  if (results === null) {
    throw new Error('Community card read failed: redis connection lost');
  }
  return results.map(([error, value]) => {
    if (error || typeof value !== 'object' || value === null) return null;
    return parseCard(value as Record<string, string | undefined>);
  });
}

export interface CommunityIndexScores {
  createdAt: number;
  remixes: number;
  likes: number;
}

/**
 * ioredis returns null from exec() on connection-level failure and reports
 * per-command errors in the result tuples. Index membership decides whether
 * a design exists in the gallery at all, so both cases must throw instead
 * of leaving the indexes silently out of sync (same contract as the session
 * pipeline in session.ts).
 */
async function execIndexPipeline(pipeline: ChainableCommander, context: string): Promise<void> {
  const results = await pipeline.exec();
  if (results === null) {
    throw new Error(`${context}: redis connection lost`);
  }
  for (const [err] of results) {
    if (err) {
      throw new Error(`${context}: ${err.message}`);
    }
  }
}

/** Pipelined ZADD across all three sort indexes. Only call for live designs. */
export async function upsertCommunityIndexes(
  redis: Redis,
  designId: string,
  scores: CommunityIndexScores
): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.zadd(communityIndexKey('newest'), scores.createdAt, designId);
  pipeline.zadd(communityIndexKey('remixes'), scores.remixes, designId);
  pipeline.zadd(communityIndexKey('likes'), scores.likes, designId);
  await execIndexPipeline(pipeline, 'Community index upsert failed');
}

/** Pipelined ZREM from every sort index (hide, remove, unpublish). */
export async function removeFromCommunityIndexes(redis: Redis, designId: string): Promise<void> {
  const pipeline = redis.pipeline();
  for (const sort of COMMUNITY_INDEX_SORTS) {
    pipeline.zrem(communityIndexKey(sort), designId);
  }
  await execIndexPipeline(pipeline, 'Community index removal failed');
}

/**
 * Flip a design's status and keep the sort indexes consistent: only live
 * designs are indexed, so the gallery can page sorted sets without filtering.
 * Restoring to live re-scores from the card hash (counters kept accruing
 * while hidden).
 */
export async function setCommunityDesignStatus(
  redis: Redis,
  designId: string,
  status: CommunityDesignStatus
): Promise<void> {
  await redis.hset(communityDesignKey(designId), { status });
  if (status === 'live') {
    const [createdAt, remixes, likes] = await redis.hmget(
      communityDesignKey(designId),
      'createdAt',
      'remixes',
      'likes'
    );
    await upsertCommunityIndexes(redis, designId, {
      createdAt: Number(createdAt ?? 0),
      remixes: Number(remixes ?? 0),
      likes: Number(likes ?? 0),
    });
  } else {
    await removeFromCommunityIndexes(redis, designId);
  }
}

/**
 * Atomic like/unlike: SADD/SREM the per-design likes set, mirror into the
 * user's reverse "liked" set, HINCRBY the card hash counter, and re-score the
 * likes sort index, all inside one Lua script so two racing requests (double
 * tap, two open tabs) cannot leave the set and the counter disagreeing the
 * way four sequential awaits could.
 *
 * ZADD uses XX (update-score-only, never add) so a like on a hidden/removed
 * design, already ZREM'd from the index by `removeFromCommunityIndexes`,
 * cannot resurrect it into the "likes" sort. The caller still gates on
 * `status === 'live'` before invoking this; XX is defense in depth.
 *
 * The below-zero clamp covers drifted state (counter behind the set): an
 * unlike must never publish a negative count.
 *
 * Returns [likes, likedByMe] as Lua numbers (0/1 for the boolean).
 */
const COMMUNITY_LIKE_TOGGLE_LUA = `
local likesSet = KEYS[1]
local likedSet = KEYS[2]
local designHash = KEYS[3]
local likesIndex = KEYS[4]
local userId = ARGV[1]
local designId = ARGV[2]
local like = ARGV[3]

local isMember = redis.call('SISMEMBER', likesSet, userId)
local likes = tonumber(redis.call('HGET', designHash, 'likes') or '0')

if like == '1' then
  if isMember == 1 then
    return {likes, 1}
  end
  redis.call('SADD', likesSet, userId)
  redis.call('SADD', likedSet, designId)
  likes = redis.call('HINCRBY', designHash, 'likes', 1)
  redis.call('ZADD', likesIndex, 'XX', likes, designId)
  return {likes, 1}
else
  if isMember == 0 then
    return {likes, 0}
  end
  redis.call('SREM', likesSet, userId)
  redis.call('SREM', likedSet, designId)
  likes = redis.call('HINCRBY', designHash, 'likes', -1)
  if likes < 0 then
    redis.call('HSET', designHash, 'likes', 0)
    likes = 0
  end
  redis.call('ZADD', likesIndex, 'XX', likes, designId)
  return {likes, 0}
end
`;

/** `defineCommand` attaches the script as a method; declare its shape for callers. */
interface CommunityRedis extends Redis {
  communityLikeToggle(
    likesKey: string,
    likedKey: string,
    designKey: string,
    likesIndexKey: string,
    userId: string,
    designId: string,
    like: string
  ): Promise<[number, number]>;
}

// The like-toggle script registers lazily on the client `getRedis()` hands
// back: rateLimit.ts owns that singleton and should stay scoped to rate
// limiting. Re-registration is guarded per instance (not per module) so tests
// that hand in fresh clients each register their own.
function ensureLikeToggle(redis: Redis): CommunityRedis {
  const client = redis as CommunityRedis;
  if (typeof client.communityLikeToggle !== 'function') {
    client.defineCommand('communityLikeToggle', {
      numberOfKeys: 4,
      lua: COMMUNITY_LIKE_TOGGLE_LUA,
    });
  }
  return client;
}

export async function toggleCommunityLike(
  redis: Redis,
  userId: string,
  designId: string,
  like: boolean
): Promise<{ likes: number; likedByMe: boolean }> {
  const client = ensureLikeToggle(redis);
  const [likes, likedByMe] = await client.communityLikeToggle(
    communityLikesKey(designId),
    communityLikedKey(userId),
    communityDesignKey(designId),
    communityIndexKey('likes'),
    userId,
    designId,
    like ? '1' : '0'
  );
  return { likes, likedByMe: likedByMe === 1 };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  // JSON.stringify's lib type is `string`, but undefined/function inputs
  // really return undefined at runtime.
  const serialized = JSON.stringify(value) as string | undefined;
  return serialized === undefined ? 'null' : serialized;
}

export interface CommunityContentHashInput {
  params: Record<string, unknown>;
  name: string;
  description: string;
  category: string;
}

/**
 * Stable content hash for publish idempotency: a retry or second tab posting
 * identical content maps to the same hash, so the handler can return the
 * existing id instead of minting a duplicate. Object keys are sorted
 * recursively so serialization order can't defeat the match.
 */
export function communityContentHash(content: CommunityContentHashInput): string {
  const canonical = stableStringify({
    params: content.params,
    name: content.name,
    description: content.description,
    category: content.category,
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

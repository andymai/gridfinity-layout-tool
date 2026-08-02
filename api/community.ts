import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del, put } from '@vercel/blob';
import { requireMethod } from './lib/method.js';
import { readSessionCookie } from './lib/cookies.js';
import { readSession, requireSession } from './lib/session.js';
import type { SessionRecord } from './lib/session.js';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { logger } from './lib/logger.js';
import {
  ErrorCode,
  getBaseUrl,
  rateLimited,
  sendError,
  serviceUnavailable,
  singleParam,
} from './lib/shared.js';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_TECHNIQUES,
  parseCommunityLineage,
  validateCommunityPublish,
} from './lib/communityValidation.js';
import type { CommunityCategory, CommunityTechnique } from './lib/communityValidation.js';
import { deriveAuthorPublicId, generateCommunityDesignId } from './lib/communityIds.js';
import { checkCommunityPublishQuota } from './lib/communityQuota.js';
import {
  communityContentHash,
  communityMeshBlobPath,
  communityThumbBlobPath,
  deleteCommunityDesignBlob,
  deriveCommunityMetrics,
  readCommunityCards,
  readCommunityDesignBlob,
  removeFromCommunityIndexes,
  upsertCommunityIndexes,
  writeCommunityCard,
  writeCommunityDesignBlob,
} from './lib/communityStore.js';
import type {
  CommunityCardMetadata,
  CommunityCardRecord,
  CommunityDesignMetrics,
  CommunityDesignRecord,
  CommunityDesignStatus,
  CommunityHiddenReason,
  CommunityLineage,
} from './lib/communityStore.js';
import {
  COMMUNITY_INDEX_SORTS,
  communityAuthorKey,
  communityChildrenKey,
  communityDenylistKey,
  communityDesignKey,
  communityIndexKey,
  communityLikedKey,
  communityPublishedKey,
} from './lib/redisKeys.js';
import type { CommunityIndexSort } from './lib/redisKeys.js';

type RedisClient = NonNullable<ReturnType<typeof getRedis>>;

const FIRST_REVISION = 1;
const LIST_PAGE_SIZE = 24;
const LIST_SCAN_BATCH = 48;
// Bounds per-request Redis work when filters match rarely; the client resumes
// the scan from nextCursor instead of one request walking the whole index.
const LIST_MAX_SCAN = 960;

const AUTHOR_PUBLIC_ID_REGEX = /^[a-f0-9]{32}$/;
const CURSOR_REGEX = /^\d{1,9}$/;

// Matches the client's publicDesignUrl: /community/d/<id> is the canonical route.
function communityDesignUrl(designId: string): string {
  return `${getBaseUrl()}/community/d/${designId}`;
}

function badRequest(res: VercelResponse, message: string): void {
  sendError(res, 400, ErrorCode.VALIDATION_ERROR, message);
}

type LineageResolveResult =
  { ok: true; lineage: CommunityLineage | null } | { ok: false; message: string };

/**
 * Lineage display fields and the root itself come from the stored parent
 * record, never the client: accepting client values would let a publisher
 * fabricate "remix of X by Y" or "originally by Z" credit for arbitrary real
 * authors. The parent must be live at publish time and its stored chain
 * dictates the root; a client rootId that disagrees is rejected. When the
 * chain's root is legitimately deleted, its snapshot survives via the parent
 * record. The parent link itself carries no proof-of-remix: any live design
 * can be claimed as a parent, only the credit text is server-derived.
 */
async function resolveLineage(
  redis: RedisClient,
  lineage: CommunityLineage | null
): Promise<LineageResolveResult> {
  if (lineage === null) return { ok: true, lineage: null };
  const parentCard = (await readCommunityCards(redis, [lineage.parentId]))[0] ?? null;
  if (parentCard === null || parentCard.status !== 'live') {
    return { ok: false, message: 'lineage.parentId does not reference a live design' };
  }
  const parentRecord = await readCommunityDesignBlob(lineage.parentId);
  if (parentRecord === null) {
    return { ok: false, message: 'lineage.parentId does not reference a live design' };
  }
  const rootId = parentRecord.lineage?.rootId ?? lineage.parentId;
  if (lineage.rootId !== rootId) {
    return { ok: false, message: 'lineage.rootId does not match the parent design chain' };
  }
  let rootAuthorName = parentRecord.lineage?.rootAuthorName ?? parentCard.authorName;
  if (rootId !== lineage.parentId) {
    const rootCard = (await readCommunityCards(redis, [rootId]))[0] ?? null;
    if (rootCard !== null && rootCard.status === 'live') {
      rootAuthorName = rootCard.authorName;
    }
  }
  return {
    ok: true,
    lineage: {
      parentId: lineage.parentId,
      rootId,
      parentName: parentCard.name,
      parentAuthorName: parentCard.authorName,
      rootAuthorName,
    },
  };
}

async function findPublishedIdByContentHash(
  redis: RedisClient,
  userId: string,
  contentHash: string
): Promise<string | null> {
  const publishedIds = await redis.smembers(communityPublishedKey(userId));
  if (publishedIds.length === 0) return null;
  const pipeline = redis.pipeline();
  for (const id of publishedIds) {
    pipeline.hget(communityDesignKey(id), 'contentHash');
  }
  // A swallowed exec failure would disable idempotency and mint duplicate
  // designs while consuming quota, so an unhealthy redis must fail the
  // publish instead.
  const results = await pipeline.exec();
  if (results === null) {
    throw new Error('Community idempotency check failed: redis connection lost');
  }
  for (let i = 0; i < publishedIds.length && i < results.length; i++) {
    const [error, value] = results[i];
    if (error) {
      throw new Error(`Community idempotency check failed: ${error.message}`);
    }
    if (value === contentHash) return publishedIds[i];
  }
  return null;
}

function cardFromRecord(record: CommunityDesignRecord): CommunityCardMetadata {
  return {
    id: record.id,
    name: record.name,
    authorPublicId: record.authorPublicId,
    authorName: record.authorName,
    category: record.category,
    techniques: record.techniques,
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

async function handlePublish(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (process.env.COMMUNITY_PUBLISH_ENABLED !== 'true') {
    serviceUnavailable(res, 'Community publishing is not available.');
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const rate = await checkRateLimit(session.userId, 'community.publish');
    if (!rate.allowed) {
      rateLimited(res, rate.retryAfterSeconds, 'Publish limit reached. Try again later.');
      return;
    }

    const redis = getRedis();
    if (!redis) {
      serviceUnavailable(res);
      return;
    }

    const authorPublicId = deriveAuthorPublicId(session.userId);
    if (authorPublicId === null) {
      logger.error('Community publish failed: TOKEN_SALT is not configured');
      serviceUnavailable(res);
      return;
    }

    const validated = validateCommunityPublish(req.body);
    if (!validated.valid) {
      res.status(400).json({ error: validated.error.message, code: validated.error.code });
      return;
    }
    const payload = validated.payload;

    const lineageParse = parseCommunityLineage((req.body as Record<string, unknown>).lineage);
    if (!lineageParse.ok) {
      res.status(400).json({ error: lineageParse.message, code: 'INVALID_LINEAGE' });
      return;
    }

    const denied = await redis.sismember(communityDenylistKey(), session.userId);
    if (denied === 1) {
      // Deliberately neutral: the response must not reveal deny-listing.
      sendError(res, 403, ErrorCode.UNAUTHORIZED, 'Publishing is not available for this account.');
      return;
    }

    const contentHash = communityContentHash({
      params: payload.params,
      name: payload.name,
      description: payload.description,
      category: payload.category,
    });
    // Idempotency runs before quota: a retry of an already-published design
    // must return its id even when the user sits at the live-design cap.
    const existingId = await findPublishedIdByContentHash(redis, session.userId, contentHash);
    if (existingId !== null) {
      res.status(200).json({ id: existingId, url: communityDesignUrl(existingId) });
      return;
    }

    const quota = await checkCommunityPublishQuota(redis, session.userId);
    if (!quota.ok) {
      sendError(
        res,
        413,
        ErrorCode.SIZE_LIMIT,
        `Published design limit reached (${quota.error.limit} live designs).`
      );
      return;
    }

    const lineageResolve = await resolveLineage(redis, lineageParse.lineage);
    if (!lineageResolve.ok) {
      res.status(400).json({ error: lineageResolve.message, code: 'INVALID_LINEAGE' });
      return;
    }
    const lineage = lineageResolve.lineage;

    const id = generateCommunityDesignId();
    const now = Date.now();
    const [thumbBlobs, meshBlob] = await Promise.all([
      Promise.all(
        payload.thumbnails.map((thumbnail, angle) =>
          put(communityThumbBlobPath(id, FIRST_REVISION, angle), Buffer.from(thumbnail, 'base64'), {
            access: 'public',
            contentType: 'image/webp',
            addRandomSuffix: false,
            allowOverwrite: false,
          })
        )
      ),
      put(communityMeshBlobPath(id, FIRST_REVISION), Buffer.from(payload.glb, 'base64'), {
        access: 'public',
        contentType: 'model/gltf-binary',
        addRandomSuffix: false,
        allowOverwrite: false,
      }),
    ]);

    const record: CommunityDesignRecord = {
      id,
      authorPublicId,
      authorName: payload.authorName,
      name: payload.name,
      description: payload.description,
      category: payload.category,
      techniques: payload.techniques,
      params: payload.params,
      metrics: deriveCommunityMetrics(payload.params),
      lineage,
      thumbnails: thumbBlobs.map((blob) => blob.url),
      meshUrl: meshBlob.url,
      photos: [],
      featured: false,
      createdAt: now,
      updatedAt: now,
      status: 'live',
    };

    try {
      await writeCommunityDesignBlob(record);
      await writeCommunityCard(redis, cardFromRecord(record));
      await redis.hset(communityDesignKey(id), { contentHash });
      await upsertCommunityIndexes(redis, id, { createdAt: now, remixes: 0, likes: 0 });
      await redis.sadd(communityPublishedKey(session.userId), id);
      await redis.sadd(communityAuthorKey(authorPublicId), id);
      // Recorded at publish so remix claims are auditable and so the delete
      // path's srem from the parent's children set has something to undo.
      if (lineage !== null) {
        await redis.sadd(communityChildrenKey(lineage.parentId), id);
      }
    } catch (writeErr) {
      // The thumbnails and GLB were already uploaded to public, predictable
      // paths; without this cleanup a failed publish would strand CDN assets
      // that no record references and no purge can enumerate.
      const uploadedAssets = [...thumbBlobs.map((blob) => blob.url), meshBlob.url];
      await del(uploadedAssets).catch((delErr: unknown) => {
        logger.error('Rollback failed: orphan community assets left after publish failure', {
          id,
          error: delErr instanceof Error ? delErr.message : String(delErr),
        });
      });
      await deleteCommunityDesignBlob(id).catch((delErr: unknown) => {
        logger.error('Rollback failed: orphan community design blob left after publish failure', {
          id,
          error: delErr instanceof Error ? delErr.message : String(delErr),
        });
      });
      // Redis writes may have partially landed before the failure; without
      // this cleanup a stranded card hash surfaces in the gallery list while
      // the detail 404s, and the published-set entry burns a quota slot.
      await (async () => {
        const cleanup = redis.pipeline();
        cleanup.del(communityDesignKey(id));
        cleanup.srem(communityPublishedKey(session.userId), id);
        cleanup.srem(communityAuthorKey(authorPublicId), id);
        if (lineage !== null) {
          cleanup.srem(communityChildrenKey(lineage.parentId), id);
        }
        await cleanup.exec();
        await removeFromCommunityIndexes(redis, id);
      })().catch((cleanupErr: unknown) => {
        logger.error('Rollback failed: orphan community redis entries left after publish failure', {
          id,
          error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      });
      throw writeErr;
    }

    res.status(201).json({ id, url: communityDesignUrl(id) });
  } catch (error) {
    logger.error('Community publish error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to publish design');
  }
}

interface CommunityListItem {
  id: string;
  name: string;
  authorName: string;
  authorPublicId: string;
  category: CommunityCategory;
  techniques: CommunityTechnique[];
  metrics: CommunityDesignMetrics;
  thumbnailUrl: string;
  isRemix: boolean;
  /** Direct-remix lineage pointer, '' for originals: powers the detail view's builds-on-this list. */
  parentId: string;
  featured: boolean;
  /** `opens`/`views` are owner-only stats, present only on `mine=1` items. */
  counts: { likes: number; remixes: number; exports: number; opens?: number; views?: number };
  createdAt: number;
  updatedAt: number;
  status: CommunityDesignStatus;
  /** Owner-only: why a hidden design is hidden. Present only on `mine=1` items with status 'hidden'. */
  hiddenReason?: CommunityHiddenReason;
}

function toListItem(card: CommunityCardRecord): CommunityListItem {
  return {
    id: card.id,
    name: card.name,
    authorName: card.authorName,
    authorPublicId: card.authorPublicId,
    category: card.category,
    techniques: card.techniques,
    metrics: {
      width: card.width,
      depth: card.depth,
      height: card.height,
      gridUnitMm: card.gridUnitMm,
    },
    thumbnailUrl: card.thumbnailUrl,
    isRemix: card.isRemix,
    parentId: card.parentId,
    featured: card.featured,
    counts: { likes: card.likes, remixes: card.remixes, exports: card.exports },
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    status: card.status,
  };
}

/**
 * Mine-branch item shape: the public card plus the owner-only stats and, for
 * hidden designs, the hide reason. Only reachable behind requireSession, so
 * these fields never leak into the public list.
 */
function toOwnerListItem(card: CommunityCardRecord): CommunityListItem {
  const item = toListItem(card);
  return {
    ...item,
    counts: { ...item.counts, opens: card.opens ?? 0, views: card.views ?? 0 },
    ...(card.status === 'hidden' &&
      card.hiddenReason !== undefined && { hiddenReason: card.hiddenReason }),
  };
}

interface ListFilters {
  sort: CommunityIndexSort;
  category: CommunityCategory | undefined;
  technique: CommunityTechnique | undefined;
  author: string | undefined;
}

function matchesFilters(card: CommunityCardRecord, filters: ListFilters): boolean {
  if (filters.category !== undefined && card.category !== filters.category) return false;
  if (filters.technique !== undefined && !card.techniques.includes(filters.technique)) return false;
  if (filters.author !== undefined && card.authorPublicId !== filters.author) return false;
  return true;
}

function compareCards(
  a: CommunityCardRecord,
  b: CommunityCardRecord,
  sort: CommunityIndexSort
): number {
  if (sort === 'likes' && b.likes !== a.likes) return b.likes - a.likes;
  if (sort === 'remixes' && b.remixes !== a.remixes) return b.remixes - a.remixes;
  return b.createdAt - a.createdAt;
}

function isCommunityIndexSort(value: string): value is CommunityIndexSort {
  return (COMMUNITY_INDEX_SORTS as readonly string[]).includes(value);
}

function isCommunityCategory(value: string): value is CommunityCategory {
  return (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

function isCommunityTechnique(value: string): value is CommunityTechnique {
  return (COMMUNITY_TECHNIQUES as readonly string[]).includes(value);
}

interface ListPage {
  items: CommunityListItem[];
  nextCursor: string | null;
}

/**
 * Resolve the caller's session without sending any response. The list is a
 * public surface: an absent, expired, or unreadable session must degrade to
 * the anonymous view (no likedIds), never 401.
 */
async function readOptionalSession(req: VercelRequest): Promise<SessionRecord | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await readSession(redis, token);
  } catch {
    return null;
  }
}

/** Ids on this page the session user has liked, for heart state without a second request. */
async function resolveLikedIds(
  redis: RedisClient,
  userId: string,
  items: CommunityListItem[]
): Promise<string[]> {
  if (items.length === 0) return [];
  const ids = items.map((item) => item.id);
  const flags = await redis.smismember(communityLikedKey(userId), ...ids);
  return ids.filter((_, index) => flags[index] === 1);
}

async function listMine(
  redis: RedisClient,
  userId: string,
  filters: ListFilters,
  cursor: number
): Promise<ListPage> {
  const ids = await redis.smembers(communityPublishedKey(userId));
  const cards = (await readCommunityCards(redis, ids)).filter(
    (card): card is CommunityCardRecord => card !== null && card.status !== 'removed'
  );
  const matching = cards
    .filter((card) => matchesFilters(card, filters))
    .sort((a, b) => compareCards(a, b, filters.sort));
  const page = matching.slice(cursor, cursor + LIST_PAGE_SIZE);
  const nextOffset = cursor + page.length;
  return {
    items: page.map(toOwnerListItem),
    nextCursor: nextOffset < matching.length ? String(nextOffset) : null,
  };
}

async function listPublic(
  redis: RedisClient,
  filters: ListFilters,
  cursor: number
): Promise<ListPage> {
  const items: CommunityListItem[] = [];
  let offset = cursor;
  let scanned = 0;
  let reachedEnd = false;
  let full = false;

  while (!full && !reachedEnd && scanned < LIST_MAX_SCAN) {
    const ids = await redis.zrevrange(
      communityIndexKey(filters.sort),
      offset,
      offset + LIST_SCAN_BATCH - 1
    );
    if (ids.length === 0) {
      reachedEnd = true;
      break;
    }
    const cards = await readCommunityCards(redis, ids);
    for (const card of cards) {
      offset += 1;
      scanned += 1;
      if (card === null || card.status !== 'live' || !matchesFilters(card, filters)) continue;
      items.push(toListItem(card));
      if (items.length === LIST_PAGE_SIZE) {
        full = true;
        break;
      }
    }
    if (!full && ids.length < LIST_SCAN_BATCH) reachedEnd = true;
  }

  return { items, nextCursor: reachedEnd ? null : String(offset) };
}

async function handleList(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const rate = await checkRateLimit(getClientIP(req), 'community.read');
    if (!rate.allowed) {
      rateLimited(res, rate.retryAfterSeconds);
      return;
    }

    const redis = getRedis();
    if (!redis) {
      serviceUnavailable(res);
      return;
    }

    const sortParam = singleParam(req.query.sort) ?? 'newest';
    if (!isCommunityIndexSort(sortParam)) {
      badRequest(res, `sort must be one of: ${COMMUNITY_INDEX_SORTS.join(', ')}`);
      return;
    }

    const categoryParam = singleParam(req.query.category);
    if (categoryParam !== undefined && !isCommunityCategory(categoryParam)) {
      badRequest(res, `category must be one of: ${COMMUNITY_CATEGORIES.join(', ')}`);
      return;
    }

    const techniqueParam = singleParam(req.query.technique);
    if (techniqueParam !== undefined && !isCommunityTechnique(techniqueParam)) {
      badRequest(res, `technique must be one of: ${COMMUNITY_TECHNIQUES.join(', ')}`);
      return;
    }

    const authorParam = singleParam(req.query.author);
    if (authorParam !== undefined && !AUTHOR_PUBLIC_ID_REGEX.test(authorParam)) {
      badRequest(res, 'author must be a 32-char author public id');
      return;
    }

    const cursorParam = singleParam(req.query.cursor);
    let cursor = 0;
    if (cursorParam !== undefined) {
      if (!CURSOR_REGEX.test(cursorParam)) {
        badRequest(res, 'cursor must be a non-negative integer');
        return;
      }
      cursor = Number(cursorParam);
    }

    const mineParam = singleParam(req.query.mine);
    const mine = mineParam === '1' || mineParam === 'true';

    const filters: ListFilters = {
      sort: sortParam,
      category: categoryParam,
      technique: techniqueParam,
      author: authorParam,
    };

    if (mine) {
      const session = await requireSession(req, res);
      if (!session) return;
      const page = await listMine(redis, session.userId, filters, cursor);
      const likedIds = await resolveLikedIds(redis, session.userId, page.items);
      res.status(200).json({ ...page, likedIds });
      return;
    }

    const page = await listPublic(redis, filters, cursor);
    const session = await readOptionalSession(req);
    const likedIds =
      session === null ? [] : await resolveLikedIds(redis, session.userId, page.items);
    res.status(200).json({ ...page, likedIds });
  } catch (error) {
    logger.error('Community list error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to list designs');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  if (req.method === 'GET') {
    await handleList(req, res);
    return;
  }
  await handlePublish(req, res);
}

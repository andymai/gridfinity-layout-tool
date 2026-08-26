import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del, put } from '@vercel/blob';
import { requireMethod } from './lib/method.js';
import {
  cardFromRecord,
  communityDesignUrl,
  DUPLICATE_DESIGN_RESPONSE,
  REMIX_UNCHANGED_RESPONSE,
} from './lib/communityRecord.js';
import { readSessionCookie } from './lib/cookies.js';
import { readSession, requireSession } from './lib/session.js';
import type { SessionRecord } from './lib/session.js';
import { checkRateLimit, getClientIP, getRedis } from './lib/rateLimit.js';
import { logger } from './lib/logger.js';
import {
  ErrorCode,
  rateLimited,
  sendError,
  serviceUnavailable,
  singleParam,
} from './lib/shared.js';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_TECHNIQUES,
  communityRequiresDescription,
  isCommunityFeatureReason,
  parseCommunityLineage,
  validateCommunityPublish,
} from './lib/communityValidation.js';
import type { CommunityCategory, CommunityTechnique } from './lib/communityValidation.js';
import { deriveAuthorPublicId, generateCommunityDesignId } from './lib/communityIds.js';
import { resolveSupporterAuthors } from './lib/supporterLink.js';
import { checkCommunityPublishQuota } from './lib/communityQuota.js';
import {
  adjustRemixCredit,
  communityContentHash,
  communityMeshBlobPath,
  communityDesignContent,
  communityParamsFingerprint,
  communityThumbBlobPath,
  deleteCommunityDesignBlob,
  deriveAssemblyMetrics,
  deriveCommunityMetrics,
  isModeratedContent,
  readCommunityCards,
  readCommunityDesignBlob,
  removeFromCommunityIndexes,
  upsertCommunityIndexes,
  writeCommunityCard,
  writeCommunityDesignBlob,
} from './lib/communityStore.js';
import { communityPrintsEnabled } from './lib/communityPrintValidation.js';
import { COMMUNITY_EXAMPLE_PARAM_HASHES } from './lib/communityExampleParamHashes.js';
import type {
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
  communityParamsHashKey,
  communityPublishedKey,
  communityPublishLockKey,
} from './lib/redisKeys.js';
import type { CommunityIndexSort } from './lib/redisKeys.js';

type RedisClient = NonNullable<ReturnType<typeof getRedis>>;

const FIRST_REVISION = 1;
const LIST_PAGE_SIZE = 24;
const LIST_SCAN_BATCH = 48;
// Bounds per-request Redis work when filters match rarely; the client resumes
// the scan from nextCursor instead of one request walking the whole index.
const LIST_MAX_SCAN = 960;

/**
 * Upper bound on a windowed scan. Matches LIST_SCAN_BATCH so a window costs the
 * same single zrevrange the sequential mode's inner batch does.
 */
const LIST_MAX_WINDOW = 48;

const AUTHOR_PUBLIC_ID_REGEX = /^[a-f0-9]{32}$/;
const CURSOR_REGEX = /^\d{1,9}$/;

// Short per-user publish lock TTL: long enough to cover the check->write
// sequence of one publish, short enough that a crashed request self-heals.
const PUBLISH_LOCK_TTL_MS = 10_000;

function badRequest(res: VercelResponse, message: string): void {
  sendError(res, 400, ErrorCode.VALIDATION_ERROR, message);
}

type LineageResolveResult =
  | { ok: true; lineage: CommunityLineage | null; parentContent: Record<string, unknown> | null }
  | { ok: false; message: string };

/**
 * Lineage display fields and the root itself come from the stored parent
 * record, never the client: accepting client values would let a publisher
 * fabricate "remix of X by Y" or "originally by Z" credit for arbitrary real
 * authors. The parent must be live at publish time and its stored chain
 * dictates the root; a client rootId that disagrees is rejected. When the
 * chain's root is legitimately deleted, its snapshot survives via the parent
 * record.
 *
 * ACCEPTED RISK (A11, community-showcase-plan): the parent link carries no
 * proof-of-remix. Any live design can be claimed as a parent; only the credit
 * text is server-derived, so a spammer could inflate a victim's remix count.
 * This is bounded by the 10/day publish rate limit and the report path, and
 * further shrunk by the remix-must-differ rule (B4) and the exact-duplicate
 * guard (B3). We deliberately do not build proof-of-remix.
 */
async function resolveLineage(
  redis: RedisClient,
  lineage: CommunityLineage | null
): Promise<LineageResolveResult> {
  if (lineage === null) return { ok: true, lineage: null, parentContent: null };
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
    parentContent: communityDesignContent(parentRecord),
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
    if (value === contentHash) {
      // A8: never resurface a hidden/removed design as a 200 idempotency hit.
      // A moderated design keeping its content hash would otherwise let a
      // re-publish return the id of a design the gallery no longer shows.
      const status = await redis.hget(communityDesignKey(publishedIds[i]), 'status');
      if (status === 'live') return publishedIds[i];
    }
  }
  return null;
}

/**
 * B3 exact-duplicate guard. True when the sanitized params re-upload a built-in
 * example, or match a currently-live design published by a different author.
 * The author's own re-publish never reaches here (idempotency returns first).
 */
async function isExactDuplicate(
  redis: RedisClient,
  contentFingerprint: string,
  authorPublicId: string
): Promise<boolean> {
  if (COMMUNITY_EXAMPLE_PARAM_HASHES.has(contentFingerprint)) return true;
  const candidateId = await redis.get(communityParamsHashKey(contentFingerprint));
  if (candidateId === null || candidateId === '') return false;
  const [status, candidateAuthor] = await redis.hmget(
    communityDesignKey(candidateId),
    'status',
    'authorPublicId'
  );
  return status === 'live' && candidateAuthor !== null && candidateAuthor !== authorPublicId;
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

    // A9: serialize one user's overlapping publishes so the check->write
    // sequence cannot interleave into a duplicate mint or a quota overshoot.
    // The value is a unique token: if this publish outlives PUBLISH_LOCK_TTL_MS
    // and a second acquires the lock, our release must not delete the second
    // request's lock (fencing), so release is a compare-and-delete on the token.
    const lockKey = communityPublishLockKey(session.userId);
    const lockToken = randomUUID();
    const lockAcquired = await redis.set(lockKey, lockToken, 'PX', PUBLISH_LOCK_TTL_MS, 'NX');
    if (lockAcquired !== 'OK') {
      res.status(409).json({
        error: 'Another publish is already in progress. Try again in a moment.',
        code: 'PUBLISH_IN_PROGRESS',
      });
      return;
    }

    try {
      const contentFingerprint = communityParamsFingerprint(communityDesignContent(payload));
      const contentHash = communityContentHash({
        content: communityDesignContent(payload),
        name: payload.name,
        description: payload.description,
        category: payload.category,
        authorName: payload.authorName,
        lineage: lineageParse.lineage,
      });
      // Content taken down by moderation cannot come back, and that outranks
      // every check below including idempotency. The dedupe checks deliberately
      // only match LIVE designs, so a hidden original is invisible to them and
      // a re-post of the identical payload would otherwise mint a fresh design
      // with an empty reports set. The tombstone is keyed by content, so it
      // survives the design — and the whole account — being deleted. Neutral
      // 403, matching the deny-list response: the reply must not confirm that a
      // takedown happened.
      if (await isModeratedContent(redis, contentHash)) {
        sendError(res, 403, ErrorCode.UNAUTHORIZED, 'Publishing is not available for this design.');
        return;
      }

      // Idempotency runs before quota: a retry of an already-published design
      // must return its id even when the user sits at the live-design cap.
      const existingId = await findPublishedIdByContentHash(redis, session.userId, contentHash);
      if (existingId !== null) {
        res.status(200).json({ id: existingId, url: communityDesignUrl(existingId) });
        return;
      }

      // B3: reject a verbatim re-upload of a built-in example or of another
      // author's live design. The author's own re-publish returned above.
      if (await isExactDuplicate(redis, contentFingerprint, authorPublicId)) {
        res.status(409).json(DUPLICATE_DESIGN_RESPONSE);
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

      // B4: a remix must differ from its parent, or remix credit could be
      // farmed by re-uploading the parent unchanged.
      if (
        lineage !== null &&
        lineageResolve.parentContent !== null &&
        communityParamsFingerprint(lineageResolve.parentContent) === contentFingerprint
      ) {
        res.status(409).json(REMIX_UNCHANGED_RESPONSE);
        return;
      }

      const id = generateCommunityDesignId();
      const now = Date.now();
      const [thumbBlobs, meshBlob] = await Promise.all([
        Promise.all(
          payload.thumbnails.map((thumbnail, angle) =>
            put(
              communityThumbBlobPath(id, FIRST_REVISION, angle),
              Buffer.from(thumbnail, 'base64'),
              {
                access: 'public',
                contentType: 'image/webp',
                addRandomSuffix: false,
                allowOverwrite: false,
              }
            )
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
        ...(payload.kind === 'assembly'
          ? { kind: 'assembly' as const, envelope: payload.envelope, structure: payload.structure }
          : { params: payload.params }),
        metrics:
          payload.kind === 'assembly'
            ? deriveAssemblyMetrics(payload.envelope ?? {}, payload.heightUnits ?? 1)
            : deriveCommunityMetrics(payload.params ?? {}),
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
        await upsertCommunityIndexes(redis, id, {
          createdAt: now,
          remixes: 0,
          likes: 0,
          prints: 0,
        });
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
          logger.error(
            'Rollback failed: orphan community redis entries left after publish failure',
            {
              id,
              error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
            }
          );
        });
        throw writeErr;
      }

      // Post-commit bookkeeping: the design is already live, so these keep the
      // duplicate index and remix stats in sync best-effort. A failure here
      // must not fail an already-successful publish.
      await redis.set(communityParamsHashKey(contentFingerprint), id).catch((indexErr: unknown) => {
        logger.warn('Community publish: params-hash index write failed', {
          id,
          error: indexErr instanceof Error ? indexErr.message : String(indexErr),
        });
      });
      // A1: crediting the parent and root remix counts (and rescoring the
      // most-remixed index) is the counterpart of the delete-path decrement.
      if (lineage !== null) {
        await adjustRemixCredit(redis, lineage.parentId, lineage.rootId, 1).catch(
          (remixErr: unknown) => {
            logger.warn('Community publish: remix credit bump failed', {
              id,
              error: remixErr instanceof Error ? remixErr.message : String(remixErr),
            });
          }
        );
      }

      res.status(201).json({ id, url: communityDesignUrl(id) });
    } finally {
      // Compare-and-delete: only release the lock if we still hold it, so a
      // publish that overran the TTL cannot delete a newer publish's lock.
      await redis
        .eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          lockKey,
          lockToken
        )
        .catch(() => {
          // The lock self-heals via its PX TTL; a failed release is not fatal.
        });
    }
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
  /** 'assembly' for a Workshop holder; omitted for bin designs. */
  kind?: 'assembly';
  metrics: CommunityDesignMetrics;
  thumbnailUrl: string;
  isRemix: boolean;
  /** Direct-remix lineage pointer, '' for originals: powers the detail view's builds-on-this list. */
  parentId: string;
  featured: boolean;
  /** Curator's stated reason; omitted when unfeatured or picked before the field. */
  featureReason?: string;
  /** `opens`/`views` are owner-only stats, present only on `mine=1` items. */
  counts: {
    likes: number;
    remixes: number;
    exports: number;
    prints: number;
    opens?: number;
    views?: number;
  };
  createdAt: number;
  updatedAt: number;
  status: CommunityDesignStatus;
  /** Owner-only: why a hidden design is hidden. Present only on `mine=1` items with status 'hidden'. */
  hiddenReason?: CommunityHiddenReason;
}

function coverThumbnail(card: CommunityCardRecord): string {
  if (!communityPrintsEnabled()) return card.thumbnailUrl;
  // Prefer the browsing-sized copy of the cover: the grid renders ~200px
  // cells and a promoted photo is stored at 1200px. Falls back to the full
  // cover for one promoted before the copy existed, then to the render.
  const coverThumb = card.coverPhotoThumbUrl ?? '';
  if (coverThumb !== '') return coverThumb;
  const cover = card.coverPhotoUrl ?? '';
  return cover !== '' ? cover : card.thumbnailUrl;
}

function toListItem(card: CommunityCardRecord): CommunityListItem {
  return {
    id: card.id,
    name: card.name,
    authorName: card.authorName,
    authorPublicId: card.authorPublicId,
    category: card.category,
    techniques: card.techniques,
    ...(card.kind === 'assembly' && { kind: 'assembly' as const }),
    metrics: {
      width: card.width,
      depth: card.depth,
      height: card.height,
      gridUnitMm: card.gridUnitMm,
    },
    // A promoted print photo wins over the render: a shelf of real prints
    // reads as proven in a way a grid of renders cannot. Resolved at read
    // time so flipping the kill switch off also pulls every already promoted
    // photo back off the grid rather than stranding it there.
    thumbnailUrl: coverThumbnail(card),
    isRemix: card.isRemix,
    parentId: card.parentId,
    featured: card.featured,
    // Validated, not forwarded: the stored value is a free string, and a
    // reason retired from the union would otherwise reach a client that
    // indexes it straight into a label map.
    ...(card.featured &&
      card.featureReason !== undefined &&
      isCommunityFeatureReason(card.featureReason) && { featureReason: card.featureReason }),
    counts: {
      likes: card.likes,
      remixes: card.remixes,
      exports: card.exports,
      prints: card.prints ?? 0,
    },
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
  if (sort === 'prints' && (b.prints ?? 0) !== (a.prints ?? 0)) {
    return (b.prints ?? 0) - (a.prints ?? 0);
  }
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
  // A12: id is the final tiebreaker so tied timestamps produce a stable total
  // order across requests, preventing dup/skip at a page boundary.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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

/**
 * Author public ids on this page whose supporter badge is public.
 *
 * A sidecar array like `likedIds` rather than a field on each item: the answer
 * is per AUTHOR, not per design, so one publisher with six designs on a page
 * costs one entry instead of six, and `toListItem` stays a pure mapping.
 *
 * Resolved live rather than stamped on the card at publish time, so supporting
 * today badges designs published a year ago — and withdrawing the badge takes
 * effect everywhere at once.
 */
async function resolveSupporterAuthorIds(
  redis: RedisClient,
  items: CommunityListItem[]
): Promise<string[]> {
  if (items.length === 0) return [];
  const badged = await resolveSupporterAuthors(
    redis,
    items.map((item) => item.authorPublicId)
  );
  return [...badged];
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

/**
 * Scans exactly `window` slots of the index from `cursor` and returns whatever
 * is live in them, rather than collecting until a page is full.
 *
 * The distinction matters for concurrent callers. `cursor` is a raw offset into
 * the sorted set, and the sequential mode advances it per slot *scanned* while
 * stopping at LIST_PAGE_SIZE items *collected*, so a stretch containing hidden
 * or unreadable entries consumes more slots than it yields and the next
 * boundary cannot be predicted from the item count. Requesting fixed strides in
 * parallel against that would leave gaps — silently missing designs, which is
 * worse than the serial latency it saves. A fixed window is exact: disjoint
 * windows cover the set by construction, and a window with dead entries simply
 * returns short.
 */
async function listWindow(
  redis: RedisClient,
  filters: ListFilters,
  cursor: number,
  window: number
): Promise<ListPage> {
  const ids = await redis.zrevrange(communityIndexKey(filters.sort), cursor, cursor + window - 1);
  const cards = await readCommunityCards(redis, ids);
  const items = cards
    .filter(
      (card): card is CommunityCardRecord =>
        card !== null && card.status === 'live' && matchesFilters(card, filters)
    )
    .map(toListItem);
  // Short of the window means the index ended inside it.
  const nextCursor = ids.length < window ? null : String(cursor + ids.length);
  return { items, nextCursor };
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

    // Opt-in windowed mode, for a caller building the whole index concurrently.
    // Bounded like any other scan so it cannot be used to pull the set in one
    // request.
    const windowParam = singleParam(req.query.window);
    let window: number | null = null;
    if (windowParam !== undefined) {
      if (!CURSOR_REGEX.test(windowParam)) {
        badRequest(res, `window must be an integer between 1 and ${LIST_MAX_WINDOW}`);
        return;
      }
      window = Number(windowParam);
      if (window < 1 || window > LIST_MAX_WINDOW) {
        badRequest(res, `window must be an integer between 1 and ${LIST_MAX_WINDOW}`);
        return;
      }
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
      const supporterAuthorIds = await resolveSupporterAuthorIds(redis, page.items);
      res.status(200).json({ ...page, likedIds, supporterAuthorIds });
      return;
    }

    const page =
      window === null
        ? await listPublic(redis, filters, cursor)
        : await listWindow(redis, filters, cursor, window);
    const session = await readOptionalSession(req);
    const likedIds =
      session === null ? [] : await resolveLikedIds(redis, session.userId, page.items);
    const supporterAuthorIds = await resolveSupporterAuthorIds(redis, page.items);
    // Slots in the index, not designs that survive filtering: it tells a
    // concurrent caller how many windows to request, and cannot promise a
    // filtered count without scanning the whole set to produce it.
    const indexSlots = await redis.zcard(communityIndexKey(filters.sort));
    res.status(200).json({ ...page, likedIds, supporterAuthorIds, indexSlots });
  } catch (error) {
    logger.error('Community list error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to list designs');
  }
}

/**
 * The three server switches the client cannot otherwise observe. Without this
 * the publish dialog only learns publishing is off by POSTing a finished
 * design and reading a 503, which is the worst possible moment to find out.
 *
 * Rides the existing GET rather than taking its own file: each api/ module is
 * a separate deployed function, and this answer is three booleans.
 */
function handleCapabilities(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({
    publishEnabled: process.env.COMMUNITY_PUBLISH_ENABLED === 'true',
    printsEnabled: communityPrintsEnabled(),
    requireDescription: communityRequiresDescription(),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'POST'])) return;
  if (req.method === 'GET') {
    if (singleParam(req.query.capabilities) === '1') {
      handleCapabilities(res);
      return;
    }
    await handleList(req, res);
    return;
  }
  await handlePublish(req, res);
}

/** GET /api/community: the public, windowed and owner listings with their filters and sort. */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readOptionalSession, requireSession } from './session.js';
import { checkRateLimit, getClientIP, getRedis } from './rateLimit.js';
import { logger } from './logger.js';
import { ErrorCode, rateLimited, sendError, serviceUnavailable, singleParam } from './shared.js';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_TECHNIQUES,
  isCommunityFeatureReason,
} from './communityValidation.js';
import type { CommunityCategory, CommunityTechnique } from './communityValidation.js';
import { resolveSupporterAuthors } from './supporterLink.js';
import { readCommunityCards } from './communityStore.js';
import { communityPrintsEnabled } from './communityPrintValidation.js';
import type {
  CommunityCardRecord,
  CommunityDesignMetrics,
  CommunityDesignStatus,
  CommunityHiddenReason,
} from './communityStore.js';
import {
  COMMUNITY_INDEX_SORTS,
  communityIndexKey,
  communityLikedKey,
  communityPublishedKey,
} from './redisKeys.js';
import type { CommunityIndexSort } from './redisKeys.js';
import type { RedisClient } from './communityPublish.js';

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

function badRequest(res: VercelResponse, message: string): void {
  sendError(res, 400, ErrorCode.VALIDATION_ERROR, message);
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

export async function handleList(req: VercelRequest, res: VercelResponse): Promise<void> {
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

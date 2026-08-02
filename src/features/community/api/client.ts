import type { Result } from '@/core/result';
import { ok, err, isErr } from '@/core/result';
import { isApiErrorResponse } from '@/core/api/mapApiError';
import { apiFetch } from '@/core/sync/apiFetch';
import type { BinParams } from '@/shared/types/bin';
import type {
  CommunityCard,
  CommunityCategory,
  CommunityDesign,
  CommunityDesignCounts,
  CommunityDesignLineage,
  CommunityReportReason,
} from '@/shared/types/community';
import { COMMUNITY_CATEGORIES, COMMUNITY_REPORT_NOTE_MAX_LENGTH } from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';

const COMMUNITY_ENDPOINT = '/api/community';

/**
 * The browse engine holds the whole card index in memory for client-side
 * search/filter/sort; cap it at the 2,000 newest so a runaway library cannot
 * grow the fetch loop or the store unboundedly (plan §2.3). The cap state is
 * surfaced so the gallery can say "Showing the 2,000 newest designs".
 */
export const COMMUNITY_INDEX_CAP = 2000;

// Heavy in-memory filtering server-side can return near-empty pages with a
// non-null cursor; this bounds the loop if the index never yields the cap.
const INDEX_MAX_REQUESTS = 250;

/**
 * Community-specific error union instead of the generic ApiError: the publish
 * dialog branches on these (re-auth prompt, kill-switch notice, quota
 * deep-link, content-filter reword prompt), and mapApiErrorResponse collapses
 * 503 into a generic server error, losing the disabled signal.
 */
export type CommunityClientError =
  | { kind: 'needsAuth' }
  | { kind: 'disabled' }
  | { kind: 'rateLimited'; retryAfterSeconds: number | null }
  | { kind: 'quotaExceeded'; message: string }
  | { kind: 'contentBlocked'; message: string }
  | { kind: 'validation'; code: string; message: string }
  | { kind: 'forbidden'; message: string }
  | { kind: 'notFound' }
  | { kind: 'server' }
  | { kind: 'network' };

export interface CommunityPublishInput {
  name: string;
  description: string;
  authorName: string;
  category: CommunityCategory;
  params: BinParams;
  /** WebP data URLs or raw base64, 1-3 entries, each <= 200 KB decoded. */
  thumbnails: readonly string[];
  /** Raw base64 GLB, <= 2 MB decoded. */
  glb: string;
}

export interface CommunityPublishResult {
  id: string;
  url: string;
}

function errorFromResponse(status: number, data: unknown): CommunityClientError {
  const body = isApiErrorResponse(data) ? data : null;
  if (status === 401) return { kind: 'needsAuth' };
  if (status === 503) return { kind: 'disabled' };
  if (status === 429) {
    return { kind: 'rateLimited', retryAfterSeconds: body?.retryAfter ?? null };
  }
  if (status === 413) return { kind: 'quotaExceeded', message: body?.error ?? '' };
  if (status === 403) return { kind: 'forbidden', message: body?.error ?? '' };
  if (status === 404) return { kind: 'notFound' };
  if (status === 400 && body !== null) {
    if (body.code === 'CONTENT_BLOCKED') return { kind: 'contentBlocked', message: body.error };
    return { kind: 'validation', code: body.code, message: body.error };
  }
  return { kind: 'server' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPublishResult(value: unknown): value is CommunityPublishResult {
  return isRecord(value) && typeof value.id === 'string' && typeof value.url === 'string';
}

function isCommunityDesign(value: unknown): value is CommunityDesign {
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
    value.techniques.every(isKnownTechnique) &&
    isRecord(value.params) &&
    isRecord(value.metrics) &&
    (value.lineage === null || isRecord(value.lineage)) &&
    Array.isArray(value.thumbnails) &&
    typeof value.meshUrl === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.status === 'live' || value.status === 'hidden' || value.status === 'removed')
  );
}

function isDesignResponse(value: unknown): value is { design: CommunityDesign } {
  return isRecord(value) && isCommunityDesign(value.design);
}

export interface CommunityDesignDetail {
  design: CommunityDesign;
  /** Server-verified against the session's published set, never a client-sent id. */
  isOwner: boolean;
  /**
   * Card-hash counters shipped with the detail so the stats row works for
   * designs beyond the capped browse index; null when the server degraded
   * (no Redis) or predates the field.
   */
  counts: CommunityDesignCounts | null;
  likedByMe: boolean;
}

function isCountsShape(value: unknown): value is CommunityDesignCounts {
  return (
    isRecord(value) &&
    typeof value.likes === 'number' &&
    typeof value.remixes === 'number' &&
    typeof value.exports === 'number'
  );
}

function isDetailResponse(value: unknown): value is {
  design: CommunityDesign;
  isOwner?: boolean;
  counts?: unknown;
  likedByMe?: unknown;
} {
  return isDesignResponse(value) && (!('isOwner' in value) || typeof value.isOwner === 'boolean');
}

const KNOWN_TECHNIQUES: readonly string[] = Object.keys(TECHNIQUE_CONFIG);

function isKnownCategory(value: unknown): value is CommunityCategory {
  return typeof value === 'string' && (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

function isKnownTechnique(value: unknown): boolean {
  return typeof value === 'string' && KNOWN_TECHNIQUES.includes(value);
}

function isCommunityCard(value: unknown): value is CommunityCard {
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
    isRecord(counts) &&
    typeof counts.likes === 'number' &&
    typeof counts.remixes === 'number' &&
    typeof counts.exports === 'number' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    (value.status === 'live' || value.status === 'hidden' || value.status === 'removed')
  );
}

interface CommunityListPage {
  items: CommunityCard[];
  nextCursor: string | null;
  /** Ids on this page the session user has liked; empty for anonymous callers. */
  likedIds?: string[];
}

function isListPage(value: unknown): value is CommunityListPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isCommunityCard) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string') &&
    (value.likedIds === undefined ||
      (Array.isArray(value.likedIds) && value.likedIds.every((id) => typeof id === 'string')))
  );
}

function isDeleteResponse(value: unknown): value is { success: true } {
  return isRecord(value) && value.success === true;
}

async function communityFetch(input: string, init: RequestInit): Promise<Response> {
  // A community 401 is handled locally by the publish flow; the app-wide
  // forced sign-out event would clear the sync outbox and flip every tab
  // anonymous.
  return apiFetch(input, { ...init, suppressForcedSignOut: true });
}

export async function publishDesign(
  input: CommunityPublishInput,
  lineage: CommunityDesignLineage | null = null,
  signal?: AbortSignal
): Promise<Result<CommunityPublishResult, CommunityClientError>> {
  try {
    const response = await communityFetch(COMMUNITY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, lineage }),
      signal,
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isPublishResult(data)) return ok(data);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

export async function updateDesign(
  publishedId: string,
  input: CommunityPublishInput,
  signal?: AbortSignal
): Promise<Result<CommunityDesign, CommunityClientError>> {
  try {
    const response = await communityFetch(`${COMMUNITY_ENDPOINT}/${publishedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isDesignResponse(data)) return ok(data.design);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

export async function unpublishDesign(
  publishedId: string
): Promise<Result<{ success: true }, CommunityClientError>> {
  try {
    const response = await communityFetch(`${COMMUNITY_ENDPOINT}/${publishedId}`, {
      method: 'DELETE',
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isDeleteResponse(data)) return ok(data);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

export interface CommunityIndexResult {
  items: CommunityCard[];
  /** True when the index was truncated to the `COMMUNITY_INDEX_CAP` newest designs. */
  capped: boolean;
}

async function fetchCommunityPage(
  cursor: string | null,
  signal?: AbortSignal
): Promise<Result<CommunityListPage, CommunityClientError>> {
  try {
    const params = new URLSearchParams({ sort: 'newest' });
    if (cursor !== null) params.set('cursor', cursor);
    const response = await communityFetch(`${COMMUNITY_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      signal,
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isListPage(data)) return ok(data);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

/**
 * Fetches the complete public card index by transparently paging through
 * `GET /api/community` until the cursor is exhausted or `COMMUNITY_INDEX_CAP`
 * is reached. A short page with a non-null `nextCursor` is normal (the server
 * bounds each request's scan), so only `nextCursor === null` means done.
 *
 * Pages are deduped by id: the server cursor is a raw offset into a live
 * sorted set, so a publish landing between two page requests shifts every
 * offset and re-serves the boundary card on the next page.
 */
export async function fetchCommunityIndex(
  signal?: AbortSignal
): Promise<Result<CommunityIndexResult, CommunityClientError>> {
  const items: CommunityCard[] = [];
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  for (let request = 0; request < INDEX_MAX_REQUESTS; request++) {
    const page = await fetchCommunityPage(cursor, signal);
    if (isErr(page)) return page;
    const likedIds = new Set(page.value.likedIds ?? []);
    for (const card of page.value.items) {
      if (seenIds.has(card.id)) continue;
      seenIds.add(card.id);
      items.push({ ...card, likedByMe: likedIds.has(card.id) });
    }
    cursor = page.value.nextCursor;
    if (cursor === null) return ok({ items, capped: false });
    if (items.length >= COMMUNITY_INDEX_CAP) {
      return ok({ items: items.slice(0, COMMUNITY_INDEX_CAP), capped: true });
    }
  }
  // Exhausting the request budget below the cap is a server paging anomaly;
  // only claim the exact-cap truncation when the cap was actually reached.
  return ok({
    items: items.slice(0, COMMUNITY_INDEX_CAP),
    capped: items.length >= COMMUNITY_INDEX_CAP,
  });
}

export async function fetchCommunityDesign(
  id: string
): Promise<Result<CommunityDesignDetail, CommunityClientError>> {
  try {
    const response = await communityFetch(`${COMMUNITY_ENDPOINT}/${id}`, {
      method: 'GET',
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isDetailResponse(data)) {
      return ok({
        design: data.design,
        isOwner: data.isOwner === true,
        counts: isCountsShape(data.counts) ? data.counts : null,
        likedByMe: data.likedByMe === true,
      });
    }
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

export interface CommunityLikeResult {
  /** Authoritative post-toggle count, replacing the optimistic value. */
  likes: number;
  likedByMe: boolean;
}

function isLikeResult(value: unknown): value is CommunityLikeResult {
  return isRecord(value) && typeof value.likes === 'number' && typeof value.likedByMe === 'boolean';
}

export async function setDesignLiked(
  id: string,
  liked: boolean
): Promise<Result<CommunityLikeResult, CommunityClientError>> {
  try {
    const response = await communityFetch(`${COMMUNITY_ENDPOINT}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: liked ? 'like' : 'unlike' }),
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isLikeResult(data)) return ok(data);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

export async function reportDesign(
  id: string,
  reason: CommunityReportReason,
  note: string
): Promise<Result<{ success: true }, CommunityClientError>> {
  try {
    const trimmed = note.trim().slice(0, COMMUNITY_REPORT_NOTE_MAX_LENGTH);
    const response = await communityFetch(`${COMMUNITY_ENDPOINT}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'report',
        reason,
        ...(trimmed !== '' && { note: trimmed }),
      }),
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isDeleteResponse(data)) return ok({ success: true });
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

export async function fetchOwnDesign(
  publishedId: string
): Promise<Result<CommunityDesign, CommunityClientError>> {
  try {
    const response = await communityFetch(`${COMMUNITY_ENDPOINT}/${publishedId}`, {
      method: 'GET',
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isDesignResponse(data)) return ok(data.design);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

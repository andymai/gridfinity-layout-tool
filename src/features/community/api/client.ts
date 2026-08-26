import type { Result } from '@/core/result';
import { ok, err, isErr } from '@/core/result';
import { isApiErrorResponse } from '@/core/api/mapApiError';
import { apiFetch } from '@/core/sync/apiFetch';
import type { BinParams } from '@/shared/types/bin';
import type { ItemEnvelope } from '@/shared/types/item';
import type { AssemblyStructure } from '@/shared/types/assembly';
import type {
  CommunityCard,
  CommunityCategory,
  CommunityDesign,
  CommunityDesignCounts,
  CommunityDesignLineage,
  CommunityHiddenReason,
  CommunityReportReason,
} from '@/shared/types/community';
import type { CommunityFeatureReason } from '@/shared/types/community';
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_FEATURE_REASONS,
  COMMUNITY_REPORT_NOTE_MAX_LENGTH,
  COMMUNITY_REPORT_REASONS,
} from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { isRecord } from '@/shared/utils/isRecord';

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

/** Exactly one content shape per publish: bin params, or a Workshop
 *  assembly's envelope + structure (server validates, sanitizes, derives height). */
export type CommunityPublishContent =
  | { params: BinParams; kind?: undefined }
  | { kind: 'assembly'; envelope: ItemEnvelope; structure: AssemblyStructure; params?: undefined };

export type CommunityPublishInput = CommunityPublishContent & {
  name: string;
  description: string;
  authorName: string;
  category: CommunityCategory;
  /** WebP data URLs or raw base64, 1-3 entries, each <= 200 KB decoded. */
  thumbnails: readonly string[];
  /** Raw base64 GLB, <= 2 MB decoded. */
  glb: string;
};

export interface CommunityPublishResult {
  id: string;
  url: string;
}

/** Shared with `printsClient.ts` so both surfaces branch on one error union. */
export function errorFromResponse(status: number, data: unknown): CommunityClientError {
  const body = isApiErrorResponse(data) ? data : null;
  if (status === 401) return { kind: 'needsAuth' };
  if (status === 503) return { kind: 'disabled' };
  if (status === 429) {
    return { kind: 'rateLimited', retryAfterSeconds: body?.retryAfter ?? null };
  }
  if (status === 413) return { kind: 'quotaExceeded', message: body?.error ?? '' };
  if (status === 403) return { kind: 'forbidden', message: body?.error ?? '' };
  if (status === 404) return { kind: 'notFound' };
  // 400 for validation, 409 for conflict-class rejections (duplicate, unchanged
  // remix, publish-in-progress). Both carry a code the dialog turns into a real
  // message, so route them through the same validation channel.
  if ((status === 400 || status === 409) && body !== null) {
    if (body.code === 'CONTENT_BLOCKED') return { kind: 'contentBlocked', message: body.error };
    return { kind: 'validation', code: body.code, message: body.error };
  }
  return { kind: 'server' };
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
   * (no Redis) or predates the field. Includes the owner-only opens/views
   * fields when the caller owns the design.
   */
  counts: CommunityDesignCounts | null;
  likedByMe: boolean;
  /** Whether the design's author is a badged Ko-fi supporter. */
  authorIsSupporter: boolean;
  /**
   * Owner-only, non-null only when the caller owns the design and it is
   * hidden; null reads as a report auto-hide (the pre-field default).
   */
  hiddenReason: CommunityHiddenReason | null;
  /** Dominant reported reason category; owner-only, null when nothing was tallied. */
  hiddenReasonCategory: CommunityReportReason | null;
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

function isCountsShape(value: unknown): value is CommunityDesignCounts {
  return (
    isRecord(value) &&
    typeof value.likes === 'number' &&
    typeof value.remixes === 'number' &&
    typeof value.exports === 'number' &&
    isOptionalNumber(value.opens) &&
    isOptionalNumber(value.views)
  );
}

function parseHiddenReason(value: unknown): CommunityHiddenReason | null {
  return value === 'reports' || value === 'denylist' || value === 'moderation' ? value : null;
}

function parseReportReason(value: unknown): CommunityReportReason | null {
  return typeof value === 'string' &&
    (COMMUNITY_REPORT_REASONS as readonly string[]).includes(value)
    ? (value as CommunityReportReason)
    : null;
}

function isDetailResponse(value: unknown): value is {
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

function isKnownCategory(value: unknown): value is CommunityCategory {
  return typeof value === 'string' && (COMMUNITY_CATEGORIES as readonly string[]).includes(value);
}

function isKnownTechnique(value: unknown): boolean {
  return typeof value === 'string' && KNOWN_TECHNIQUES.includes(value);
}

function isKnownFeatureReason(value: unknown): value is CommunityFeatureReason {
  return (
    typeof value === 'string' && (COMMUNITY_FEATURE_REASONS as readonly string[]).includes(value)
  );
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

interface CommunityListPage {
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

/** Seed the per-card supporter flag from a page's author-keyed sidecar. */
function supporterAuthorSet(page: CommunityListPage): Set<string> {
  return new Set(page.supporterAuthorIds ?? []);
}

function isListPage(value: unknown): value is CommunityListPage {
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

function isDeleteResponse(value: unknown): value is { success: true } {
  return isRecord(value) && value.success === true;
}

export async function communityFetch(input: string, init: RequestInit): Promise<Response> {
  // A community 401 is handled locally by the publish flow; the app-wide
  // forced sign-out event would clear the sync outbox and flip every tab
  // anonymous.
  return apiFetch(input, { ...init, suppressForcedSignOut: true });
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

function isCapabilities(value: unknown): value is CommunityCapabilities {
  return (
    isRecord(value) &&
    typeof value.publishEnabled === 'boolean' &&
    typeof value.printsEnabled === 'boolean' &&
    typeof value.requireDescription === 'boolean'
  );
}

/**
 * Probed before the publish form renders, so a disabled deployment is stated
 * up front instead of after a completed form is POSTed.
 */
export async function fetchCommunityCapabilities(
  signal?: AbortSignal
): Promise<Result<CommunityCapabilities, CommunityClientError>> {
  try {
    const response = await communityFetch(`${COMMUNITY_ENDPOINT}?capabilities=1`, {
      method: 'GET',
      signal,
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isCapabilities(data)) return ok(data);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
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
  signal?: AbortSignal,
  mine = false,
  window?: number
): Promise<Result<CommunityListPage, CommunityClientError>> {
  try {
    const params = new URLSearchParams({ sort: 'newest' });
    if (mine) params.set('mine', '1');
    if (cursor !== null) params.set('cursor', cursor);
    if (window !== undefined) params.set('window', String(window));
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
/**
 * The slot count, or null when the server did not send a usable one.
 *
 * Integer-checked rather than typeof-checked: NaN is a number, and it would
 * make the planner's `offset < slots` false on the first comparison, leaving
 * the entire remainder of the index unrequested — a silently short gallery,
 * which is the exact failure the windowing exists to avoid.
 */
function readIndexSlots(page: CommunityListPage): number | null {
  const slots = page.indexSlots;
  return typeof slots === 'number' && Number.isInteger(slots) && slots >= 0 ? slots : null;
}

/** Slots per windowed request; must not exceed the server's LIST_MAX_WINDOW. */
const INDEX_WINDOW = 48;

/** Concurrent windows in flight. Enough to collapse the wait without burying the API in a burst. */
const INDEX_CONCURRENCY = 6;

/**
 * Fetches the whole index as concurrent windows once the first response says
 * how many slots there are.
 *
 * Windows rather than page cursors: the cursor is a raw offset into the index
 * and the sequential mode advances it per slot *scanned* while stopping at a
 * full *page*, so a stretch holding hidden entries consumes more slots than it
 * yields and the next boundary cannot be predicted. Striding blind would leave
 * gaps, and a silently short gallery is worse than a slow one. Disjoint windows
 * cover the index by construction.
 *
 * Falls back to the sequential walk when the server does not report its slot
 * count, so a client ahead of a deployment still loads.
 */
async function fetchIndexWindows(
  first: CommunityListPage,
  slots: number,
  signal?: AbortSignal
): Promise<Result<CommunityIndexResult, CommunityClientError>> {
  const pages: CommunityListPage[] = [first];
  const offsets: number[] = [];
  const start = Number(first.nextCursor);
  if (!Number.isFinite(start)) return ok({ items: [...first.items], capped: false });
  for (let offset = start; offset < slots; offset += INDEX_WINDOW) offsets.push(offset);

  for (let i = 0; i < offsets.length; i += INDEX_CONCURRENCY) {
    const batch = offsets.slice(i, i + INDEX_CONCURRENCY);
    const results = await Promise.all(
      batch.map((offset) => fetchCommunityPage(String(offset), signal, false, INDEX_WINDOW))
    );
    for (const result of results) {
      if (isErr(result)) return result;
      pages.push(result.value);
    }
    // Windows are ordered, so the cap is reachable before every batch lands.
    if (pages.reduce((n, page) => n + page.items.length, 0) >= COMMUNITY_INDEX_CAP) break;
  }

  const items: CommunityCard[] = [];
  const seenIds = new Set<string>();
  for (const page of pages) {
    const likedIds = new Set(page.likedIds ?? []);
    const supporters = supporterAuthorSet(page);
    for (const card of page.items) {
      if (seenIds.has(card.id)) continue;
      seenIds.add(card.id);
      items.push({
        ...card,
        likedByMe: likedIds.has(card.id),
        authorIsSupporter: supporters.has(card.authorPublicId),
      });
    }
  }
  return ok({
    items: items.slice(0, COMMUNITY_INDEX_CAP),
    capped: items.length > COMMUNITY_INDEX_CAP || slots > COMMUNITY_INDEX_CAP,
  });
}

export async function fetchCommunityIndex(
  signal?: AbortSignal
): Promise<Result<CommunityIndexResult, CommunityClientError>> {
  const items: CommunityCard[] = [];
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  for (let request = 0; request < INDEX_MAX_REQUESTS; request++) {
    const page = await fetchCommunityPage(cursor, signal);
    if (isErr(page)) return page;

    // The first response reports how many slots the index has, which is what
    // makes the rest requestable at once. Its own cursor is the offset to
    // start those windows from, so nothing is fetched twice.
    if (request === 0 && page.value.nextCursor !== null) {
      const slots = readIndexSlots(page.value);
      if (slots !== null) return fetchIndexWindows(page.value, slots, signal);
    }

    const likedIds = new Set(page.value.likedIds ?? []);
    const supporters = supporterAuthorSet(page.value);
    for (const card of page.value.items) {
      if (seenIds.has(card.id)) continue;
      seenIds.add(card.id);
      items.push({
        ...card,
        likedByMe: likedIds.has(card.id),
        authorIsSupporter: supporters.has(card.authorPublicId),
      });
    }
    cursor = page.value.nextCursor;
    if (items.length >= COMMUNITY_INDEX_CAP) {
      // A non-null cursor here means the server may still have more beyond
      // the cap, so treat it as truncated; a null cursor confirms the index
      // ended exactly at the cap with nothing left to cut.
      const capped = items.length > COMMUNITY_INDEX_CAP || cursor !== null;
      return ok({ items: items.slice(0, COMMUNITY_INDEX_CAP), capped });
    }
    if (cursor === null) return ok({ items, capped: false });
  }
  // Exhausting the request budget below the cap is a server paging anomaly;
  // only claim the exact-cap truncation when the cap was actually reached.
  return ok({
    items: items.slice(0, COMMUNITY_INDEX_CAP),
    capped: items.length >= COMMUNITY_INDEX_CAP,
  });
}

/**
 * Fetches the session user's own published designs via `mine=1`, which is the
 * only list that includes the caller's hidden designs (removed ones are
 * excluded server-side). Requires an authenticated session (401 → needsAuth).
 * Same paging/dedupe contract as `fetchCommunityIndex`; the cap is a
 * defensive bound only, since one user's set is quota-limited far below it.
 */
export async function fetchMineIndex(
  signal?: AbortSignal
): Promise<Result<CommunityIndexResult, CommunityClientError>> {
  const items: CommunityCard[] = [];
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  for (let request = 0; request < INDEX_MAX_REQUESTS; request++) {
    const page = await fetchCommunityPage(cursor, signal, true);
    if (isErr(page)) return page;
    const likedIds = new Set(page.value.likedIds ?? []);
    const supporters = supporterAuthorSet(page.value);
    for (const card of page.value.items) {
      if (seenIds.has(card.id)) continue;
      seenIds.add(card.id);
      items.push({
        ...card,
        likedByMe: likedIds.has(card.id),
        authorIsSupporter: supporters.has(card.authorPublicId),
      });
    }
    cursor = page.value.nextCursor;
    if (cursor === null || items.length >= COMMUNITY_INDEX_CAP) break;
  }
  return ok({ items: items.slice(0, COMMUNITY_INDEX_CAP), capped: false });
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
        authorIsSupporter: data.authorIsSupporter === true,
        hiddenReason: parseHiddenReason(data.hiddenReason),
        hiddenReasonCategory: parseReportReason(data.hiddenReasonCategory),
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

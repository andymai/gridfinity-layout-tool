/**
 * Result-typed client for `/api/community/prints`.
 *
 * Shares `CommunityClientError` with the design client so the print dialog can
 * branch on the same union (re-auth prompt, kill-switch notice, content-filter
 * reword) without a second error vocabulary.
 */

import type { Result } from '@/core/result';
import { err, ok } from '@/core/result';
import type {
  CommunityPrint,
  CommunityPrintFitVerdict,
  CommunityPrintMaterial,
  CommunityPrintSummary,
} from '@/shared/types/communityPrint';
import type { CommunityReportReason } from '@/shared/types/community';
import type { CommunityClientError } from './client';
import { communityFetch, errorFromResponse } from './client';
import { isRecord } from '@/shared/utils/isRecord';

const PRINTS_ENDPOINT = '/api/community/prints';

export interface CommunityPrintInput {
  authorName: string;
  /** Every setting is optional; omit rather than null what the reporter left blank. */
  material?: CommunityPrintMaterial;
  nozzleMm?: number;
  layerHeightMm?: number;
  printMinutes?: number;
  filamentGrams: number | null;
  printer?: string;
  printerOther?: string;
  fitVerdict: CommunityPrintFitVerdict;
  note: string;
  /**
   * Ordered desired photo set. A `data:image/webp;base64,...` entry is a new
   * upload; an `https://` entry keeps a photo the record already has. Mixing
   * them is how an edit adds a photo without re-uploading the others.
   *
   * The object form attaches a browsing-sized copy to the upload it belongs
   * to. It rides the entry rather than a second array so the two cannot fall
   * out of order when the server splices fresh uploads between kept slots.
   */
  photos: readonly (string | { photo: string; thumb: string | null })[];
}

export interface CommunityPrintPage {
  items: readonly CommunityPrint[];
  nextCursor: string | null;
  /** Present on the first page only; describes the whole set, not the page. */
  summary: CommunityPrintSummary | null;
  /** The caller's own print, travelling even when it is not on this page. */
  mine: CommunityPrint | null;
  /**
   * Author public ids on this page whose supporter badge is public. Keyed by
   * author, so a printer with several reports costs one entry. Absent on an
   * older deployment, which reads as nobody badged.
   */
  supporterAuthorIds?: readonly string[];
}

export interface CommunityPrintWriteResult {
  print: CommunityPrint;
  /** Distinct printers after the write, so callers can update a card without refetching. */
  count: number;
}

function isPrint(value: unknown): value is CommunityPrint {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.designId === 'string' &&
    typeof value.authorPublicId === 'string' &&
    Array.isArray(value.photos) &&
    isRecord(value.settings) &&
    typeof value.fitVerdict === 'string'
  );
}

function isPrintPage(value: unknown): value is CommunityPrintPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isPrint) &&
    (value.nextCursor === null || typeof value.nextCursor === 'string') &&
    (value.summary === null || isRecord(value.summary)) &&
    (value.mine === null || isPrint(value.mine)) &&
    (value.supporterAuthorIds === undefined ||
      (Array.isArray(value.supporterAuthorIds) &&
        value.supporterAuthorIds.every((id) => typeof id === 'string')))
  );
}

function isWriteResult(value: unknown): value is CommunityPrintWriteResult {
  return isRecord(value) && isPrint(value.print) && typeof value.count === 'number';
}

export async function fetchPrints(
  designId: string,
  cursor: string | null = null,
  signal?: AbortSignal
): Promise<Result<CommunityPrintPage, CommunityClientError>> {
  try {
    const query = new URLSearchParams({ design: designId });
    if (cursor !== null) query.set('cursor', cursor);
    const response = await communityFetch(`${PRINTS_ENDPOINT}?${query.toString()}`, {
      method: 'GET',
      signal,
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isPrintPage(data)) return ok(data);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

/** Creates or replaces the caller's own print; the server decides which. */
export async function savePrint(
  designId: string,
  input: CommunityPrintInput,
  signal?: AbortSignal
): Promise<Result<CommunityPrintWriteResult, CommunityClientError>> {
  try {
    const response = await communityFetch(
      `${PRINTS_ENDPOINT}?design=${encodeURIComponent(designId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal,
      }
    );
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isWriteResult(data)) return ok(data);
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

export async function deletePrint(
  designId: string,
  signal?: AbortSignal
): Promise<Result<{ count: number }, CommunityClientError>> {
  try {
    const response = await communityFetch(
      `${PRINTS_ENDPOINT}?design=${encodeURIComponent(designId)}`,
      { method: 'DELETE', signal }
    );
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isRecord(data) && typeof data.count === 'number') return ok({ count: data.count });
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

export async function reportPrint(
  designId: string,
  printerPublicId: string,
  reason: CommunityReportReason,
  note: string,
  signal?: AbortSignal
): Promise<Result<{ hidden: boolean }, CommunityClientError>> {
  try {
    const response = await communityFetch(
      `${PRINTS_ENDPOINT}?design=${encodeURIComponent(designId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'report', printer: printerPublicId, reason, note }),
        signal,
      }
    );
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isRecord(data) && typeof data.hidden === 'boolean') return ok({ hidden: data.hidden });
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

/**
 * Owner opt-in: promote one of a design's print photos to its card, or pass
 * null to fall back to the render. The server re-verifies that the URL belongs
 * to a live print of that design.
 */
export async function setCoverPhoto(
  designId: string,
  photoUrl: string | null,
  signal?: AbortSignal
): Promise<Result<{ coverPhotoUrl: string }, CommunityClientError>> {
  try {
    const response = await communityFetch(`/api/community/${encodeURIComponent(designId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setCover', photoUrl }),
      signal,
    });
    const data: unknown = await response.json();
    if (!response.ok) return err(errorFromResponse(response.status, data));
    if (isRecord(data) && typeof data.coverPhotoUrl === 'string') {
      return ok({ coverPhotoUrl: data.coverPhotoUrl });
    }
    return err({ kind: 'server' });
  } catch {
    return err({ kind: 'network' });
  }
}

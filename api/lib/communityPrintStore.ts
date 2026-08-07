/**
 * Storage helpers for community print reports.
 *
 * Unlike designs, a print has no blob half: the whole record is small and
 * bounded (enum settings, a 200-char note, at most four photo URLs), so it
 * lives entirely in one Redis hash. The per-design ZSET provides both ordering
 * and the distinct-printer count, and the card hash carries a mirrored `prints`
 * counter so the gallery list index can show "printed by N" without reading
 * every print.
 */

import { createHash } from 'node:crypto';
import type { ChainableCommander, Redis } from 'ioredis';
import {
  communityDesignKey,
  communityPrintKey,
  communityPrintedKey,
  communityPrintsIndexKey,
  communityPrintsKey,
} from './redisKeys.js';
import type {
  CommunityPrintFitVerdict,
  CommunityPrintMaterial,
} from './communityPrintValidation.js';
import {
  COMMUNITY_PRINT_FIT_VERDICTS,
  COMMUNITY_PRINT_MATERIALS,
} from './communityPrintValidation.js';
import { readCommunityDesignBlob, writeCommunityDesignBlob } from './communityStore.js';
import { logger } from './logger.js';

/** Mirrors CommunityPrintStatus in `src/shared/types/communityPrint.ts`. */
export type CommunityPrintStatus = 'live' | 'hidden' | 'removed';

export interface CommunityPrintRecord {
  designId: string;
  authorPublicId: string;
  authorName: string;
  photos: string[];
  material: CommunityPrintMaterial;
  nozzleMm: number;
  layerHeightMm: number;
  printMinutes: number;
  /** null when the printer did not report it; excluded from the median. */
  filamentGrams: number | null;
  printer: string;
  /** '' unless `printer` is 'other'. */
  printerOther: string;
  fitVerdict: CommunityPrintFitVerdict;
  note: string;
  /** Bumped on every edit that uploads photos, so replaced photos get fresh immutable URLs. */
  rev: number;
  createdAt: number;
  updatedAt: number;
  status: CommunityPrintStatus;
}

/**
 * Print photo paths carry the same salted segment as design assets and for the
 * same reason: blobs are world-readable and the store hostname leaks through
 * every thumbnail URL, so a path derivable from public ids alone would let
 * anyone fetch a hidden print's photos directly, bypassing the API's
 * moderation 404.
 */
function printPathSecret(designId: string, authorPublicId: string): string {
  const salt = process.env.TOKEN_SALT;
  if (!salt) {
    throw new Error('TOKEN_SALT is required to derive community print blob paths');
  }
  return createHash('sha256')
    .update(`${salt}:community-print:${designId}:${authorPublicId}`)
    .digest('hex')
    .slice(0, 16);
}

export function communityPrintPhotoBlobPath(
  designId: string,
  authorPublicId: string,
  rev: number,
  index: number
): string {
  const secret = printPathSecret(designId, authorPublicId);
  return `community/prints/${designId}-${authorPublicId}-${secret}-${rev}-${index}.webp`;
}

function isMaterial(value: string): value is CommunityPrintMaterial {
  return (COMMUNITY_PRINT_MATERIALS as readonly string[]).includes(value);
}

function isFitVerdict(value: string): value is CommunityPrintFitVerdict {
  return (COMMUNITY_PRINT_FIT_VERDICTS as readonly string[]).includes(value);
}

function parsePrint(fields: Record<string, string | undefined>): CommunityPrintRecord | null {
  if (fields.designId === undefined || fields.authorPublicId === undefined) return null;
  const status = fields.status;
  if (status !== 'live' && status !== 'hidden' && status !== 'removed') return null;
  const material = fields.material ?? '';
  const fitVerdict = fields.fitVerdict ?? '';
  // A record whose enum fields no longer parse is malformed rather than
  // defaultable: silently coercing it to 'pla'/'as-designed' would feed a
  // fabricated value into the aggregate summary.
  if (!isMaterial(material) || !isFitVerdict(fitVerdict)) return null;
  let photos: string[] = [];
  try {
    const parsed: unknown = JSON.parse(fields.photos ?? '[]');
    if (Array.isArray(parsed))
      photos = parsed.filter((url): url is string => typeof url === 'string');
  } catch {
    photos = [];
  }
  const filamentGrams = fields.filamentGrams;
  return {
    designId: fields.designId,
    authorPublicId: fields.authorPublicId,
    authorName: fields.authorName ?? '',
    photos,
    material,
    nozzleMm: Number(fields.nozzleMm ?? 0),
    layerHeightMm: Number(fields.layerHeightMm ?? 0),
    printMinutes: Number(fields.printMinutes ?? 0),
    filamentGrams:
      filamentGrams === undefined || filamentGrams === '' ? null : Number(filamentGrams),
    printer: fields.printer ?? '',
    printerOther: fields.printerOther ?? '',
    fitVerdict,
    note: fields.note ?? '',
    rev: Number(fields.rev ?? 1),
    createdAt: Number(fields.createdAt ?? 0),
    updatedAt: Number(fields.updatedAt ?? 0),
    status,
  };
}

export async function writeCommunityPrint(
  redis: Redis,
  record: CommunityPrintRecord
): Promise<void> {
  await redis.hset(communityPrintKey(record.designId, record.authorPublicId), {
    designId: record.designId,
    authorPublicId: record.authorPublicId,
    authorName: record.authorName,
    photos: JSON.stringify(record.photos),
    material: record.material,
    nozzleMm: String(record.nozzleMm),
    layerHeightMm: String(record.layerHeightMm),
    printMinutes: String(record.printMinutes),
    filamentGrams: record.filamentGrams === null ? '' : String(record.filamentGrams),
    printer: record.printer,
    printerOther: record.printerOther,
    fitVerdict: record.fitVerdict,
    note: record.note,
    rev: String(record.rev),
    createdAt: String(record.createdAt),
    updatedAt: String(record.updatedAt),
    status: record.status,
  });
}

export async function readCommunityPrint(
  redis: Redis,
  designId: string,
  authorPublicId: string
): Promise<CommunityPrintRecord | null> {
  const fields = await redis.hgetall(communityPrintKey(designId, authorPublicId));
  if (Object.keys(fields).length === 0) return null;
  return parsePrint(fields);
}

/**
 * Pipelined HGETALL for a page of printers. Positional like `readCommunityCards`:
 * a missing or malformed hash yields null at its index rather than shifting the
 * page, so the caller's ordering from the ZSET is preserved.
 */
export async function readCommunityPrints(
  redis: Redis,
  designId: string,
  authorPublicIds: readonly string[]
): Promise<(CommunityPrintRecord | null)[]> {
  if (authorPublicIds.length === 0) return [];
  const pipeline = redis.pipeline();
  for (const authorPublicId of authorPublicIds) {
    pipeline.hgetall(communityPrintKey(designId, authorPublicId));
  }
  const results = await pipeline.exec();
  if (results === null) {
    throw new Error('Community print read failed: redis connection lost');
  }
  return results.map(([error, value]) => {
    if (error || typeof value !== 'object' || value === null) return null;
    return parsePrint(value as Record<string, string | undefined>);
  });
}

/** Newest first, matching the design list's default ordering. */
export async function listCommunityPrinterIds(
  redis: Redis,
  designId: string,
  offset: number,
  limit: number
): Promise<string[]> {
  return redis.zrevrange(communityPrintsKey(designId), offset, offset + limit - 1);
}

export async function countCommunityPrints(redis: Redis, designId: string): Promise<number> {
  return redis.zcard(communityPrintsKey(designId));
}

async function execPrintPipeline(pipeline: ChainableCommander, context: string): Promise<void> {
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

/**
 * Re-derive the design's print count from the ZSET and mirror it onto the card
 * hash and the prints sort index.
 *
 * Recomputed from ZCARD rather than incremented, so an edit (which must not
 * change the count), a retried delete, or a moderation hide all converge on the
 * truth instead of drifting the way a counter would.
 *
 * The index ZADD uses XX (update-score-only, never add), mirroring the like
 * toggle: a print on a design that moderation already dropped from the indexes
 * must not resurrect it into the gallery.
 */
export async function syncCommunityPrintCount(redis: Redis, designId: string): Promise<number> {
  const count = await redis.zcard(communityPrintsKey(designId));
  const pipeline = redis.pipeline();
  pipeline.hset(communityDesignKey(designId), { prints: String(count) });
  pipeline.zadd(communityPrintsIndexKey(), 'XX', count, designId);
  await execPrintPipeline(pipeline, 'Community print count sync failed');
  return count;
}

/**
 * Remove one print entirely: hash, per-design ZSET membership, and the
 * printer's reverse index. The caller owns blob cleanup and the count sync,
 * because a delete triggered by moderation keeps different bookkeeping from an
 * owner delete.
 */
export async function deleteCommunityPrint(
  redis: Redis,
  designId: string,
  authorPublicId: string,
  userId: string
): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.del(communityPrintKey(designId, authorPublicId));
  pipeline.zrem(communityPrintsKey(designId), authorPublicId);
  pipeline.srem(communityPrintedKey(userId), designId);
  await execPrintPipeline(pipeline, 'Community print delete failed');
}

export interface CommunityPrintSummary {
  count: number;
  asDesigned: number;
  adjusted: number;
  didNotFit: number;
  commonMaterial: CommunityPrintMaterial | null;
  commonLayerHeightMm: number | null;
  medianPrintMinutes: number | null;
  medianFilamentGrams: number | null;
}

function modeOf<T>(values: readonly T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  let best: T = values[0];
  let bestCount = 0;
  for (const value of values) {
    const next = (counts.get(value) ?? 0) + 1;
    counts.set(value, next);
    // Strict > keeps the first-seen value on a tie, which for a list ordered
    // newest-first means the tiebreak favours the most recent practice.
    if (next > bestCount) {
      best = value;
      bestCount = next;
    }
  }
  return best;
}

function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Rollup shown above the print list.
 *
 * Modes and medians rather than means throughout: one printer reporting a
 * 40-hour job (they printed twelve at once) would drag an average print time
 * into uselessness, while the median still answers "what should I expect".
 */
export function summarizeCommunityPrints(
  prints: readonly CommunityPrintRecord[]
): CommunityPrintSummary {
  const live = prints.filter((print) => print.status === 'live');
  return {
    count: live.length,
    asDesigned: live.filter((print) => print.fitVerdict === 'as-designed').length,
    adjusted: live.filter((print) => print.fitVerdict === 'adjusted').length,
    didNotFit: live.filter((print) => print.fitVerdict === 'did-not-fit').length,
    commonMaterial: modeOf(live.map((print) => print.material)),
    commonLayerHeightMm: modeOf(live.map((print) => print.layerHeightMm)),
    medianPrintMinutes: medianOf(live.map((print) => print.printMinutes)),
    medianFilamentGrams: medianOf(
      live
        .map((print) => print.filamentGrams)
        .filter((grams): grams is number => grams !== null && Number.isFinite(grams))
    ),
  };
}

/**
 * Drop the design's promoted cover when it came from a print that is no longer
 * publicly visible.
 *
 * Without this, hiding a print leaves its photo on the design's card: the most
 * public surface in the app would keep showing an image moderation just took
 * down, which defeats the report path entirely. The account-deletion cascade
 * needs the same guarantee for a deleted user's photos, which is why this lives
 * here rather than beside the one handler that used to own it.
 */
export async function clearCommunityCoverIfFromPhotos(
  redis: Redis,
  designId: string,
  photos: readonly string[]
): Promise<void> {
  if (photos.length === 0) return;
  const cover = await redis.hget(communityDesignKey(designId), 'coverPhotoUrl');
  if (cover === null || cover === '' || !photos.includes(cover)) return;
  await redis.hset(communityDesignKey(designId), { coverPhotoUrl: '' });
  const record = await readCommunityDesignBlob(designId);
  if (record !== null) {
    await writeCommunityDesignBlob(
      { ...record, coverPhotoUrl: '' },
      { allowOverwrite: true }
    ).catch((err: unknown) => {
      logger.warn('Community cover: clear-on-moderation blob mirror failed', {
        designId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

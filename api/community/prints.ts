/**
 * Community print reports: `/api/community/prints?design=<id>`.
 *
 * GET    list a design's prints (public) plus the derived summary
 * PUT    create or replace the caller's own print for that design
 * DELETE remove the caller's own print
 * POST   { action: 'report' } flag someone else's print
 *
 * Kept out of `[id].ts` deliberately: that handler is already the design's
 * whole lifecycle, and prints have their own storage, moderation bookkeeping
 * and blob pipeline.
 */

import { del, put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import { readSessionCookie } from '../lib/cookies.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { readSession, requireSession } from '../lib/session.js';
import type { SessionRecord } from '../lib/session.js';
import { REPORT_THRESHOLD } from '../lib/contentFilter.js';
import {
  ErrorCode,
  methodNotAllowed,
  rateLimited,
  sendError,
  serviceUnavailable,
  singleParam,
} from '../lib/shared.js';
import { isObject, isString } from '../lib/validationUtils.js';
import { deriveAuthorPublicId } from '../lib/communityIds.js';
import { resolveSupporterAuthors } from '../lib/supporterLink.js';
import {
  communityDenylistKey,
  communityDesignKey,
  communityPrintKey,
  communityPrintReportedKey,
  communityPrintReportsKey,
  communityPrintedKey,
  communityPrintsKey,
} from '../lib/redisKeys.js';
import { parseReportBody } from '../lib/communityValidation.js';
import {
  communityPrintsEnabled,
  hasPrintSubstance,
  validateCommunityPrint,
} from '../lib/communityPrintValidation.js';
import {
  clearCommunityCoverIfFromPhotos,
  communityPrintPhotoBlobPath,
  communityPrintThumbBlobPath,
  countCommunityPrints,
  deleteCommunityPrint,
  listCommunityPrinterIds,
  readCommunityPrint,
  readCommunityPrints,
  summarizeCommunityPrints,
  syncCommunityPrintCount,
  writeCommunityPrint,
} from '../lib/communityPrintStore.js';
import type { CommunityPrintRecord, CommunityPrintStatus } from '../lib/communityPrintStore.js';

const COMMUNITY_DESIGN_ID_REGEX = /^[a-zA-Z0-9]{12}$/;
const AUTHOR_PUBLIC_ID_REGEX = /^[a-f0-9]{32}$/;
const CURSOR_REGEX = /^\d{1,9}$/;

const PRINT_PAGE_SIZE = 24;

/**
 * Prints sampled for the summary. A design with more than this many reports
 * has a stable enough mode/median from its most recent 200 that reading every
 * record on each detail open would buy accuracy nobody can perceive.
 */
const SUMMARY_SAMPLE_SIZE = 200;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!communityPrintsEnabled()) {
    serviceUnavailable(res, 'Print reports are not available.');
    return;
  }

  const designId = singleParam(req.query.design);
  if (designId === undefined || !COMMUNITY_DESIGN_ID_REGEX.test(designId)) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid design ID');
    return;
  }

  try {
    switch (req.method) {
      case 'OPTIONS':
        res.status(200).end();
        return;
      case 'GET':
        await handleList(req, res, designId);
        return;
      case 'PUT':
        await handleUpsert(req, res, designId);
        return;
      case 'DELETE':
        await handleDelete(req, res, designId);
        return;
      case 'POST':
        await handleAction(req, res, designId);
        return;
      default:
        methodNotAllowed(res, 'GET, PUT, POST, DELETE');
        return;
    }
  } catch (error) {
    logger.error('Community print error', {
      designId,
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to handle print report');
  }
}

/**
 * Prints are only readable on a live design. A hidden design's detail GET
 * already 404s for everyone but its owner, so serving its prints would hand
 * anyone holding the id a way around that gate.
 */
async function requireLiveDesign(redis: Redis, designId: string): Promise<boolean> {
  return (await redis.hget(communityDesignKey(designId), 'status')) === 'live';
}

/** Public surface: an absent or unreadable session degrades to anonymous, never 401. */
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

interface PrintResponse {
  id: string;
  designId: string;
  authorPublicId: string;
  authorName: string;
  photos: string[];
  photoThumbs: string[];
  /** Every field omitted rather than nulled when unreported, so a client that
      reads `settings.nozzleMm` gets `undefined` and cannot format a 0. */
  settings: {
    material?: string;
    nozzleMm?: number;
    layerHeightMm?: number;
    printMinutes?: number;
    filamentGrams?: number;
    printer?: string;
    printerOther?: string;
  };
  fitVerdict: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  status: string;
}

function toPrintResponse(record: CommunityPrintRecord): PrintResponse {
  return {
    id: `${record.designId}:${record.authorPublicId}`,
    designId: record.designId,
    authorPublicId: record.authorPublicId,
    authorName: record.authorName,
    photos: record.photos,
    photoThumbs: record.photoThumbs,
    settings: {
      ...(record.material !== null && { material: record.material }),
      ...(record.nozzleMm !== null && { nozzleMm: record.nozzleMm }),
      ...(record.layerHeightMm !== null && { layerHeightMm: record.layerHeightMm }),
      ...(record.printMinutes !== null && { printMinutes: record.printMinutes }),
      ...(record.filamentGrams !== null && { filamentGrams: record.filamentGrams }),
      ...(record.printer !== null && { printer: record.printer }),
      ...(record.printerOther !== '' && { printerOther: record.printerOther }),
    },
    fitVerdict: record.fitVerdict,
    note: record.note,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
  };
}

async function handleList(
  req: VercelRequest,
  res: VercelResponse,
  designId: string
): Promise<void> {
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

  if (!(await requireLiveDesign(redis, designId))) {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Design not found');
    return;
  }

  const cursorParam = singleParam(req.query.cursor);
  if (cursorParam !== undefined && !CURSOR_REGEX.test(cursorParam)) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'cursor must be a non-negative integer');
    return;
  }
  const cursor = cursorParam === undefined ? 0 : Number(cursorParam);

  const total = await countCommunityPrints(redis, designId);
  const pageIds = await listCommunityPrinterIds(redis, designId, cursor, PRINT_PAGE_SIZE);
  const page = (await readCommunityPrints(redis, designId, pageIds)).filter(
    (record): record is CommunityPrintRecord => record !== null && record.status === 'live'
  );

  // The summary rides the first page only: it describes the whole set, so
  // re-deriving it on every "load more" would be pure duplicated work.
  let summary = null;
  if (cursor === 0) {
    if (total <= PRINT_PAGE_SIZE) {
      // The first page already is the whole set; re-reading it would double
      // the Redis round trips for the common case of a handful of prints.
      summary = summarizeCommunityPrints(page);
    } else {
      const sampleIds = await listCommunityPrinterIds(redis, designId, 0, SUMMARY_SAMPLE_SIZE);
      const sample = (await readCommunityPrints(redis, designId, sampleIds)).filter(
        (record): record is CommunityPrintRecord => record !== null
      );
      summary = summarizeCommunityPrints(sample);
    }
  }

  // The caller's own print travels with the response even when it is not on
  // this page, so the UI can offer "edit your print" without a second request
  // or a full walk of the list.
  let mine: PrintResponse | null = null;
  const session = await readOptionalSession(req);
  if (session !== null) {
    const authorPublicId = deriveAuthorPublicId(session.userId);
    if (authorPublicId !== null) {
      // A hidden print still travels to its own author, carrying its status:
      // the moderation path keeps the hash precisely so the owner can see what
      // happened and delete it. Only a removed record is gone for everyone.
      const own = await readCommunityPrint(redis, designId, authorPublicId);
      if (own !== null && own.status !== 'removed') mine = toPrintResponse(own);
    }
  }

  const nextOffset = cursor + pageIds.length;
  const items = page.map(toPrintResponse);
  // Same sidecar shape the design list uses: badged authors, not badged prints,
  // so a printer with several reports costs one entry.
  const supporterAuthorIds = [
    ...(await resolveSupporterAuthors(
      redis,
      items.map((item) => item.authorPublicId)
    )),
  ];
  res.status(200).json({
    items,
    nextCursor:
      pageIds.length === PRINT_PAGE_SIZE && nextOffset < total ? String(nextOffset) : null,
    summary,
    mine,
    supporterAuthorIds,
  });
}

/**
 * Resolve the session plus its author id, rejecting deny-listed accounts. The
 * denial response is deliberately neutral: it must not reveal deny-listing.
 */
async function requirePrinter(
  req: VercelRequest,
  res: VercelResponse,
  redis: Redis
): Promise<{ session: SessionRecord; authorPublicId: string } | null> {
  const session = await requireSession(req, res);
  if (!session) return null;

  if ((await redis.sismember(communityDenylistKey(), session.userId)) === 1) {
    sendError(res, 403, ErrorCode.UNAUTHORIZED, 'This action is not available for this account.');
    return null;
  }

  const authorPublicId = deriveAuthorPublicId(session.userId);
  if (authorPublicId === null) {
    logger.error('Community print failed: TOKEN_SALT is not configured');
    serviceUnavailable(res);
    return null;
  }
  return { session, authorPublicId };
}

async function handleUpsert(
  req: VercelRequest,
  res: VercelResponse,
  designId: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    serviceUnavailable(res);
    return;
  }

  const printer = await requirePrinter(req, res, redis);
  if (printer === null) return;
  const { session, authorPublicId } = printer;

  const rate = await checkRateLimit(session.userId, 'community.print');
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds, 'Print report limit reached. Try again later.');
    return;
  }

  if (!(await requireLiveDesign(redis, designId))) {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Design not found');
    return;
  }

  const validated = validateCommunityPrint(req.body);
  if (!validated.valid) {
    res.status(400).json({ error: validated.error.message, code: validated.error.code });
    return;
  }
  const payload = validated.payload;

  const existing = await readCommunityPrint(redis, designId, authorPublicId);
  // A moderated print is not editable back into visibility: allowing an edit
  // would let a hidden report re-enter the list by rewriting itself.
  if (existing !== null && existing.status !== 'live') {
    sendError(res, 403, ErrorCode.UNAUTHORIZED, 'This print report is no longer editable.');
    return;
  }

  // Enforced against what is already stored, not unconditionally: a record
  // written before the floor existed can legitimately carry neither a photo nor
  // a note, and its owner must still be able to correct it. What the floor does
  // guarantee is that a record never drops BELOW it.
  if (
    !hasPrintSubstance(payload.photos.length, payload.note) &&
    (existing === null || hasPrintSubstance(existing.photos.length, existing.note))
  ) {
    res.status(400).json({
      error: 'a print needs at least one photo or a note',
      code: 'INVALID_PAYLOAD',
    });
    return;
  }

  const keptUrls = payload.photos
    .filter((photo): photo is { kind: 'keep'; url: string } => photo.kind === 'keep')
    .map((photo) => photo.url);
  const existingPhotos = existing?.photos ?? [];
  // A kept URL must already belong to this record. Without this the field
  // would accept any blob URL, letting a caller graft another print's photos
  // (or an arbitrary same-host asset) onto their own report.
  if (keptUrls.some((url) => !existingPhotos.includes(url))) {
    res.status(400).json({ error: 'photos references an unknown photo', code: 'INVALID_PHOTOS' });
    return;
  }

  const now = Date.now();
  const newPhotos = payload.photos.filter((photo) => photo.kind === 'new');
  // Only an upload advances the revision. Blob paths are (rev, index) and
  // upload at `allowOverwrite: false`, so every batch needs a rev of its own or
  // an edit that adds one photo while keeping another would target the kept
  // photo's path and collide. A settings-only edit uploads nothing, so it holds
  // the revision steady instead of churning it.
  const previousRev = existing?.rev ?? 0;
  const rev = newPhotos.length > 0 ? previousRev + 1 : Math.max(previousRev, 1);

  const uploadWebp = (path: string, base64: string): Promise<{ url: string }> =>
    put(path, Buffer.from(base64, 'base64'), {
      access: 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
      allowOverwrite: false,
    });

  const uploaded = await Promise.all(
    newPhotos.map(async (photo, index) => {
      const full = await uploadWebp(
        communityPrintPhotoBlobPath(designId, authorPublicId, rev, index),
        photo.base64
      );
      if (photo.thumbBase64 === null) return { url: full.url, thumbUrl: '' };
      const thumb = await uploadWebp(
        communityPrintThumbBlobPath(designId, authorPublicId, rev, index),
        photo.thumbBase64
      );
      return { url: full.url, thumbUrl: thumb.url };
    })
  );

  // Rebuild in the order the client asked for, splicing fresh URLs into the
  // 'new' slots so a reorder-plus-add edit keeps the intended sequence.
  //
  // Both lists are built in this one pass, from the same entry, so they cannot
  // drift out of step — the failure mode gotcha 6 warns about. A kept slot
  // carries its existing thumb forward by looking the photo up in the previous
  // record; '' where there is none, which is every photo uploaded before this
  // field existed.
  const existingThumbs = existing?.photoThumbs ?? [];
  let uploadIndex = 0;
  const rebuilt = payload.photos.map((photo) => {
    if (photo.kind === 'new') return uploaded[uploadIndex++];
    const previousIndex = existingPhotos.indexOf(photo.url);
    return { url: photo.url, thumbUrl: existingThumbs[previousIndex] ?? '' };
  });
  const photos = rebuilt.map((entry) => entry.url);
  const photoThumbs = rebuilt.map((entry) => entry.thumbUrl);

  // Reporter sets outlive the record they moderated (deleteCommunityPrint
  // deliberately keeps them, so the per-account dedupe still holds). On a
  // CREATE, consult them: if this (design, author) pair already crossed the
  // threshold, the print comes back moderated rather than live. Belt to the
  // delete guard's braces — recreation must never launder the status.
  const priorReports =
    existing === null ? await redis.scard(communityPrintReportsKey(designId, authorPublicId)) : 0;
  const status: CommunityPrintStatus = priorReports >= REPORT_THRESHOLD ? 'hidden' : 'live';

  const record: CommunityPrintRecord = {
    designId,
    authorPublicId,
    authorName: payload.authorName,
    photos,
    photoThumbs,
    material: payload.material,
    nozzleMm: payload.nozzleMm,
    layerHeightMm: payload.layerHeightMm,
    printMinutes: payload.printMinutes,
    filamentGrams: payload.filamentGrams,
    printer: payload.printer,
    printerOther: payload.printerOther,
    fitVerdict: payload.fitVerdict,
    note: payload.note,
    rev,
    // An edit keeps its original timestamp so the list's newest-first order
    // does not reshuffle every time someone fixes a typo.
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status,
  };

  try {
    await writeCommunityPrint(redis, record);
    // Only a live print joins the public ZSET — that membership IS the list
    // and the distinct-printer count.
    if (status === 'live') {
      await redis.zadd(communityPrintsKey(designId), record.createdAt, authorPublicId);
    }
    await redis.sadd(communityPrintedKey(session.userId), designId);
  } catch (writeErr) {
    // The photos are already at public, predictable paths; without this the
    // failed edit strands CDN assets no record references.
    if (uploaded.length > 0) {
      // Both sizes: each upload wrote up to two blobs, and rolling back only
      // the photo would strand its copy at a public path no record names.
      const orphans = uploaded.flatMap((blob) =>
        blob.thumbUrl === '' ? [blob.url] : [blob.url, blob.thumbUrl]
      );
      await del(orphans).catch((delErr: unknown) => {
        logger.error('Rollback failed: orphan print photos left after write failure', {
          designId,
          error: delErr instanceof Error ? delErr.message : String(delErr),
        });
      });
    }
    throw writeErr;
  }

  const count = await syncCommunityPrintCount(redis, designId);

  // Post-commit: photos the edit dropped are no longer referenced by anything.
  // Best-effort, because the record is already correct and a failed cleanup
  // must not fail a successful edit.
  // Indexed against the previous record so each dropped photo takes its copy
  // with it; the two arrays are the same length by construction.
  const orphaned = existingPhotos.filter((url) => !photos.includes(url));
  const orphanedThumbs = existingPhotos
    .map((url, index) => (photos.includes(url) ? '' : (existingThumbs[index] ?? '')))
    .filter((url) => url !== '' && !photoThumbs.includes(url));
  await clearCommunityCoverIfFromPhotos(redis, designId, orphaned);
  if (orphaned.length > 0 || orphanedThumbs.length > 0) {
    await del([...orphaned, ...orphanedThumbs]).catch((delErr: unknown) => {
      logger.warn('Community print: dropped-photo cleanup failed', {
        designId,
        error: delErr instanceof Error ? delErr.message : String(delErr),
      });
    });
  }

  res.status(existing === null ? 201 : 200).json({
    print: toPrintResponse(record),
    count,
  });
}

async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  designId: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    serviceUnavailable(res);
    return;
  }

  const session = await requireSession(req, res);
  if (!session) return;

  // Deleting is cheap to request but not free to serve (blob deletes plus a
  // count resync), so it carries the same budget as the design manage paths.
  const rate = await checkRateLimit(session.userId, 'community.manage');
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds);
    return;
  }

  const authorPublicId = deriveAuthorPublicId(session.userId);
  if (authorPublicId === null) {
    logger.error('Community print delete failed: TOKEN_SALT is not configured');
    serviceUnavailable(res);
    return;
  }

  const existing = await readCommunityPrint(redis, designId, authorPublicId);
  if (existing === null) {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Print report not found');
    return;
  }

  // Mirrors the design DELETE guard: a moderated print cannot be deleted. The
  // upsert path already refuses to edit a hidden print back into visibility,
  // but delete-then-repost reached the same place — the record is gone, so the
  // re-visibility check finds nothing and writes a fresh 'live' record.
  if (existing.status !== 'live') {
    res.status(409).json({
      error: 'This print report is under moderation review and cannot be deleted.',
      code: 'UNDER_REVIEW',
    });
    return;
  }

  await deleteCommunityPrint(redis, designId, authorPublicId, session.userId);
  const count = await syncCommunityPrintCount(redis, designId);
  await clearCommunityCoverIfFromPhotos(redis, designId, existing.photos);

  const deadAssets = [...existing.photos, ...existing.photoThumbs.filter((url) => url !== '')];
  if (deadAssets.length > 0) {
    await del(deadAssets).catch((delErr: unknown) => {
      logger.warn('Community print: photo cleanup failed after delete', {
        designId,
        error: delErr instanceof Error ? delErr.message : String(delErr),
      });
    });
  }

  res.status(200).json({ deleted: true, count });
}

async function handleAction(
  req: VercelRequest,
  res: VercelResponse,
  designId: string
): Promise<void> {
  const body: unknown = req.body;
  if (!isObject(body) || !isString(body.action)) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'action is required');
    return;
  }
  if (body.action !== 'report') {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Unknown action');
    return;
  }
  await handleReport(req, res, designId, body);
}

async function handleReport(
  req: VercelRequest,
  res: VercelResponse,
  designId: string,
  body: Record<string, unknown>
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    serviceUnavailable(res);
    return;
  }

  const reporter = await requirePrinter(req, res, redis);
  if (reporter === null) return;
  const { session, authorPublicId: reporterPublicId } = reporter;

  const rate = await checkRateLimit(session.userId, 'community.report');
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds);
    return;
  }

  if (!isString(body.printer) || !AUTHOR_PUBLIC_ID_REGEX.test(body.printer)) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'printer must be a 32-char author public id');
    return;
  }
  const targetPublicId = body.printer;

  if (targetPublicId === reporterPublicId) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'You cannot report your own print report.');
    return;
  }

  const parsed = parseReportBody(body);
  if (!parsed.ok) {
    sendError(res, parsed.status, parsed.code, parsed.message);
    return;
  }
  const { reason } = parsed;

  const existing = await readCommunityPrint(redis, designId, targetPublicId);
  if (existing === null || existing.status !== 'live') {
    sendError(res, 404, ErrorCode.NOT_FOUND, 'Print report not found');
    return;
  }

  const printId = `${designId}:${targetPublicId}`;
  const added = await redis.sadd(
    communityPrintReportsKey(designId, targetPublicId),
    session.userId
  );
  // Reverse index for the account-deletion cascade, written only alongside a
  // genuinely new report so a repeat tap cannot inflate either side.
  if (added === 1) {
    await redis.sadd(communityPrintReportedKey(session.userId), printId);
  }

  const reports = await redis.scard(communityPrintReportsKey(designId, targetPublicId));
  let hidden = false;
  if (reports >= REPORT_THRESHOLD) {
    // ZREM rather than delete: the hash survives so the reporter dedupe holds
    // and the owner still sees their own record, while dropping out of the
    // ZSET removes it from the list and from the distinct-printer count.
    await redis.hset(communityPrintKey(designId, targetPublicId), {
      status: 'hidden',
      hiddenReason: 'reports',
      hiddenReasonCategory: reason,
    });
    await redis.zrem(communityPrintsKey(designId), targetPublicId);
    await syncCommunityPrintCount(redis, designId);
    await clearCommunityCoverIfFromPhotos(redis, designId, existing.photos);
    hidden = true;
  }

  res.status(200).json({ reported: true, hidden });
}

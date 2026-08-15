import type { Redis } from 'ioredis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../lib/method.js';
import { logger } from '../lib/logger.js';
import { rateLimited, serviceUnavailable, ErrorCode, sendError } from '../lib/shared.js';
import { checkRateLimit, getRedis } from '../lib/rateLimit.js';
import { checkCsrfDefense, readSession, requireSession } from '../lib/session.js';
import { readSessionCookie } from '../lib/cookies.js';
import { supportersDonorsKey, userProfileKey } from '../lib/redisKeys.js';
import {
  filterMessage,
  normalizeDisplayName,
  parseDonorRecord,
  serializeDonorRecord,
  type SupporterRecord,
} from '../lib/supporters.js';
import {
  linkSupporterAccount,
  readSupporterLink,
  setSupporterBadgePublic,
  type SupporterLink,
} from '../lib/supporterLink.js';

/**
 * The caller's own supporter record: whether they are recognized, and what the
 * wall currently shows about them.
 *
 * `name: null` is the anonymous bin — indistinguishable on the wall from an
 * opted-out Ko-fi supporter, which is the point. `joinedAt` is absent on legacy
 * records that predate the dated writes.
 */
interface SupporterMeResponse {
  supporter: boolean;
  badgePublic: boolean;
  name: string | null;
  message: string | null;
  joinedAt?: string;
}

const NOT_A_SUPPORTER: SupporterMeResponse = {
  supporter: false,
  badgePublic: false,
  name: null,
  message: null,
};

/**
 * GET/PATCH /api/supporters/me
 *
 * The signed-in half of the supporters page: read your own status, and rewrite
 * the name, message, and anonymity of your own bin.
 *
 * GET answers 200 for anonymous callers rather than 401, matching
 * `/api/auth/me` — this is fetched on page load, and the browser logs every 4xx
 * as a console error, which trips the post-promote smoke check. PATCH is a
 * deliberate action, so it 401s normally.
 *
 * Never edge-cached: the response is per-account, unlike the public list at
 * `/api/supporters`, which is exactly why this lives at its own path.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PATCH'])) return;
  if (req.method === 'PATCH') {
    await handlePatch(req, res);
    return;
  }
  await handleGet(req, res);
}

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!checkCsrfDefense(req, res)) return;

  const token = readSessionCookie(req);
  if (!token) {
    res.status(200).json(NOT_A_SUPPORTER);
    return;
  }

  const redis = getRedis();
  if (!redis) {
    if (process.env.VERCEL_ENV === 'production') {
      logger.error('Supporter status failed: Redis unavailable');
      serviceUnavailable(res);
      return;
    }
    res.status(200).json(NOT_A_SUPPORTER);
    return;
  }

  const session = await readSession(redis, token);
  if (!session) {
    res.status(200).json(NOT_A_SUPPORTER);
    return;
  }

  const rate = await checkRateLimit(session.userId, 'supporters.me');
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds);
    return;
  }

  try {
    const link = await resolveLink(redis, session.userId);
    if (!link) {
      res.status(200).json(NOT_A_SUPPORTER);
      return;
    }
    res.status(200).json(await buildResponse(redis, link));
  } catch (error) {
    logger.error('Supporter status read failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to read supporter status.');
  }
}

/**
 * The user's link, retrying the match from their stored candidates if they
 * have none yet.
 *
 * Sign-in already attempts this, but the most common ordering is the other way
 * round — sign in first, support later — and a 30-day session means the next
 * sign-in could be a month away. Retrying here is one HMGET over at most
 * `MAX_DONOR_CANDIDATES` fields, and only for users who are not yet linked.
 */
async function resolveLink(redis: Redis, userId: string): Promise<SupporterLink | null> {
  const existing = await readSupporterLink(redis, userId);
  if (existing) return existing;

  const raw = await redis.get(userProfileKey(userId));
  if (!raw) return null;
  let candidates: unknown;
  try {
    candidates = (JSON.parse(raw) as { donorCandidates?: unknown }).donorCandidates;
  } catch {
    return null;
  }
  if (!Array.isArray(candidates)) return null;
  return linkSupporterAccount(
    redis,
    userId,
    candidates.filter((value): value is string => typeof value === 'string')
  );
}

async function buildResponse(redis: Redis, link: SupporterLink): Promise<SupporterMeResponse> {
  const raw = await redis.hget(supportersDonorsKey(), link.donorId);
  const record: SupporterRecord = raw ? parseDonorRecord(raw) : { name: null };
  return {
    supporter: true,
    badgePublic: link.badgePublic,
    name: record.name,
    message: record.message ?? null,
    ...(record.joinedAt ? { joinedAt: record.joinedAt } : {}),
  };
}

interface PatchBody {
  /** Empty or null switches the bin to anonymous. */
  name?: unknown;
  message?: unknown;
  badgePublic?: unknown;
}

async function handlePatch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const session = await requireSession(req, res);
  if (!session) return;

  const rate = await checkRateLimit(session.userId, 'supporters.edit');
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds, 'Too many changes. Try again later.');
    return;
  }

  const redis = getRedis();
  if (!redis) {
    serviceUnavailable(res, 'Supporter store unavailable.');
    return;
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as PatchBody;
  if (body.name !== undefined && body.name !== null && typeof body.name !== 'string') {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'name must be a string or null.');
    return;
  }
  if (body.message !== undefined && body.message !== null && typeof body.message !== 'string') {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'message must be a string or null.');
    return;
  }
  if (body.badgePublic !== undefined && typeof body.badgePublic !== 'boolean') {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'badgePublic must be a boolean.');
    return;
  }

  try {
    let link = await resolveLink(redis, session.userId);
    if (!link) {
      sendError(res, 403, ErrorCode.UNAUTHORIZED, 'No linked supporter record.');
      return;
    }

    if (body.badgePublic !== undefined && body.badgePublic !== link.badgePublic) {
      link = await setSupporterBadgePublic(redis, session.userId, link, body.badgePublic);
    }

    if (body.name !== undefined || body.message !== undefined) {
      const written = await writeDonorRecord(redis, link.donorId, body);
      if (!written.ok) {
        sendError(res, 400, ErrorCode.CONTENT_BLOCKED, written.reason);
        return;
      }
    }

    res.status(200).json(await buildResponse(redis, link));
  } catch (error) {
    logger.error('Supporter self-service edit failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to update supporter record.');
  }
}

/**
 * Apply a name/message edit to the donor record.
 *
 * Runs the SAME gauntlet the Ko-fi webhook does — `normalizeDisplayName` and
 * `filterMessage` — because this is a second door onto the same public text,
 * and a validator that only lives on the client is not a validator. The one
 * difference is the empty case: the webhook treats "filtered to nothing" and
 * "left blank" alike, but here they are distinguishable intents, so a
 * non-empty string that the filter rejects is reported back rather than
 * silently turning the supporter anonymous.
 *
 * Clearing the name clears the message with it. That invariant lives in
 * `serializeDonorRecord` (a message only ever rides with a name), so it holds
 * whether or not the caller thought to send both.
 */
async function writeDonorRecord(
  redis: Redis,
  donorId: string,
  body: PatchBody
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const raw = await redis.hget(supportersDonorsKey(), donorId);
  const current: SupporterRecord = raw ? parseDonorRecord(raw) : { name: null };

  let name = current.name;
  if (body.name !== undefined) {
    const requested = typeof body.name === 'string' ? body.name.trim() : '';
    if (!requested) {
      name = null;
    } else {
      name = normalizeDisplayName(requested, true);
      if (!name) return { ok: false, reason: "That name can't be shown on the wall." };
    }
  }

  let message = current.message;
  if (body.message !== undefined) {
    const requested = typeof body.message === 'string' ? body.message.trim() : '';
    if (!requested) {
      message = undefined;
    } else {
      const filtered = filterMessage(requested);
      if (!filtered) return { ok: false, reason: "That message can't be shown on the wall." };
      message = filtered;
    }
  }

  await redis.hset(
    supportersDonorsKey(),
    donorId,
    serializeDonorRecord({ name, joinedAt: current.joinedAt, message })
  );
  return { ok: true };
}

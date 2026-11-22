import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serverError } from '../lib/shared.js';
import { logger } from '../lib/logger.js';
import { getIndex, getIndexUpdatedAt } from '../lib/userIndex.js';
import { cutoutLibrarySyncEnabled } from '../lib/cutoutLibraryValidation.js';
import { requireSyncContext } from './lib/requireSyncContext.js';

/**
 * GET /api/sync/manifest
 *
 * Returns the user's full per-kind index plus an `indexUpdatedAt`
 * timestamp the client uses for `If-Modified-Since` polling.
 *
 *   200  → { layouts, designs, baseplates, designVersions, folders, cutoutItems?, cutoutFolders?: { [id]: IndexEntry }, indexUpdatedAt }
 *   304  → empty body when the client's `If-Modified-Since` >= the
 *          server's `users:{uid}:indexUpdatedAt` (no scan needed).
 *
 * The 304 path is the hot poll path — every authenticated tab pings
 * this every 45s when visible, so it must be cheap. We compare against
 * a single Redis GET of the `indexUpdatedAt` key, never reading the
 * hashes themselves.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const context = await requireSyncContext(req, res, ['GET'], 'sync.read');
  if (!context) return;
  const { session, redis } = context;

  try {
    const indexUpdatedAt = await getIndexUpdatedAt(redis, session.userId);

    const library = cutoutLibrarySyncEnabled();
    const ifModifiedSince = parseIfModifiedSinceHeader(req);
    if (
      ifModifiedSince !== null &&
      indexUpdatedAt > 0 &&
      ifModifiedSince >= indexUpdatedAt &&
      sameGatedKinds(req, library ? CUTOUT_LIBRARY_KINDS : [])
    ) {
      res.status(304).end();
      return;
    }

    const [layouts, designs, baseplates, designVersions, folders, cutoutItems, cutoutFolders] =
      await Promise.all([
        getIndex(redis, session.userId, 'layouts'),
        getIndex(redis, session.userId, 'designs'),
        getIndex(redis, session.userId, 'baseplates'),
        getIndex(redis, session.userId, 'designVersions'),
        getIndex(redis, session.userId, 'folders'),
        library ? getIndex(redis, session.userId, 'cutoutItems') : null,
        library ? getIndex(redis, session.userId, 'cutoutFolders') : null,
      ]);

    res.status(200).json({
      layouts,
      designs,
      baseplates,
      designVersions,
      folders,
      // Absent while the kill switch is off: the client pushes only the kinds listed here.
      ...(cutoutItems && cutoutFolders ? { cutoutItems, cutoutFolders } : {}),
      indexUpdatedAt,
    });
  } catch (error) {
    logger.error('sync/manifest failed', {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    serverError(res);
  }
}

const CUTOUT_LIBRARY_KINDS = ['cutoutItems', 'cutoutFolders'] as const;

/**
 * Whether the client reads the same gated kinds as served (`X-Sync-Served`,
 * mirroring `servedGatedKinds` in src/core/sync/servedKinds.ts). Flipping a
 * kill switch changes no index, so without this a client would get 304s and
 * never see a kind appear or go. A client that sends no header predates gated
 * kinds and keeps the plain timestamp check.
 */
function sameGatedKinds(req: VercelRequest, served: readonly string[]): boolean {
  const raw: unknown = req.headers['x-sync-served'];
  if (typeof raw !== 'string') return true;
  const seen = new Set(raw.split(',').filter(Boolean));
  return seen.size === served.length && served.every((kind) => seen.has(kind));
}

/**
 * Read a numeric millisecond timestamp from `If-Modified-Since` (custom
 * convention — we send a number, not RFC 1123, because our cache key is
 * `users:{uid}:indexUpdatedAt` already in ms). Returns null if absent or
 * malformed; the handler then serves a fresh 200.
 */
function parseIfModifiedSinceHeader(req: VercelRequest): number | null {
  const raw: unknown = req.headers['if-modified-since'];
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0]) : null;
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

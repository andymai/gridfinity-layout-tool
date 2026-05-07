import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireMethod } from '../lib/method.js';
import { ErrorCode } from '../lib/shared.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit, getRedis } from '../lib/rateLimit.js';
import { requireSession } from '../lib/session.js';
import { getJson } from '../lib/blobStore.js';
import {
  getIndex,
  getIndexUpdatedAt,
  type IndexEntry,
  type SyncItemKind,
} from '../lib/userIndex.js';

/**
 * GET /api/sync/export
 *
 * Stream a ZIP of the user's live data:
 *
 *   manifest.json        — { layouts: { [id]: IndexEntry }, designs: ..., indexUpdatedAt, exportedAt }
 *   layouts/{id}.json    — full envelope for each non-tombstoned layout
 *   designs/{id}.json    — full envelope for each non-tombstoned design
 *
 * Tombstones are excluded — the user asked to export their data, not
 * the audit trail of deletions.
 *
 * The ZIP is built in-memory. With the 10MB-per-kind quota, the worst
 * case is ~20MB pre-compression which is still well within Vercel
 * function memory limits and HTTP response timeouts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['GET'])) return;

  const session = await requireSession(req, res);
  if (!session) return;

  const rate = await checkRateLimit(session.userId, 'sync.read');
  if (!rate.allowed) {
    res.status(429).json({
      error: 'Too many requests. Try again later.',
      code: ErrorCode.RATE_LIMITED,
      retryAfter: rate.retryAfterSeconds,
    });
    return;
  }

  const redis = getRedis();
  if (!redis) {
    res
      .status(503)
      .json({ error: 'Service temporarily unavailable', code: ErrorCode.SERVICE_UNAVAILABLE });
    return;
  }

  try {
    const [layoutsIndex, designsIndex, indexUpdatedAt] = await Promise.all([
      getIndex(redis, session.userId, 'layouts'),
      getIndex(redis, session.userId, 'designs'),
      getIndexUpdatedAt(redis, session.userId),
    ]);

    const liveLayouts = filterLive(layoutsIndex);
    const liveDesigns = filterLive(designsIndex);

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          layouts: liveLayouts,
          designs: liveDesigns,
          indexUpdatedAt,
          exportedAt: Date.now(),
          schemaVersion: 1,
        },
        null,
        2
      )
    );

    await Promise.all([
      addEnvelopes(zip, session.userId, 'layouts', Object.keys(liveLayouts)),
      addEnvelopes(zip, session.userId, 'designs', Object.keys(liveDesigns)),
    ]);

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gridfinity-export-${session.userId.slice(0, 8)}.zip"`
    );
    res.status(200).send(buffer);
  } catch (error) {
    logger.error('sync/export failed', {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Server error', code: ErrorCode.SERVER_ERROR });
  }
}

function filterLive(index: Record<string, IndexEntry>): Record<string, IndexEntry> {
  const out: Record<string, IndexEntry> = {};
  for (const [id, entry] of Object.entries(index)) {
    if (entry.deletedAt === undefined) out[id] = entry;
  }
  return out;
}

interface JSZipLike {
  file(name: string, content: string): void;
}

async function addEnvelopes(
  zip: JSZipLike,
  userId: string,
  kind: SyncItemKind,
  ids: string[]
): Promise<void> {
  // Fetch envelopes in parallel; missing blobs are skipped (they shouldn't
  // happen, but if a blob delete races with the index read we don't want
  // the export to fail).
  const envelopes = await Promise.all(
    ids.map((id) => getJson<unknown>(`users/${userId}/${kind}/${id}.json`))
  );
  for (let i = 0; i < ids.length; i++) {
    const envelope = envelopes[i];
    if (envelope) {
      zip.file(`${kind}/${ids[i]}.json`, JSON.stringify(envelope, null, 2));
    }
  }
}

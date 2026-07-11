import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Zip, ZipDeflate, strToU8 } from 'fflate';
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
 *   manifest.json        — { layouts, designs, baseplates: { [id]: IndexEntry }, indexUpdatedAt, exportedAt }
 *   layouts/{id}.json    — full envelope for each non-tombstoned layout
 *   designs/{id}.json    — full envelope for each non-tombstoned design
 *   baseplates/{id}.json — full envelope for each non-tombstoned baseplate
 *
 * Tombstones are excluded — the user asked to export their data, not
 * the audit trail of deletions.
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
    const [layoutsIndex, designsIndex, baseplatesIndex, indexUpdatedAt] = await Promise.all([
      getIndex(redis, session.userId, 'layouts'),
      getIndex(redis, session.userId, 'designs'),
      getIndex(redis, session.userId, 'baseplates'),
      getIndexUpdatedAt(redis, session.userId),
    ]);

    const liveLayouts = filterLive(layoutsIndex);
    const liveDesigns = filterLive(designsIndex);
    const liveBaseplates = filterLive(baseplatesIndex);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gridfinity-export-${session.userId.slice(0, 8)}.zip"`
    );
    res.status(200);

    await streamZipToResponse(res, async (addFile) => {
      addFile(
        'manifest.json',
        strToU8(
          JSON.stringify(
            {
              layouts: liveLayouts,
              designs: liveDesigns,
              baseplates: liveBaseplates,
              indexUpdatedAt,
              exportedAt: Date.now(),
              schemaVersion: 1,
            },
            null,
            2
          )
        )
      );
      await Promise.all([
        streamEnvelopes(addFile, session.userId, 'layouts', Object.keys(liveLayouts)),
        streamEnvelopes(addFile, session.userId, 'designs', Object.keys(liveDesigns)),
        streamEnvelopes(addFile, session.userId, 'baseplates', Object.keys(liveBaseplates)),
      ]);
    });
  } catch (error) {
    logger.error('sync/export failed', {
      userId: session.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Headers + 200 already flushed: can't switch to a JSON error.
    if (res.headersSent) {
      try {
        res.end();
      } catch {
        /* nothing to do */
      }
      return;
    }
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

type AddFile = (filename: string, contents: Uint8Array) => void;

// `level: 6` matches the prior JSZip default; keeps archive sizes stable
// across the migration so existing client roundtrips behave identically.
function streamZipToResponse(
  res: VercelResponse,
  build: (addFile: AddFile) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    const zip = new Zip((err, chunk, final) => {
      if (err) {
        settle(() => reject(err instanceof Error ? err : new Error(String(err))));
        return;
      }
      if (chunk.length > 0) res.write(chunk);
      if (final) {
        res.end();
        settle(resolve);
      }
    });

    build((filename, contents) => {
      const entry = new ZipDeflate(filename, { level: 6 });
      zip.add(entry);
      entry.push(contents, true);
    })
      .then(() => zip.end())
      .catch((error: unknown) =>
        settle(() => reject(error instanceof Error ? error : new Error(String(error))))
      );
  });
}

async function streamEnvelopes(
  addFile: AddFile,
  userId: string,
  kind: SyncItemKind,
  ids: string[]
): Promise<void> {
  // Missing blobs (index/blob race) are skipped rather than failing the export.
  const envelopes = await Promise.all(
    ids.map((id) => getJson<unknown>(`users/${userId}/${kind}/${id}.json`))
  );
  for (let i = 0; i < ids.length; i++) {
    const envelope = envelopes[i];
    if (envelope) {
      addFile(`${kind}/${ids[i]}.json`, strToU8(JSON.stringify(envelope, null, 2)));
    }
  }
}

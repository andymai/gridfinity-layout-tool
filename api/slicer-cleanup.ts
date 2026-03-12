/**
 * Cleanup cron job for temporary 3MF files uploaded via "Open in Slicer".
 *
 * Deletes blobs under the `slicer-temp/` prefix that are older than 2 hours.
 * Slicers download the file immediately after the protocol URL fires, so
 * anything older than a few minutes is safe to remove.
 *
 * Configured as a Vercel Cron running every hour (see vercel.json).
 * Protected by CRON_SECRET when set (required in production).
 */

import { list, del } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { methodNotAllowed, timingSafeCompare } from './lib/shared.js';

const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  // Verify the request originates from Vercel's cron scheduler.
  // CRON_SECRET is required in production; optional in local dev.
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.VERCEL_ENV === 'production';
  if (isProduction && !cronSecret) {
    return res.status(503).json({ error: 'Service not configured' });
  }
  const authHeader = req.headers['authorization'] as string | string[] | undefined;
  const authValue = Array.isArray(authHeader) ? (authHeader[0] ?? '') : (authHeader ?? '');
  if (cronSecret && !timingSafeCompare(authValue, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Service not configured' });
  }

  const cutoff = new Date(Date.now() - MAX_AGE_MS);
  const toDelete: string[] = [];
  let cursor: string | undefined;

  try {
    do {
      const result = await list({ prefix: 'slicer-temp/', cursor, limit: 1000 });

      for (const blob of result.blobs) {
        if (blob.uploadedAt < cutoff) {
          toDelete.push(blob.url);
        }
      }

      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    // Batch deletions to avoid hitting API limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      await del(toDelete.slice(i, i + BATCH_SIZE));
    }
  } catch (error) {
    console.error(
      'Slicer cleanup failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return res.status(500).json({ error: 'Cleanup failed' });
  }

  return res.status(200).json({ deleted: toDelete.length, cutoff: cutoff.toISOString() });
}

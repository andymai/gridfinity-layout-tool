/**
 * Temporary file upload endpoint for "Open in Slicer" deep-linking.
 *
 * Accepts a raw 3MF binary body, uploads it to Vercel Blob under the
 * `slicer-temp/` prefix, and returns a public URL. The slicer protocol
 * handler (e.g. prusaslicer://open?file_url=<url>) uses this URL to
 * fetch and open the file.
 *
 * Files accumulate in Blob storage; the cleanup cron job prunes
 * entries older than 2 hours using the `slicer-temp/` prefix listing.
 */

import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit, getClientIP } from './lib/rateLimit.js';
import { methodNotAllowed } from './lib/shared.js';

/** Maximum accepted file size: 2MB (well above any realistic 3MF bin file) */
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  // Enforce same-origin requests to prevent third-party file hosting abuse.
  // Requests without an Origin header (e.g. curl, server-side scripts) are also
  // rejected — this endpoint is intentionally browser-only.
  //
  // VERCEL_URL is always the unique per-deployment hash URL (e.g. proj-abc123.vercel.app),
  // even in production — it differs from the canonical production URL that users
  // actually visit. We therefore check against all three Vercel URL variables so
  // that both the canonical domain and the deployment-hash URL are accepted.
  const originHeader = req.headers['origin'];
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

  const allowedHosts = new Set<string>();
  for (const raw of [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]) {
    if (raw) {
      try {
        allowedHosts.add(new URL(`https://${raw}`).hostname);
      } catch {
        /* skip malformed */
      }
    }
  }

  let originAllowed = false;
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const isProduction = process.env.VERCEL_ENV === 'production';
      originAllowed = (!isProduction && originHost === 'localhost') || allowedHosts.has(originHost);
    } catch {
      /* malformed Origin — denied */
    }
  }
  if (!originAllowed) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(clientIP, 'slicer');

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Too many uploads. Try again later.',
      retryAfter: rateLimit.retryAfterSeconds,
    });
  }

  // Read raw body (Vercel parses body as Buffer for non-JSON content types)
  const body = req.body as Buffer | undefined;
  if (!body || body.length === 0) {
    return res.status(400).json({ error: 'Missing file body' });
  }

  if (body.length > MAX_FILE_SIZE_BYTES) {
    return res.status(413).json({ error: 'File too large (max 2MB)' });
  }

  // Validate 3MF magic bytes (PK ZIP header: 0x50 0x4B 0x03 0x04)
  if (body[0] !== 0x50 || body[1] !== 0x4b || body[2] !== 0x03 || body[3] !== 0x04) {
    return res.status(400).json({ error: 'Invalid 3MF file' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Service not configured' });
  }

  const uuid = crypto.randomUUID();
  const blobPath = `slicer-temp/${uuid}.3mf`;

  try {
    const blob = await put(blobPath, body, {
      access: 'public',
      contentType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
      addRandomSuffix: false,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error(
      'Slicer upload failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return res.status(500).json({ error: 'Upload failed' });
  }
}

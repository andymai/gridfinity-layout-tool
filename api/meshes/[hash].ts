import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import {
  ErrorCode,
  sendError,
  serverError,
  serviceUnavailable,
  singleParam,
} from '../lib/shared.js';
import { logger } from '../lib/logger.js';
import { putContentAddressed } from '../lib/blobStore.js';
import { checkMeshQuota } from '../lib/quota.js';
import { acquireAccountMesh, getHeldMesh } from '../lib/meshIndex.js';
import {
  MAX_MESH_UPLOAD_BYTES,
  isMeshHash,
  meshBlobPath,
  meshFileHash,
  validateMeshFile,
} from '../lib/meshFile.js';
import { requireSyncContext } from '../sync/lib/requireSyncContext.js';

/** Carries a held file's Blob URL on HEAD, which has no body. */
export const MESH_URL_HEADER = 'X-Mesh-Url';

const MESH_CONTENT_TYPE = 'application/octet-stream';

/**
 * Kill switch matching `COMMUNITY_PUBLISH_ENABLED`: unset, or anything but the
 * literal string 'true', makes every method 503. Documented in CLAUDE.md.
 */
function meshStoreEnabled(): boolean {
  return process.env.MESH_STORE_ENABLED === 'true';
}

function isOctetStream(req: VercelRequest): boolean {
  return req.headers['content-type']?.split(';')[0].trim().toLowerCase() === MESH_CONTENT_TYPE;
}

async function handleHead(
  res: VercelResponse,
  redis: Redis,
  userId: string,
  hash: string
): Promise<void> {
  const held = await getHeldMesh(redis, userId, hash);
  if (!held) {
    res.status(404).end();
    return;
  }
  res.setHeader(MESH_URL_HEADER, held.url);
  res.status(200).end();
}

async function handlePut(
  req: VercelRequest,
  res: VercelResponse,
  redis: Redis,
  userId: string,
  hash: string
): Promise<void> {
  if (!isOctetStream(req)) {
    sendError(res, 415, ErrorCode.VALIDATION_ERROR, `Body must be ${MESH_CONTENT_TYPE}`);
    return;
  }
  const body: unknown = req.body;
  if (!Buffer.isBuffer(body) || body.byteLength === 0) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Missing body');
    return;
  }
  if (body.byteLength > MAX_MESH_UPLOAD_BYTES) {
    sendError(
      res,
      413,
      ErrorCode.SIZE_LIMIT,
      `Mesh file exceeds the ${MAX_MESH_UPLOAD_BYTES} byte limit`
    );
    return;
  }
  const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  if (meshFileHash(bytes) !== hash) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Body does not match the hash in the URL');
    return;
  }

  const held = await getHeldMesh(redis, userId, hash);
  if (held) {
    res.status(200).json({ hash, url: held.url, sizeBytes: held.sizeBytes });
    return;
  }

  const file = await validateMeshFile(bytes);
  if (!file.ok) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, file.error);
    return;
  }

  const quota = await checkMeshQuota(redis, userId, hash, bytes.byteLength);
  if (!quota.ok) {
    sendError(
      res,
      413,
      ErrorCode.SIZE_LIMIT,
      `Quota exceeded (${quota.error.reason}): ${quota.error.current} of ${quota.error.limit}.`
    );
    return;
  }

  const url = await putContentAddressed(meshBlobPath(hash), bytes, MESH_CONTENT_TYPE);
  await acquireAccountMesh(redis, userId, hash, { sizeBytes: bytes.byteLength, url });
  res.status(200).json({ hash, url, sizeBytes: bytes.byteLength });
}

/**
 * PUT  /api/meshes/{hash}  body: the mesh file bytes. Stores it once and
 *                          records that this account holds it; 200 with
 *                          `{ hash, url, sizeBytes }`. A re-PUT of a held
 *                          hash is a cheap 200.
 * HEAD /api/meshes/{hash}  200 with the URL in `X-Mesh-Url` when this account
 *                          holds the file, else 404, so a client can skip the
 *                          upload.
 *
 * Files are read from the Blob CDN at that URL, so there is no GET. They are
 * public: the URL needs the hash, and the hash needs the content or a design
 * that references it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!meshStoreEnabled()) {
    serviceUnavailable(res, 'Mesh storage is not available.');
    return;
  }

  const context = await requireSyncContext(
    req,
    res,
    ['PUT', 'HEAD'],
    req.method === 'PUT' ? 'mesh.write' : 'mesh.read'
  );
  if (!context) return;
  const { session, redis } = context;

  const hash = singleParam(req.query.hash);
  if (!isMeshHash(hash)) {
    sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid mesh hash');
    return;
  }

  try {
    if (req.method === 'HEAD') {
      await handleHead(res, redis, session.userId, hash);
    } else {
      await handlePut(req, res, redis, session.userId, hash);
    }
  } catch (error) {
    logger.error('meshes handler failed', {
      userId: session.userId,
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
    });
    serverError(res);
  }
}

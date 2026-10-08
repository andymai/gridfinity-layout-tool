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
import { checkMeshQuota, type QuotaError } from '../lib/quota.js';
import {
  acquireAccountMesh,
  getHeldMesh,
  getMeshUsage,
  meshStoreEnabled,
} from '../lib/meshIndex.js';
import { readSessionCookie } from '../lib/cookies.js';
import {
  MAX_MESH_UPLOAD_BYTES,
  isMeshHash,
  meshBlobPath,
  meshFileHash,
  validateMeshFile,
} from '../lib/meshFile.js';
import { requireSyncContext } from '../sync/lib/requireSyncContext.js';

export const MESH_URL_HEADER = 'X-Mesh-Url';

const MESH_CONTENT_TYPE = 'application/octet-stream';

function isOctetStream(req: VercelRequest): boolean {
  return req.headers['content-type']?.split(';')[0].trim().toLowerCase() === MESH_CONTENT_TYPE;
}

function sendQuotaExceeded(res: VercelResponse, error: QuotaError): void {
  sendError(
    res,
    413,
    ErrorCode.SIZE_LIMIT,
    `Quota exceeded (${error.reason}): ${error.current} of ${error.limit}.`
  );
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

  const quota = checkMeshQuota(await getMeshUsage(redis, userId), bytes.byteLength);
  if (!quota.ok) {
    sendQuotaExceeded(res, quota.error);
    return;
  }

  const sessionToken = readSessionCookie(req);
  if (sessionToken === null) {
    sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Not signed in');
    return;
  }

  // The Blob write comes before the hold so a held hash always has a blob
  // behind it: HEAD answering "held" for a file that was never written would
  // make a client skip the upload for good. The write is content-addressed and
  // write-once, so repeating or abandoning it is harmless. The pre-check above
  // keeps an upload that cannot fit from reaching Blob; only a race past it
  // can leave a blob with no holder, and its empty holder set marks it.
  const sizeBytes = bytes.byteLength;
  const url = await putContentAddressed(meshBlobPath(hash), bytes, MESH_CONTENT_TYPE);
  const acquired = await acquireAccountMesh(redis, {
    userId,
    sessionToken,
    hash,
    held: { sizeBytes, url },
  });
  if (acquired.status === 'signed-out') {
    sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Session expired');
    return;
  }
  if (acquired.status === 'over-quota') {
    sendQuotaExceeded(res, acquired.error);
    return;
  }
  res.status(200).json({ hash, url, sizeBytes });
}

/**
 * Files are read from the Blob CDN, so there is no GET. They are public: the
 * URL needs the hash, and the hash needs the content or a design that
 * references it.
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

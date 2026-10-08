import type { VercelRequest, VercelResponse } from '@vercel/node';
import { heldMeshUrls } from './meshIndex.js';
import { getRedis } from './rateLimit.js';
import { checkCsrfDefense, readOptionalSession } from './session.js';
import { ErrorCode, MESH_MISSING_STATUS, sendJson } from './shared.js';

/**
 * The CDN URL of each mesh file a share names by ref, which recipients read
 * the files from without an account. A share may name only files the caller's
 * account holds; when it names others, this answers 424 `MESH_MISSING` listing
 * them and returns null, and the client sends those meshes inline. A signed-out
 * caller, or a server with no mesh store, holds none. Shares are otherwise
 * anonymous, so the CSRF check applies only to one naming files.
 */
export async function resolveShareMeshFiles(
  req: VercelRequest,
  res: VercelResponse,
  hashes: readonly string[]
): Promise<Record<string, string> | null> {
  const unique = [...new Set(hashes)];
  if (unique.length === 0) return {};
  if (!checkCsrfDefense(req, res)) return null;

  const session = await readOptionalSession(req);
  const redis = getRedis();
  const urls =
    session && redis
      ? await heldMeshUrls(redis, session.userId, unique)
      : new Map<string, string>();
  const missing = unique.filter((hash) => !urls.has(hash));
  if (missing.length > 0) {
    sendJson(res, MESH_MISSING_STATUS, {
      error: 'Upload the mesh files this share names, or send them inline.',
      code: ErrorCode.MESH_MISSING,
      missing,
    });
    return null;
  }
  return Object.fromEntries(urls);
}

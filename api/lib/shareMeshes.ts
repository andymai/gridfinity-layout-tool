import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import { heldMeshUrls } from './meshIndex.js';
import { getRedis } from './rateLimit.js';
import { checkCsrfDefense, readOptionalSession } from './session.js';
import { ErrorCode, MESH_MISSING_STATUS, sendJson } from './shared.js';

/**
 * The CDN URL of each mesh file a shared or published design names by ref,
 * which others read the files from without an account. A design may name only
 * files the caller's account holds; when it names others, this answers 424
 * `MESH_MISSING` listing them and returns null, and the client sends those
 * meshes inline. A signed-out caller, or a server with no mesh store, holds none.
 */
export async function resolveHeldMeshFiles(
  res: VercelResponse,
  redis: Redis | null,
  userId: string | null,
  hashes: readonly string[]
): Promise<Record<string, string> | null> {
  const unique = [...new Set(hashes)];
  if (unique.length === 0) return {};
  const urls =
    userId && redis ? await heldMeshUrls(redis, userId, unique) : new Map<string, string>();
  const missing = unique.filter((hash) => !urls.has(hash));
  if (missing.length > 0) {
    sendJson(res, MESH_MISSING_STATUS, {
      error: 'Upload the mesh files this design names, or send them inline.',
      code: ErrorCode.MESH_MISSING,
      missing,
    });
    return null;
  }
  return Object.fromEntries(urls);
}

/**
 * {@link resolveHeldMeshFiles} for a share. Shares are otherwise anonymous, so
 * the CSRF check applies only to one naming files.
 */
export async function resolveShareMeshFiles(
  req: VercelRequest,
  res: VercelResponse,
  hashes: readonly string[]
): Promise<Record<string, string> | null> {
  if (hashes.length === 0) return {};
  if (!checkCsrfDefense(req, res)) return null;
  const session = await readOptionalSession(req);
  return resolveHeldMeshFiles(res, getRedis(), session?.userId ?? null, hashes);
}

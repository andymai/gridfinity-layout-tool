/**
 * Minimal client for the public community design endpoints.
 *
 * `probeCommunityDesign` answers one question: is a cached `publishedId`
 * still backed by a live record the caller can see? The server returns 404
 * both when the record is gone and when it is hidden/removed and the caller
 * is not the owner, so 'missing' covers "no longer published as far as this
 * user is concerned". Any other failure (network, 5xx, rate limit) is
 * indeterminate and must not be treated as missing.
 */

import type { ApiError, Result } from '@/core/result';
import { apiNetworkError, apiServerError, err, ok } from '@/core/result';
import { apiFetch } from '@/core/sync/apiFetch';

export type CommunityDesignProbe = 'live' | 'missing';

export async function probeCommunityDesign(
  publishedId: string
): Promise<Result<CommunityDesignProbe, ApiError>> {
  try {
    const response = await apiFetch(`/api/community/${encodeURIComponent(publishedId)}`, {
      // A 401 from this probe says nothing about the sync session.
      suppressForcedSignOut: true,
    });
    if (response.status === 404) return ok('missing');
    if (response.ok) return ok('live');
    return err(apiServerError(response.status));
  } catch (e) {
    return err(apiNetworkError(e));
  }
}

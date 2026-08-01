/**
 * Deterministic fingerprint for generation params.
 *
 * Lives in `shared/` because both sides of the worker boundary need to agree on
 * it: the bridge keys its dedup caches on it, and the worker uses it as the
 * identity of the solid it holds in `shapeCache.lastSolid`. Two copies that
 * drifted would let a stale solid pass for a fresh one.
 */

/**
 * Stable JSON encoding with sorted object keys, so identical params always
 * produce the same string regardless of property insertion order.
 *
 * Collision-free by construction: distinct params always encode differently, so
 * a comparison can only err toward recomputing, never toward reusing the wrong
 * result.
 */
export function paramsFingerprint(params: unknown): string {
  return JSON.stringify(params, (_, value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value).sort()) {
        sorted[key] = (value as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return value;
  });
}

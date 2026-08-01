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
 * Distinguishes any two parameter sets that differ in a value JSON can carry,
 * which is every field generation params actually hold. The encoding is lossy
 * in two places, and neither can hide a geometric difference: an explicitly
 * `undefined` member encodes the same as an absent one (both mean "unset" to
 * every consumer, so they build the same solid), and `NaN`/`Infinity` collapse
 * to `null` (a param already invalid upstream — no solid is built from it).
 */
export function paramsFingerprint(params: unknown): string {
  return JSON.stringify(params, (_, value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Null prototype rather than `{}`: assigning a `__proto__` key to a plain
      // object sets the prototype instead of creating an own property, so that
      // key would vanish from the output and two different maps could
      // fingerprint identically. Params carry map-like objects whose keys come
      // from persisted data, so the key set is not fully ours to control.
      const sorted = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(value).sort()) {
        sorted[key] = (value as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return value;
  });
}

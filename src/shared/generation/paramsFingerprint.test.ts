import { describe, it, expect } from 'vitest';
import { paramsFingerprint } from './paramsFingerprint';

describe('paramsFingerprint', () => {
  it('ignores property insertion order', () => {
    expect(paramsFingerprint({ a: 1, b: 2 })).toBe(paramsFingerprint({ b: 2, a: 1 }));
  });

  it('sorts keys at every depth, not just the top level', () => {
    expect(paramsFingerprint({ base: { x: 1, y: 2 } })).toBe(
      paramsFingerprint({ base: { y: 2, x: 1 } })
    );
  });

  it('preserves array order — position is meaningful in cutouts and cut planes', () => {
    expect(paramsFingerprint([1, 2])).not.toBe(paramsFingerprint([2, 1]));
  });

  it('separates params that differ only in a nested value', () => {
    expect(paramsFingerprint({ lid: { tray: { depthMm: 4 } } })).not.toBe(
      paramsFingerprint({ lid: { tray: { depthMm: 5 } } })
    );
  });

  it('separates params that differ by an extra field', () => {
    expect(paramsFingerprint({ width: 2 })).not.toBe(paramsFingerprint({ width: 2, depth: 3 }));
  });

  it('treats an explicitly undefined member as absent — both mean unset', () => {
    // Documented lossiness, and safe: every consumer of an optional param
    // reads `undefined` and "not present" the same way, so the two build the
    // same solid and sharing a cache entry is correct.
    expect(paramsFingerprint({ width: 2, gridUnitMmY: undefined })).toBe(
      paramsFingerprint({ width: 2 })
    );
  });

  it('keeps a __proto__ map key in the fingerprint', () => {
    // Assigning it to a plain `{}` would set the prototype instead of an own
    // property, dropping the key and letting two different maps match.
    const withKey = JSON.parse('{"compartmentTexts":{"__proto__":"A"}}') as unknown;
    const empty = JSON.parse('{"compartmentTexts":{}}') as unknown;
    expect(paramsFingerprint(withKey)).not.toBe(paramsFingerprint(empty));
    expect(paramsFingerprint(withKey)).toContain('__proto__');
  });

  it('separates dimensions that would collide under naive concatenation', () => {
    // The whole point of the worker-side identity check: `1x11` and `11x1` are
    // different bins and must never share a cached solid (GH #3074).
    expect(paramsFingerprint({ width: 1, depth: 11 })).not.toBe(
      paramsFingerprint({ width: 11, depth: 1 })
    );
  });
});

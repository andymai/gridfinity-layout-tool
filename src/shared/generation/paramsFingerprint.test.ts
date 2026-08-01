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

  it('distinguishes a missing key from an explicit undefined-valued sibling', () => {
    expect(paramsFingerprint({ width: 2 })).not.toBe(paramsFingerprint({ width: 2, depth: 3 }));
  });

  it('separates dimensions that would collide under naive concatenation', () => {
    // The whole point of the worker-side identity check: `1x11` and `11x1` are
    // different bins and must never share a cached solid (GH #3074).
    expect(paramsFingerprint({ width: 1, depth: 11 })).not.toBe(
      paramsFingerprint({ width: 11, depth: 1 })
    );
  });
});

import { describe, it, expect } from 'vitest';
import { allPairs, uncoveredPairs, type Axis } from './pairwise';

const axes = <T>(spec: Record<string, readonly T[]>): Axis<T>[] =>
  Object.entries(spec).map(([name, values]) => ({ name, values }));

describe('allPairs', () => {
  it('covers every value pair for a small set', () => {
    const a = axes({ x: [1, 2, 3], y: [10, 20], z: [100, 200] });
    expect(uncoveredPairs(a, allPairs(a))).toEqual([]);
  });

  it('covers every value pair for a wide, ragged set', () => {
    const a = axes({
      grid: ['1x1', '2x2', '3x2', '8x1'],
      label: ['off', 'back', 'both'],
      scoop: ['off', 'auto', 'typed'],
      grip: ['none', 'scallop'],
      collar: ['0', '4'],
      overhang: ['none', 'asym'],
      attachment: ['clickRails', 'friction', 'magnetic'],
      coverage: ['50', '100'],
    });
    expect(uncoveredPairs(a, allPairs(a))).toEqual([]);
  });

  it('stays far below the full product', () => {
    const a = axes({
      grid: ['1x1', '2x2', '3x2', '8x1'],
      label: ['off', 'back', 'both'],
      scoop: ['off', 'auto', 'typed'],
      grip: ['none', 'scallop'],
      collar: ['0', '4'],
      overhang: ['none', 'asym'],
      attachment: ['clickRails', 'friction', 'magnetic'],
      coverage: ['50', '100'],
    });
    // Full product is 4*3*3*2*2*2*3*2 = 1728 WASM builds. Pairwise is bounded
    // below by the two largest axes (4*3 = 12); anything near the product means
    // the generator has stopped combining.
    expect(allPairs(a).length).toBeLessThan(40);
  });

  it('is deterministic', () => {
    const a = axes({ x: [1, 2, 3], y: [10, 20], z: [100, 200, 300] });
    expect(allPairs(a)).toEqual(allPairs(a));
  });

  it('gives every case a value on every axis', () => {
    const a = axes({ x: [1, 2, 3], y: [10, 20], z: [100, 200] });
    for (const c of allPairs(a)) {
      expect(Object.keys(c).sort()).toEqual(['x', 'y', 'z']);
    }
  });

  it('handles a single-value axis as a constant', () => {
    const a = axes<string>({ x: ['1', '2'], only: ['fixed'] });
    const cases = allPairs(a);
    expect(uncoveredPairs(a, cases)).toEqual([]);
    expect(cases.every((c) => c.only === 'fixed')).toBe(true);
  });

  it('degenerates cleanly', () => {
    expect(allPairs([])).toEqual([]);
    expect(allPairs(axes({ x: [1, 2] }))).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it('uncoveredPairs reports a real gap', () => {
    // Control for every assertion above: if the detector cannot see a missing
    // pair, "covers every value pair" is satisfied by any case list at all.
    const a = axes({ x: [1, 2], y: [10, 20] });
    expect(uncoveredPairs(a, [{ x: 1, y: 10 }])).toEqual(['x=1|y=1', 'x=1|y=0', 'x=0|y=1'].sort());
  });
});

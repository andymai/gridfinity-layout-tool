import { describe, it, expect } from 'vitest';
import { clearedProfile, entryChamferWidth } from './cutoutFit';

describe('clearedProfile', () => {
  it('grows an insert shape by its clearance and keeps a polygon regular', () => {
    expect(clearedProfile({ shape: 'circle', width: 10, depth: 10, clearance: 0.2 })).toEqual({
      clearance: 0.2,
      w: 10.2,
      d: 10.2,
    });
    const hex = clearedProfile({ shape: 'polygon', width: 20, depth: 10, clearance: 1 });
    expect(hex.w / hex.d).toBeCloseTo(2, 9);
    expect(hex.d).toBe(11);
  });

  it('ignores a clearance left on a shape that takes none', () => {
    expect(clearedProfile({ shape: 'rectangle', width: 10, depth: 5, clearance: 1 })).toEqual({
      clearance: 0,
      w: 10,
      d: 5,
    });
  });
});

describe('entryChamferWidth', () => {
  it('keeps a straight wall under the bevel', () => {
    expect(entryChamferWidth({ shape: 'slot', cutDepth: 10, chamferWidth: 0.8 })).toBe(0.8);
    expect(entryChamferWidth({ shape: 'slot', cutDepth: 0.6, chamferWidth: 0.8 })).toBeCloseTo(
      0.4,
      9
    );
  });

  it('gives none to a shape that takes none', () => {
    expect(entryChamferWidth({ shape: 'text', cutDepth: 10, chamferWidth: 0.8 })).toBe(0);
  });
});

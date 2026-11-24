import { describe, expect, it } from 'vitest';
import polygonClipping from 'polygon-clipping';
import { ringBounds } from '@/shared/utils/cutoutOutline';
import { combinationWrenchOutline, type WrenchDims } from './wrenchOutline';

// Wera 6003 Joker 13 mm: 160 long, 27 open end, 19 box end.
const wrench13: WrenchDims = {
  lengthMm: 160,
  openWidthMm: 27,
  boxWidthMm: 19,
  shankWidthMm: 11,
  jawAngleDeg: 15,
};

function area(ring: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

describe('combinationWrenchOutline', () => {
  it('spans the wrench length from the box-end tip', () => {
    const outline = combinationWrenchOutline(wrench13);
    if (!outline) throw new Error('expected an outline');
    const b = ringBounds(outline);
    expect(b.minX).toBeCloseTo(0, 1);
    expect(b.maxX).toBeCloseTo(160, 0);
  });

  it('is as wide as the wider head, and no wider than the tilted open head allows', () => {
    const outline = combinationWrenchOutline(wrench13);
    if (!outline) throw new Error('expected an outline');
    const b = ringBounds(outline);
    expect(b.maxY - b.minY).toBeGreaterThanOrEqual(27 - 0.2);
    expect(b.maxY - b.minY).toBeLessThan(27 * 1.15);
  });

  it('is one counter-clockwise ring that does not cross itself', () => {
    const outline = combinationWrenchOutline(wrench13);
    if (!outline) throw new Error('expected an outline');
    expect(area(outline)).toBeGreaterThan(0);
    const closed = [...outline, outline[0]];
    const self = polygonClipping.union([closed]);
    expect(self).toHaveLength(1);
    expect(self[0]).toHaveLength(1);
  });

  it('refuses dimensions that cannot describe a wrench', () => {
    expect(combinationWrenchOutline({ ...wrench13, lengthMm: 40 })).toBeNull();
    expect(combinationWrenchOutline({ ...wrench13, shankWidthMm: 25 })).toBeNull();
    expect(combinationWrenchOutline({ ...wrench13, boxWidthMm: Number.NaN })).toBeNull();
  });
});

describe('combinationWrenchOutline with a length range', () => {
  it('holds the open head of the shortest and the longest wrench', () => {
    const swept = combinationWrenchOutline({ ...wrench13, lengthMm: 193, minLengthMm: 160 });
    if (!swept) throw new Error('expected an outline');
    const closed = [...swept, swept[0]];
    for (const length of [160, 175, 193]) {
      const one = combinationWrenchOutline({ ...wrench13, lengthMm: length });
      if (!one) throw new Error('expected an outline');
      const outside = polygonClipping.difference([[...one, one[0]]], [closed]);
      const missed = outside.flat().reduce((sum, ring) => sum + Math.abs(area(ring)), 0);
      expect(missed).toBeLessThan(1);
    }
  });
});

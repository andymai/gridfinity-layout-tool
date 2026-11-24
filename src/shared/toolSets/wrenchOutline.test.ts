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
    const b = ringBounds(outline.ring);
    expect(b.minX).toBeCloseTo(0, 1);
    expect(b.maxX).toBeCloseTo(160, 0);
  });

  it('is as wide as the wider head, and no wider than the tilted open head allows', () => {
    const outline = combinationWrenchOutline(wrench13);
    if (!outline) throw new Error('expected an outline');
    const b = ringBounds(outline.ring);
    expect(b.maxY - b.minY).toBeGreaterThanOrEqual(27 - 0.2);
    expect(b.maxY - b.minY).toBeLessThan(27 * 1.15);
  });

  it('is one counter-clockwise ring that does not cross itself', () => {
    const outline = combinationWrenchOutline(wrench13);
    if (!outline) throw new Error('expected an outline');
    expect(area(outline.ring)).toBeGreaterThan(0);
    const closed = [...outline.ring, outline.ring[0]];
    const self = polygonClipping.union([closed]);
    expect(self).toHaveLength(1);
    expect(self[0]).toHaveLength(1);
  });

  it('marks the end of the box-end ring for the deeper well', () => {
    expect(combinationWrenchOutline(wrench13)?.boxEndX).toBe(19);
  });

  it('refuses dimensions that cannot describe a wrench', () => {
    expect(combinationWrenchOutline({ ...wrench13, lengthMm: 40 })).toBeNull();
    expect(combinationWrenchOutline({ ...wrench13, shankWidthMm: 25 })).toBeNull();
    expect(combinationWrenchOutline({ ...wrench13, boxWidthMm: Number.NaN })).toBeNull();
  });
});

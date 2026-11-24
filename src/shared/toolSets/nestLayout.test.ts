import { describe, expect, it } from 'vitest';
import { combinationWrenchOutline } from './wrenchOutline';
import {
  nestHeadToTail,
  nestHeadToTailCompact,
  placeRing,
  ringDistance,
  type NestItem,
} from './nestLayout';

function wrench(length: number, open: number, box: number, shank: number): NestItem {
  const outline = combinationWrenchOutline({
    lengthMm: length,
    openWidthMm: open,
    boxWidthMm: box,
    shankWidthMm: shank,
    jawAngleDeg: 15,
  });
  if (!outline) throw new Error('expected an outline');
  return { ring: outline.ring, length };
}

const set = [
  wrench(125, 19, 13, 7.5),
  wrench(135, 21, 14.5, 8),
  wrench(145, 23, 16, 9),
  wrench(155, 25, 17.5, 10),
];

describe('nestHeadToTail', () => {
  it('turns every other item and keeps one centre line', () => {
    const placements = nestHeadToTail(set, 2);
    expect(placements.map((p) => p.flipped)).toEqual([false, true, false, true]);
    expect(placements.every((p) => p.cx === 0)).toBe(true);
  });

  it('keeps every pair at least the gap apart', () => {
    const placements = nestHeadToTail(set, 2);
    const rings = set.map((item, i) => placeRing(item.ring, item.length, placements[i]));
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        expect(ringDistance(rings[i], rings[j])).toBeGreaterThanOrEqual(2 - 0.01);
      }
    }
  });

  it('nests closer than stacking whole widths', () => {
    const placements = nestHeadToTail(set, 2);
    const pitch = placements[0].cy - placements[1].cy;
    expect(pitch).toBeLessThan(19 / 2 + 21 / 2 + 2);
    expect(pitch).toBeGreaterThan(0);
  });
});

describe('ringDistance', () => {
  it('is zero for overlapping rings and the gap for separate ones', () => {
    const square = (x: number): [number, number][] => [
      [x, 0],
      [x + 10, 0],
      [x + 10, 10],
      [x, 10],
    ];
    expect(ringDistance(square(0), square(5))).toBe(0);
    expect(ringDistance(square(0), square(13))).toBeCloseTo(3, 6);
  });
});

describe('nestHeadToTailCompact', () => {
  it('keeps to a width limit when some shift allows it', () => {
    const free = nestHeadToTailCompact(set, 2);
    const narrow = nestHeadToTailCompact(set, 2, 156);
    expect(narrow.width).toBeLessThanOrEqual(156);
    expect(narrow.width * narrow.depth).toBeGreaterThanOrEqual(free.width * free.depth - 1e-6);
  });
});

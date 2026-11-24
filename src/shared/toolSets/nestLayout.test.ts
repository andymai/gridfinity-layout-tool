import { describe, expect, it } from 'vitest';
import { combinationWrenchOutline } from './wrenchOutline';
import {
  closerThan,
  nestHeadToTail,
  nestHeadToTailCompact,
  placeRing,
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
  return { ring: outline, length };
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
        expect(closerThan(rings[i], rings[j], 2)).toBe(false);
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

describe('closerThan', () => {
  const square = (x: number, size = 10): [number, number][] => [
    [x, 0],
    [x + size, 0],
    [x + size, size],
    [x, size],
  ];

  it('reports overlapping rings at any gap', () => {
    expect(closerThan(square(0), square(5), 0.01)).toBe(true);
  });

  it('reports a ring inside another, where no edges meet', () => {
    expect(closerThan(square(0, 30), square(10), 0.01)).toBe(true);
    expect(closerThan(square(10), square(0, 30), 0.01)).toBe(true);
  });

  it('compares the gap between separate rings', () => {
    expect(closerThan(square(0), square(13), 3.1)).toBe(true);
    expect(closerThan(square(0), square(13), 2.9)).toBe(false);
  });
});

describe('nestHeadToTailCompact', () => {
  it('keeps to a width limit when some shift allows it', () => {
    const free = nestHeadToTailCompact(set, 2);
    const narrow = nestHeadToTailCompact(set, 2, 156);
    expect(narrow.width).toBeLessThanOrEqual(156);
    expect(narrow.width * narrow.depth).toBeGreaterThanOrEqual(free.width * free.depth - 1e-6);
  });

  it('prefers a stack the caller accepts, and falls back to the bed limit', () => {
    const free = nestHeadToTailCompact(set, 2);
    const unshifted = nestHeadToTailCompact(set, 2, Infinity, (r) =>
      r.placements.every((p) => p.cx === 0)
    );
    expect(unshifted.placements.every((p) => p.cx === 0)).toBe(true);
    expect(unshifted.width * unshifted.depth).toBeGreaterThanOrEqual(
      free.width * free.depth - 1e-6
    );
    const none = nestHeadToTailCompact(set, 2, 156, () => false);
    expect(none.width).toBeLessThanOrEqual(156);
  });
});

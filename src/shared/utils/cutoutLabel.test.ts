import { describe, it, expect } from 'vitest';
import { cutoutWorldAabb, cutoutLabelPlacement } from './cutoutLabel';

type AabbInput = Parameters<typeof cutoutWorldAabb>[0];

const base: AabbInput & { textSide?: 'top' | 'bottom' | 'left' | 'right' } = {
  x: 40,
  y: 40,
  width: 20,
  depth: 10,
  rotation: 0,
};

describe('cutoutWorldAabb', () => {
  it('returns the unrotated box around the cutout center', () => {
    expect(cutoutWorldAabb(base, 0, 0)).toEqual({
      minX: 40,
      maxX: 60,
      minY: 40,
      maxY: 50,
    });
  });

  it('shifts by origin (generation passes the bin-centered frame)', () => {
    const aabb = cutoutWorldAabb(base, -50, -50);
    expect(aabb).toEqual({ minX: -10, maxX: 10, minY: -10, maxY: 0 });
  });

  it('expands to the rotated footprint at 90°', () => {
    // 90° swaps the 20×10 footprint to 10×20 about the same center (50, 45).
    const aabb = cutoutWorldAabb({ ...base, rotation: 90 }, 0, 0);
    expect(aabb.minX).toBeCloseTo(45);
    expect(aabb.maxX).toBeCloseTo(55);
    expect(aabb.minY).toBeCloseTo(35);
    expect(aabb.maxY).toBeCloseTo(55);
  });

  it('takes the diagonal extent at 45°', () => {
    const aabb = cutoutWorldAabb({ ...base, rotation: 45 }, 0, 0);
    const half = (20 * Math.SQRT2) / 2; // half-diagonal of width
    const halfD = (10 * Math.SQRT2) / 2;
    expect(aabb.maxX - aabb.minX).toBeCloseTo(half + halfD);
  });
});

describe('cutoutLabelPlacement', () => {
  const W = 100;
  const D = 100;

  it('places a top label in the gap above the cutout, centered on its width', () => {
    const p = cutoutLabelPlacement({ ...base, textSide: 'top' }, W, D);
    expect(p).not.toBeNull();
    expect(p?.centerX).toBeCloseTo(50); // (40+60)/2
    expect(p?.centerY).toBeCloseTo(75); // (50 + 100)/2
    expect(p?.availW).toBeCloseTo(20); // cutout width
    expect(p?.availD).toBeCloseTo(50); // 100 - 50
  });

  it('places a bottom label in the gap below the cutout', () => {
    const p = cutoutLabelPlacement({ ...base, textSide: 'bottom' }, W, D);
    expect(p?.centerX).toBeCloseTo(50);
    expect(p?.centerY).toBeCloseTo(20); // (0 + 40)/2
    expect(p?.availD).toBeCloseTo(40);
  });

  it('places a left label in the gap to the left, centered on its depth', () => {
    const p = cutoutLabelPlacement({ ...base, textSide: 'left' }, W, D);
    expect(p?.centerX).toBeCloseTo(20); // (0 + 40)/2
    expect(p?.centerY).toBeCloseTo(45); // (40 + 50)/2
    expect(p?.availW).toBeCloseTo(40);
    expect(p?.availD).toBeCloseTo(10); // cutout depth
  });

  it('places a right label in the gap to the right', () => {
    const p = cutoutLabelPlacement({ ...base, textSide: 'right' }, W, D);
    expect(p?.centerX).toBeCloseTo(80); // (60 + 100)/2
    expect(p?.availW).toBeCloseTo(40); // 100 - 60
  });

  it('defaults to the top side when textSide is missing', () => {
    const withSide = cutoutLabelPlacement({ ...base, textSide: 'top' }, W, D);
    const without = cutoutLabelPlacement(base, W, D);
    expect(without).toEqual(withSide);
  });

  it('returns null when the chosen side has no room', () => {
    // Cutout flush against the back wall — no gap above for a top label.
    const flush = { ...base, y: D - base.depth, textSide: 'top' as const };
    expect(cutoutLabelPlacement(flush, W, D)).toBeNull();
  });

  it('produces the same band in the editor frame and the bin-centered frame', () => {
    const editor = cutoutLabelPlacement({ ...base, textSide: 'top' }, W, D, 0, 0);
    const centered = cutoutLabelPlacement({ ...base, textSide: 'top' }, W, D, -W / 2, -D / 2);
    if (editor === null || centered === null) throw new Error('expected placements');
    // Same widths; centers differ by exactly the origin shift.
    expect(centered.availW).toBeCloseTo(editor.availW);
    expect(centered.availD).toBeCloseTo(editor.availD);
    expect(centered.centerX).toBeCloseTo(editor.centerX - W / 2);
    expect(centered.centerY).toBeCloseTo(editor.centerY - D / 2);
  });
});

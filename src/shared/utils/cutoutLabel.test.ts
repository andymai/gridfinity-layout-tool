import { describe, it, expect } from 'vitest';
import { cutoutWorldAabb, cutoutLabelPlacement, resolveCutoutTextAnchor } from './cutoutLabel';
import type { Cutout } from '@/shared/types/bin';

type AabbInput = Parameters<typeof cutoutWorldAabb>[0];

const base: AabbInput & Partial<Pick<Cutout, 'textSide' | 'textAnchor' | 'textOffset'>> = {
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
    // Spanned axis grows symmetrically into the interior: 2·min(50, 100-50).
    expect(p?.availW).toBeCloseTo(100);
    expect(p?.availD).toBeCloseTo(50); // 100 - 50
  });

  it('places a bottom label in the gap below the cutout', () => {
    const p = cutoutLabelPlacement({ ...base, textSide: 'bottom' }, W, D);
    expect(p?.centerX).toBeCloseTo(50);
    expect(p?.centerY).toBeCloseTo(20); // (0 + 40)/2
    // Spanned axis grows symmetrically into the interior: 2·min(50, 100-50).
    expect(p?.availW).toBeCloseTo(100);
    expect(p?.availD).toBeCloseTo(40);
  });

  it('places a left label in the gap to the left, centered on its depth', () => {
    const p = cutoutLabelPlacement({ ...base, textSide: 'left' }, W, D);
    expect(p?.centerX).toBeCloseTo(20); // (0 + 40)/2
    expect(p?.centerY).toBeCloseTo(45); // (40 + 50)/2
    expect(p?.availW).toBeCloseTo(40);
    // Spanned axis grows into the interior: 2·min(45, 100-45).
    expect(p?.availD).toBeCloseTo(90);
  });

  it('places a right label in the gap to the right', () => {
    const p = cutoutLabelPlacement({ ...base, textSide: 'right' }, W, D);
    expect(p?.centerX).toBeCloseTo(80); // (60 + 100)/2
    expect(p?.availW).toBeCloseTo(40); // 100 - 60
    // Spanned axis grows symmetrically into the interior: 2·min(45, 100-45).
    expect(p?.availD).toBeCloseTo(90);
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

  it('places a top-right corner label in the diagonal gap past the corner', () => {
    const p = cutoutLabelPlacement({ ...base, textAnchor: 'top-right' }, W, D);
    expect(p?.centerX).toBeCloseTo(80); // (60 + 100)/2
    expect(p?.centerY).toBeCloseTo(75); // (50 + 100)/2
    expect(p?.availW).toBeCloseTo(40); // 100 - 60
    expect(p?.availD).toBeCloseTo(50); // 100 - 50
  });

  it('places a bottom-left corner label past the front-left corner', () => {
    const p = cutoutLabelPlacement({ ...base, textAnchor: 'bottom-left' }, W, D);
    expect(p?.centerX).toBeCloseTo(20); // (0 + 40)/2
    expect(p?.centerY).toBeCloseTo(20); // (0 + 40)/2
    expect(p?.availW).toBeCloseTo(40);
    expect(p?.availD).toBeCloseTo(40);
  });

  it('places a center (on-face) label over the cutout footprint', () => {
    const p = cutoutLabelPlacement({ ...base, textAnchor: 'center' }, W, D);
    expect(p?.centerX).toBeCloseTo(50);
    expect(p?.centerY).toBeCloseTo(45);
    // Both axes are spanned, so both grow symmetrically into the interior.
    expect(p?.availW).toBeCloseTo(100); // 2·min(50, 100-50)
    expect(p?.availD).toBeCloseTo(90); // 2·min(45, 100-45)
  });

  it('gives a narrow cutout a band far wider than its own width (#2583)', () => {
    // A 7.5mm-wide cutout centered in the interior used to cap the label to
    // 7.5mm, dropping it below the legibility floor. The band now spans the
    // room around the center instead of the cutout footprint.
    const narrow = { ...base, x: 50 - 3.75, width: 7.5, textSide: 'top' as const };
    const p = cutoutLabelPlacement(narrow, W, D);
    expect(p?.centerX).toBeCloseTo(50);
    expect(p?.availW).toBeCloseTo(100); // 2·min(50, 100-50), not 7.5
    expect(p?.availW ?? 0).toBeGreaterThan(7.5);
  });

  it('keeps the band symmetric when the cutout hugs an interior edge', () => {
    // Cutout centered near the left wall: the band can only borrow the smaller
    // side so it never crosses the interior edge.
    const nearEdge = { ...base, x: 0, width: 8, textSide: 'top' as const };
    const p = cutoutLabelPlacement(nearEdge, W, D);
    expect(p?.centerX).toBeCloseTo(4); // (0 + 8)/2
    expect(p?.availW).toBeCloseTo(8); // 2·min(4, 100-4)
  });

  it('on-face center always has room even flush against a wall', () => {
    const flush = { ...base, y: D - base.depth, textAnchor: 'center' as const };
    expect(cutoutLabelPlacement(flush, W, D)).not.toBeNull();
  });

  it('applies textOffset as a free nudge from the anchored center', () => {
    const anchored = cutoutLabelPlacement({ ...base, textAnchor: 'top' }, W, D);
    const nudged = cutoutLabelPlacement(
      { ...base, textAnchor: 'top', textOffset: { x: 5, y: -3 } },
      W,
      D
    );
    expect(nudged?.centerX).toBeCloseTo((anchored?.centerX ?? 0) + 5);
    expect(nudged?.centerY).toBeCloseTo((anchored?.centerY ?? 0) - 3);
    // Offset doesn't change the auto-fit band.
    expect(nudged?.availW).toBeCloseTo(anchored?.availW ?? 0);
  });

  it('textAnchor wins over a legacy textSide; bands match the migrated side', () => {
    const viaAnchor = cutoutLabelPlacement({ ...base, textAnchor: 'left' }, W, D);
    const viaSide = cutoutLabelPlacement({ ...base, textSide: 'left' }, W, D);
    expect(viaAnchor).toEqual(viaSide);
    // Anchor takes precedence when both are present.
    const both = cutoutLabelPlacement({ ...base, textSide: 'left', textAnchor: 'top' }, W, D);
    const topOnly = cutoutLabelPlacement({ ...base, textAnchor: 'top' }, W, D);
    expect(both).toEqual(topOnly);
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

describe('resolveCutoutTextAnchor', () => {
  it('returns the explicit anchor when present', () => {
    expect(resolveCutoutTextAnchor({ textAnchor: 'bottom-right' })).toBe('bottom-right');
  });

  it('migrates each legacy side onto its edge-center anchor', () => {
    expect(resolveCutoutTextAnchor({ textSide: 'top' })).toBe('top');
    expect(resolveCutoutTextAnchor({ textSide: 'bottom' })).toBe('bottom');
    expect(resolveCutoutTextAnchor({ textSide: 'left' })).toBe('left');
    expect(resolveCutoutTextAnchor({ textSide: 'right' })).toBe('right');
  });

  it('prefers an explicit anchor over a legacy side', () => {
    expect(resolveCutoutTextAnchor({ textSide: 'left', textAnchor: 'center' })).toBe('center');
  });

  it('defaults to top when neither is set', () => {
    expect(resolveCutoutTextAnchor({})).toBe('top');
  });
});

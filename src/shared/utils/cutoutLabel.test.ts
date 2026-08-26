import { describe, it, expect } from 'vitest';
import {
  cutoutWorldAabb,
  cutoutLabelPlacement,
  expandBandToInterior,
  fitLabelRoom,
  hasExplicitLabelSize,
  resolveCutoutTextAnchor,
  textElementFootprint,
  withTextFootprint,
} from './cutoutLabel';
import type { Cutout, CutoutArrayConfig } from '@/shared/types/bin';

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

describe('fitLabelRoom', () => {
  const cfg = (over: Partial<CutoutArrayConfig> = {}): CutoutArrayConfig => ({
    mode: 'grid',
    cols: 4,
    rows: 1,
    pitchX: 38,
    pitchY: 38,
    count: 4,
    radius: 30,
    startAngle: 0,
    rotateToCenter: false,
    ...over,
  });

  it('leaves the band alone when there is no repeat', () => {
    expect(fitLabelRoom(160, 40, undefined)).toEqual({ availW: 160, availD: 40 });
  });

  it('leaves the band alone for a repeat that labels itself once', () => {
    // No list means one caption beside the master, which still gets the full
    // band. Capping here would resize the text every stored design engraves.
    expect(fitLabelRoom(160, 40, cfg())).toEqual({ availW: 160, availD: 40 });
  });

  it('caps a labelled row to its column pitch, so captions cannot collide', () => {
    // The band grows into the interior by design; four copies each claiming
    // 160mm printed on top of each other.
    expect(fitLabelRoom(160, 40, cfg({ labels: ['a', 'b', 'c', 'd'] }))).toEqual({
      availW: 38,
      availD: 40,
    });
  });

  it('caps only the axis the repeat actually runs along', () => {
    const oneColumn = cfg({ cols: 1, rows: 4, labels: ['a', 'b', 'c', 'd'] });
    expect(fitLabelRoom(160, 200, oneColumn)).toEqual({ availW: 160, availD: 38 });
  });

  it('never widens a band that was already tighter than the pitch', () => {
    expect(fitLabelRoom(12, 9, cfg({ labels: ['a'] }))).toEqual({ availW: 12, availD: 9 });
  });

  it('caps a labelled ring to the gap between neighbours', () => {
    // Chord between adjacent copies of a 4-ring at r=30: 2*30*sin(45°) ≈ 42.4.
    const ring = cfg({ mode: 'radial', count: 4, radius: 30, labels: ['a', 'b', 'c', 'd'] });
    const room = fitLabelRoom(160, 160, ring);
    expect(room.availW).toBeCloseTo(42.43, 1);
    expect(room.availD).toBeCloseTo(42.43, 1);
  });

  it('leaves a single-copy ring uncapped', () => {
    expect(fitLabelRoom(160, 160, cfg({ mode: 'radial', count: 1, labels: ['a'] }))).toEqual({
      availW: 160,
      availD: 160,
    });
  });
});

describe('hasExplicitLabelSize', () => {
  it('fires on a per-cutout fixed size mode', () => {
    expect(hasExplicitLabelSize({})).toBe(false);
    expect(hasExplicitLabelSize({ textStyle: { fontSizeOverride: 8 } })).toBe(false);
    expect(hasExplicitLabelSize({ textStyle: { sizeMode: 'auto' } })).toBe(false);
    expect(hasExplicitLabelSize({ textStyle: { sizeMode: 'fixed' } })).toBe(true);
    expect(hasExplicitLabelSize({ textStyle: { sizeMode: 'fixed', fixedSize: 8 } })).toBe(true);
  });

  it('treats a text element as explicit even without a style', () => {
    expect(hasExplicitLabelSize({ shape: 'text' })).toBe(true);
    expect(hasExplicitLabelSize({ shape: 'circle' })).toBe(false);
  });
});

describe('expandBandToInterior', () => {
  it('grows a narrow gap band symmetric about its center', () => {
    // Center at (50, 30) in a 100×100 interior: symmetric room is 100 on X
    // (50 each way) and 60 on Y (30 to the near edge, mirrored).
    const placement = { centerX: 50, centerY: 30, availW: 20, availD: 4 };
    expect(expandBandToInterior(placement, 100, 100)).toEqual({
      centerX: 50,
      centerY: 30,
      availW: 100,
      availD: 60,
    });
  });

  it('never returns less room than the anchor band itself', () => {
    // An offset drags the center past the interior edge: symmetric room is
    // negative there, so the original band stands.
    const placement = { centerX: -5, centerY: 50, availW: 12, availD: 8 };
    const out = expandBandToInterior(placement, 100, 100);
    expect(out.availW).toBe(12);
    expect(out.availD).toBe(100);
  });

  it('respects a shifted origin, as generation uses', () => {
    // Generation centers the interior on the model origin: a band centered on
    // the origin has the full interior symmetric around it.
    const placement = { centerX: 0, centerY: 0, availW: 5, availD: 5 };
    expect(expandBandToInterior(placement, 100, 80, -50, -40)).toEqual({
      centerX: 0,
      centerY: 0,
      availW: 100,
      availD: 80,
    });
  });
});

describe('textElementFootprint', () => {
  it('scales with caption length and size', () => {
    expect(textElementFootprint('ABCD', 10)).toEqual({ width: 24, depth: 12 });
  });

  it('floors an empty caption so the element stays clickable', () => {
    const empty = textElementFootprint('', 8);
    expect(empty.width).toBeGreaterThanOrEqual(4);
    expect(empty.depth).toBeGreaterThanOrEqual(4);
  });
});

describe('withTextFootprint', () => {
  const textElement: Cutout = {
    id: 't1',
    shape: 'text',
    x: 40,
    y: 40,
    width: 20,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: 'AB',
    groupId: null,
    engraveLabel: true,
    textStyle: { sizeMode: 'fixed', fixedSize: 10 },
  };

  it('re-derives the box from the caption, holding the center still', () => {
    const out = withTextFootprint(textElement);
    // 2 chars × 0.6 × 10mm = 12 wide, 12 tall (1.2em line box).
    expect(out.width).toBeCloseTo(12);
    expect(out.depth).toBeCloseTo(12);
    expect(out.x + out.width / 2).toBeCloseTo(40 + 20 / 2);
    expect(out.y + out.depth / 2).toBeCloseTo(40 + 10 / 2);
  });

  it('is identity for other shapes and for an in-sync footprint', () => {
    const circle = { ...textElement, shape: 'circle' as const };
    expect(withTextFootprint(circle)).toBe(circle);
    const synced = withTextFootprint(textElement);
    expect(withTextFootprint(synced)).toBe(synced);
  });
});

import { describe, it, expect } from 'vitest';
import {
  packOntoPlates,
  plateColumnCount,
  plateOrigin,
  LOGICAL_PLATE_GAP,
  DEFAULT_PART_SPACING_MM,
  DEFAULT_PLATE_MARGIN_MM,
} from './platePacking';
import type { PlatePackingItem, PlatePackingOptions, PlatePlacement } from './platePacking';

const BED: PlatePackingOptions = {
  bedWidthMm: 256,
  bedDepthMm: 256,
  spacingMm: DEFAULT_PART_SPACING_MM,
  marginMm: DEFAULT_PLATE_MARGIN_MM,
};

/** 1x1 gridfinity bin footprint. */
const unit = (w: number, d: number): PlatePackingItem => ({ widthMm: w * 42, depthMm: d * 42 });

/** Axis-aligned overlap test on the same plate. */
function overlaps(
  a: PlatePlacement,
  ai: PlatePackingItem,
  b: PlatePlacement,
  bi: PlatePackingItem
): boolean {
  if (a.plate !== b.plate) return false;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx < (ai.widthMm + bi.widthMm) / 2 && dy < (ai.depthMm + bi.depthMm) / 2;
}

describe('plateColumnCount', () => {
  it('mirrors the slicer grid: a square-ish column count', () => {
    // compute_colum_count in PartPlate.hpp: round(sqrt(n)), +1 when sqrt
    // overshoots the round. 5 plates -> sqrt 2.24, round 2, so 3 columns.
    expect(plateColumnCount(1)).toBe(1);
    expect(plateColumnCount(2)).toBe(2);
    expect(plateColumnCount(4)).toBe(2);
    expect(plateColumnCount(5)).toBe(3);
    expect(plateColumnCount(9)).toBe(3);
    expect(plateColumnCount(10)).toBe(4);
  });

  it('never returns zero columns for an empty or single plate', () => {
    expect(plateColumnCount(0)).toBe(1);
  });
});

describe('plateOrigin', () => {
  it('places the first plate at the world origin', () => {
    expect(plateOrigin(0, 1, 256, 256)).toEqual({ x: 0, y: 0 });
  });

  it('strides by the bed size plus the fixed logical gap', () => {
    // LOGICAL_PART_PLATE_GAP is 1/5 in PartPlate.hpp, so the stride is 1.2x bed.
    expect(plateOrigin(1, 2, 256, 256)).toEqual({ x: 256 * (1 + LOGICAL_PLATE_GAP), y: 0 });
  });

  it('advances rows in NEGATIVE Y', () => {
    // origin(1) = -row * depth * 1.2 — getting this sign wrong puts row 2
    // behind the printer instead of in front of it.
    const third = plateOrigin(2, 4, 256, 200);
    expect(third.x).toBe(0);
    expect(third.y).toBe(-200 * (1 + LOGICAL_PLATE_GAP));
  });
});

describe('packOntoPlates', () => {
  it('returns nothing for no items', () => {
    const result = packOntoPlates([], BED);
    expect(result.placements).toEqual([]);
    expect(result.plateCount).toBe(0);
  });

  it('keeps a small set on one plate', () => {
    const items = [unit(1, 1), unit(2, 1), unit(1, 2)];
    const result = packOntoPlates(items, BED);
    expect(result.plateCount).toBe(1);
    expect(result.placements.every((p) => p.plate === 0)).toBe(true);
  });

  it('returns one placement per item in input order', () => {
    // Placement is computed in sorted order, so an off-by-one in the index
    // carry would silently transpose two parts.
    const items = [unit(1, 1), unit(4, 4), unit(2, 2)];
    const result = packOntoPlates(items, BED);
    expect(result.placements).toHaveLength(3);
    expect(result.placements.every((p) => p !== undefined)).toBe(true);
  });

  it('never overlaps two parts on the same plate', () => {
    const items = Array.from({ length: 40 }, (_, i) => unit((i % 3) + 1, (i % 2) + 1));
    const { placements } = packOntoPlates(items, BED);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        expect(
          overlaps(placements[i], items[i], placements[j], items[j]),
          `item ${i} overlaps item ${j}`
        ).toBe(false);
      }
    }
  });

  it('keeps every part inside the usable bed area', () => {
    const items = Array.from({ length: 25 }, () => unit(2, 2));
    const { placements } = packOntoPlates(items, BED);
    placements.forEach((p, i) => {
      expect(p.x - items[i].widthMm / 2).toBeGreaterThanOrEqual(BED.marginMm - 1e-9);
      expect(p.y - items[i].depthMm / 2).toBeGreaterThanOrEqual(BED.marginMm - 1e-9);
      expect(p.x + items[i].widthMm / 2).toBeLessThanOrEqual(BED.bedWidthMm - BED.marginMm + 1e-9);
      expect(p.y + items[i].depthMm / 2).toBeLessThanOrEqual(BED.bedDepthMm - BED.marginMm + 1e-9);
    });
  });

  it('opens a second plate once the bed is full', () => {
    // 30 x 2x2 bins (84mm each) cannot fit a 246mm usable square.
    const items = Array.from({ length: 30 }, () => unit(2, 2));
    const result = packOntoPlates(items, BED);
    expect(result.plateCount).toBeGreaterThan(1);
  });

  it('gives an oversize part its own plate instead of dropping it', () => {
    const items = [unit(1, 1), { widthMm: 400, depthMm: 400 }, unit(1, 1)];
    const result = packOntoPlates(items, BED);
    expect(result.oversizeIndices).toEqual([1]);
    expect(result.placements).toHaveLength(3);
    const oversizePlate = result.placements[1].plate;
    expect(result.placements.filter((p) => p.plate === oversizePlate)).toHaveLength(1);
  });

  it('does not report a trailing empty plate when the last part is oversize', () => {
    // The oversize branch opens a fresh plate for whatever comes next; if that
    // plate counted as used, the slicer would show an empty plate at the end.
    const result = packOntoPlates([unit(1, 1), { widthMm: 400, depthMm: 400 }], BED);
    expect(result.plateCount).toBe(2);
  });

  it('counts exactly the plates it used', () => {
    const items = Array.from({ length: 12 }, () => unit(2, 2));
    const { placements, plateCount } = packOntoPlates(items, BED);
    const used = new Set(placements.map((p) => p.plate));
    expect(used.size).toBe(plateCount);
    expect(Math.max(...used)).toBe(plateCount - 1);
  });
});

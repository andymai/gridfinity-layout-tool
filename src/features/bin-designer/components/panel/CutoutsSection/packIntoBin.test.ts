import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { offFloorIds, packIntoBin } from './packIntoBin';
import { getCutoutBounds, rectFitsInMask } from './maskFit';
import { translateCutoutPreview } from './cutoutHelpers';

const rect = (id: string, width: number, depth: number): Cutout => ({
  id,
  shape: 'rectangle',
  x: 0,
  y: 0,
  width,
  depth,
  cutDepth: 10,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
});

const bin = (cutouts: Cutout[], width = 2, depth = 2): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  style: 'solid',
  width,
  depth,
  cutouts,
});

function landsInside(params: BinParams, halfGrid = false): boolean {
  const { size, placements } = packIntoBin(params, halfGrid);
  const sized = size ? { ...params, ...size } : params;
  const { innerW, innerD } = cutoutInterior(sized);
  return params.cutouts.every((c) => {
    const b = getCutoutBounds(translateCutoutPreview(c, placements[c.id] ?? {}));
    return b.minX >= -1e-6 && b.minY >= -1e-6 && b.maxX <= innerW + 1e-6 && b.maxY <= innerD + 1e-6;
  });
}

describe('packIntoBin', () => {
  it('keeps the size when the tools already fit', () => {
    const params = bin([rect('a', 20, 10), rect('b', 15, 15)]);
    expect(packIntoBin(params, false).size).toBeNull();
    expect(landsInside(params)).toBe(true);
  });

  it('grows by half units in half-grid mode', () => {
    const params = bin([rect('a', 95, 20)]);
    expect(packIntoBin(params, true).size).toEqual({ width: 2.5, depth: 2 });
    expect(landsInside(params, true)).toBe(true);
    expect(packIntoBin(params, false).size).toEqual({ width: 3, depth: 2 });
  });

  it('packs new tools around a locked pocket', () => {
    const pinned = { ...rect('pinned', 30, 30), x: 2, y: 2, locked: true };
    const params = bin([pinned, rect('a', 20, 20)]);
    const { placements } = packIntoBin(params, false);
    const a = getCutoutBounds(translateCutoutPreview(rect('a', 20, 20), placements.a));
    const p = getCutoutBounds(pinned);
    expect(placements.pinned).toBeUndefined();
    expect(a.minX >= p.maxX || a.minY >= p.maxY).toBe(true);
  });

  it("keeps tools out of a custom footprint's notch", () => {
    // Masks are half-bin cells, so a 2x2 bin's is 4x4. Its bottom-left grid
    // cell is missing: an L-shaped bin.
    const mask: CellMask = {
      cols: 4,
      rows: 4,
      cells: [0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    };
    const params: BinParams = { ...bin([rect('a', 20, 20)]), cellMask: mask };
    const { innerW, innerD } = cutoutInterior(params);
    const { placements } = packIntoBin(params, false);
    const b = getCutoutBounds(translateCutoutPreview(rect('a', 20, 20), placements.a));
    const cell = { cellMmX: innerW / 4, cellMmY: innerD / 4 };
    expect(rectFitsInMask(mask, b.minX, b.minY, 20, 20, cell)).toBe(true);
  });

  it('leaves hidden pockets, which are never cut, out of the off-floor set', () => {
    const stray = { ...rect('stray', 900, 20), x: 2, y: 2 };
    expect(offFloorIds(bin([stray]))).toEqual(new Set(['stray']));
    expect(offFloorIds(bin([{ ...stray, hidden: true }])).size).toBe(0);
  });

  it('grows the bin until a long tool and its neighbours fit', () => {
    const params = bin([rect('a', 150, 30), rect('b', 40, 20), rect('c', 40, 20)]);
    const { size } = packIntoBin(params, false);
    expect(size).not.toBeNull();
    expect(landsInside(params)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { packIntoBin } from './packIntoBin';
import { getCutoutBounds } from './maskFit';
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

  it('grows the bin until a long tool and its neighbours fit', () => {
    const params = bin([rect('a', 150, 30), rect('b', 40, 20), rect('c', 40, 20)]);
    const { size } = packIntoBin(params, false);
    expect(size).not.toBeNull();
    expect(landsInside(params)).toBe(true);
  });
});

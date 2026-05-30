import { describe, it, expect } from 'vitest';
import { resolveOverTileStatus } from './overTileStatus';
import { DEFAULT_BASEPLATE_PARAMS, OVER_TILE_MIN_MARGIN_MM } from '@/core/constants';
import { mm } from '@/core/types';
import type { BaseplateParams } from '@/core/types';

const params = (o: Partial<BaseplateParams> = {}): BaseplateParams => ({
  ...DEFAULT_BASEPLATE_PARAMS,
  ...o,
});

describe('resolveOverTileStatus', () => {
  it('reports no tiling when there is no padding', () => {
    const s = resolveOverTileStatus(params());
    expect(s.tiled).toHaveLength(0);
    expect(s.tooSmall).toHaveLength(0);
    expect(s.canOverTile).toBe(false);
  });

  it('classifies wide margins as tiled', () => {
    const s = resolveOverTileStatus(params({ paddingLeft: mm(12), paddingRight: mm(12) }));
    expect(s.tiled.map((e) => e.labelKey)).toEqual([
      'baseplate.paddingLeft',
      'baseplate.paddingRight',
    ]);
    expect(s.canOverTile).toBe(true);
  });

  it('classifies a sub-threshold margin as too-small (kept solid)', () => {
    const below = OVER_TILE_MIN_MARGIN_MM - 1;
    const s = resolveOverTileStatus(params({ paddingFront: mm(below), paddingBack: mm(below) }));
    expect(s.tiled).toHaveLength(0);
    expect(s.tooSmall).toHaveLength(2);
    expect(s.canOverTile).toBe(false);
  });

  it('handles a mix: tile the wide axis, keep the thin axis solid', () => {
    const s = resolveOverTileStatus(
      params({ paddingLeft: mm(12), paddingRight: mm(12), paddingFront: mm(3), paddingBack: mm(3) })
    );
    expect(s.tiled.map((e) => e.labelKey)).toEqual([
      'baseplate.paddingLeft',
      'baseplate.paddingRight',
    ]);
    expect(s.tooSmall.map((e) => e.labelKey)).toEqual([
      'baseplate.paddingFront',
      'baseplate.paddingBack',
    ]);
    expect(s.canOverTile).toBe(true);
  });
});

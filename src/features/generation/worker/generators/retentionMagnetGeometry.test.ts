import { describe, it, expect } from 'vitest';
import {
  retentionBossRadius,
  retentionMagnetPositions,
  usesMagneticLid,
} from './retentionMagnetGeometry';
import { LID_MAGNET_BOSS_WALL, LID_MAGNET_EDGE_INSET } from './lidConstants';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';

function withLid(params: Partial<BinParams['lid']>, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...extra,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...params },
  };
}

describe('retentionBossRadius', () => {
  it('adds the boss wall to the magnet radius', () => {
    expect(retentionBossRadius(6)).toBe(3 + LID_MAGNET_BOSS_WALL);
  });
});

describe('retentionMagnetPositions', () => {
  it('places four symmetric corners inset by the boss radius + edge inset', () => {
    const r = retentionBossRadius(6);
    const positions = retentionMagnetPositions(2, 2, 42, 42, r);
    expect(positions).toHaveLength(4);
    const x = 42 - (r + LID_MAGNET_EDGE_INSET); // halfW (2*42/2 = 42) - inset
    expect(positions).toEqual([
      [-x, -x],
      [x, -x],
      [-x, x],
      [x, x],
    ]);
  });

  it('stretches with a non-square grid pitch', () => {
    const r = 4;
    const [[, y0]] = retentionMagnetPositions(2, 2, 42, 50, r);
    // halfD = 2*50/2 = 50, inset (r + edge) → keeps inside the footprint
    expect(y0).toBeCloseTo(-(50 - (r + LID_MAGNET_EDGE_INSET)));
  });

  it('is centred on the origin (matching bin + lid frames) so magnets mate', () => {
    const positions = retentionMagnetPositions(3, 2, 42, 42, 4);
    const sumX = positions.reduce((a, [px]) => a + px, 0);
    const sumY = positions.reduce((a, [, py]) => a + py, 0);
    expect(sumX).toBeCloseTo(0);
    expect(sumY).toBeCloseTo(0);
  });
});

describe('usesMagneticLid', () => {
  it('is true for an enabled magnetic lid on a rectangular bin with a lip', () => {
    expect(usesMagneticLid(withLid({ attachment: 'magnetic' }))).toBe(true);
  });

  it('is false for non-magnetic attachment modes', () => {
    expect(usesMagneticLid(withLid({ attachment: 'clickRails' }))).toBe(false);
    expect(usesMagneticLid(withLid({ attachment: 'friction' }))).toBe(false);
  });

  it('is false when the lid is disabled', () => {
    expect(usesMagneticLid(withLid({ enabled: false, attachment: 'magnetic' }))).toBe(false);
  });

  it('is false without a stacking lip', () => {
    const params = withLid(
      { attachment: 'magnetic' },
      { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }
    );
    expect(usesMagneticLid(params)).toBe(false);
  });

  it('is false for polygon (cellMask) bins — corner placement unsupported', () => {
    const mask: CellMask = { cols: 4, rows: 4, cells: new Array(16).fill(1) as (0 | 1)[] };
    // A fully-filled mask reads as rectangular; use a partial one.
    mask.cells[0] = 0;
    expect(usesMagneticLid(withLid({ attachment: 'magnetic' }, { cellMask: mask }))).toBe(false);
  });
});

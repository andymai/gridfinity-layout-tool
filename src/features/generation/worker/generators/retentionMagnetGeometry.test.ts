import { describe, it, expect } from 'vitest';
import {
  retentionBossRadius,
  retentionMagnetInset,
  retentionMagnetPositions,
  usesMagneticLid,
} from './retentionMagnetGeometry';
import { LID_MAGNET_BOSS_WALL, LID_MAGNET_LIP_CLEARANCE } from './lidConstants';
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

describe('retentionMagnetInset', () => {
  it('keeps the boss clear of the lip (lip clearance + boss radius)', () => {
    expect(retentionMagnetInset(6)).toBe(LID_MAGNET_LIP_CLEARANCE + retentionBossRadius(6));
  });
});

describe('retentionMagnetPositions', () => {
  it('places four symmetric corners inset from the nominal corner', () => {
    const inset = retentionMagnetInset(6);
    const positions = retentionMagnetPositions(2, 2, 42, 42, inset);
    expect(positions).toHaveLength(4);
    const x = 42 - inset; // halfW (2*42/2 = 42) - inset
    expect(positions).toEqual([
      [-x, -x],
      [x, -x],
      [-x, x],
      [x, x],
    ]);
  });

  it('keeps the magnet boss well inside the footprint (drawer-safe)', () => {
    const inset = retentionMagnetInset(6);
    const [, [x]] = retentionMagnetPositions(2, 2, 42, 42, inset);
    // Boss outer edge (x + bossRadius) must stay inside the nominal half-width.
    expect(x + retentionBossRadius(6)).toBeLessThan(42);
  });

  it('stretches with a non-square grid pitch', () => {
    const inset = 8;
    const [[, y0]] = retentionMagnetPositions(2, 2, 42, 50, inset);
    // halfD = 2*50/2 = 50, inset keeps the magnet inboard.
    expect(y0).toBeCloseTo(-(50 - inset));
  });

  it('is centred on the origin (matching bin + lid frames) so magnets mate', () => {
    const positions = retentionMagnetPositions(3, 2, 42, 42, 8);
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

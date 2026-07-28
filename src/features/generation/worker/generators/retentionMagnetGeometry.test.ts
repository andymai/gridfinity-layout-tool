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
      { x: -x, y: -x, anchor: 'corner' },
      { x, y: -x, anchor: 'corner' },
      { x: -x, y: x, anchor: 'corner' },
      { x, y: x, anchor: 'corner' },
    ]);
  });

  it('defaults to only the four corners (no edge magnets)', () => {
    const positions = retentionMagnetPositions(6, 6, 42, 42, retentionMagnetInset(6));
    expect(positions).toHaveLength(4);
    expect(positions.every((p) => p.anchor === 'corner')).toBe(true);
  });

  it('keeps the magnet boss well inside the footprint (drawer-safe)', () => {
    const inset = retentionMagnetInset(6);
    const { x } = retentionMagnetPositions(2, 2, 42, 42, inset)[1];
    // Boss outer edge (x + bossRadius) must stay inside the nominal half-width.
    expect(x + retentionBossRadius(6)).toBeLessThan(42);
  });

  it('stretches with a non-square grid pitch', () => {
    const inset = 8;
    const { y: y0 } = retentionMagnetPositions(2, 2, 42, 50, inset)[0];
    // halfD = 2*50/2 = 50, inset keeps the magnet inboard.
    expect(y0).toBeCloseTo(-(50 - inset));
  });

  it('is centred on the origin (matching bin + lid frames) so magnets mate', () => {
    const positions = retentionMagnetPositions(3, 2, 42, 42, 8);
    const sumX = positions.reduce((a, p) => a + p.x, 0);
    const sumY = positions.reduce((a, p) => a + p.y, 0);
    expect(sumX).toBeCloseTo(0);
    expect(sumY).toBeCloseTo(0);
  });
});

describe('retentionMagnetPositions edge magnets (#2844)', () => {
  const inset = retentionMagnetInset(6);
  const bossR = retentionBossRadius(6);

  it('adds edge magnets on both axes of a large square lid', () => {
    // 6x6 @ 42mm: each edge span (2*(halfW - inset)) is ~237mm — plenty of room
    // for a magnet on every edge.
    const positions = retentionMagnetPositions(6, 6, 42, 42, inset, 1, bossR);
    const edges = positions.filter((p) => p.anchor !== 'corner');
    // 1 per edge × 4 edges.
    expect(edges).toHaveLength(4);
    // Mid front/back walls anchor 'y' (free in X); mid left/right walls anchor 'x'.
    expect(edges.filter((p) => p.anchor === 'y')).toHaveLength(2);
    expect(edges.filter((p) => p.anchor === 'x')).toHaveLength(2);
    // Edge magnets sit at the wall midpoint (the free coordinate is 0).
    for (const p of edges) {
      if (p.anchor === 'y') expect(p.x).toBeCloseTo(0);
      else expect(p.y).toBeCloseTo(0);
    }
  });

  it('places edge magnets only on the long edges of a wide-but-shallow lid', () => {
    // 6 wide × 1 deep: the front/back walls (span ~237mm along X) get edge
    // magnets; the tiny left/right walls (span along Y) cannot fit any.
    const positions = retentionMagnetPositions(6, 1, 42, 42, inset, 2, bossR);
    const edges = positions.filter((p) => p.anchor !== 'corner');
    expect(edges.every((p) => p.anchor === 'y')).toBe(true);
    expect(edges.length).toBeGreaterThan(0);
  });

  it('places none on a small lid even when requested (spacing floor)', () => {
    // 2x2 corners sit ~34mm apart per edge — below one grid pitch, so no edge
    // magnet fits between them.
    const positions = retentionMagnetPositions(2, 2, 42, 42, inset, 3, bossR);
    expect(positions).toHaveLength(4);
  });

  it('stays centred on the origin with edge magnets', () => {
    const positions = retentionMagnetPositions(8, 6, 42, 42, inset, 3, bossR);
    const sumX = positions.reduce((a, p) => a + p.x, 0);
    const sumY = positions.reduce((a, p) => a + p.y, 0);
    expect(sumX).toBeCloseTo(0);
    expect(sumY).toBeCloseTo(0);
  });

  it('spaces multiple edge magnets evenly and clear of the corners', () => {
    const positions = retentionMagnetPositions(8, 6, 42, 42, inset, 2, bossR);
    const halfW = (8 * 42) / 2;
    const xc = halfW - inset;
    // Front-wall (anchor 'y', y < 0) magnets, sorted along X.
    const front = positions
      .filter((p) => p.anchor === 'y' && p.y < 0)
      .map((p) => p.x)
      .sort((a, b) => a - b);
    expect(front).toHaveLength(2);
    // 2 magnets split the corner-to-corner span into 3 equal gaps.
    expect(front[0]).toBeCloseTo(-xc / 3);
    expect(front[1]).toBeCloseTo(xc / 3);
    // Every neighbour gap (including to the corners) is at least one grid pitch.
    const stops = [-xc, ...front, xc];
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i] - stops[i - 1]).toBeGreaterThanOrEqual(42 - 1e-9);
    }
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

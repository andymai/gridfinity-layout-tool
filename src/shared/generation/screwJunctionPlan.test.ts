import { describe, expect, it } from 'vitest';
import { mm } from '@/core/types';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import { screwHeadRecessDepth } from './screwHolePlan';
import {
  SCREW_JUNCTION_FOOT_CLEARANCE_MM,
  junctionPostDepthMm,
  junctionScrewFits,
  junctionScrewSeatMm,
  screwJunctions,
  seatedFootDistanceMm,
} from './screwJunctionPlan';
import { junctionClearanceMm, profileInsetAt } from './mountMagnetPlan';
import {
  CLEARANCE,
  LOW_PROFILE_BAND_CUT_MM,
  PLATE_PROFILE_HEIGHT,
  SOCKET_HEIGHT,
  MAGNET_FLOOR,
  footProfileFor,
  pocketProfileFor,
} from './generatorConstants';

const STANDARD = PLATE_PROFILE_HEIGHT;
const STANDARD_FOOT = SOCKET_HEIGHT;
const LOW = PLATE_PROFILE_HEIGHT - LOW_PROFILE_BAND_CUT_MM;
const LOW_FOOT = SOCKET_HEIGHT - LOW_PROFILE_BAND_CUT_MM;
const MAGNET_PLATE = STANDARD + MAGNET_FLOOR + 2;

const M3_FLAT: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'countersink',
  headDiameter: mm(6),
};
const M4_FLAT: ScrewHoleParams = { ...M3_FLAT, headDiameter: mm(8) };
const M3_CAP: ScrewHoleParams = { ...M3_FLAT, headStyle: 'counterbore', headDiameter: undefined };

const cellOpts = { gridUnitMm: 42 };

describe('seatedFootDistanceMm', () => {
  it('puts a seated foot 0.35mm beyond the pocket corner on the upper taper', () => {
    // The foot stands 0.1mm above the top face and its 45° faces sit
    // CLEARANCE/2 off the pocket's, which is 0.35mm measured across the corner.
    expect(seatedFootDistanceMm(1, STANDARD, STANDARD_FOOT)).toBeCloseTo(
      junctionClearanceMm(1, STANDARD) + 0.35,
      6
    );
  });

  it('recedes going down and never comes closer', () => {
    let previous = 0;
    for (let d = 0; d <= STANDARD; d += 0.1) {
      const distance = seatedFootDistanceMm(d, STANDARD, STANDARD_FOOT);
      expect(distance).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = distance;
    }
  });

  it('is absent below the pocket profile', () => {
    expect(seatedFootDistanceMm(STANDARD + 0.5, STANDARD, STANDARD_FOOT)).toBe(Infinity);
  });

  it('rests a foot with nothing under it on the tapers, CLEARANCE/2 below the top face', () => {
    for (const [plate, foot] of [
      [STANDARD, STANDARD_FOOT],
      [LOW, LOW_FOOT],
    ]) {
      const gapAt = (rise: number): number => {
        let gap = Infinity;
        for (let d = 0; d <= plate; d += 0.01) {
          if (d + rise < 0 || d + rise > foot) continue;
          const footInset = CLEARANCE / 2 + profileInsetAt(footProfileFor(foot), d + rise);
          gap = Math.min(gap, footInset - profileInsetAt(pocketProfileFor(plate), d));
        }
        return gap;
      };
      expect(gapAt(-CLEARANCE / 2)).toBeCloseTo(0, 6);
      expect(gapAt(-CLEARANCE / 2 - 0.01)).toBeLessThan(0);
    }
  });

  it('brings a foot resting on the tapers 0.35mm closer at every depth', () => {
    for (let d = 0.5; d <= 4; d += 0.25) {
      expect(seatedFootDistanceMm(d, STANDARD, STANDARD_FOOT, undefined, true)).toBeCloseTo(
        seatedFootDistanceMm(d - 0.35, STANDARD, STANDARD_FOOT),
        6
      );
    }
  });
});

describe('junctionScrewSeatMm', () => {
  it('seats an M3 flat head 1.24mm down, where a seated foot clears it', () => {
    const seat = junctionScrewSeatMm(M3_FLAT, STANDARD, STANDARD_FOOT);
    expect(seat).toBeCloseTo(1.244, 3);
    expect(seatedFootDistanceMm(seat ?? 0, STANDARD, STANDARD_FOOT)).toBeGreaterThanOrEqual(
      3 + SCREW_JUNCTION_FOOT_CLEARANCE_MM - 1e-9
    );
  });

  it('seats the head at the same depth on a low-profile plate, whose top is unchanged', () => {
    expect(junctionScrewSeatMm(M3_FLAT, LOW, LOW_FOOT)).toBeCloseTo(
      junctionScrewSeatMm(M3_FLAT, STANDARD, STANDARD_FOOT) ?? NaN,
      6
    );
  });

  it('keeps the rim within 0.1mm of the pocket corners it overhangs', () => {
    for (const params of [M3_FLAT, M4_FLAT, M3_CAP]) {
      const seat = junctionScrewSeatMm(params, STANDARD, STANDARD_FOOT) ?? 0;
      const headRadius = (params.headDiameter ?? 5.5) / 2;
      expect(junctionClearanceMm(seat, STANDARD)).toBeGreaterThanOrEqual(headRadius - 0.1 - 1e-9);
    }
  });

  it('seats an M3 flat head 0.35mm lower where the feet rest on the tapers', () => {
    const seat = junctionScrewSeatMm(M3_FLAT, STANDARD, STANDARD_FOOT, undefined, true);
    expect(seat).toBeCloseTo(1.594, 3);
    expect(
      seatedFootDistanceMm(seat ?? 0, STANDARD, STANDARD_FOOT, undefined, true)
    ).toBeGreaterThanOrEqual(3 + SCREW_JUNCTION_FOOT_CLEARANCE_MM - 1e-9);
  });

  it('has no seat for a head wider than the foot ever recedes', () => {
    expect(
      junctionScrewSeatMm({ ...M3_FLAT, headDiameter: mm(10) }, STANDARD, STANDARD_FOOT)
    ).toBeUndefined();
  });
});

describe('junctionScrewFits', () => {
  const fits = (params: ScrewHoleParams, total: number, profile: number = STANDARD): boolean => {
    const foot = profile === STANDARD ? STANDARD_FOOT : LOW_FOOT;
    const seat = junctionScrewSeatMm(params, profile, foot);
    return seat !== undefined && junctionScrewFits(params, seat, total, profile);
  };

  it('fits an M3 flat head on a stock frame-only plate with 2.1mm under it', () => {
    expect(fits(M3_FLAT, STANDARD)).toBe(true);
    const seat = junctionScrewSeatMm(M3_FLAT, STANDARD, STANDARD_FOOT) ?? 0;
    expect(STANDARD - seat - screwHeadRecessDepth(M3_FLAT)).toBeCloseTo(2.106, 2);
  });

  it('fits an M3 flat head on a low-profile plate with about 1mm under it', () => {
    expect(fits(M3_FLAT, LOW, LOW)).toBe(true);
  });

  it('refuses an M4 flat head on a stock plate, which leaves no plastic under it', () => {
    expect(fits(M4_FLAT, STANDARD)).toBe(false);
  });

  it('takes an M4 flat head once a magnet floor deepens the post', () => {
    expect(fits(M4_FLAT, MAGNET_PLATE)).toBe(true);
  });

  it('refuses the default counterbore on a stock plate, leaving under 0.8mm below it', () => {
    expect(fits(M3_CAP, STANDARD)).toBe(false);
    expect(fits(M3_CAP, MAGNET_PLATE)).toBe(true);
  });

  it('refuses a shaft too wide for the post', () => {
    expect(fits({ ...M3_FLAT, diameter: mm(8), headDiameter: mm(8) }, MAGNET_PLATE)).toBe(false);
  });
});

describe('junctionPostDepthMm', () => {
  it('meets the post at the top face along the "+" arms', () => {
    expect(junctionPostDepthMm(3, 0, STANDARD)).toBe(0);
    expect(junctionPostDepthMm(0, -3, STANDARD)).toBe(0);
  });

  it('meets it on the diagonal where the pocket corner clearance reaches the point', () => {
    const depth = junctionPostDepthMm(3 / Math.SQRT2, 3 / Math.SQRT2, STANDARD);
    expect(junctionClearanceMm(depth, STANDARD)).toBeCloseTo(3, 6);
  });
});

describe('screwJunctions', () => {
  it('offers every crossing of a stock 3x3 plate to an M3 flat head', () => {
    const sites = screwJunctions(M3_FLAT, 3, 3, STANDARD, STANDARD, STANDARD_FOOT, cellOpts);
    expect(sites.map(({ x, y }) => `${x},${y}`)).toEqual(['-21,-21', '21,-21', '-21,21', '21,21']);
    expect(sites.every((s) => Math.abs(s.seatBelowTopMm - 1.244) < 1e-3)).toBe(true);
  });

  it('offers none to an M4 flat head on that plate', () => {
    expect(screwJunctions(M4_FLAT, 3, 3, STANDARD, STANDARD, STANDARD_FOOT, cellOpts)).toEqual([]);
  });

  it('skips a crossing whose fourth cell is filtered out', () => {
    const sites = screwJunctions(
      M3_FLAT,
      3,
      3,
      STANDARD,
      STANDARD,
      STANDARD_FOOT,
      cellOpts,
      (cell) => !(cell.centerX > 0 && cell.centerY > 0)
    );
    expect(sites).toHaveLength(3);
  });
});

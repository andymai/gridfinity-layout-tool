import { describe, expect, it } from 'vitest';
import { mm } from '@/core/types';
import {
  MOUNT_MAGNET_MIN_WALL_MM,
  junctionClearanceMm,
  maxMountMagnetDepthMm,
  mountMagnetChamferFits,
  mountMagnetFits,
  mountMagnetJunctions,
  planMountMagnets,
  selectMountMagnets,
} from './mountMagnetPlan';
import { PLATE_PROFILE_HEIGHT, LOW_PROFILE_BAND_CUT_MM } from './generatorConstants';

const STANDARD = PLATE_PROFILE_HEIGHT;
const LOW = PLATE_PROFILE_HEIGHT - LOW_PROFILE_BAND_CUT_MM;
const cellOpts = { gridUnitMm: 42 };
const size = { diameter: mm(6), depth: mm(3) };

describe('junctionClearanceMm', () => {
  it('is the pocket corner arc at the top face: 4·(√2 − 1)', () => {
    expect(junctionClearanceMm(0, STANDARD)).toBeCloseTo(4 * (Math.SQRT2 - 1), 6);
  });

  it('grows with depth through the upper taper and holds in the vertical band', () => {
    const top = junctionClearanceMm(1, STANDARD);
    const band = junctionClearanceMm(3, STANDARD);
    expect(band).toBeGreaterThan(top);
    expect(junctionClearanceMm(2.5, STANDARD)).toBeCloseTo(band, 6);
  });
});

describe('mountMagnetFits', () => {
  it('fits the ø6 × 3mm cap on a standard plate with the wall to spare', () => {
    expect(mountMagnetFits(6, 3, STANDARD, STANDARD)).toBe(true);
    const wall = junctionClearanceMm(STANDARD - 3, STANDARD) - 3;
    expect(wall).toBeGreaterThanOrEqual(MOUNT_MAGNET_MIN_WALL_MM);
    expect(wall).toBeCloseTo(0.307, 2);
  });

  it('rejects the cap on a low-profile plate, whose pockets reach lower', () => {
    expect(mountMagnetFits(6, 3, LOW, LOW)).toBe(false);
  });

  it('gains room from a floor under the profile', () => {
    expect(mountMagnetFits(6, 3, LOW + 2.5, LOW)).toBe(true);
  });

  it('never accepts a hole as deep as the plate', () => {
    expect(mountMagnetFits(2, STANDARD, STANDARD, STANDARD)).toBe(false);
  });
});

describe('junctionClearanceMm with a corner relief', () => {
  it('reaches only as close as the relief rectangle over its depth band', () => {
    const below = STANDARD + 1;
    expect(junctionClearanceMm(below, STANDARD, 4, true)).toBeLessThan(
      junctionClearanceMm(below, STANDARD)
    );
    expect(junctionClearanceMm(1, STANDARD, 4, true)).toBe(junctionClearanceMm(1, STANDARD));
  });
});

describe('maxMountMagnetDepthMm', () => {
  it('returns the deepest fitting tenth', () => {
    const max = maxMountMagnetDepthMm(6, STANDARD, STANDARD);
    expect(mountMagnetFits(6, max, STANDARD, STANDARD)).toBe(true);
    expect(mountMagnetFits(6, max + 0.1, STANDARD, STANDARD)).toBe(false);
  });
});

describe('mountMagnetJunctions', () => {
  it('finds only interior crossings: (w − 1)(d − 1) on a whole grid', () => {
    expect(mountMagnetJunctions(4, 3, size, STANDARD, STANDARD, cellOpts)).toHaveLength(6);
    expect(mountMagnetJunctions(1, 5, size, STANDARD, STANDARD, cellOpts)).toHaveLength(0);
  });

  it('places junctions on cell corners of a centred grid', () => {
    expect(mountMagnetJunctions(2, 2, size, STANDARD, STANDARD, cellOpts)).toEqual([
      { x: 0, y: 0, cornerRadius: 4, cornerRelief: false },
    ]);
  });

  it('counts the crossings a half-unit row adds', () => {
    expect(mountMagnetJunctions(3, 2.5, size, STANDARD, STANDARD, cellOpts)).toHaveLength(4);
  });

  it('drops a junction whose fourth cell is filtered out', () => {
    const junctions = mountMagnetJunctions(
      3,
      3,
      size,
      STANDARD,
      STANDARD,
      cellOpts,
      (cell) => !(cell.centerX > 0 && cell.centerY > 0)
    );
    expect(junctions).toHaveLength(3);
  });

  it('skips every junction when the hole does not fit', () => {
    expect(mountMagnetJunctions(4, 4, size, LOW, LOW, cellOpts)).toHaveLength(0);
  });
});

describe('selectMountMagnets', () => {
  const grid = (n: number): Array<{ x: number; y: number }> => {
    const out: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) out.push({ x: x - (n - 1) / 2, y: y - (n - 1) / 2 });
    return out;
  };

  it('puts four on the corners of the junction grid', () => {
    expect(new Set(selectMountMagnets(grid(3), 4).map((p) => `${p.x},${p.y}`))).toEqual(
      new Set(['-1,-1', '1,-1', '-1,1', '1,1'])
    );
  });

  it('puts a single magnet at the centre', () => {
    expect(selectMountMagnets(grid(3), 1)).toEqual([{ x: 0, y: 0 }]);
  });

  /** Junctions of a 5×4 piece: x ∈ {−63, −21, 21, 63}, y ∈ {−42, 0, 42}. */
  const fiveByFour = mountMagnetJunctions(
    5,
    4,
    { diameter: mm(6.5), depth: mm(2.5) },
    STANDARD,
    STANDARD,
    cellOpts
  );
  const picked = (count: number): Set<string> =>
    new Set(selectMountMagnets(fiveByFour, count).map((p) => `${p.x},${p.y}`));

  it('puts four on the outer corners of a 5×4 piece, not three corners and an inner one', () => {
    expect(picked(4)).toEqual(new Set(['-63,-42', '63,-42', '-63,42', '63,42']));
  });

  it('puts two on the ends of the middle row', () => {
    expect(picked(2)).toEqual(new Set(['-63,0', '63,0']));
  });

  it('keeps six mirror-symmetric about both axes', () => {
    const six = picked(6);
    expect(six.size).toBe(6);
    for (const p of six) {
      const [x, y] = p.split(',').map(Number);
      expect(six.has(`${-x},${y}`)).toBe(true);
      expect(six.has(`${x},${-y}`)).toBe(true);
    }
  });

  it('uses a diagonal pair when only point symmetry can make the count', () => {
    // A 3×3 piece has a 2×2 junction grid: one group of four, no middle row.
    const threeByThree = mountMagnetJunctions(
      3,
      3,
      { diameter: mm(6.5), depth: mm(2.5) },
      STANDARD,
      STANDARD,
      cellOpts
    );
    const two = selectMountMagnets(threeByThree, 2).map((p) => [p.x, p.y]);
    expect(two[0][0]).toBe(-two[1][0]);
    expect(two[0][1]).toBe(-two[1][1]);
  });

  it('still places an odd count that no symmetric set can make', () => {
    expect(selectMountMagnets(fiveByFour, 3)).toHaveLength(3);
  });

  it('returns every junction when the count exceeds them', () => {
    expect(selectMountMagnets(grid(2), 64)).toHaveLength(4);
  });
});

describe('mountMagnetChamferFits', () => {
  it('fits the ø6.5 × 2.5mm default on a standard plate', () => {
    expect(mountMagnetChamferFits(6.5, 2.5, STANDARD, STANDARD)).toBe(true);
  });

  it('fits a floored plate unless a small cell relief reaches the junction', () => {
    expect(mountMagnetChamferFits(6.5, 2.5, STANDARD + 2.5, STANDARD)).toBe(true);
    expect(mountMagnetChamferFits(6.5, 2.5, STANDARD + 2.5, STANDARD, 4, true)).toBe(false);
  });

  it('needs a bore longer than the lead-in', () => {
    expect(mountMagnetChamferFits(5.5, 1.5, STANDARD, STANDARD)).toBe(false);
  });

  it('refuses a mouth that would break into a pocket', () => {
    expect(mountMagnetChamferFits(8, 1.5 + 2, STANDARD + 2.5, STANDARD)).toBe(false);
  });
});

describe('planMountMagnets', () => {
  it('marks each hole with whether its chamfer applies', () => {
    const holes = planMountMagnets(
      { enabled: true, diameter: mm(6.5), depth: mm(2.5), chamfer: true },
      3,
      3,
      STANDARD,
      STANDARD,
      cellOpts
    );
    expect(holes).toHaveLength(4);
    expect(holes.every((h) => h.chamfer)).toBe(true);
  });

  it('is empty when disabled', () => {
    expect(
      planMountMagnets({ ...size, enabled: false }, 4, 4, STANDARD, STANDARD, cellOpts)
    ).toEqual([]);
  });

  it('defaults to four per piece', () => {
    expect(
      planMountMagnets({ ...size, enabled: true }, 5, 5, STANDARD, STANDARD, cellOpts)
    ).toHaveLength(4);
  });
});

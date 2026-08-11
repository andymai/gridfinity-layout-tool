import { describe, expect, it } from 'vitest';
import { DESIGNER_CONSTRAINTS } from '@/shared/constants/bin';
import { LID_CLICK_RAIL_BAND_BELOW_WALL_TOP } from '@/shared/types/bin';
import type { ScoopConfig } from '@/shared/types/bin';
import {
  resolveScoopProfile,
  resolveScoopPlacement,
  resolveScoopSide,
  computeLipOffset,
  computeInteriorHeight,
} from './scoopCalculations';

const scoop = (overrides: Partial<ScoopConfig> = {}): ScoopConfig => ({
  enabled: true,
  radius: 'auto',
  ...overrides,
});

describe('resolveScoopProfile', () => {
  // Common test parameters
  const wallHeight = 16; // 3U bin (3*7 - 5 socket)
  const interiorHeight = 15.3; // wallHeight - LIP_SMALL_TAPER (0.7)

  describe('auto mode', () => {
    it('uses min(minDim/3, ...) for typical compartments', () => {
      // 1x1 bin: compW ≈ 39mm, compD ≈ 39mm → minDim/3 = 13
      const p = resolveScoopProfile(scoop(), 39, 39, true, false, wallHeight, interiorHeight, 0);
      expect(p?.height).toBeCloseTo(13, 0);
      // Auto is proportional: run mirrors height.
      expect(p?.run).toBeCloseTo(p?.height ?? 0, 5);
      expect(p?.style).toBe('curved');
    });

    it('caps at 15mm when wallHeight * 0.5 < 15', () => {
      const p = resolveScoopProfile(scoop(), 164, 164, true, false, wallHeight, interiorHeight, 0);
      expect(p?.height).toBe(15);
    });

    it('caps auto height at MAX_SCOOP_RADIUS by default for tall bins', () => {
      // 4x4 single compartment, 10U bin (wallHeight ≈ 65mm)
      // minDim/3 = 54.7, max(15, 65*0.5) = 32.5, but capped at 25mm default
      const p = resolveScoopProfile(scoop(), 164, 164, true, false, 65, 64.3, 0);
      expect(p?.height).toBe(DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS);
    });

    it('raises the auto ceiling when autoMaxHeight is increased', () => {
      // Same tall bin, but the user lifts the auto ceiling to 40mm.
      const p = resolveScoopProfile(
        scoop({ autoMaxHeight: 40 }),
        164,
        164,
        true,
        false,
        65,
        64.3,
        0
      );
      // Formula gives max(15, 32.5) = 32.5, now below the 40mm ceiling.
      expect(p?.height).toBeCloseTo(32.5, 1);
    });

    it('caps auto height for front-row lipped tall bins', () => {
      const p = resolveScoopProfile(scoop(), 164, 164, true, true, 65, 64.3, 1.4);
      expect(p?.height).toBe(DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS);
    });

    it('preserves at least 2/3 of depth (compD/3 constraint)', () => {
      const p = resolveScoopProfile(scoop(), 100, 20, true, false, wallHeight, interiorHeight, 0);
      expect(p?.height).toBeCloseTo(6.67, 1);
    });

    it('returns null for compartments too small for a scoop', () => {
      const p = resolveScoopProfile(scoop(), 1.5, 1.5, true, false, wallHeight, interiorHeight, 0);
      expect(p).toBeNull();
    });

    it('holds an outer-wall scoop a click-rail band below the wall top (#3434)', () => {
      // A tall compartment would otherwise resolve to the 15mm floor, which on
      // this 3U wall is 1mm from the top — inside the band a seated lid's rail
      // drops into. The ramp's exit stays flush with the lip either way: the
      // builder carries a chute at `lipOffset` from the ramp's top to the lip.
      const p = resolveScoopProfile(scoop(), 164, 164, true, true, wallHeight, interiorHeight, 1.4);
      expect(p?.height).toBeCloseTo(wallHeight - LID_CLICK_RAIL_BAND_BELOW_WALL_TOP, 6);
      // Auto stays a symmetric quarter shape, so the run follows the rise down.
      expect(p?.run).toBeCloseTo(p?.height ?? 0, 6);
    });

    it('leaves the ceiling off without a lip — there is no rail band to clear', () => {
      const p = resolveScoopProfile(scoop(), 164, 164, true, false, wallHeight, interiorHeight, 0);
      expect(p?.height).toBe(15);
    });

    it('does not lower a scoop that already clears the band', () => {
      // minDim/3 = 10 here, a full 6mm below the 16mm wall top, so the ceiling
      // never binds and the three-factor rule is left alone.
      const p = resolveScoopProfile(scoop(), 30, 30, true, true, wallHeight, interiorHeight, 1.4);
      expect(p?.height).toBeCloseTo(10, 5);
    });

    it('does not increase height for interior rows even with lip', () => {
      const p = resolveScoopProfile(scoop(), 39, 39, false, true, wallHeight, interiorHeight, 0);
      expect(p?.height).toBeCloseTo(13, 0);
    });
  });

  describe('legacy single-value radius (run undefined)', () => {
    it('produces a symmetric quarter shape', () => {
      const p = resolveScoopProfile(
        scoop({ radius: 10 }),
        39,
        39,
        true,
        false,
        wallHeight,
        interiorHeight,
        0
      );
      expect(p?.height).toBe(10);
      expect(p?.run).toBe(10);
    });

    it('clamps both axes to the smaller of depth and height', () => {
      // radius 20, compartment only 15mm deep → min(20, 16, 14.5) = 14.5
      const p = resolveScoopProfile(
        scoop({ radius: 20 }),
        39,
        15,
        true,
        false,
        wallHeight,
        interiorHeight,
        0
      );
      expect(p?.height).toBe(14.5);
      expect(p?.run).toBe(14.5);
    });

    it('clamps to wall height for front row', () => {
      const p = resolveScoopProfile(
        scoop({ radius: 25 }),
        100,
        100,
        true,
        false,
        wallHeight,
        interiorHeight,
        0
      );
      expect(p?.height).toBe(wallHeight);
    });

    it('clamps to interior height for non-front rows', () => {
      const p = resolveScoopProfile(
        scoop({ radius: 25 }),
        100,
        100,
        false,
        true,
        wallHeight,
        interiorHeight,
        0
      );
      expect(p?.height).toBe(interiorHeight);
    });

    it('returns null when clamped below 1mm', () => {
      const p = resolveScoopProfile(
        scoop({ radius: 5 }),
        2,
        1,
        true,
        false,
        wallHeight,
        interiorHeight,
        0
      );
      expect(p).toBeNull();
    });
  });

  describe('two-variable custom (run defined)', () => {
    it('clamps height and run independently for a steep profile', () => {
      // Tall bin, deep compartment: height reaches the wall, run stays short.
      const p = resolveScoopProfile(
        scoop({ radius: 20, run: 8 }),
        100,
        100,
        true,
        false,
        40,
        39.3,
        0
      );
      expect(p?.height).toBe(20); // < wallHeight 40, unclamped
      expect(p?.run).toBe(8); // < depth, unclamped
    });

    it('clamps run to the compartment depth without touching height', () => {
      // 12mm-deep compartment caps run at 11.5; height is free to reach 20.
      const p = resolveScoopProfile(
        scoop({ radius: 20, run: 30 }),
        100,
        12,
        true,
        false,
        40,
        39.3,
        0
      );
      expect(p?.run).toBe(11.5); // 12 - 0.5
      expect(p?.height).toBe(20);
    });

    it('passes the style through', () => {
      const p = resolveScoopProfile(
        scoop({ radius: 15, run: 15, style: 'straight' }),
        39,
        39,
        true,
        false,
        wallHeight,
        interiorHeight,
        0
      );
      expect(p?.style).toBe('straight');
    });
  });
});

describe('computeLipOffset', () => {
  it('returns offset for front row with lip', () => {
    const offset = computeLipOffset(true, true, 2.6, 1.2);
    expect(offset).toBeCloseTo(1.4, 1);
  });

  it('returns 0 for interior rows', () => {
    expect(computeLipOffset(true, false, 2.6, 1.2)).toBe(0);
  });

  it('returns 0 when no lip', () => {
    expect(computeLipOffset(false, true, 2.6, 1.2)).toBe(0);
  });

  it('returns 0 when wall is thicker than lip taper', () => {
    expect(computeLipOffset(true, true, 2.0, 3.0)).toBe(0);
  });
});

describe('computeInteriorHeight', () => {
  it('subtracts lip taper when lip is present', () => {
    expect(computeInteriorHeight(16, true, 0.7)).toBeCloseTo(15.3, 1);
  });

  it('returns full wall height without lip', () => {
    expect(computeInteriorHeight(16, false, 0.7)).toBe(16);
  });
});

describe('resolveScoopSide', () => {
  it('defaults to front when the design predates the side selector', () => {
    expect(resolveScoopSide(scoop())).toBe('front');
  });

  it('honors an explicit side', () => {
    expect(resolveScoopSide(scoop({ side: 'left' }))).toBe('left');
  });

  it('falls back to front for a value the server never validated', () => {
    // `scoop` is passed through the API without deep validation, so an
    // arbitrary string can reach here and must not fall out of the switch.
    const corrupt = { enabled: true, radius: 'auto', side: 'sideways' } as unknown as ScoopConfig;
    expect(resolveScoopSide(corrupt)).toBe('front');
    expect(
      resolveScoopPlacement(
        resolveScoopSide(corrupt),
        { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 },
        { cols: 1, rows: 1, innerW: 40, innerD: 40 }
      )
    ).toBeDefined();
  });
});

describe('resolveScoopPlacement', () => {
  // 2 cols x 2 rows over a 40x60 interior: cells are 20 wide, 30 deep.
  const grid = { cols: 2, rows: 2, innerW: 40, innerD: 60 };
  const topLeft = { minCol: 0, maxCol: 0, minRow: 0, maxRow: 0 };

  it('measures span along the wall and depth away from it', () => {
    // Front/back sit on an X-aligned wall: span is the 20mm column width.
    expect(resolveScoopPlacement('front', topLeft, grid)).toMatchObject({
      span: 20,
      depth: 30,
    });
    // Left/right sit on a Y-aligned wall, so the two axes swap.
    expect(resolveScoopPlacement('left', topLeft, grid)).toMatchObject({
      span: 30,
      depth: 20,
    });
  });

  it('places each side on its own wall plane', () => {
    expect(resolveScoopPlacement('front', topLeft, grid).edge).toBe(-30);
    expect(resolveScoopPlacement('back', topLeft, grid).edge).toBe(0);
    expect(resolveScoopPlacement('left', topLeft, grid).edge).toBe(-20);
    expect(resolveScoopPlacement('right', topLeft, grid).edge).toBe(0);
  });

  it('runs inward from every wall', () => {
    // edge + runSign * run must always head toward the bin center.
    expect(resolveScoopPlacement('front', topLeft, grid).runSign).toBe(1);
    expect(resolveScoopPlacement('back', topLeft, grid).runSign).toBe(-1);
    expect(resolveScoopPlacement('left', topLeft, grid).runSign).toBe(1);
    expect(resolveScoopPlacement('right', topLeft, grid).runSign).toBe(-1);
  });

  it('flags outer walls only for compartments that touch them', () => {
    // The top-left compartment touches front and left, not back or right.
    expect(resolveScoopPlacement('front', topLeft, grid).isOuter).toBe(true);
    expect(resolveScoopPlacement('left', topLeft, grid).isOuter).toBe(true);
    expect(resolveScoopPlacement('back', topLeft, grid).isOuter).toBe(false);
    expect(resolveScoopPlacement('right', topLeft, grid).isOuter).toBe(false);

    const bottomRight = { minCol: 1, maxCol: 1, minRow: 1, maxRow: 1 };
    expect(resolveScoopPlacement('back', bottomRight, grid).isOuter).toBe(true);
    expect(resolveScoopPlacement('right', bottomRight, grid).isOuter).toBe(true);
    expect(resolveScoopPlacement('front', bottomRight, grid).isOuter).toBe(false);
  });

  it('spans the full extent of a merged compartment', () => {
    const merged = { minCol: 0, maxCol: 1, minRow: 0, maxRow: 0 };
    const placement = resolveScoopPlacement('front', merged, grid);
    expect(placement.span).toBe(40);
    expect(placement.alongCenter).toBe(0);
  });

  it('centers each compartment along its wall', () => {
    expect(resolveScoopPlacement('front', topLeft, grid).alongCenter).toBe(-10);
    // Left/right measure the center along Y instead.
    expect(resolveScoopPlacement('left', topLeft, grid).alongCenter).toBe(-15);
  });

  it('rotates the front-facing profile onto the chosen wall', () => {
    expect(resolveScoopPlacement('front', topLeft, grid)).toMatchObject({
      rotationDeg: 0,
      runsAlongY: true,
    });
    expect(resolveScoopPlacement('back', topLeft, grid)).toMatchObject({
      rotationDeg: 180,
      runsAlongY: true,
    });
    expect(resolveScoopPlacement('left', topLeft, grid)).toMatchObject({
      rotationDeg: -90,
      runsAlongY: false,
    });
    expect(resolveScoopPlacement('right', topLeft, grid)).toMatchObject({
      rotationDeg: 90,
      runsAlongY: false,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { DESIGNER_CONSTRAINTS } from '@/shared/constants/bin';
import type { ScoopConfig } from '@/shared/types/bin';
import { resolveScoopProfile, computeLipOffset, computeInteriorHeight } from './scoopCalculations';

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

    it('increases auto height to wallHeight for front-row scoops with lip', () => {
      const p = resolveScoopProfile(scoop(), 39, 39, true, true, wallHeight, interiorHeight, 1.4);
      expect(p?.height).toBe(wallHeight);
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

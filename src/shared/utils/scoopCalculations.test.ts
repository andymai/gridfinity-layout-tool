import { describe, expect, it } from 'vitest';
import { resolveScoopRadius, computeLipOffset, computeInteriorHeight } from './scoopCalculations';

describe('resolveScoopRadius', () => {
  // Common test parameters
  const wallHeight = 16; // 3U bin (3*7 - 5 socket)
  const interiorHeight = 15.3; // wallHeight - LIP_SMALL_TAPER (0.7)
  const lipOffset = 0;

  describe('auto mode', () => {
    it('uses min(minDim/3, ...) for typical compartments', () => {
      // 1x1 bin: compW ≈ 39mm, compD ≈ 39mm → minDim/3 = 13
      const radius = resolveScoopRadius('auto', 39, 39, true, false, wallHeight, interiorHeight, 0);
      expect(radius).toBeCloseTo(13, 0);
    });

    it('caps at 15mm when wallHeight * 0.5 < 15', () => {
      // Large compartment (4x4 single) but short bin (3U, wallHeight=16)
      // minDim/3 = 164/3 = 54.7, max(15, 16*0.5) = max(15, 8) = 15
      const radius = resolveScoopRadius(
        'auto',
        164,
        164,
        true,
        false,
        wallHeight,
        interiorHeight,
        0
      );
      expect(radius).toBe(15);
    });

    it('allows larger radius for tall bins via height-aware cap', () => {
      // 4x4 single compartment, 10U bin (wallHeight ≈ 65mm)
      // minDim/3 = 54.7, max(15, 65*0.5) = 32.5
      const tallWallHeight = 65;
      const tallInteriorHeight = 64.3;
      const radius = resolveScoopRadius(
        'auto',
        164,
        164,
        true,
        false,
        tallWallHeight,
        tallInteriorHeight,
        0
      );
      expect(radius).toBeCloseTo(32.5, 0);
    });

    it('preserves at least 2/3 of depth (compD/3 constraint)', () => {
      // compD/3 acts alongside minDim/3. When compD < compW, minDim = compD.
      // 20mm depth, 100mm width → minDim/3 = 6.7, compD/3 = 6.7 (same)
      const radius = resolveScoopRadius(
        'auto',
        100,
        20,
        true,
        false,
        wallHeight,
        interiorHeight,
        0
      );
      expect(radius).toBeCloseTo(6.67, 1);
    });

    it('returns 0 for compartments too small for a scoop', () => {
      // Very small compartment: minDim/3 = 0.5 < 1mm threshold
      const radius = resolveScoopRadius(
        'auto',
        1.5,
        1.5,
        true,
        false,
        wallHeight,
        interiorHeight,
        0
      );
      expect(radius).toBe(0);
    });

    it('increases auto radius to wallHeight for front-row scoops with lip', () => {
      // Front row (isMinRow=true) with lip: max(base, wallHeight)
      const radius = resolveScoopRadius(
        'auto',
        39,
        39,
        true,
        true,
        wallHeight,
        interiorHeight,
        1.4
      );
      // Base = min(13, 15, 13) = 13, but with lip: max(13, 16) = 16
      // Clamped by min(16, 39-0.5-1.4, 16) = 16
      expect(radius).toBe(wallHeight);
    });

    it('does not increase radius for interior rows even with lip', () => {
      // Interior row: lip alignment does not apply
      const radius = resolveScoopRadius('auto', 39, 39, false, true, wallHeight, interiorHeight, 0);
      // min(13, 15, 13) = 13, no lip boost for interior rows
      expect(radius).toBeCloseTo(13, 0);
    });
  });

  describe('manual mode', () => {
    it('uses the provided radius value', () => {
      const radius = resolveScoopRadius(10, 39, 39, true, false, wallHeight, interiorHeight, 0);
      expect(radius).toBe(10);
    });

    it('clamps to compartment depth', () => {
      // Radius 20mm but compartment only 15mm deep
      const radius = resolveScoopRadius(
        20,
        39,
        15,
        true,
        false,
        wallHeight,
        interiorHeight,
        lipOffset
      );
      expect(radius).toBe(14.5); // 15 - 0.5
    });

    it('clamps to wall height for front row', () => {
      const radius = resolveScoopRadius(25, 100, 100, true, false, wallHeight, interiorHeight, 0);
      expect(radius).toBe(wallHeight);
    });

    it('clamps to interior height for non-front rows', () => {
      const radius = resolveScoopRadius(25, 100, 100, false, true, wallHeight, interiorHeight, 0);
      expect(radius).toBe(interiorHeight);
    });

    it('returns 0 when clamped below 1mm', () => {
      // compD - 0.5 = 1 - 0.5 = 0.5 < 1mm threshold → returns 0
      const radius = resolveScoopRadius(5, 2, 1, true, false, wallHeight, interiorHeight, 0);
      expect(radius).toBe(0);
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

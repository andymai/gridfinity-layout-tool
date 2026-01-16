import { describe, it, expect } from 'vitest';
import { getBaseplateDimensions } from '../../generation/baseplateGeometry';
import { GRIDFINITY_SPEC } from '../../types/generation';

// Expected height: base floor (2.6mm) + wall height (4.95mm) = 7.55mm
const EXPECTED_HEIGHT = 2.6 + GRIDFINITY_SPEC.baseProfileHeightMm;

// Note: createBaseplateGeometry tests are skipped because three-bvh-csg
// requires WebGL which is not available in jsdom test environment.
// Geometry generation is tested manually in the browser via Labs drawer.

describe('getBaseplateDimensions', () => {
  it('returns correct dimensions for standard grid unit', () => {
    const dims = getBaseplateDimensions({
      widthUnits: 5,
      depthUnits: 4,
    });

    expect(dims.widthMm).toBe(210); // 5 * 42
    expect(dims.depthMm).toBe(168); // 4 * 42
    expect(dims.heightMm).toBeCloseTo(EXPECTED_HEIGHT, 1);
  });

  it('respects custom grid unit size', () => {
    const dims = getBaseplateDimensions({
      widthUnits: 3,
      depthUnits: 2,
      gridUnitMm: 50,
    });

    expect(dims.widthMm).toBe(150); // 3 * 50
    expect(dims.depthMm).toBe(100); // 2 * 50
  });

  it('uses spec values for height calculation', () => {
    const dims = getBaseplateDimensions({
      widthUnits: 1,
      depthUnits: 1,
    });

    // Height = base thickness (2.6) + profile height (4.95) = 7.55mm
    expect(dims.heightMm).toBeCloseTo(7.55, 1);
  });
});

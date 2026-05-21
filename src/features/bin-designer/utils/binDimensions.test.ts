import { describe, it, expect } from 'vitest';
import { binDimensions } from './binDimensions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

describe('binDimensions', () => {
  it('returns standard Gridfinity dimensions for a 2x2x3 default bin', () => {
    const dims = binDimensions(DEFAULT_BIN_PARAMS);
    // outerW = 2 × 42 − 0.5 = 83.5
    expect(dims.outerW).toBeCloseTo(83.5, 5);
    expect(dims.outerD).toBeCloseTo(83.5, 5);
    // innerW = 83.5 − 2 × 1.2 = 81.1
    expect(dims.innerW).toBeCloseTo(81.1, 5);
    expect(dims.innerD).toBeCloseTo(81.1, 5);
    // totalH = 3 × 7 = 21
    expect(dims.totalH).toBeCloseTo(21, 5);
    // socketed default → wallHeight = 21 − 5 = 16, floorZ = 5
    expect(dims.wallHeight).toBeCloseTo(16, 5);
    expect(dims.floorZ).toBeCloseTo(5, 5);
    expect(dims.isFlat).toBe(false);
  });

  it('tracks a custom half-pitch gridUnitMm (30mm)', () => {
    const dims = binDimensions({ ...DEFAULT_BIN_PARAMS, gridUnitMm: 30 });
    // outerW = 2 × 30 − 0.5 = 59.5 (would be 83.5 with hardcoded 42)
    expect(dims.outerW).toBeCloseTo(59.5, 5);
    expect(dims.innerW).toBeCloseTo(57.1, 5);
    // Height unchanged
    expect(dims.totalH).toBeCloseTo(21, 5);
  });

  it('tracks a custom heightUnitMm', () => {
    const dims = binDimensions({ ...DEFAULT_BIN_PARAMS, heightUnitMm: 10 });
    // totalH = 3 × 10 = 30
    expect(dims.totalH).toBeCloseTo(30, 5);
    // wallHeight = 30 − 5 = 25
    expect(dims.wallHeight).toBeCloseTo(25, 5);
    // XY unchanged
    expect(dims.outerW).toBeCloseTo(83.5, 5);
  });

  it('handles fractional grid units (half-bin mode)', () => {
    const dims = binDimensions({ ...DEFAULT_BIN_PARAMS, width: 1.5, depth: 2.5 });
    // outerW = 1.5 × 42 − 0.5 = 62.5
    expect(dims.outerW).toBeCloseTo(62.5, 5);
    expect(dims.outerD).toBeCloseTo(104.5, 5);
  });

  it('zeroes the floor offset for flat-base bins', () => {
    const dims = binDimensions({
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
    expect(dims.floorZ).toBe(0);
    // Flat: wallHeight = totalH (no socket subtraction)
    expect(dims.wallHeight).toBeCloseTo(dims.totalH, 5);
    expect(dims.isFlat).toBe(true);
  });

  it('uses SOCKET_HEIGHT for floorZ on socketed bins (matches mesh generator)', () => {
    // Regression guard for the BASE_HEIGHT/SOCKET_HEIGHT inconsistency
    // surfaced during the gridUnitMm audit.
    const dims = binDimensions(DEFAULT_BIN_PARAMS);
    expect(dims.floorZ).toBe(GRIDFINITY.SOCKET_HEIGHT);
    expect(dims.floorZ).not.toBe(GRIDFINITY.BASE_HEIGHT);
  });

  it('keeps wallTop == totalH for both base styles (matches generator invariant)', () => {
    const standard = binDimensions(DEFAULT_BIN_PARAMS);
    const flat = binDimensions({
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
    expect(standard.floorZ + standard.wallHeight).toBeCloseTo(standard.totalH, 5);
    expect(flat.floorZ + flat.wallHeight).toBeCloseTo(flat.totalH, 5);
  });

  it('combines custom gridUnitMm + heightUnitMm + thick walls + half-bin width', () => {
    const dims = binDimensions({
      ...DEFAULT_BIN_PARAMS,
      width: 1.5,
      depth: 2,
      height: 4,
      gridUnitMm: 30,
      heightUnitMm: 8,
      wallThickness: 2,
    });
    // outerW = 1.5 × 30 − 0.5 = 44.5
    expect(dims.outerW).toBeCloseTo(44.5, 5);
    // innerW = 44.5 − 2 × 2 = 40.5
    expect(dims.innerW).toBeCloseTo(40.5, 5);
    // outerD = 2 × 30 − 0.5 = 59.5
    expect(dims.outerD).toBeCloseTo(59.5, 5);
    // totalH = 4 × 8 = 32
    expect(dims.totalH).toBeCloseTo(32, 5);
    // wallHeight = 32 − 5 = 27 (socketed)
    expect(dims.wallHeight).toBeCloseTo(27, 5);
  });
});

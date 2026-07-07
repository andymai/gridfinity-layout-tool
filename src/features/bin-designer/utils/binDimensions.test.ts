import { describe, it, expect } from 'vitest';
import { binDimensions, cutoutInterior } from './binDimensions';
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

describe('cutoutInterior', () => {
  // Nominal interior of the default bin, derived (not hard-coded) so the tests
  // track any change to the default grid pitch / wall thickness / tolerance.
  const NOMINAL = binDimensions(DEFAULT_BIN_PARAMS).innerW;

  it('returns the nominal interior when overhang is absent or all-zero', () => {
    const ci = cutoutInterior(DEFAULT_BIN_PARAMS);
    expect(ci.innerW).toBeCloseTo(NOMINAL, 5);
    expect(ci.innerD).toBeCloseTo(NOMINAL, 5);
    expect(ci.offsetX).toBe(0);
    expect(ci.offsetY).toBe(0);
  });

  it('expands the interior by the summed per-side overhang (symmetric → no offset)', () => {
    const ci = cutoutInterior({
      ...DEFAULT_BIN_PARAMS,
      overhang: { left: 3, right: 3, front: 2, back: 2 },
    });
    expect(ci.innerW).toBeCloseTo(NOMINAL + 6, 5);
    expect(ci.innerD).toBeCloseTo(NOMINAL + 4, 5);
    expect(ci.offsetX).toBeCloseTo(0, 5);
    expect(ci.offsetY).toBeCloseTo(0, 5);
  });

  it('shifts the cavity center for asymmetric overhang', () => {
    const ci = cutoutInterior({
      ...DEFAULT_BIN_PARAMS,
      overhang: { left: 0, right: 8, front: 4, back: 0 },
    });
    expect(ci.innerW).toBeCloseTo(NOMINAL + 8, 5);
    expect(ci.innerD).toBeCloseTo(NOMINAL + 4, 5);
    // offsetX = (right − left) / 2, offsetY = (back − front) / 2
    expect(ci.offsetX).toBeCloseTo(4, 5);
    expect(ci.offsetY).toBeCloseTo(-2, 5);
  });

  it('ignores overhang when explicitly disabled', () => {
    const ci = cutoutInterior({
      ...DEFAULT_BIN_PARAMS,
      overhang: { enabled: false, left: 5, right: 5, front: 0, back: 0 },
    });
    expect(ci.innerW).toBeCloseTo(NOMINAL, 5);
    expect(ci.offsetX).toBe(0);
  });

  it('clamps negative sides to zero', () => {
    const ci = cutoutInterior({
      ...DEFAULT_BIN_PARAMS,
      overhang: { left: -5, right: 4, front: 0, back: 0 },
    });
    expect(ci.innerW).toBeCloseTo(NOMINAL + 4, 5);
    expect(ci.offsetX).toBeCloseTo(2, 5);
  });

  it('suppresses overhang for polygon masks (the mask defines the footprint)', () => {
    const ci = cutoutInterior({
      ...DEFAULT_BIN_PARAMS,
      overhang: { left: 5, right: 5, front: 0, back: 0 },
      cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
    });
    expect(ci.innerW).toBeCloseTo(NOMINAL, 5);
    expect(ci.innerD).toBeCloseTo(NOMINAL, 5);
  });
});

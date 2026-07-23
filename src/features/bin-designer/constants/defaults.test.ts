import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '../constants/defaults';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '../constants/gridfinity';
import { validateBinParams } from '../utils/validation';
import { expectOk } from '@/test/testUtils';

describe('DEFAULT_BIN_PARAMS', () => {
  it('should pass validation', () => {
    const result = validateBinParams(DEFAULT_BIN_PARAMS);
    expectOk(result);
  });

  it('should have valid dimension ranges', () => {
    expect(DEFAULT_BIN_PARAMS.width).toBeGreaterThanOrEqual(DESIGNER_CONSTRAINTS.MIN_DIMENSION);
    expect(DEFAULT_BIN_PARAMS.width).toBeLessThanOrEqual(DESIGNER_CONSTRAINTS.MAX_DIMENSION);
    expect(DEFAULT_BIN_PARAMS.depth).toBeGreaterThanOrEqual(DESIGNER_CONSTRAINTS.MIN_DIMENSION);
    expect(DEFAULT_BIN_PARAMS.depth).toBeLessThanOrEqual(DESIGNER_CONSTRAINTS.MAX_DIMENSION);
    expect(DEFAULT_BIN_PARAMS.height).toBeGreaterThanOrEqual(DESIGNER_CONSTRAINTS.MIN_HEIGHT);
    expect(DEFAULT_BIN_PARAMS.height).toBeLessThanOrEqual(DESIGNER_CONSTRAINTS.MAX_HEIGHT);
  });

  it('should have standard style', () => {
    expect(DEFAULT_BIN_PARAMS.style).toBe('standard');
  });

  it('should have no features enabled by default', () => {
    expect(DEFAULT_BIN_PARAMS.compartments.cols).toBe(1);
    expect(DEFAULT_BIN_PARAMS.compartments.rows).toBe(1);
    expect(DEFAULT_BIN_PARAMS.scoop.enabled).toBe(false);
    expect(DEFAULT_BIN_PARAMS.label.enabled).toBe(false);
    expect(DEFAULT_BIN_PARAMS.label.support).toBe('bracket');
    expect(DEFAULT_BIN_PARAMS.label.depth).toBe(12);
    expect(DEFAULT_BIN_PARAMS.label.width).toBe(100);
    expect(DEFAULT_BIN_PARAMS.label.alignment).toBe('left');
  });

  it('should have wall cutouts on left/right sides by default', () => {
    expect(DEFAULT_BIN_PARAMS.walls.enabled).toBe(false);
    expect(DEFAULT_BIN_PARAMS.walls.front).toEqual(DISABLED_WALL_CUTOUT);
    expect(DEFAULT_BIN_PARAMS.walls.back).toEqual(DISABLED_WALL_CUTOUT);
    expect(DEFAULT_BIN_PARAMS.walls.left).toEqual({
      ...DISABLED_WALL_CUTOUT,
      enabled: true,
      width: 70,
      depth: 50,
    });
    expect(DEFAULT_BIN_PARAMS.walls.right).toEqual({
      ...DISABLED_WALL_CUTOUT,
      enabled: true,
      width: 70,
      depth: 50,
    });
    expect(DEFAULT_BIN_PARAMS.walls.interior).toEqual(DISABLED_WALL_CUTOUT);
  });

  it('should have u-shape as default wall cutout shape', () => {
    expect(DEFAULT_BIN_PARAMS.walls.shape).toBe('u-shape');
  });

  it('should have stacking lip enabled', () => {
    expect(DEFAULT_BIN_PARAMS.base.stackingLip).toBe(true);
  });

  it('should have ScoopConfig as default scoop type', () => {
    expect(typeof DEFAULT_BIN_PARAMS.scoop).toBe('object');
    expect(DEFAULT_BIN_PARAMS.scoop.enabled).toBe(false);
    expect(DEFAULT_BIN_PARAMS.scoop.radius).toBe('auto');
  });
});

describe('GRIDFINITY constants', () => {
  it('should have correct grid size', () => {
    expect(GRIDFINITY.GRID_SIZE).toBe(42);
  });

  it('should have correct height unit', () => {
    expect(GRIDFINITY.HEIGHT_UNIT).toBe(7);
  });

  it('should have positive wall thickness', () => {
    expect(GRIDFINITY.WALL_THICKNESS).toBeGreaterThan(0);
  });

  it('should have valid magnet dimensions', () => {
    expect(GRIDFINITY.MAGNET_DIAMETER).toBeGreaterThan(0);
    expect(GRIDFINITY.MAGNET_DEPTH).toBeGreaterThan(0);
  });
});

describe('DESIGNER_CONSTRAINTS magnet depth step', () => {
  it('MAGNET_HEIGHT_STEP is 0.1mm to allow fractional input', () => {
    expect(DESIGNER_CONSTRAINTS.MAGNET_HEIGHT_STEP).toBe(0.1);
  });

  it('validateBinParams rejects magnetDepth not on 0.1mm grid', () => {
    const params = {
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' as const, magnetDepth: 2.25 },
    };
    const result = validateBinParams(params);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.error.code).toBe('MAGNET_HEIGHT_INVALID_STEP');
    }
  });

  it('validateBinParams accepts fractional magnetDepth on 0.1mm grid', () => {
    const params = {
      ...DEFAULT_BIN_PARAMS,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' as const, magnetDepth: 2.3 },
    };
    expectOk(validateBinParams(params));
  });
});

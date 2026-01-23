import { describe, it, expect } from 'vitest';
import { isOk } from '@/core/result';
import { DEFAULT_BIN_PARAMS, migrateParams } from '../constants/defaults';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '../constants/gridfinity';
import { validateBinParams } from '../utils/validation';

describe('DEFAULT_BIN_PARAMS', () => {
  it('should pass validation', () => {
    const result = validateBinParams(DEFAULT_BIN_PARAMS);
    expect(isOk(result)).toBe(true);
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
    expect(DEFAULT_BIN_PARAMS.dividers.x).toBe(0);
    expect(DEFAULT_BIN_PARAMS.dividers.y).toBe(0);
    expect(DEFAULT_BIN_PARAMS.scoop.enabled).toBe(false);
    expect(DEFAULT_BIN_PARAMS.label.enabled).toBe(false);
  });

  it('should have no wall cutouts by default', () => {
    expect(DEFAULT_BIN_PARAMS.walls.front).toBe(0);
    expect(DEFAULT_BIN_PARAMS.walls.back).toBe(0);
    expect(DEFAULT_BIN_PARAMS.walls.left).toBe(0);
    expect(DEFAULT_BIN_PARAMS.walls.right).toBe(0);
  });

  it('should have stacking lip enabled', () => {
    expect(DEFAULT_BIN_PARAMS.base.stackingLip).toBe(true);
  });

  it('should have ScoopConfig as default scoop type', () => {
    expect(typeof DEFAULT_BIN_PARAMS.scoop).toBe('object');
    expect(DEFAULT_BIN_PARAMS.scoop.enabled).toBe(false);
    expect(DEFAULT_BIN_PARAMS.scoop.radius).toBe('auto');
    expect(DEFAULT_BIN_PARAMS.scoop.allRows).toBe(false);
  });

});

describe('migrateParams', () => {
  it('should handle legacy boolean scoop: true', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = migrateParams({ scoop: true as any });
    expect(result.scoop).toEqual({ enabled: true, radius: 'auto', allRows: false });
  });

  it('should handle legacy boolean scoop: false', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = migrateParams({ scoop: false as any });
    expect(result.scoop).toEqual({ enabled: false, radius: 'auto', allRows: false });
  });

  it('should pass through valid ScoopConfig', () => {
    const config = { enabled: true, radius: 10, allRows: true };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = migrateParams({ scoop: config as any });
    expect(result.scoop).toEqual({ enabled: true, radius: 10, allRows: true });
  });

  it('should fill missing ScoopConfig fields with defaults', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = migrateParams({ scoop: { enabled: true } as any });
    expect(result.scoop.radius).toBe('auto');
    expect(result.scoop.allRows).toBe(false);
  });

  it('should produce valid params from empty input', () => {
    const result = migrateParams({});
    expect(isOk(validateBinParams(result))).toBe(true);
  });

  it('should produce valid params from legacy format', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = migrateParams({
      width: 2,
      depth: 2,
      height: 3,
      style: 'standard',
      scoop: true as any,
    });
    expect(isOk(validateBinParams(result))).toBe(true);
    expect(result.scoop.enabled).toBe(true);
  });

  it('should preserve all non-migrated fields', () => {
    const result = migrateParams({
      width: 4,
      depth: 5,
      height: 8,
      style: 'rugged',
    });
    expect(result.width).toBe(4);
    expect(result.depth).toBe(5);
    expect(result.height).toBe(8);
    expect(result.style).toBe('rugged');
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
    expect(GRIDFINITY.MAGNET_INSET).toBeGreaterThan(0);
  });
});

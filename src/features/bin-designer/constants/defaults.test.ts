import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT, migrateParams } from '../constants/defaults';
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

describe('migrateParams', () => {
  it('should handle legacy boolean scoop: true', () => {
    const result = migrateParams({ scoop: true as any });
    expect(result.scoop).toEqual({ enabled: true, radius: 'auto' });
  });

  it('should handle legacy boolean scoop: false', () => {
    const result = migrateParams({ scoop: false as any });
    expect(result.scoop).toEqual({ enabled: false, radius: 'auto' });
  });

  it('should pass through valid ScoopConfig', () => {
    const config = { enabled: true, radius: 10 };

    const result = migrateParams({ scoop: config });
    expect(result.scoop).toEqual({ enabled: true, radius: 10 });
  });

  it('should fill missing ScoopConfig fields with defaults', () => {
    const result = migrateParams({ scoop: { enabled: true } as any });
    expect(result.scoop.radius).toBe('auto');
  });

  it('should produce valid params from empty input', () => {
    const result = migrateParams({});
    expectOk(validateBinParams(result));
  });

  it('should produce valid params from legacy format', () => {
    const result = migrateParams({
      width: 2,
      depth: 2,
      height: 3,
      style: 'standard',
      scoop: true as any,
    });
    expectOk(validateBinParams(result));
    expect(result.scoop.enabled).toBe(true);
  });

  it('should preserve all non-migrated fields', () => {
    const result = migrateParams({
      width: 4,
      depth: 5,
      height: 8,
    });
    expect(result.width).toBe(4);
    expect(result.depth).toBe(5);
    expect(result.height).toBe(8);
    expect(result.style).toBe('standard');
  });

  it('should merge label params with defaults', () => {
    const result = migrateParams({ label: { enabled: true, depth: 15 } as any });
    expect(result.label).toEqual({
      enabled: true,
      support: 'bracket',
      depth: 15,
      width: 100,
      alignment: 'left',
    });
  });

  it('should migrate legacy dividers to compartments', () => {
    const result = migrateParams({ dividers: { x: 2, y: 1, thickness: 1.5 } });
    expect(result.compartments.cols).toBe(3);
    expect(result.compartments.rows).toBe(2);
    expect(result.compartments.thickness).toBe(1.5);
    expect(result.compartments.cells).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('should migrate legacy number-based walls to WallCutout format', () => {
    const result = migrateParams({ walls: { front: 80, back: 0, left: 50, right: 0 } } as any);
    expect(result.walls.front).toEqual({
      ...DISABLED_WALL_CUTOUT,
      enabled: true,
      width: 80,
      depth: 100,
    });
    expect(result.walls.back).toEqual(DISABLED_WALL_CUTOUT);
    expect(result.walls.left).toEqual({
      ...DISABLED_WALL_CUTOUT,
      enabled: true,
      width: 50,
      depth: 100,
    });
    expect(result.walls.right).toEqual(DISABLED_WALL_CUTOUT);
    expect(result.walls.interior).toEqual(DISABLED_WALL_CUTOUT);
    expect(result.walls.enabled).toBe(true);
  });

  it('should pass through new WallCutout format', () => {
    const walls = {
      enabled: true,
      shape: 'u-shape' as const,
      width: 70,
      depth: 50,
      front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 80, depth: 60 },
      back: DISABLED_WALL_CUTOUT,
      left: DISABLED_WALL_CUTOUT,
      right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 40 },
      interior: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    };
    const result = migrateParams({ walls });
    expect(result.walls).toEqual(walls);
  });

  it('should fill missing WallCutout fields with defaults', () => {
    const result = migrateParams({ walls: { front: { width: 80 } } } as any);
    expect(result.walls.front).toEqual({ ...DISABLED_WALL_CUTOUT, enabled: true, width: 80 });
    expect(result.walls.back).toEqual(DISABLED_WALL_CUTOUT);
  });

  it('should produce valid params from legacy wall format', () => {
    const result = migrateParams({ walls: { front: 50, back: 80, left: 0, right: 100 } } as any);
    expectOk(validateBinParams(result));
  });

  it('should migrate legacy eco mode string to wallPattern enabled', () => {
    const result = migrateParams({
      eco: { honeycombWall: { mode: 'pocketed' } },
    });
    expect(result.wallPattern.enabled).toBe(true);
    expect(result.wallPattern.pattern).toBe('honeycomb');
  });

  it('should migrate legacy eco mode "none" to wallPattern disabled', () => {
    const result = migrateParams({
      eco: { honeycombWall: { mode: 'none' } },
    });
    expect(result.wallPattern.enabled).toBe(false);
    expect(result.wallPattern.pattern).toBe('honeycomb');
  });

  it('should migrate legacy eco enabled boolean to wallPattern', () => {
    const result = migrateParams({
      eco: { honeycombWall: { enabled: true } },
    });
    expect(result.wallPattern.enabled).toBe(true);
    expect(result.wallPattern.pattern).toBe('honeycomb');
  });

  it('should preserve new wallPattern field when present', () => {
    const result = migrateParams({
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    });
    expect(result.wallPattern.enabled).toBe(true);
    expect(result.wallPattern.pattern).toBe('honeycomb');
  });

  it('should default wallPattern to disabled when neither wallPattern nor eco field is present', () => {
    const result = migrateParams({});
    expect(result.wallPattern.enabled).toBe(false);
    expect(result.wallPattern.pattern).toBe('honeycomb');
  });

  it('should not share wallPattern reference with DEFAULT_WALL_PATTERN_CONFIG', () => {
    const result1 = migrateParams({});
    const result2 = migrateParams({});
    expect(result1.wallPattern).not.toBe(result2.wallPattern);
  });

  it('should handle mixed legacy walls with partial WallCutout objects alongside numbers', () => {
    // Legacy format: at least one side is a number, another is a partial WallCutout object
    const result = migrateParams({
      walls: { front: 80, back: { width: 50, depth: 75 }, left: 0, right: undefined },
    } as any);
    // Number value: front=80 → enabled with depth 100
    expect(result.walls.front).toEqual({
      ...DISABLED_WALL_CUTOUT,
      enabled: true,
      width: 80,
      depth: 100,
    });
    // Object value: back gets merged with defaults and inferred enabled
    expect(result.walls.back.width).toBe(50);
    expect(result.walls.back.depth).toBe(75);
    expect(result.walls.back.enabled).toBe(true);
    // Number zero: left=0 → disabled
    expect(result.walls.left).toEqual(DISABLED_WALL_CUTOUT);
    // Undefined: right → defaults
    expect(result.walls.right).toEqual(DEFAULT_BIN_PARAMS.walls.front);
  });

  it('should migrate legacy base.solid=true to style="solid"', () => {
    const result = migrateParams({
      style: 'standard',
      base: { solid: true } as any,
    });
    expect(result.style).toBe('solid');
  });

  it('should not change style when base.solid is false', () => {
    const result = migrateParams({
      style: 'standard',
      base: { solid: false } as any,
    });
    expect(result.style).toBe('standard');
  });

  it('should not change style when already solid', () => {
    const result = migrateParams({
      style: 'solid',
      base: { solid: true } as any,
    });
    expect(result.style).toBe('solid');
  });

  it('should default walls.shape to u-shape when shape is missing', () => {
    const result = migrateParams({
      walls: {
        enabled: true,
        width: 70,
        depth: 50,
        front: { enabled: true, width: 70, depth: 50 },
      } as any,
    });
    expect(result.walls.shape).toBe('u-shape');
  });

  it('should default walls.shape to u-shape when shape is invalid', () => {
    const result = migrateParams({
      walls: {
        enabled: true,
        shape: 'invalid-shape',
        width: 70,
        depth: 50,
        front: { enabled: true, width: 70, depth: 50 },
      } as any,
    });
    expect(result.walls.shape).toBe('u-shape');
  });

  it('backfills handles with defaults for old designs', () => {
    const old = { width: 2, depth: 2, height: 3 }; // no handles field
    const result = migrateParams(old);
    expect(result.handles).toEqual(DEFAULT_BIN_PARAMS.handles);
  });

  it('migrates legacy handle config (ledge → hole) with nested side merging', () => {
    const old = {
      width: 2,
      depth: 2,
      height: 3,
      handles: {
        enabled: true,
        depth: 12, // legacy field — should be stripped
        width: 80,
        filletRadius: 6, // legacy field — should be stripped
        front: { enabled: false },
        // back, left, right omitted — should get defaults
      },
    };
    const result = migrateParams(old as any);
    expect(result.handles.enabled).toBe(true);
    expect(result.handles.width).toBe(80); // preserved
    expect(result.handles.height).toBe(15); // default (legacy depth stripped)
    expect(result.handles.cornerRadius).toBe(10); // default (legacy fillet stripped)
    expect(result.handles.front.enabled).toBe(false);
    expect(result.handles.back.enabled).toBe(false); // default
    expect(result.handles.left.enabled).toBe(true); // default
    // Verify legacy fields are not present on migrated config
    expect((result.handles as Record<string, unknown>).depth).toBeUndefined();
    expect((result.handles as Record<string, unknown>).filletRadius).toBeUndefined();
  });

  it('should preserve valid walls.shape values', () => {
    const resultScoop = migrateParams({
      walls: {
        enabled: true,
        shape: 'scoop',
        width: 70,
        depth: 50,
        front: { enabled: true, width: 70, depth: 50 },
      } as any,
    });
    expect(resultScoop.walls.shape).toBe('scoop');

    const resultFunnel = migrateParams({
      walls: {
        enabled: true,
        shape: 'funnel',
        width: 70,
        depth: 50,
        front: { enabled: true, width: 70, depth: 50 },
      } as any,
    });
    expect(resultFunnel.walls.shape).toBe('funnel');

    const resultUShape = migrateParams({
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 70,
        depth: 50,
        front: { enabled: true, width: 70, depth: 50 },
      } as any,
    });
    expect(resultUShape.walls.shape).toBe('u-shape');
  });

  it('should provide default featureColors when absent', () => {
    const result = migrateParams({});
    expect(result.featureColors).toEqual({
      body: '#d4d8dc',
      lip: '#d4d8dc',
      labelTab: '#d4d8dc',
    });
  });

  it('should migrate legacy slot IDs to hex colors', () => {
    const legacy = { body: 'slot2' as const, lip: 'slot3' as const, labelTab: 'slot1' as const };
    const result = migrateParams({
      featureColors: legacy,
    });
    expect(result.featureColors).toEqual({
      body: '#3b82f6',
      lip: '#22c55e',
      labelTab: '#d4d8dc',
    });
  });

  it('should preserve hex featureColors through double migration', () => {
    const hex = { body: '#ef4444', lip: '#3b82f6', labelTab: '#22c55e' };
    const firstPass = migrateParams({ featureColors: hex });
    const secondPass = migrateParams(firstPass);
    expect(secondPass.featureColors).toEqual(hex);
  });

  it('should backfill missing featureColors fields from defaults', () => {
    const partial = { body: '#3b82f6' } as unknown as typeof DEFAULT_BIN_PARAMS.featureColors;
    const result = migrateParams({ featureColors: partial });
    expect(result.featureColors.body).toBe('#3b82f6');
    expect(result.featureColors.lip).toBe('#d4d8dc');
    expect(result.featureColors.labelTab).toBe('#d4d8dc');
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

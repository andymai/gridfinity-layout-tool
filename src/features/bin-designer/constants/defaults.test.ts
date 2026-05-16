import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT, migrateParams } from '../constants/defaults';
import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '../constants/gridfinity';
import { validateBinParams } from '../utils/validation';
import { expectOk } from '@/test/testUtils';
import type { BinParams } from '../types';

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
      enabled: false,
      body: '#d4d8dc',
      lip: {
        frontLeft: '#d4d8dc',
        frontRight: '#d4d8dc',
        backRight: '#d4d8dc',
        backLeft: '#d4d8dc',
      },
      labelTab: '#d4d8dc',
      base: '#d4d8dc',
      scoop: '#d4d8dc',
      dividers: '#d4d8dc',
    });
  });

  it('should migrate legacy slot IDs to hex colors', () => {
    const legacy = { body: 'slot2' as const, lip: 'slot3' as const, labelTab: 'slot1' as const };
    const result = migrateParams({
      featureColors: legacy,
    });
    expect(result.featureColors.body).toBe('#3b82f6');
    expect(result.featureColors.lip).toEqual({
      frontLeft: '#22c55e',
      frontRight: '#22c55e',
      backRight: '#22c55e',
      backLeft: '#22c55e',
    });
    expect(result.featureColors.labelTab).toBe('#d4d8dc');
    // Legacy design had diverged colors but no `enabled` field — back-fill to true
    // so its multi-color look is preserved post-migration.
    expect(result.featureColors.enabled).toBe(true);
  });

  it('expands the legacy single-color lip into four matching corners', () => {
    // Pre-corner-lip designs stored `lip` as a single hex string. All four
    // corners must inherit that value so existing designs render unchanged.
    const legacy = { body: '#222', lip: '#ff0000', labelTab: '#0f0' };
    const result = migrateParams({ featureColors: legacy });
    expect(result.featureColors.lip).toEqual({
      frontLeft: '#ff0000',
      frontRight: '#ff0000',
      backRight: '#ff0000',
      backLeft: '#ff0000',
    });
    expect(result.featureColors.enabled).toBe(true);
  });

  it('preserves explicit enabled:false even when colors are diverged', () => {
    // raw.enabled ?? hasCustomColor — when the user explicitly chose false,
    // that wins over the auto-derive, so toggling off doesn't bounce back to
    // true just because their saved colors still diverge.
    const explicitOff = {
      enabled: false,
      body: '#222',
      lip: { frontLeft: '#f00', frontRight: '#f00', backRight: '#f00', backLeft: '#f00' },
      labelTab: '#0f0',
      base: '#222',
      scoop: '#222',
      dividers: '#222',
    };
    const result = migrateParams({ featureColors: explicitOff });
    expect(result.featureColors.enabled).toBe(false);
  });

  it('should preserve hex featureColors through double migration', () => {
    const hex = {
      enabled: true,
      body: '#ef4444',
      lip: {
        frontLeft: '#3b82f6',
        frontRight: '#3b82f6',
        backRight: '#3b82f6',
        backLeft: '#3b82f6',
      },
      labelTab: '#22c55e',
      base: '#ef4444',
      scoop: '#ef4444',
      dividers: '#ef4444',
    };
    const firstPass = migrateParams({ featureColors: hex });
    const secondPass = migrateParams(firstPass);
    expect(secondPass.featureColors).toEqual(hex);
  });

  it('inherits body for missing zones and auto-enables when body was customized', () => {
    // Pre-`enabled` design: only `body` is explicitly set, but it's a non-default
    // color — the user could only have set this via the old Labs multi-color
    // section, so honor their intent and auto-enable.
    const partial = { body: '#3b82f6' } as unknown as typeof DEFAULT_BIN_PARAMS.featureColors;
    const result = migrateParams({ featureColors: partial });
    expect(result.featureColors.body).toBe('#3b82f6');
    // Lip corners with no input → inherit body color (no surprise visual change).
    expect(result.featureColors.lip.frontLeft).toBe('#3b82f6');
    expect(result.featureColors.lip.frontRight).toBe('#3b82f6');
    // New zones similarly inherit body so older designs match what they showed before.
    expect(result.featureColors.base).toBe('#3b82f6');
    expect(result.featureColors.scoop).toBe('#3b82f6');
    expect(result.featureColors.dividers).toBe('#3b82f6');
    expect(result.featureColors.labelTab).toBe('#3b82f6');
    // Body diverges from the default → auto-enable so their body color renders.
    expect(result.featureColors.enabled).toBe(true);
  });

  it('does not auto-enable when every zone matches the historical default color', () => {
    // Legacy design that was never customized — pre-`enabled` semantics treated
    // this as single-color, and the new opt-in toggle should reflect that.
    const allDefault = {
      body: '#d4d8dc',
      lip: {
        frontLeft: '#d4d8dc',
        frontRight: '#d4d8dc',
        backRight: '#d4d8dc',
        backLeft: '#d4d8dc',
      },
      labelTab: '#d4d8dc',
      base: '#d4d8dc',
      scoop: '#d4d8dc',
      dividers: '#d4d8dc',
    } as unknown as typeof DEFAULT_BIN_PARAMS.featureColors;
    const result = migrateParams({ featureColors: allDefault });
    expect(result.featureColors.enabled).toBe(false);
  });

  it('backfills lid with defaults for designs saved before lid feature existed', () => {
    const result = migrateParams({ width: 2, depth: 2, height: 3 });
    expect(result.lid).toEqual(DEFAULT_BIN_PARAMS.lid);
    expect(result.lid.enabled).toBe(false);
  });

  it('preserves stored lid config and fills missing fields from defaults', () => {
    const result = migrateParams({
      lid: { enabled: true, magnetHoles: true } as any,
    });
    expect(result.lid.enabled).toBe(true);
    expect(result.lid.magnetHoles).toBe(true);
    // Unspecified fields fall back to DEFAULT_LID_CONFIG
    expect(result.lid.stackableTop).toBe(DEFAULT_BIN_PARAMS.lid.stackableTop);
  });

  it('strips legacy `fit`, `wallThickness`, `topThickness` from old saved designs', () => {
    // These three fields were removed from LidConfig — designs saved
    // before that point still carry them, and re-spreading would put
    // unknown properties back onto the typed config.
    const result = migrateParams({
      lid: {
        enabled: true,
        stackableTop: true,
        fit: 'tight',
        wallThickness: 1.6,
        topThickness: 1.6,
      } as any,
    });
    expect(result.lid.enabled).toBe(true);
    expect(result.lid.stackableTop).toBe(true);
    expect((result.lid as any).fit).toBeUndefined();
    expect((result.lid as any).wallThickness).toBeUndefined();
    expect((result.lid as any).topThickness).toBeUndefined();
  });

  it('passes through fully-specified lid config', () => {
    const lid = {
      enabled: true,
      stackableTop: true,
      magnetHoles: true,
      clickRails: { front: false, back: true, left: true, right: false },
      clickRailCoverage: 75,
    };
    const result = migrateParams({ lid });
    expect(result.lid).toEqual(lid);
  });

  it('backfills clickRails (object) for legacy lid configs missing the field', () => {
    const result = migrateParams({
      lid: {
        enabled: true,
        fit: 'standard',
        stackableTop: false,
        magnetHoles: false,
        wallThickness: 1.2,
        topThickness: 1.2,
        clickRailCoverage: 50,
        // clickRails missing — pre-feature designs were always built
        // with rails, so the backfill restores all four sides on.
      } as unknown as BinParams['lid'],
    });
    expect(result.lid.clickRails).toEqual({
      front: true,
      back: true,
      left: true,
      right: true,
    });
  });

  it('migrates legacy clickRails: true to all four sides on', () => {
    const result = migrateParams({
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        clickRails: true as unknown as BinParams['lid']['clickRails'],
      },
    });
    expect(result.lid.clickRails).toEqual({
      front: true,
      back: true,
      left: true,
      right: true,
    });
  });

  it('migrates legacy clickRails: false to all four sides off (friction-fit)', () => {
    const result = migrateParams({
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        clickRails: false as unknown as BinParams['lid']['clickRails'],
      },
    });
    expect(result.lid.clickRails).toEqual({
      front: false,
      back: false,
      left: false,
      right: false,
    });
  });

  it('backfills missing per-side flags from defaults when clickRails is a partial object', () => {
    const result = migrateParams({
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        // Only `front` set; the other three should fall back to default (true).
        clickRails: { front: false } as unknown as BinParams['lid']['clickRails'],
      },
    });
    expect(result.lid.clickRails).toEqual({
      front: false,
      back: true,
      left: true,
      right: true,
    });
  });

  it('backfills clickRailCoverage from defaults for legacy lid configs missing the field', () => {
    const result = migrateParams({
      lid: {
        enabled: true,
        fit: 'standard',
        stackableTop: true,
        magnetHoles: false,
        wallThickness: 1.2,
        topThickness: 1.2,
        // clickRailCoverage missing — should fall back to whatever
        // DEFAULT_LID_CONFIG ships, NOT a hard-coded value, since the
        // first-enable default has shifted over time (started at 100%
        // edge-to-edge, then moved to 50% for filament economy).
      } as unknown as BinParams['lid'],
    });
    expect(result.lid.clickRailCoverage).toBe(DEFAULT_BIN_PARAMS.lid.clickRailCoverage);
  });

  describe('cutout scoop migration', () => {
    const makeCutout = (overrides: Record<string, unknown> = {}): unknown => ({
      id: 'c1',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 20,
      depth: 20,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
      ...overrides,
    });

    it('copies legacy scoopRadius into both axis fields', () => {
      const result = migrateParams({
        cutouts: [makeCutout({ scoopRadius: 4 })] as BinParams['cutouts'],
      });
      const c = result.cutouts[0];
      expect(c.scoopRadiusW).toBe(4);
      expect(c.scoopRadiusD).toBe(4);
      // Legacy field should be stripped after migration
      expect('scoopRadius' in c).toBe(false);
    });

    it('preserves split fields when both are already set', () => {
      const result = migrateParams({
        cutouts: [makeCutout({ scoopRadiusW: 6, scoopRadiusD: 2 })] as BinParams['cutouts'],
      });
      expect(result.cutouts[0].scoopRadiusW).toBe(6);
      expect(result.cutouts[0].scoopRadiusD).toBe(2);
    });

    it('ignores legacy scoopRadius when split fields are already set', () => {
      const result = migrateParams({
        cutouts: [
          makeCutout({ scoopRadius: 10, scoopRadiusW: 3, scoopRadiusD: 5 }),
        ] as BinParams['cutouts'],
      });
      expect(result.cutouts[0].scoopRadiusW).toBe(3);
      expect(result.cutouts[0].scoopRadiusD).toBe(5);
    });

    it('is idempotent — re-migrating a migrated cutout is a no-op', () => {
      const once = migrateParams({
        cutouts: [makeCutout({ scoopRadius: 4 })] as BinParams['cutouts'],
      });
      const twice = migrateParams({ cutouts: once.cutouts });
      expect(twice.cutouts[0]).toEqual(once.cutouts[0]);
    });

    it('leaves cutouts without scoop fields untouched', () => {
      const result = migrateParams({
        cutouts: [makeCutout()] as BinParams['cutouts'],
      });
      expect(result.cutouts[0].scoopRadiusW).toBeUndefined();
      expect(result.cutouts[0].scoopRadiusD).toBeUndefined();
    });
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

import { describe, it, expect } from 'vitest';
import {
  migrateWalls,
  migrateParams,
  extractStyleDefaults,
  STYLE_DEFAULT_OMIT_KEYS,
} from './paramMigration';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from './defaults';
import type { LidConfig } from '../types';
import { FLOOR_PATTERN_TYPES, WALL_PATTERN_TYPES } from '../types';
import { DESIGNER_CONSTRAINTS } from './gridfinity';
import { validateBinParams } from '../utils/validation';
import { makeUniformLipCells } from '../types/featureColors';
import { DEFAULT_SLIDE_CONFIG } from '../types/slide';
import { expectOk } from '@/test/testUtils';
import type { BinParams } from '../types';

const defaults = DEFAULT_BIN_PARAMS.walls;
const migrate = (raw: Parameters<typeof migrateWalls>[0]): ReturnType<typeof migrateWalls> =>
  migrateWalls(raw, defaults, DISABLED_WALL_CUTOUT);

describe('migrateWalls', () => {
  it('returns the defaults when input is undefined', () => {
    expect(migrate(undefined)).toBe(defaults);
  });

  it('expands legacy numeric sides into WallCutout objects', () => {
    const result = migrate({ front: 12, back: 0 });
    expect(result.front.enabled).toBe(true);
    expect(result.front.width).toBe(12);
    expect(result.front.depth).toBe(100);
    expect(result.back.enabled).toBe(false);
    expect(result.back.width).toBe(0);
    expect(result.enabled).toBe(true);
  });

  it('leaves all sides disabled when every legacy number is zero', () => {
    const result = migrate({ front: 0, back: 0, left: 0, right: 0 });
    expect(result.enabled).toBe(false);
  });

  it('merges current object-form sides with defaults', () => {
    const result = migrate({
      enabled: true,
      front: { enabled: true, width: 20, depth: 30 },
    });
    expect(result.enabled).toBe(true);
    expect(result.front.width).toBe(20);
    expect(result.front.depth).toBe(30);
    // Unspecified sides fall back to defaults
    expect(result.back).toEqual(defaults.back);
  });

  it('backfills enabled from non-zero dims when the field is absent', () => {
    const result = migrate({ front: { width: 15, depth: 40 } });
    expect(result.front.enabled).toBe(true);
  });

  it('rejects an invalid shape and falls back to the default', () => {
    const result = migrate({ shape: 'bogus' as never });
    expect(result.shape).toBe(defaults.shape);
  });
});

/** Expected migrated lip: a uniform 1×1 grid of `hex`. */
function uniformLip(hex: string) {
  return { corners: 1, bands: 1, cells: makeUniformLipCells(hex) };
}

describe('extractStyleDefaults', () => {
  it('omits every per-design geometry key', () => {
    const result = extractStyleDefaults(DEFAULT_BIN_PARAMS);
    for (const key of STYLE_DEFAULT_OMIT_KEYS) {
      expect(result).not.toHaveProperty(key);
    }
  });

  it('keeps reusable style and dimension preferences', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1.5,
      depth: 3,
      height: 6,
      wallThickness: 2.4,
    };
    const result = extractStyleDefaults(params);
    expect(result.width).toBe(1.5);
    expect(result.depth).toBe(3);
    expect(result.height).toBe(6);
    expect(result.wallThickness).toBe(2.4);
    expect(result.base).toEqual(DEFAULT_BIN_PARAMS.base);
    expect(result.label).toEqual(DEFAULT_BIN_PARAMS.label);
    expect(result.lid).toEqual(DEFAULT_BIN_PARAMS.lid);
    expect(result.featureColors).toEqual(DEFAULT_BIN_PARAMS.featureColors);
  });

  it('does not mutate the input params', () => {
    const before = JSON.stringify(DEFAULT_BIN_PARAMS);
    extractStyleDefaults(DEFAULT_BIN_PARAMS);
    expect(JSON.stringify(DEFAULT_BIN_PARAMS)).toBe(before);
  });

  it('produces a partial that migrateParams re-completes to a valid bin', () => {
    const partial = extractStyleDefaults({
      ...DEFAULT_BIN_PARAMS,
      compartments: { cols: 2, rows: 2, thickness: 1.6, cells: [0, 1, 2, 3] },
    });
    const completed = migrateParams(partial);
    expectOk(validateBinParams(completed));
    // Stripped compartments fall back to the factory single cell.
    expect(completed.compartments).toEqual(DEFAULT_BIN_PARAMS.compartments);
  });
});

describe('migrateParams', () => {
  it('drops orphaned mesh cutouts and unreferenced mesh assets together', () => {
    const asset = {
      name: 'wrench',
      data: 'AAAA',
      triangleCount: 12,
      sizeMm: { x: 20, y: 10, z: 5 },
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
        ],
      ],
    };
    const meshCutout = {
      id: 'mesh-1',
      shape: 'mesh',
      meshId: 'kept',
      x: 0,
      y: 0,
      width: 20,
      depth: 10,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
    } as const;
    const orphanCutout = { ...meshCutout, id: 'mesh-2', meshId: 'ghost' };

    const result = migrateParams({
      cutouts: [meshCutout, orphanCutout],
      meshAssets: { kept: asset, unreferenced: asset },
    });

    expect(result.cutouts.map((c) => c.id)).toEqual(['mesh-1']);
    expect(Object.keys(result.meshAssets ?? {})).toEqual(['kept']);
  });

  it('clears meshAssets entirely when nothing references it', () => {
    const asset = {
      name: 'wrench',
      data: 'AAAA',
      triangleCount: 12,
      sizeMm: { x: 20, y: 10, z: 5 },
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
        ],
      ],
    };
    const result = migrateParams({ meshAssets: { stray: asset } });
    expect(result.meshAssets).toBeUndefined();
  });

  it('should handle legacy boolean scoop: true', () => {
    const result = migrateParams({ scoop: true as any });
    expect(result.scoop).toEqual({ ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto' });
  });

  it('should handle legacy boolean scoop: false', () => {
    const result = migrateParams({ scoop: false as any });
    expect(result.scoop).toEqual({ ...DEFAULT_BIN_PARAMS.scoop, enabled: false, radius: 'auto' });
  });

  it('should pass through valid ScoopConfig and backfill new defaults', () => {
    const config = { enabled: true, radius: 10 };

    const result = migrateParams({ scoop: config });
    // radius/run stay untouched; style + autoMaxHeight backfill from defaults so
    // legacy single-value designs keep rendering as a symmetric quarter shape.
    expect(result.scoop).toEqual({ ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 10 });
    expect(result.scoop.run).toBeUndefined();
  });

  it('should fill missing ScoopConfig fields with defaults', () => {
    const result = migrateParams({ scoop: { enabled: true } as any });
    expect(result.scoop.radius).toBe('auto');
  });

  it('should produce valid params from empty input', () => {
    const result = migrateParams({});
    expectOk(validateBinParams(result));
  });

  it('backfills fractional edge defaults to "end" for legacy designs', () => {
    const result = migrateParams({ width: 2.5 });
    expect(result.fractionalEdgeX).toBe('end');
    expect(result.fractionalEdgeY).toBe('end');
  });

  it('leaves surfaceText absent for pre-feature designs', () => {
    const result = migrateParams({ width: 2, depth: 2 });
    expect(result.surfaceText).toBeUndefined();
  });

  it('preserves valid surfaceText and clamps overlong strings', () => {
    const result = migrateParams({
      surfaceText: { lidText: 'Cables', style: { mode: 'emboss' } },
    });
    expect(result.surfaceText).toEqual({ lidText: 'Cables', style: { mode: 'emboss' } });

    const clamped = migrateParams({ surfaceText: { lidText: 'x'.repeat(60) } });
    expect(clamped.surfaceText?.lidText).toHaveLength(50);
  });

  it('collapses empty/junk surfaceText to undefined', () => {
    expect(migrateParams({ surfaceText: {} } as any).surfaceText).toBeUndefined();
    expect(migrateParams({ surfaceText: { lidText: '   ' } } as any).surfaceText).toBeUndefined();
    expect(migrateParams({ surfaceText: { style: {} } } as any).surfaceText).toBeUndefined();
    expect(migrateParams({ surfaceText: 'label' } as any).surfaceText).toBeUndefined();
    expect(migrateParams({ surfaceText: { lidText: 42 } } as any).surfaceText).toBeUndefined();
  });

  it('trims persisted lid text so store, worker, and geometry agree', () => {
    const result = migrateParams({ surfaceText: { lidText: '  Cables  ' } });
    expect(result.surfaceText?.lidText).toBe('Cables');
  });

  it('drops invalid surface-text style fields and keeps valid ones', () => {
    const result = migrateParams({
      surfaceText: {
        lidText: 'ok',
        style: {
          mode: 'blast',
          font: 'comic-sans',
          depth: 0.6,
          margin: 999,
          minFontSize: Number.NaN,
          fontSizeOverride: 'big',
          evil: 1,
        },
      },
    } as any);
    // Only the in-range depth survives; every malformed field is dropped
    // instead of flowing into the BREP worker via resolveLidInputs.
    expect(result.surfaceText).toEqual({ lidText: 'ok', style: { depth: 0.6 } });

    const allInvalid = migrateParams({
      surfaceText: { style: { mode: 'blast', depth: -1 } },
    } as any);
    expect(allInvalid.surfaceText).toBeUndefined();
  });

  it('extractStyleDefaults drops the per-design surface text', () => {
    const result = extractStyleDefaults({
      ...DEFAULT_BIN_PARAMS,
      surfaceText: { lidText: 'Cables' },
    });
    expect(result).not.toHaveProperty('surfaceText');
  });

  it('preserves wall texts, dropping unknown sides and blank values', () => {
    const result = migrateParams({
      surfaceText: {
        walls: { front: ' Cables ', diagonal: 'nope', back: '   ', left: 'x'.repeat(60) },
        wallAlign: 'top',
      },
    } as any);
    // Kept sides are clamped AND trimmed, like the lid text.
    expect(result.surfaceText?.walls).toEqual({ front: 'Cables', left: 'x'.repeat(50) });
    expect(result.surfaceText?.wallAlign).toBe('top');
  });

  it('drops wallAlign when it is the center default or no wall text remains', () => {
    expect(
      migrateParams({ surfaceText: { walls: { front: 'ok' }, wallAlign: 'center' } } as any)
        .surfaceText?.wallAlign
    ).toBeUndefined();
    expect(
      migrateParams({ surfaceText: { walls: { front: '  ' }, wallAlign: 'top' } } as any)
        .surfaceText
    ).toBeUndefined();
    expect(
      migrateParams({ surfaceText: { walls: { front: 'ok' }, wallAlign: 'sideways' } } as any)
        .surfaceText?.wallAlign
    ).toBeUndefined();
  });

  it('defaults the exterior-wall collar to 0 for legacy designs', () => {
    const result = migrateParams({ width: 2, depth: 2, height: 3 });
    expect(result.extraWallHeightMm).toBe(0);
  });

  it('preserves a valid exterior-wall collar', () => {
    const result = migrateParams({ extraWallHeightMm: 12 });
    expect(result.extraWallHeightMm).toBe(12);
  });

  it('clamps an out-of-range or non-numeric collar', () => {
    expect(migrateParams({ extraWallHeightMm: -5 } as any).extraWallHeightMm).toBe(0);
    expect(migrateParams({ extraWallHeightMm: 9999 } as any).extraWallHeightMm).toBe(
      DESIGNER_CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT
    );
    expect(migrateParams({ extraWallHeightMm: 'tall' } as any).extraWallHeightMm).toBe(0);
  });

  it('preserves an explicit fractional edge choice', () => {
    const result = migrateParams({ width: 2.5, fractionalEdgeX: 'start' } as any);
    expect(result.fractionalEdgeX).toBe('start');
    expect(result.fractionalEdgeY).toBe('end');
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
      edges: 'back',
      inset: 0,
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

  it('should backfill wallPattern.dividers to false on designs that predate it', () => {
    const result = migrateParams({ wallPattern: { enabled: true, pattern: 'honeycomb' } });
    expect(result.wallPattern.dividers).toBe(false);
  });

  it('should coerce a non-boolean wallPattern.dividers to false', () => {
    const result = migrateParams({
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: 'yes' },
    });
    expect(result.wallPattern.dividers).toBe(false);
  });

  it('should preserve wallPattern.dividers when opted in', () => {
    const result = migrateParams({
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
    });
    expect(result.wallPattern.dividers).toBe(true);
  });

  it('should preserve every registered pattern type through migration', () => {
    for (const pattern of WALL_PATTERN_TYPES) {
      const result = migrateParams({ wallPattern: { enabled: true, pattern } });
      expect(result.wallPattern.pattern).toBe(pattern);
    }
  });

  it('should coerce unknown persisted pattern values to honeycomb', () => {
    const result = migrateParams({
      wallPattern: { enabled: true, pattern: 'not-a-pattern' },
    });
    expect(result.wallPattern.pattern).toBe('honeycomb');
  });

  it('should default wallPattern to disabled when neither wallPattern nor eco field is present', () => {
    const result = migrateParams({});
    expect(result.wallPattern.enabled).toBe(false);
    expect(result.wallPattern.pattern).toBe('honeycomb');
  });

  it('should backfill a disabled floorPattern on designs saved before the feature', () => {
    const result = migrateParams({});
    expect(result.floorPattern).toEqual({ enabled: false, pattern: 'round', scale: 0.5 });
  });

  it('should preserve every registered floor pattern type through migration', () => {
    for (const pattern of FLOOR_PATTERN_TYPES) {
      const result = migrateParams({ floorPattern: { enabled: true, pattern } });
      expect(result.floorPattern?.pattern).toBe(pattern);
      expect(result.floorPattern?.enabled).toBe(true);
    }
  });

  it('should coerce a floor pattern the floor cannot tile back to the default', () => {
    // Kumiko lattices are valid wall patterns but only exist wrapped around the
    // perimeter, so a crafted payload naming one must not reach the geometry.
    const result = migrateParams({
      floorPattern: { enabled: true, pattern: 'mitsukude' },
    } as never);
    expect(result.floorPattern?.pattern).toBe('round');
  });

  it('should clamp a crafted floorPattern scale into [0, 1]', () => {
    expect(
      migrateParams({ floorPattern: { enabled: true, pattern: 'round', scale: 42 } }).floorPattern
        ?.scale
    ).toBe(1);
    expect(
      migrateParams({ floorPattern: { enabled: true, pattern: 'round', scale: -3 } }).floorPattern
        ?.scale
    ).toBe(0);
    expect(
      migrateParams({ floorPattern: { enabled: true, pattern: 'round', scale: NaN } }).floorPattern
        ?.scale
    ).toBe(0.5);
  });

  it('should not share wallPattern reference with DEFAULT_WALL_PATTERN_CONFIG', () => {
    const result1 = migrateParams({});
    const result2 = migrateParams({});
    expect(result1.wallPattern).not.toBe(result2.wallPattern);
    expect(result1.wallPattern.sides).not.toBe(result2.wallPattern.sides);
  });

  it('should backfill wallPattern.sides to all four walls (#2966)', () => {
    // Designs saved before per-side selection patterned every wall — a missing
    // `sides` must not be read as "no walls".
    expect(
      migrateParams({ wallPattern: { enabled: true, pattern: 'round' } }).wallPattern.sides
    ).toEqual({ left: true, right: true, front: true, back: true });
  });

  it('should preserve an explicit wallPattern.sides selection', () => {
    expect(
      migrateParams({
        wallPattern: {
          enabled: true,
          pattern: 'round',
          sides: { left: false, right: false, front: true, back: false },
        },
      }).wallPattern.sides
    ).toEqual({ left: false, right: false, front: true, back: false });
  });

  it('should coerce a partial or crafted wallPattern.sides object', () => {
    expect(
      migrateParams({
        wallPattern: { enabled: true, pattern: 'round', sides: { back: false, left: 'yes' } },
      }).wallPattern.sides
    ).toEqual({ left: true, right: true, front: true, back: false });
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
    expect('depth' in result.handles).toBe(false);
    expect('filletRadius' in result.handles).toBe(false);
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
      lip: uniformLip('#d4d8dc'),
      labelTab: '#d4d8dc',
      base: '#d4d8dc',
      scoop: '#d4d8dc',
      dividers: '#d4d8dc',
      text: '#d4d8dc',
      lid: '#d4d8dc',
      topAccent: { enabled: false, heightMm: 2, color: '#d4d8dc' },
    });
  });

  it('backfills a disabled topAccent (body color) for designs predating it', () => {
    const legacy = {
      enabled: true,
      body: '#112233',
    } as unknown as (typeof DEFAULT_BIN_PARAMS)['featureColors'];
    const result = migrateParams({ featureColors: legacy });
    expect(result.featureColors.topAccent).toEqual({
      enabled: false,
      heightMm: 2,
      color: '#112233',
    });
  });

  it('preserves a persisted topAccent and clamps a bad height to the default', () => {
    const withAccent = {
      enabled: true,
      topAccent: { enabled: true, heightMm: 3.5, color: '#ff0000' },
    } as unknown as (typeof DEFAULT_BIN_PARAMS)['featureColors'];
    expect(migrateParams({ featureColors: withAccent }).featureColors.topAccent).toEqual({
      enabled: true,
      heightMm: 3.5,
      color: '#ff0000',
    });
    const badHeight = {
      topAccent: { enabled: true, heightMm: -4, color: '#ff0000' },
    } as unknown as (typeof DEFAULT_BIN_PARAMS)['featureColors'];
    expect(migrateParams({ featureColors: badHeight }).featureColors.topAccent.heightMm).toBe(2);
  });

  it('clamps a persisted band taller than the wall height to the bin bound', () => {
    // 1 unit × 7mm/unit = 7mm wall; a stored 50mm band clamps to 7mm so it can't
    // recolor the whole bin on load.
    const tall = {
      topAccent: { enabled: true, heightMm: 50, color: '#ff0000' },
    } as unknown as (typeof DEFAULT_BIN_PARAMS)['featureColors'];
    const result = migrateParams({ height: 1, heightUnitMm: 7, featureColors: tall });
    expect(result.featureColors.topAccent.heightMm).toBe(7);
  });

  it('includes the exterior-wall collar in the top-accent clamp bound', () => {
    // 1 unit × 7mm + 10mm collar = 17mm wall top; a 15mm band stays unclamped.
    const banded = {
      topAccent: { enabled: true, heightMm: 15, color: '#ff0000' },
    } as unknown as (typeof DEFAULT_BIN_PARAMS)['featureColors'];
    const result = migrateParams({
      height: 1,
      heightUnitMm: 7,
      extraWallHeightMm: 10,
      featureColors: banded,
    });
    expect(result.featureColors.topAccent.heightMm).toBe(15);
  });

  it('uses the clamped (not raw) collar for the top-accent bound', () => {
    // A persisted collar above MAX is normalized to MAX everywhere; the accent
    // bound must use that clamped value so the band can't exceed the bin's real
    // post-migration wall top.
    const banded = {
      topAccent: { enabled: true, heightMm: 5000, color: '#ff0000' },
    } as unknown as (typeof DEFAULT_BIN_PARAMS)['featureColors'];
    const result = migrateParams({
      height: 1,
      heightUnitMm: 7,
      extraWallHeightMm: 99999,
      featureColors: banded,
    });
    expect(result.featureColors.topAccent.heightMm).toBe(
      7 + DESIGNER_CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT
    );
  });

  it('rejects NaN height/heightUnitMm when computing the clamp bound', () => {
    const banded = {
      topAccent: { enabled: true, heightMm: 3, color: '#ff0000' },
    } as unknown as (typeof DEFAULT_BIN_PARAMS)['featureColors'];
    // NaN height would poison Math.max(1, NaN)=NaN and yield a NaN band; the
    // finite guard falls back to the default height so the clamp stays valid.
    const result = migrateParams({
      height: NaN,
      featureColors: banded,
    });
    expect(Number.isFinite(result.featureColors.topAccent.heightMm)).toBe(true);
    expect(result.featureColors.topAccent.heightMm).toBe(3);
  });

  it('should migrate legacy slot IDs to hex colors', () => {
    const legacy = { body: 'slot2' as const, lip: 'slot3' as const, labelTab: 'slot1' as const };
    const result = migrateParams({
      featureColors: legacy,
    });
    expect(result.featureColors.body).toBe('#3b82f6');
    expect(result.featureColors.lip).toEqual(uniformLip('#22c55e'));
    expect(result.featureColors.labelTab).toBe('#d4d8dc');
    // Legacy design had diverged colors but no `enabled` field — back-fill to true
    // so its multi-color look is preserved post-migration.
    expect(result.featureColors.enabled).toBe(true);
  });

  it('canonicalizes mismatched lip corners to frontLeft on load (bug #3)', () => {
    // The per-corner lip editor was rolled back to a single picker that
    // mirrors hex into all four slots. Designs saved while the per-corner
    // editor was live can land with mismatched corners — the picker shows
    // frontLeft but the 3D preview and 3MF exporter both classify lip
    // triangles per quadrant and honor the mismatch, producing slicer
    // output that doesn't match what the picker displays. Canonicalize
    // to frontLeft on load.
    const mismatched = {
      enabled: true,
      body: '#222222',
      lip: {
        frontLeft: '#ff00ff',
        frontRight: '#00ff00',
        backRight: '#0000ff',
        backLeft: '#ffff00',
      },
      labelTab: '#222222',
    };
    const result = migrateParams({ featureColors: mismatched });
    // Legacy 4-corner object canonicalizes to a uniform 1×1 grid on frontLeft.
    expect(result.featureColors.lip).toEqual(uniformLip('#ff00ff'));
  });

  it('migrates a matching legacy 4-corner lip to a uniform grid', () => {
    const matched = {
      enabled: true,
      body: '#222222',
      lip: {
        frontLeft: '#ff0000',
        frontRight: '#ff0000',
        backRight: '#ff0000',
        backLeft: '#ff0000',
      },
    };
    const result = migrateParams({ featureColors: matched });
    expect(result.featureColors.lip).toEqual(uniformLip('#ff0000'));
  });

  it('expands the legacy single-color lip string into a uniform grid', () => {
    // Pre-corner-lip designs stored `lip` as a single hex string. The whole
    // grid inherits that value so existing designs render unchanged.
    const legacy = { body: '#222', lip: '#ff0000', labelTab: '#0f0' };
    const result = migrateParams({ featureColors: legacy });
    expect(result.featureColors.lip).toEqual(uniformLip('#ff0000'));
    expect(result.featureColors.enabled).toBe(true);
  });

  it('passes a new grid lip through migration and backfills missing cells', () => {
    const grid = {
      enabled: true,
      body: '#000000',
      lip: { corners: 4, bands: 2, cells: { 'lip:backRight:1': '#abcdef' } },
    };
    const result = migrateParams({ featureColors: grid });
    expect(result.featureColors.lip.corners).toBe(4);
    expect(result.featureColors.lip.bands).toBe(2);
    expect(result.featureColors.lip.cells['lip:backRight:1']).toBe('#abcdef');
    // Unspecified cells backfill from body.
    expect(result.featureColors.lip.cells['lip:frontLeft:0']).toBe('#000000');
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
      lip: uniformLip('#3b82f6'),
      labelTab: '#22c55e',
      base: '#ef4444',
      scoop: '#ef4444',
      dividers: '#ef4444',
      // Text zone was added in v4.109. Old payloads default to inheriting the
      // label-tab color so single-color users see no shift on migrate.
      text: '#22c55e',
      lid: '#22c55e',
    };
    const firstPass = migrateParams({ featureColors: hex });
    const secondPass = migrateParams(firstPass);
    // Idempotent: a grid lip passes through unchanged on re-migration.
    expect(secondPass.featureColors).toEqual(firstPass.featureColors);
    expect(secondPass.featureColors.lip).toEqual(uniformLip('#3b82f6'));
  });

  it('inherits body for missing zones and auto-enables when body was customized', () => {
    // Pre-`enabled` design: only `body` is explicitly set, but it's a non-default
    // color — the user could only have set this via the old Labs multi-color
    // section, so honor their intent and auto-enable.
    const partial = { body: '#3b82f6' } as unknown as typeof DEFAULT_BIN_PARAMS.featureColors;
    const result = migrateParams({ featureColors: partial });
    expect(result.featureColors.body).toBe('#3b82f6');
    // Lip cells with no input → inherit body color (no surprise visual change).
    expect(result.featureColors.lip).toEqual(uniformLip('#3b82f6'));
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
    // Every field takes its default EXCEPT the interior relief (#3477), which
    // is off for anything that predates it. Moot here — the design has no lid
    // — but the rule has to hold uniformly or it would depend on load order.
    expect(result.lid).toEqual({ ...DEFAULT_BIN_PARAMS.lid, relieveInterior: false });
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

  it('backfills stackLipOnly off so pre-#2930 designs keep the full grid', () => {
    const result = migrateParams({ lid: { enabled: true, stackableTop: true } as any });
    expect(result.lid.stackLipOnly).toBe(false);
  });

  it('passes through fully-specified lid config', () => {
    const lid = {
      enabled: true,
      attachment: 'magnetic' as const,
      stackableTop: true,
      stackLipOnly: true,
      magnetHoles: true,
      separateStackPlate: true,
      clickRails: { front: false, back: true, left: true, right: false },
      clickRailCoverage: 75,
      extraHeightMm: 25,
      topThicknessMm: 2,
      retentionMagnet: { diameter: 8, depth: 3, edgeMagnets: 2 },
      tray: { enabled: true, depthMm: 5, wallMm: 3 },
      grip: {
        mode: 'scallop' as const,
        sides: { front: true, back: true, left: false, right: false },
        coverage: 40,
        heightMm: 2.4,
        binDip: true,
      },
      // Explicitly stored, which is what a design created after #3477 holds.
      relieveInterior: true,
    };
    const result = migrateParams({ lid });
    expect(result.lid).toEqual(lid);
  });

  it('leaves the interior relief off for a design that predates it', () => {
    // The whole point of the flag: a published bin must regenerate with the
    // geometry it was published with, so an absent field means off even though
    // DEFAULT_LID_CONFIG has it on for new designs.
    // Cast because the field is required on the CURRENT type and this models a
    // design persisted before it existed, which is exactly what migration is for.
    const { relieveInterior: _absent, ...withoutFlag } = DEFAULT_BIN_PARAMS.lid;
    expect(migrateParams({ lid: withoutFlag as LidConfig }).lid.relieveInterior).toBe(false);
    expect(DEFAULT_BIN_PARAMS.lid.relieveInterior).toBe(true);
  });

  it('derives attachment from legacy rails and backfills magnet/tray defaults', () => {
    // Legacy lid predating the attachment field, with rails on → clickRails.
    const withRails = migrateParams({
      lid: { enabled: true, clickRails: { front: true, back: true, left: true, right: true } },
    } as never);
    expect(withRails.lid.attachment).toBe('clickRails');
    expect(withRails.lid.retentionMagnet).toEqual({ diameter: 6, depth: 2, edgeMagnets: 0 });
    expect(withRails.lid.tray).toEqual({ enabled: false, depthMm: 4, wallMm: 2 });

    // Legacy lid with all rails off → friction.
    const noRails = migrateParams({
      lid: { enabled: true, clickRails: { front: false, back: false, left: false, right: false } },
    } as never);
    expect(noRails.lid.attachment).toBe('friction');
  });

  it('clamps out-of-range retention magnet and tray dimensions', () => {
    const result = migrateParams({
      lid: {
        enabled: true,
        attachment: 'magnetic' as const,
        retentionMagnet: { diameter: 999, depth: -5, edgeMagnets: 99 },
        tray: { enabled: true, depthMm: 999, wallMm: 0 },
      },
    } as never);
    expect(result.lid.retentionMagnet.diameter).toBe(15); // max
    expect(result.lid.retentionMagnet.depth).toBe(1); // min
    expect(result.lid.retentionMagnet.edgeMagnets).toBe(3); // max
    expect(result.lid.tray.depthMm).toBe(30); // max
    expect(result.lid.tray.wallMm).toBe(1); // min
  });

  it('reads a grip height of auto for a design saved before the knob existed', () => {
    const result = migrateParams({
      lid: { enabled: true, grip: { mode: 'scallop', coverage: 50 } } as never,
    });
    // `null` is auto, the mode's own request, so the lid regenerates exactly
    // as it did before the field existed.
    expect(result.lid.grip.heightMm).toBeNull();
  });

  it('clamps a stored grip height and rejects a non-numeric one', () => {
    expect(
      migrateParams({ lid: { grip: { mode: 'scallop', heightMm: 999 } } as never }).lid.grip
        .heightMm
    ).toBe(10);
    expect(
      migrateParams({ lid: { grip: { mode: 'scallop', heightMm: 0 } } as never }).lid.grip.heightMm
    ).toBe(0.8);
    expect(
      migrateParams({ lid: { grip: { mode: 'scallop', heightMm: 'tall' } } as never }).lid.grip
        .heightMm
    ).toBeNull();
  });

  it('backfills separateStackPlate=false for legacy lid configs missing the field', () => {
    const result = migrateParams({
      lid: { enabled: true, stackableTop: true } as any,
    });
    expect(result.lid.separateStackPlate).toBe(false);
  });

  it('defaults extraHeightMm=0 for legacy lid configs missing the field', () => {
    const result = migrateParams({
      lid: { enabled: true, stackableTop: true } as any,
    });
    expect(result.lid.extraHeightMm).toBe(0);
  });

  it('clamps an out-of-range extraHeightMm into the valid range', () => {
    expect(migrateParams({ lid: { extraHeightMm: 999 } as any }).lid.extraHeightMm).toBe(100);
    expect(migrateParams({ lid: { extraHeightMm: -50 } as any }).lid.extraHeightMm).toBe(0);
    // Non-numeric / corrupt values fall back to the default.
    expect(migrateParams({ lid: { extraHeightMm: 'tall' } as any }).lid.extraHeightMm).toBe(0);
  });

  it('defaults topThicknessMm to the 0.8mm baseline for legacy lid configs', () => {
    const result = migrateParams({
      lid: { enabled: true, stackableTop: true } as any,
    });
    expect(result.lid.topThicknessMm).toBe(0.8);
  });

  // A legacy design carries a `topThickness` field that the migration strips.
  // It must NOT be read as the new `topThicknessMm` knob — the two never
  // meant the same thing, and 1.2 would silently thicken every old lid.
  it('does not adopt the stripped legacy topThickness as the new knob', () => {
    const result = migrateParams({
      lid: { enabled: true, topThickness: 1.2, wallThickness: 1.2, fit: 'standard' } as any,
    });
    expect(result.lid.topThicknessMm).toBe(0.8);
    expect('topThickness' in result.lid).toBe(false);
  });

  it('clamps an out-of-range topThicknessMm into the valid range', () => {
    expect(migrateParams({ lid: { topThicknessMm: 99 } as any }).lid.topThicknessMm).toBe(5);
    expect(migrateParams({ lid: { topThicknessMm: 0.1 } as any }).lid.topThicknessMm).toBe(0.8);
    expect(migrateParams({ lid: { topThicknessMm: 'thick' } as any }).lid.topThicknessMm).toBe(0.8);
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

  it('keeps every previously-shippable coverage as an exact stop', () => {
    // The stop list went from 50/75/100 to 5% steps (#3401). Because
    // `migrateClickRailCoverage` snaps to the NEAREST option, dropping a value
    // that designs were saved with would silently re-render them at a
    // different coverage: a changed printed part with no notice. 75 is the
    // one at risk, and it is why the step is 5 and not the requested 10.
    for (const coverage of [50, 75, 100]) {
      const result = migrateParams({
        lid: { ...DEFAULT_BIN_PARAMS.lid, clickRailCoverage: coverage },
      });
      expect(result.lid.clickRailCoverage).toBe(coverage);
    }
  });

  it('snaps an off-stop coverage to the nearest supported one', () => {
    const result = migrateParams({
      lid: { ...DEFAULT_BIN_PARAMS.lid, clickRailCoverage: 73 },
    });
    expect(result.lid.clickRailCoverage).toBe(75);
  });

  it('leaves a socket-mode tab width exactly as stored', () => {
    // `migrateParams` runs on EVERY load, so it cannot "normalise once". It
    // also cannot tell a width the user deliberately set in socket mode
    // (#3402) from one left over in storage from a stint in text mode, so it
    // must not touch either; resetting would wipe the new control's value
    // every time the design reopened.
    // Both non-default (the default is 100), so neither iteration can pass by
    // the merge-over-defaults spread happening to land on the right value.
    for (const width of [40, 65]) {
      const result = migrateParams({
        label: { ...DEFAULT_BIN_PARAMS.label, mode: 'socket', width },
      });
      expect(result.label.width).toBe(width);
    }
  });

  it('leaves a text-mode tab width alone', () => {
    const result = migrateParams({
      label: { ...DEFAULT_BIN_PARAMS.label, mode: 'text', width: 40 },
    });
    expect(result.label.width).toBe(40);
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

  describe('sliding tray migration', () => {
    it('backfills the whole config for designs predating the feature', () => {
      const result = migrateParams({});
      expect(result.slide).toEqual(DEFAULT_SLIDE_CONFIG);
    });

    it('completes a partially-stored config from the default', () => {
      // A design saved mid-feature carries some fields and not others; the
      // generator must never see a half-formed config.
      const result = migrateParams({
        slide: { enabled: true, trayWidthUnits: 2 } as BinParams['slide'],
      });
      expect(result.slide.enabled).toBe(true);
      expect(result.slide.trayWidthUnits).toBe(2);
      expect(result.slide.clearanceMm).toBe(DEFAULT_SLIDE_CONFIG.clearanceMm);
      expect(result.slide.railMount).toBe(DEFAULT_SLIDE_CONFIG.railMount);
    });

    it('coerces an unknown railMount back to the default', () => {
      const result = migrateParams({
        slide: { railMount: 'sideways' } as unknown as BinParams['slide'],
      });
      expect(result.slide.railMount).toBe(DEFAULT_SLIDE_CONFIG.railMount);
    });

    it('is idempotent', () => {
      const once = migrateParams({ slide: { enabled: true } as BinParams['slide'] });
      expect(migrateParams({ slide: once.slide }).slide).toEqual(once.slide);
    });
  });
});

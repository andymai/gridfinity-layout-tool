import { describe, it, expect } from 'vitest';
import {
  calcMaxGridUnits,
  generateId,
  createDefaultLayout,
  createLayoutWithSettings,
  DEFAULT_CATEGORIES,
  STAGING_ID,
  DEFAULT_CATEGORY_COLOR,
  getBaseCellSize,
  BREAKPOINTS,
  getDefaultDrawerSize,
  migrateBaseplateParams,
} from '@/core/constants';

describe('calcMaxGridUnits', () => {
  it('calculates max units for typical print bed', () => {
    // 256mm bed, 42mm grid
    // N ≤ 256 / 42 = 6.09 → 6 (bin size = 252mm fits on 256mm bed)
    expect(calcMaxGridUnits(256, 42)).toEqual({ width: 6, depth: 6 });
  });

  it('returns 1 for small print bed', () => {
    // 40mm bed can only fit 1 unit of 42mm grid (clamped to minimum)
    expect(calcMaxGridUnits(40, 42)).toEqual({ width: 1, depth: 1 });
  });

  it('calculates correctly for large print bed', () => {
    // 300mm bed, 42mm grid
    // N ≤ 300 / 42 = 7.14 → 7 (bin size = 294mm fits on 300mm bed)
    expect(calcMaxGridUnits(300, 42)).toEqual({ width: 7, depth: 7 });
  });

  it('handles exact fit scenarios', () => {
    // 126mm bed fits exactly 3 units: 3 * 42 = 126mm
    expect(calcMaxGridUnits(126, 42)).toEqual({ width: 3, depth: 3 });
    // 125mm bed: floor(125/42 * 2) / 2 = 2.5 (2.5 * 42 = 105mm fits on 125mm bed)
    expect(calcMaxGridUnits(125, 42)).toEqual({ width: 2.5, depth: 2.5 });
  });

  it('handles small grid units', () => {
    // 256mm bed, 20mm grid
    // N ≤ 256 / 20 = 12.8 → 12.5 (bin size = 250mm fits on 256mm bed)
    expect(calcMaxGridUnits(256, 20)).toEqual({ width: 12.5, depth: 12.5 });
  });

  it('never returns less than 1', () => {
    // Even impossible scenarios return at least 1
    expect(calcMaxGridUnits(1, 100)).toEqual({ width: 1, depth: 1 });
  });

  it('supports asymmetric print bed', () => {
    // 256mm wide × 210mm deep bed, 42mm grid
    expect(calcMaxGridUnits(256, 42, 210)).toEqual({ width: 6, depth: 5 });
  });

  it('uses width for depth when depth is omitted', () => {
    expect(calcMaxGridUnits(300, 42)).toEqual({ width: 7, depth: 7 });
    expect(calcMaxGridUnits(300, 42, undefined)).toEqual({ width: 7, depth: 7 });
  });

  it('floors to half-unit increments for half-bin mode support', () => {
    // 280mm bed, 42mm grid: 280/42 = 6.667 → 6.5
    // A 6.5-unit bin = 273mm fits on 280mm bed
    expect(calcMaxGridUnits(280, 42)).toEqual({ width: 6.5, depth: 6.5 });
  });

  it('handles non-standard grid unit (25mm) with 300mm bed', () => {
    // 300mm bed, 25mm grid: 300/25 = 12 exactly
    expect(calcMaxGridUnits(300, 25)).toEqual({ width: 12, depth: 12 });
  });

  it('allows half-unit bins that fit in mm but not in whole units', () => {
    // 313mm bed, 25mm grid: 313/25 = 12.52 → 12.5
    // A 12.5-unit bin = 312.5mm fits on 313mm bed
    expect(calcMaxGridUnits(313, 25)).toEqual({ width: 12.5, depth: 12.5 });
    // A 13-unit bin = 325mm does NOT fit, so max should be 12.5
    expect(calcMaxGridUnits(313, 25).width).toBeLessThan(13);
  });
});

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it('generates valid string format', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(id).toContain('-');
  });
});

describe('createDefaultLayout', () => {
  it('creates a valid default layout', () => {
    const layout = createDefaultLayout();
    expect(layout.version).toBe('1.0');
    expect(layout.name).toBe('Untitled layout');
    expect(layout.drawer.width).toBe(10);
    expect(layout.drawer.depth).toBe(8);
    expect(layout.drawer.height).toBe(12);
  });

  it('includes default categories', () => {
    const layout = createDefaultLayout();
    expect(layout.categories).toHaveLength(5);
    expect(layout.categories[0].name).toBe('Coral');
  });

  it('starts with one layer', () => {
    const layout = createDefaultLayout();
    expect(layout.layers).toHaveLength(1);
    expect(layout.layers[0].name).toBe('Layer 1');
    expect(layout.layers[0].height).toBe(3);
  });

  it('starts with no bins', () => {
    const layout = createDefaultLayout();
    expect(layout.bins).toHaveLength(0);
  });
});

describe('createLayoutWithSettings', () => {
  it('creates a layout using provided settings', () => {
    const settings = {
      defaultDrawerWidth: 20,
      defaultDrawerDepth: 15,
      defaultDrawerHeight: 10,
      defaultLayerHeight: 5,
      defaultPrintBedSize: 300,
      defaultGridUnitMm: 50,
      defaultHeightUnitMm: 10,
    };

    const layout = createLayoutWithSettings(settings);

    expect(layout.drawer.width).toBe(20);
    expect(layout.drawer.depth).toBe(15);
    expect(layout.drawer.height).toBe(10);
    expect(layout.printBedSize).toBe(300);
    expect(layout.gridUnitMm).toBe(50);
    expect(layout.heightUnitMm).toBe(10);
  });

  it('includes default categories regardless of settings', () => {
    const settings = {
      defaultDrawerWidth: 20,
      defaultDrawerDepth: 15,
      defaultDrawerHeight: 10,
      defaultLayerHeight: 5,
      defaultPrintBedSize: 300,
      defaultGridUnitMm: 50,
      defaultHeightUnitMm: 10,
    };

    const layout = createLayoutWithSettings(settings);

    expect(layout.categories).toHaveLength(5);
    expect(layout.categories[0].name).toBe('Coral');
  });

  it('starts with one layer', () => {
    const settings = {
      defaultDrawerWidth: 20,
      defaultDrawerDepth: 15,
      defaultDrawerHeight: 10,
      defaultLayerHeight: 5,
      defaultPrintBedSize: 300,
      defaultGridUnitMm: 50,
      defaultHeightUnitMm: 10,
    };

    const layout = createLayoutWithSettings(settings);

    expect(layout.layers).toHaveLength(1);
    expect(layout.layers[0].name).toBe('Layer 1');
  });

  it('uses defaultLayerHeight for initial layer', () => {
    const settings = {
      defaultDrawerWidth: 20,
      defaultDrawerDepth: 15,
      defaultDrawerHeight: 20,
      defaultLayerHeight: 5,
      defaultPrintBedSize: 300,
      defaultGridUnitMm: 50,
      defaultHeightUnitMm: 10,
    };

    const layout = createLayoutWithSettings(settings);

    expect(layout.layers).toHaveLength(1);
    expect(layout.layers[0].height).toBe(5);
  });

  it('clamps initial layer height to drawer height', () => {
    const settings = {
      defaultDrawerWidth: 20,
      defaultDrawerDepth: 15,
      defaultDrawerHeight: 4, // Drawer height is 4
      defaultLayerHeight: 10, // But default is 10
      defaultPrintBedSize: 300,
      defaultGridUnitMm: 50,
      defaultHeightUnitMm: 10,
    };

    const layout = createLayoutWithSettings(settings);

    // Should be clamped to drawer height
    expect(layout.layers[0].height).toBe(4);
  });

  it('starts with no bins', () => {
    const settings = {
      defaultDrawerWidth: 20,
      defaultDrawerDepth: 15,
      defaultDrawerHeight: 10,
      defaultLayerHeight: 5,
      defaultPrintBedSize: 300,
      defaultGridUnitMm: 50,
      defaultHeightUnitMm: 10,
    };

    const layout = createLayoutWithSettings(settings);

    expect(layout.bins).toHaveLength(0);
  });
});

describe('constants', () => {
  it('exports STAGING_ID', () => {
    expect(STAGING_ID).toBe('__staging__');
  });

  it('exports DEFAULT_CATEGORY_COLOR', () => {
    expect(DEFAULT_CATEGORY_COLOR).toBe('#6b7280');
  });

  it('exports DEFAULT_CATEGORIES with correct colors', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(5);
    expect(DEFAULT_CATEGORIES.find((c) => c.id === 'coral')?.color).toBe('#f87171');
  });
});

describe('getBaseCellSize', () => {
  it('returns 28 for tiny phones (< 375px)', () => {
    expect(getBaseCellSize(320)).toBe(28);
    expect(getBaseCellSize(374)).toBe(28);
  });

  it('returns 32 for mobile devices (375px - 767px)', () => {
    expect(getBaseCellSize(375)).toBe(32);
    expect(getBaseCellSize(640)).toBe(32);
    expect(getBaseCellSize(767)).toBe(32);
  });

  it('returns 36 for tablets (768px - 899px)', () => {
    expect(getBaseCellSize(768)).toBe(36);
    expect(getBaseCellSize(850)).toBe(36);
    expect(getBaseCellSize(899)).toBe(36);
  });

  it('returns 32 for desktop (>= 900px)', () => {
    expect(getBaseCellSize(900)).toBe(32);
    expect(getBaseCellSize(1280)).toBe(32);
    expect(getBaseCellSize(1920)).toBe(32);
  });

  it('uses BREAKPOINTS constants correctly', () => {
    // Just below TINY_PHONE threshold
    expect(getBaseCellSize(BREAKPOINTS.TINY_PHONE - 1)).toBe(28);
    // Just below MD threshold
    expect(getBaseCellSize(BREAKPOINTS.MD - 1)).toBe(32);
    // Just below LG threshold
    expect(getBaseCellSize(BREAKPOINTS.LG - 1)).toBe(36);
    // At LG threshold
    expect(getBaseCellSize(BREAKPOINTS.LG)).toBe(32);
  });
});

describe('migrateBaseplateParams', () => {
  it('preserves connectorNubs when true', () => {
    const stored = {
      magnetHoles: true,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 5,
      paddingRight: 5,
      paddingFront: 0,
      paddingBack: 0,
      connectorNubs: true,
    };
    const result = migrateBaseplateParams(stored);
    expect(result.connectorNubs).toBe(true);
  });

  it('omits connectorNubs when not present in stored data', () => {
    const stored = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
    };
    const result = migrateBaseplateParams(stored);
    expect(result.connectorNubs).toBeUndefined();
  });

  it('preserves overTile across a save/load round-trip', () => {
    const base = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 6,
      paddingRight: 6,
      paddingFront: 0,
      paddingBack: 0,
    };
    expect(migrateBaseplateParams({ ...base, overTile: true }).overTile).toBe(true);
    expect(migrateBaseplateParams({ ...base, overTile: false }).overTile).toBe(false);
    // Absent → undefined (treated as off downstream)
    expect(migrateBaseplateParams(base).overTile).toBeUndefined();
  });

  it('preserves overTileHalfGrid across a save/load round-trip', () => {
    const base = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 6,
      paddingRight: 6,
      paddingFront: 0,
      paddingBack: 0,
      overTile: true,
    };
    expect(migrateBaseplateParams({ ...base, overTileHalfGrid: true }).overTileHalfGrid).toBe(true);
    expect(migrateBaseplateParams({ ...base, overTileHalfGrid: false }).overTileHalfGrid).toBe(
      false
    );
    expect(migrateBaseplateParams(base).overTileHalfGrid).toBeUndefined();
  });

  it('returns defaults for null input', () => {
    const result = migrateBaseplateParams(null);
    expect(result.magnetHoles).toBe(false);
    expect(result.connectorNubs).toBeUndefined();
  });

  it('preserves and clamps a persisted stackPrint config', () => {
    const base = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
    };
    const result = migrateBaseplateParams({
      ...base,
      // `mode` is a dropped legacy field — migration ignores it.
      stackPrint: { enabled: true, gapMm: 5, mode: 'sacrificialSheet' },
    });
    expect(result.stackPrint).toEqual({
      enabled: true,
      gapMm: 1, // clamped to STACK_PRINT_MAX_GAP_MM
    });
    // Absent or malformed → undefined
    expect(migrateBaseplateParams(base).stackPrint).toBeUndefined();
    expect(
      migrateBaseplateParams({ ...base, stackPrint: { gapMm: 3 } }).stackPrint
    ).toBeUndefined();
  });

  it('persists the detachMargins opt-in even alongside stack-print', () => {
    const base = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 10,
      paddingRight: 10,
      paddingFront: 10,
      paddingBack: 10,
    };
    expect(migrateBaseplateParams({ ...base, detachMargins: true }).detachMargins).toBe(true);
    expect(migrateBaseplateParams({ ...base }).detachMargins).toBeUndefined();
    // Mutual exclusivity is resolved at runtime (buildFullParams/UI), so the
    // stored opt-in survives migration even when stacking is also enabled.
    expect(
      migrateBaseplateParams({
        ...base,
        detachMargins: true,
        stackPrint: { enabled: true, gapMm: 1 },
      }).detachMargins
    ).toBe(true);
  });

  it('preserves connectorStyle when dovetail key', () => {
    const stored = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      connectorNubs: true,
      connectorStyle: 'dovetailKey',
    };
    const result = migrateBaseplateParams(stored);
    expect(result.connectorStyle).toBe('dovetailKey');
  });

  it('omits connectorStyle when absent or invalid', () => {
    const base = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
    };
    expect(migrateBaseplateParams(base).connectorStyle).toBeUndefined();
    expect(
      migrateBaseplateParams({ ...base, connectorStyle: 'nonsense' }).connectorStyle
    ).toBeUndefined();
  });

  it('migrates old format (no paddingLeft) preserving magnets', () => {
    const stored = { magnetHoles: true, magnetDiameter: 8, magnetDepth: 3 };
    const result = migrateBaseplateParams(stored);
    expect(result.magnetHoles).toBe(true);
    expect(result.paddingLeft).toBe(0);
    expect(result.connectorNubs).toBeUndefined();
  });

  // issue #2024 — the user's connector fit offset must survive save/load.
  it('preserves connectorFitOffset across a save/load round-trip', () => {
    const base = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      connectorNubs: true,
    };
    expect(migrateBaseplateParams({ ...base, connectorFitOffset: 0.15 }).connectorFitOffset).toBe(
      0.15
    );
    expect(migrateBaseplateParams({ ...base, connectorFitOffset: -0.1 }).connectorFitOffset).toBe(
      -0.1
    );
    // Absent → undefined (nominal clearance downstream).
    expect(migrateBaseplateParams(base).connectorFitOffset).toBeUndefined();
  });

  it('clamps an out-of-range connectorFitOffset to the allowed bounds', () => {
    const base = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      connectorNubs: true,
    };
    // Beyond ±0.3 collapses to the boundary.
    expect(migrateBaseplateParams({ ...base, connectorFitOffset: 5 }).connectorFitOffset).toBe(0.3);
    expect(migrateBaseplateParams({ ...base, connectorFitOffset: -5 }).connectorFitOffset).toBe(
      -0.3
    );
  });

  it('preserves invertDovetails, lightweight, cornerRadius, and cornerRadii', () => {
    const stored = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      invertDovetails: true,
      lightweight: false,
      cornerRadius: 3.5,
      cornerRadii: { tl: 1, tr: 2, bl: 3, br: 4 },
    };
    const result = migrateBaseplateParams(stored);
    expect(result.invertDovetails).toBe(true);
    expect(result.lightweight).toBe(false);
    expect(result.cornerRadius).toBe(3.5);
    expect(result.cornerRadii).toEqual({ tl: 1, tr: 2, bl: 3, br: 4 });
  });

  it('clamps cornerRadius and cornerRadii to [0, 200] mm', () => {
    const stored = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      cornerRadius: 9999,
      cornerRadii: { tl: -5, tr: 500, bl: 10, br: 10 },
    };
    const result = migrateBaseplateParams(stored);
    expect(result.cornerRadius).toBe(200);
    expect(result.cornerRadii).toEqual({ tl: 0, tr: 200, bl: 10, br: 10 });
  });

  it('ignores invalid cornerRadii shape', () => {
    const stored = {
      magnetHoles: false,
      magnetDiameter: 6.5,
      magnetDepth: 2,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      cornerRadii: { tl: 'oops' },
    };
    const result = migrateBaseplateParams(stored);
    expect(result.cornerRadii).toBeUndefined();
  });
});

describe('getDefaultDrawerSize', () => {
  it('returns portrait dimensions for mobile viewports', () => {
    const size = getDefaultDrawerSize(375);
    expect(size.depth).toBeGreaterThan(size.width);
    expect(size).toEqual({ width: 6, depth: 9, height: 12 });
  });

  it('returns landscape dimensions for desktop viewports', () => {
    const size = getDefaultDrawerSize(1024);
    expect(size.width).toBeGreaterThan(size.depth);
    expect(size).toEqual({ width: 10, depth: 8, height: 12 });
  });

  it('uses MD breakpoint as the threshold', () => {
    const mobile = getDefaultDrawerSize(BREAKPOINTS.MD - 1);
    const desktop = getDefaultDrawerSize(BREAKPOINTS.MD);
    expect(mobile.depth).toBeGreaterThan(mobile.width);
    expect(desktop.width).toBeGreaterThan(desktop.depth);
  });
});

import { describe, it, expect } from 'vitest';
import { calcMaxGridUnits, generateId, createDefaultLayout, createLayoutWithSettings, DEFAULT_CATEGORIES, STAGING_ID, DEFAULT_CATEGORY_COLOR } from '../constants';

describe('calcMaxGridUnits', () => {
  it('calculates max units for typical print bed', () => {
    // 256mm bed, 42mm grid
    // N ≤ 256 / 42 = 6.09 → 6 (bin size = 252mm fits on 256mm bed)
    expect(calcMaxGridUnits(256, 42)).toBe(6);
  });

  it('returns 1 for small print bed', () => {
    // 40mm bed can only fit 1 unit of 42mm grid (clamped to minimum)
    expect(calcMaxGridUnits(40, 42)).toBe(1);
  });

  it('calculates correctly for large print bed', () => {
    // 300mm bed, 42mm grid
    // N ≤ 300 / 42 = 7.14 → 7 (bin size = 294mm fits on 300mm bed)
    expect(calcMaxGridUnits(300, 42)).toBe(7);
  });

  it('handles exact fit scenarios', () => {
    // 126mm bed fits exactly 3 units: 3 * 42 = 126mm
    expect(calcMaxGridUnits(126, 42)).toBe(3);
    // 125mm bed fits only 2 units: floor(125 / 42) = 2
    expect(calcMaxGridUnits(125, 42)).toBe(2);
  });

  it('handles small grid units', () => {
    // 256mm bed, 20mm grid
    // N ≤ 256 / 20 = 12.8 → 12 (bin size = 240mm fits on 256mm bed)
    expect(calcMaxGridUnits(256, 20)).toBe(12);
  });

  it('never returns less than 1', () => {
    // Even impossible scenarios return at least 1
    expect(calcMaxGridUnits(1, 100)).toBe(1);
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
      defaultPrintBedSize: 300,
      defaultGridUnitMm: 50,
      defaultHeightUnitMm: 10,
    };

    const layout = createLayoutWithSettings(settings);

    expect(layout.layers).toHaveLength(1);
    expect(layout.layers[0].name).toBe('Layer 1');
  });

  it('starts with no bins', () => {
    const settings = {
      defaultDrawerWidth: 20,
      defaultDrawerDepth: 15,
      defaultDrawerHeight: 10,
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
    expect(DEFAULT_CATEGORIES.find(c => c.id === 'coral')?.color).toBe('#f87171');
  });
});

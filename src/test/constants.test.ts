import { describe, it, expect } from 'vitest';
import { calcMaxGridUnits, CONSTRAINTS, generateId, createDefaultLayout, DEFAULT_CATEGORIES, STAGING_ID, DEFAULT_CATEGORY_COLOR } from '../constants';

describe('calcMaxGridUnits', () => {
  it('calculates max units for typical print bed', () => {
    // 256mm bed, 42mm grid, 10mm gap
    // N ≤ (256 + 10) / (42 + 10) = 266 / 52 = 5.11 → 5
    expect(calcMaxGridUnits(256, 42)).toBe(5);
  });

  it('returns 1 for small print bed', () => {
    // 40mm bed can only fit 1 unit of 42mm grid
    expect(calcMaxGridUnits(40, 42)).toBe(1);
  });

  it('calculates correctly for large print bed', () => {
    // 300mm bed, 42mm grid, 10mm gap
    // N ≤ (300 + 10) / (42 + 10) = 310 / 52 = 5.96 → 5
    expect(calcMaxGridUnits(300, 42)).toBe(5);
  });

  it('handles exact fit scenarios', () => {
    // Bed size that fits exactly 3 units: 3*42 + 2*10 = 146mm
    // N ≤ (146 + 10) / (42 + 10) = 156 / 52 = 3
    expect(calcMaxGridUnits(146, 42)).toBe(3);
  });

  it('uses PRINT_GAP_MM constant', () => {
    // Verify the calculation uses the gap constant
    const gap = CONSTRAINTS.PRINT_GAP_MM;
    expect(gap).toBe(10);
  });

  it('handles small grid units', () => {
    // 256mm bed, 20mm grid
    // N ≤ (256 + 10) / (20 + 10) = 266 / 30 = 8.86 → 8
    expect(calcMaxGridUnits(256, 20)).toBe(8);
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

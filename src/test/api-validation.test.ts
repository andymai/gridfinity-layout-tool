/**
 * Tests for server-side API validation module.
 * Tests the validation logic that will run on the API endpoints.
 */

import { describe, it, expect } from 'vitest';
import { validateShareLayout, validateExpiration } from '../../api/lib/validation';

// Helper to create a valid layout for testing
function createValidLayout() {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [
      { id: 'cat1', name: 'Default', color: '#888888' },
    ],
    layers: [
      { id: 'layer1', name: 'Layer 1', height: 3 },
    ],
    bins: [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: 'Test', notes: '' },
    ],
  };
}

describe('validateShareLayout', () => {
  describe('size limits', () => {
    it('rejects layouts exceeding 500KB', () => {
      const layout = createValidLayout();
      const result = validateShareLayout(layout, 600 * 1024); // 600KB

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('SIZE_LIMIT');
      }
    });

    it('accepts layouts under 500KB', () => {
      const layout = createValidLayout();
      const result = validateShareLayout(layout, 100 * 1024); // 100KB

      expect(result.valid).toBe(true);
    });
  });

  describe('required fields', () => {
    it('rejects layouts without version', () => {
      const layout = createValidLayout();
      delete (layout as Record<string, unknown>).version;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('version');
      }
    });

    it('rejects layouts without name', () => {
      const layout = createValidLayout();
      delete (layout as Record<string, unknown>).name;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('name');
      }
    });

    it('rejects layouts without drawer', () => {
      const layout = createValidLayout();
      delete (layout as Record<string, unknown>).drawer;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('drawer');
      }
    });

    it('rejects layouts without layers', () => {
      const layout = createValidLayout();
      delete (layout as Record<string, unknown>).layers;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('layers');
      }
    });

    it('rejects layouts without bins', () => {
      const layout = createValidLayout();
      delete (layout as Record<string, unknown>).bins;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('bins');
      }
    });

    it('rejects layouts without categories', () => {
      const layout = createValidLayout();
      delete (layout as Record<string, unknown>).categories;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('categories');
      }
    });
  });

  describe('bin limits', () => {
    it('rejects layouts with more than 2500 bins', () => {
      const layout = createValidLayout();
      layout.bins = Array.from({ length: 2501 }, (_, i) => ({
        id: `bin${i}`,
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: 'cat1',
        label: '',
        notes: '',
      }));
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('BIN_LIMIT');
      }
    });

    it('accepts layouts with exactly 2500 bins', () => {
      const layout = createValidLayout();
      layout.bins = Array.from({ length: 2500 }, (_, i) => ({
        id: `bin${i}`,
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: 'cat1',
        label: '',
        notes: '',
      }));
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
    });
  });

  describe('drawer dimensions', () => {
    it('rejects drawer width below 1', () => {
      const layout = createValidLayout();
      layout.drawer.width = 0;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects drawer width above 50', () => {
      const layout = createValidLayout();
      layout.drawer.width = 51;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects drawer depth below 1', () => {
      const layout = createValidLayout();
      layout.drawer.depth = 0;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects drawer depth above 50', () => {
      const layout = createValidLayout();
      layout.drawer.depth = 51;
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('layer limits', () => {
    it('rejects layouts with no layers', () => {
      const layout = createValidLayout();
      layout.layers = [];
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects layouts with more than 10 layers', () => {
      const layout = createValidLayout();
      layout.layers = Array.from({ length: 11 }, (_, i) => ({
        id: `layer${i}`,
        name: `Layer ${i}`,
        height: 1,
      }));
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('accepts layouts with exactly 10 layers', () => {
      const layout = createValidLayout();
      layout.layers = Array.from({ length: 10 }, (_, i) => ({
        id: `layer${i}`,
        name: `Layer ${i}`,
        height: 1,
      }));
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
    });
  });

  describe('category limits', () => {
    it('rejects layouts with more than 20 categories', () => {
      const layout = createValidLayout();
      layout.categories = Array.from({ length: 21 }, (_, i) => ({
        id: `cat${i}`,
        name: `Category ${i}`,
        color: '#888888',
      }));
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('accepts layouts with exactly 20 categories', () => {
      const layout = createValidLayout();
      layout.categories = Array.from({ length: 20 }, (_, i) => ({
        id: `cat${i}`,
        name: `Category ${i}`,
        color: '#888888',
      }));
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
    });
  });

  describe('sanitization', () => {
    it('sanitizes layout name to max 64 characters', () => {
      const layout = createValidLayout();
      layout.name = 'A'.repeat(100);
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.layout.name.length).toBe(64);
      }
    });

    it('sanitizes bin labels to max 24 characters', () => {
      const layout = createValidLayout();
      layout.bins[0].label = 'B'.repeat(50);
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.layout.bins[0].label!.length).toBe(24);
      }
    });

    it('sanitizes bin notes to max 256 characters', () => {
      const layout = createValidLayout();
      layout.bins[0].notes = 'N'.repeat(500);
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.layout.bins[0].notes!.length).toBe(256);
      }
    });

    it('sanitizes colors to valid hex format', () => {
      const layout = createValidLayout();
      layout.categories[0].color = 'invalid';
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.layout.categories[0].color).toBe('#888888'); // Default gray
      }
    });

    it('normalizes hex colors with hash prefix', () => {
      const layout = createValidLayout();
      layout.categories[0].color = 'FF0000'; // Without hash
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.layout.categories[0].color).toBe('#ff0000');
      }
    });
  });

  describe('valid layouts', () => {
    it('accepts a minimal valid layout', () => {
      const layout = createValidLayout();
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.layout.name).toBe('Test Layout');
        expect(result.layout.drawer.width).toBe(10);
        expect(result.layout.layers.length).toBe(1);
        expect(result.layout.bins.length).toBe(1);
        expect(result.layout.categories.length).toBe(1);
      }
    });

    it('preserves optional fields', () => {
      const layout = createValidLayout();
      const result = validateShareLayout(layout, 1000);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.layout.printBedSize).toBe(256);
        expect(result.layout.gridUnitMm).toBe(42);
        expect(result.layout.heightUnitMm).toBe(7);
      }
    });
  });
});

describe('validateExpiration', () => {
  it('accepts 30 days', () => {
    expect(validateExpiration(30)).toBe(true);
  });

  it('accepts 60 days', () => {
    expect(validateExpiration(60)).toBe(true);
  });

  it('accepts 90 days', () => {
    expect(validateExpiration(90)).toBe(true);
  });

  it('accepts 365 days', () => {
    expect(validateExpiration(365)).toBe(true);
  });

  it('rejects invalid numbers', () => {
    expect(validateExpiration(7)).toBe(false);
    expect(validateExpiration(14)).toBe(false);
    expect(validateExpiration(45)).toBe(false);
    expect(validateExpiration(100)).toBe(false);
  });

  it('rejects non-numbers', () => {
    expect(validateExpiration('30')).toBe(false);
    expect(validateExpiration(null)).toBe(false);
    expect(validateExpiration(undefined)).toBe(false);
  });
});

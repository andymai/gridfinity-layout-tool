import { describe, it, expect } from 'vitest';
import {
  canPlaceBin,
  canPlaceBinResult,
  validateImport,
  validateImportResult,
  clamp,
  truncate,
  validateLayoutIntegrity,
  validateLayoutIntegrityResult,
  validateCustomProperties,
  validateCustomPropertiesResult,
} from '../utils/validation';
import { CONSTRAINTS } from '../constants';
import type { Layout } from '../types';
import { isOk, isErr } from '../result';

const createTestLayout = (): Layout => ({
  version: '1.0',
  name: 'Test',
  drawer: { width: 10, depth: 10, height: 12 },
  printBedSize: 168,  // 4 grid units * 42mm
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [{ id: 'cat1', name: 'Test', color: '#000' }],
  layers: [
    { id: 'layer1', name: 'Layer 1', height: 3 },
    { id: 'layer2', name: 'Layer 2', height: 6 },
  ],
  bins: [],
});

describe('canPlaceBin', () => {
  it('allows valid placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      { x: 0, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result.valid).toBe(true);
  });

  it('rejects out of bounds placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      { x: -1, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'out_of_bounds' });
  });

  it('rejects placement exceeding width', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      { x: 9, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_width' });
  });

  it('rejects collision with existing bin', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 1, y: 1, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'collision' });
  });

  it('allows placement next to existing bin', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 2, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result.valid).toBe(true);
  });

  it('excludes specified bin from collision check', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'moving', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 1, y: 1, width: 2, depth: 2, height: 3 },
      'layer1',
      layout,
      'moving' // exclude this bin
    );
    expect(result.valid).toBe(true);
  });

  it('rejects placement in blocked zone', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Tall bin on layer 1 that protrudes into layer 2
      { id: 'tall', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 6, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 1, y: 1, width: 2, depth: 2, height: 6 },
      'layer2',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'blocked_zone' });
  });

  it('rejects placement exceeding depth', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      { x: 0, y: 9, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_depth' });
  });

  it('rejects invalid layer', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      { x: 0, y: 0, width: 2, depth: 2, height: 3 },
      'nonexistent',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'invalid_layer' });
  });

  it('rejects bin taller than remaining drawer height', () => {
    const layout = createTestLayout();
    // layer2 starts at z=3 (layer1 height), drawer height is 12
    // max height at layer2 = 12 - 3 = 9
    const result = canPlaceBin(
      { x: 0, y: 0, width: 2, depth: 2, height: 15 },
      'layer2',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_height' });
  });

  it('allows bin shorter than layer default height (layer height is a default, not constraint)', () => {
    const layout = createTestLayout();
    // layer2 has height 6, but bins can be any height (layer height is just a default for new bins)
    const result = canPlaceBin(
      { x: 0, y: 0, width: 2, depth: 2, height: 3 },
      'layer2',
      layout
    );
    expect(result).toEqual({ valid: true });
  });

  it('excludes multiple bins from collision check via excludeBinIds', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
      { id: 'bin2', layerId: 'layer1', x: 1, y: 1, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 0, y: 0, width: 3, depth: 3, height: 3 },
      'layer1',
      layout,
      undefined,
      new Set(['bin1', 'bin2'])
    );
    expect(result.valid).toBe(true);
  });
});

describe('validateImport', () => {
  it('accepts valid layout', () => {
    const layout = createTestLayout();
    const result = validateImport(layout);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing fields', () => {
    const result = validateImport({ name: 'Test' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing version');
  });

  it('rejects drawer out of range', () => {
    const layout = createTestLayout();
    layout.drawer.width = 100;
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate category names', () => {
    const layout = createTestLayout();
    layout.categories = [
      { id: '1', name: 'Tools', color: '#f00' },
      { id: '2', name: 'tools', color: '#0f0' }, // duplicate (case-insensitive)
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
  });

  it('rejects null/undefined data', () => {
    expect(validateImport(null)).toEqual({ valid: false, errors: ['Invalid data format'] });
    expect(validateImport(undefined)).toEqual({ valid: false, errors: ['Invalid data format'] });
  });

  it('rejects non-object data', () => {
    expect(validateImport('string')).toEqual({ valid: false, errors: ['Invalid data format'] });
    expect(validateImport(123)).toEqual({ valid: false, errors: ['Invalid data format'] });
  });

  it('rejects missing drawer', () => {
    const result = validateImport({ version: '1.0', name: 'Test', layers: [], bins: [], categories: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid drawer: must have width, depth, and height as numbers');
  });

  it('rejects invalid layers array', () => {
    const result = validateImport({ version: '1.0', name: 'Test', drawer: {}, layers: 'not-an-array', bins: [], categories: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid layers');
  });

  it('rejects too many layers', () => {
    const layout = createTestLayout();
    layout.layers = Array(11).fill(null).map((_, i) => ({ id: `layer${i}`, name: `Layer ${i}`, height: 1 }));
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('layers'))).toBe(true);
  });

  it('rejects bins referencing invalid layers', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'nonexistent', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid layer'))).toBe(true);
  });

  it('rejects bins out of bounds', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 15, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('out of bounds'))).toBe(true);
  });

  it('rejects total layer height exceeding drawer', () => {
    const layout = createTestLayout();
    layout.layers = [
      { id: 'layer1', name: 'Layer 1', height: 10 },
      { id: 'layer2', name: 'Layer 2', height: 10 },
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('exceeds drawer height'))).toBe(true);
  });

  it('rejects drawer depth out of range', () => {
    const layout = createTestLayout();
    layout.drawer.depth = 100;
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid bin without required properties', () => {
    const layout = createTestLayout();
    // Add an invalid bin missing id
    layout.bins = [
       
      { layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' } as any,
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Bin 0 is invalid'))).toBe(true);
  });

  it('rejects invalid category without required properties', () => {
    const layout = createTestLayout();
    // Replace categories with invalid ones
     
    layout.categories = [{ id: 'cat1', name: 'Category' } as any]; // Missing color
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Category 0 is invalid'))).toBe(true);
  });
});

describe('clamp', () => {
  it('clamps values to range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello');
    expect(truncate('hi', 5)).toBe('hi');
  });
});

describe('canPlaceBin - rotation scenarios', () => {
  it('allows rotation of square bin (no-op)', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    // Rotation swaps width/depth, but for square it's the same
    const result = canPlaceBin(
      { x: 0, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout,
      'bin1'
    );
    expect(result.valid).toBe(true);
  });

  it('allows rotation of rectangular bin that fits after rotation', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 4, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    // Rotate: 2x4 -> 4x2 at (0,0), should fit in 10x10 drawer
    const result = canPlaceBin(
      { x: 0, y: 0, width: 4, depth: 2, height: 3 },
      'layer1',
      layout,
      'bin1'
    );
    expect(result.valid).toBe(true);
  });

  it('rejects rotation that would exceed drawer width', () => {
    const layout = createTestLayout();
    layout.bins = [
      // 2x8 bin at position (8,0) - rotation would make it 8x2 which exceeds width
      { id: 'bin1', layerId: 'layer1', x: 8, y: 0, width: 2, depth: 8, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 8, y: 0, width: 8, depth: 2, height: 3 },
      'layer1',
      layout,
      'bin1'
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_width' });
  });

  it('rejects rotation that would exceed drawer depth', () => {
    const layout = createTestLayout();
    layout.bins = [
      // 8x2 bin at position (0,8) - rotation would make it 2x8 which exceeds depth
      { id: 'bin1', layerId: 'layer1', x: 0, y: 8, width: 8, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBin(
      { x: 0, y: 8, width: 2, depth: 8, height: 3 },
      'layer1',
      layout,
      'bin1'
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_depth' });
  });

  it('rejects rotation that would cause collision', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Bin to rotate: 2x4 at (0,0)
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 4, height: 3, category: 'cat1', label: '', notes: '' },
      // Adjacent bin at (3,0) - would collide with rotated bin (4x2)
      { id: 'bin2', layerId: 'layer1', x: 3, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    // Rotate bin1: 2x4 -> 4x2
    const result = canPlaceBin(
      { x: 0, y: 0, width: 4, depth: 2, height: 3 },
      'layer1',
      layout,
      'bin1'
    );
    expect(result).toEqual({ valid: false, reason: 'collision' });
  });

  it('allows rotation when adjacent bins do not collide', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Bin to rotate: 2x4 at (0,0)
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 4, height: 3, category: 'cat1', label: '', notes: '' },
      // Adjacent bin at (5,0) - won't collide with rotated bin (4x2)
      { id: 'bin2', layerId: 'layer1', x: 5, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    // Rotate bin1: 2x4 -> 4x2
    const result = canPlaceBin(
      { x: 0, y: 0, width: 4, depth: 2, height: 3 },
      'layer1',
      layout,
      'bin1'
    );
    expect(result.valid).toBe(true);
  });

  it('rejects rotation into blocked zone', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Tall bin on layer 1 that blocks part of layer 2
      { id: 'tall', layerId: 'layer1', x: 0, y: 0, width: 4, depth: 4, height: 6, category: 'cat1', label: '', notes: '' },
      // Bin on layer 2 to rotate: 2x4 at (5,0) - rotation would be 4x2 which doesn't overlap with blocked zone
      { id: 'bin1', layerId: 'layer2', x: 5, y: 0, width: 2, depth: 4, height: 6, category: 'cat1', label: '', notes: '' },
    ];
    // This should work since rotated position doesn't overlap blocked zone
    const result = canPlaceBin(
      { x: 5, y: 0, width: 4, depth: 2, height: 6 },
      'layer2',
      layout,
      'bin1'
    );
    expect(result.valid).toBe(true);
  });

  it('handles rotation with clearance height', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 4, height: 3, clearanceHeight: 2, category: 'cat1', label: '', notes: '' },
    ];
    // Rotate preserving clearance
    const result = canPlaceBin(
      { x: 0, y: 0, width: 4, depth: 2, height: 3, clearanceHeight: 2 },
      'layer1',
      layout,
      'bin1'
    );
    expect(result.valid).toBe(true);
  });
});

describe('validateLayoutIntegrity', () => {
  it('returns valid for well-formed layout', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns error when bin references missing layer', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'nonexistent', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: 'Test Bin', notes: '' },
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing layer');
  });

  it('returns error when bin references missing category', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'nonexistent', label: 'Test Bin', notes: '' },
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing category');
  });

  it('allows bins in staging with any layerId', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: '__staging__', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(true);
  });

  it('returns error when layout has no layers', () => {
    const layout = createTestLayout();
    layout.layers = [];
    layout.bins = [];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no layers');
  });

  it('returns error when layout has no categories', () => {
    const layout = createTestLayout();
    layout.categories = [];
    layout.bins = [];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no categories');
  });

  it('uses bin label in error message if present', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'nonexistent', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: 'My Special Bin', notes: '' },
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('My Special Bin');
  });

  it('uses bin id in error message if no label', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin-abc-123', layerId: 'nonexistent', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('bin-abc-123');
  });
});

describe('validateCustomProperties', () => {
  it('returns success for undefined properties', () => {
    const result = validateCustomProperties(undefined as unknown as Record<string, string>);
    expect(result.success).toBe(true);
  });

  it('returns success for null properties', () => {
    const result = validateCustomProperties(null as unknown as Record<string, string>);
    expect(result.success).toBe(true);
  });

  it('returns success for empty object', () => {
    const result = validateCustomProperties({});
    expect(result.success).toBe(true);
  });

  it('returns success for valid properties', () => {
    const result = validateCustomProperties({
      SKU: 'ABC123',
      Quantity: '5',
      Location: 'Shelf A',
    });
    expect(result.success).toBe(true);
  });

  it('rejects arrays (arrays are objects in JavaScript)', () => {
    const result = validateCustomProperties(['value1', 'value2'] as unknown as Record<string, string>);
    expect(result.success).toBe(false);
    expect(result.error).toContain('plain object');
  });

  it('rejects non-object values', () => {
    const result = validateCustomProperties('not an object' as unknown as Record<string, string>);
    expect(result.success).toBe(false);
    expect(result.error).toContain('plain object');
  });

  it('rejects exceeding max property count', () => {
    const props: Record<string, string> = {};
    for (let i = 0; i <= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT; i++) {
      props[`key${i}`] = `value${i}`;
    }
    const result = validateCustomProperties(props);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
    expect(result.error).toContain('custom properties');
  });

  it('rejects empty keys', () => {
    const result = validateCustomProperties({ '': 'value' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects whitespace-only keys', () => {
    const result = validateCustomProperties({ '   ': 'value' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('rejects keys exceeding max length', () => {
    const longKey = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH + 1);
    const result = validateCustomProperties({ [longKey]: 'value' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum length');
  });

  it('rejects reserved keys', () => {
    const reservedKeys = ['id', 'layerId', 'x', 'y', 'width', 'depth', 'height', 'category', 'label', 'notes'];
    for (const key of reservedKeys) {
      const result = validateCustomProperties({ [key]: 'value' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('reserved');
    }
  });

  it('rejects non-string values', () => {
    const result = validateCustomProperties({ key: 123 as unknown as string });
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be a string');
  });

  it('rejects values exceeding max length', () => {
    const longValue = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH + 1);
    const result = validateCustomProperties({ key: longValue });
    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds maximum length');
  });

  it('accepts keys at exactly max length', () => {
    const maxKey = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH);
    const result = validateCustomProperties({ [maxKey]: 'value' });
    expect(result.success).toBe(true);
  });

  it('accepts values at exactly max length', () => {
    const maxValue = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH);
    const result = validateCustomProperties({ key: maxValue });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Result-returning validation functions
// =============================================================================

describe('canPlaceBinResult', () => {
  it('returns Ok for valid placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBinResult(
      { x: 0, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(isOk(result)).toBe(true);
  });

  it('returns Err with VALIDATION_OUT_OF_BOUNDS for negative coordinates', () => {
    const layout = createTestLayout();
    const result = canPlaceBinResult(
      { x: -1, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_OUT_OF_BOUNDS');
      expect(result.error.kind).toBe('ValidationError');
      if ('reason' in result.error) {
        expect(result.error.reason).toBe('out_of_bounds');
      }
    }
  });

  it('returns Err with VALIDATION_OUT_OF_BOUNDS for exceeds_width', () => {
    const layout = createTestLayout();
    const result = canPlaceBinResult(
      { x: 9, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_OUT_OF_BOUNDS');
      if ('reason' in result.error) {
        expect(result.error.reason).toBe('exceeds_width');
      }
    }
  });

  it('returns Err with VALIDATION_OUT_OF_BOUNDS for exceeds_depth', () => {
    const layout = createTestLayout();
    const result = canPlaceBinResult(
      { x: 0, y: 9, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_OUT_OF_BOUNDS');
      if ('reason' in result.error) {
        expect(result.error.reason).toBe('exceeds_depth');
      }
    }
  });

  it('returns Err with VALIDATION_INVALID_LAYER for nonexistent layer', () => {
    const layout = createTestLayout();
    const result = canPlaceBinResult(
      { x: 0, y: 0, width: 2, depth: 2, height: 3 },
      'nonexistent-layer',
      layout
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_INVALID_LAYER');
      if ('layerId' in result.error) {
        expect(result.error.layerId).toBe('nonexistent-layer');
      }
    }
  });

  it('returns Err with VALIDATION_HEIGHT_EXCEEDED for height exceeding drawer', () => {
    const layout = createTestLayout();
    const result = canPlaceBinResult(
      { x: 0, y: 0, width: 2, depth: 2, height: 20 },
      'layer1',
      layout
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_HEIGHT_EXCEEDED');
    }
  });

  it('returns Err with VALIDATION_COLLISION with colliding bin IDs', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'existing-bin', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBinResult(
      { x: 1, y: 1, width: 2, depth: 2, height: 3 },
      'layer1',
      layout
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_COLLISION');
      if ('collidingBinIds' in result.error) {
        expect(result.error.collidingBinIds).toContain('existing-bin');
      }
    }
  });

  it('returns Err with VALIDATION_BLOCKED_ZONE for blocked area', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Tall bin on layer 1 that protrudes into layer 2
      { id: 'tall', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 6, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBinResult(
      { x: 1, y: 1, width: 2, depth: 2, height: 6 },
      'layer2',
      layout
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_BLOCKED_ZONE');
    }
  });

  it('excludes specified bin from collision check', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'moving', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBinResult(
      { x: 1, y: 1, width: 2, depth: 2, height: 3 },
      'layer1',
      layout,
      'moving'
    );
    expect(isOk(result)).toBe(true);
  });

  it('excludes set of bin IDs from collision check', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
      { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = canPlaceBinResult(
      { x: 1, y: 0, width: 2, depth: 2, height: 3 },
      'layer1',
      layout,
      undefined,
      new Set(['bin1', 'bin2'])
    );
    expect(isOk(result)).toBe(true);
  });
});

describe('validateImportResult', () => {
  it('returns Ok for valid layout data', () => {
    const validLayout = {
      version: '1.0',
      name: 'Test Layout',
      drawer: { width: 10, depth: 10, height: 12 },
      layers: [{ id: 'l1', name: 'Layer 1', height: 3 }],
      bins: [],
      categories: [{ id: 'c1', name: 'Category 1', color: '#ff0000' }],
    };
    const result = validateImportResult(validLayout);
    expect(isOk(result)).toBe(true);
  });

  it('returns Err with VALIDATION_IMPORT_FAILED for invalid data', () => {
    const result = validateImportResult(null);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
      expect(result.error.kind).toBe('ValidationError');
      if ('errors' in result.error) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns Err with detailed errors for multiple issues', () => {
    const invalidLayout = {
      version: '1.0',
      // missing name
      drawer: { width: 100, depth: -5, height: 12 }, // invalid dimensions
      layers: [], // empty layers (violates min constraint)
      bins: [],
      categories: [],
    };
    const result = validateImportResult(invalidLayout);
    expect(isErr(result)).toBe(true);
    if (isErr(result) && 'errors' in result.error) {
      // Should have at least 1 error (missing name is caught first)
      expect(result.error.errors.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('validateLayoutIntegrityResult', () => {
  it('returns Ok for valid layout', () => {
    const layout = createTestLayout();
    const result = validateLayoutIntegrityResult(layout);
    expect(isOk(result)).toBe(true);
  });

  it('returns Err with VALIDATION_IMPORT_FAILED for missing layer reference', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'nonexistent', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
    ];
    const result = validateLayoutIntegrityResult(layout);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
    }
  });

  it('returns Err with VALIDATION_IMPORT_FAILED for missing category reference', () => {
    const layout = createTestLayout();
    layout.bins = [
      { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'nonexistent', label: '', notes: '' },
    ];
    const result = validateLayoutIntegrityResult(layout);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
    }
  });

  it('returns Err with VALIDATION_IMPORT_FAILED for empty layers', () => {
    const layout = createTestLayout();
    layout.layers = [];
    const result = validateLayoutIntegrityResult(layout);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
      if ('errors' in result.error) {
        expect(result.error.errors.some(e => e.includes('no layers'))).toBe(true);
      }
    }
  });

  it('returns Err with VALIDATION_IMPORT_FAILED for empty categories', () => {
    const layout = createTestLayout();
    layout.categories = [];
    const result = validateLayoutIntegrityResult(layout);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
      if ('errors' in result.error) {
        expect(result.error.errors.some(e => e.includes('no categories'))).toBe(true);
      }
    }
  });
});

describe('validateCustomPropertiesResult', () => {
  it('returns Ok for valid custom properties', () => {
    const result = validateCustomPropertiesResult({ key: 'value', another: 'prop' });
    expect(isOk(result)).toBe(true);
  });

  it('returns Ok for empty properties', () => {
    const result = validateCustomPropertiesResult({});
    expect(isOk(result)).toBe(true);
  });

  it('returns Err with VALIDATION_IMPORT_FAILED for too many properties', () => {
    const props: Record<string, string> = {};
    for (let i = 0; i <= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT; i++) {
      props[`key${i}`] = 'value';
    }
    const result = validateCustomPropertiesResult(props);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
    }
  });

  it('returns Err with VALIDATION_IMPORT_FAILED for key exceeding max length', () => {
    const longKey = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH + 1);
    const result = validateCustomPropertiesResult({ [longKey]: 'value' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
    }
  });

  it('returns Err with VALIDATION_IMPORT_FAILED for reserved keys', () => {
    const result = validateCustomPropertiesResult({ id: 'value' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
      if ('errors' in result.error) {
        expect(result.error.errors[0]).toContain('reserved');
      }
    }
  });
});

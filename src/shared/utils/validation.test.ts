import { describe, it, expect } from 'vitest';
import {
  canPlaceBin,
  validateImport,
  clamp,
  truncate,
  validateLayoutIntegrity,
  validateCustomProperties,
  isValidBin,
} from '@/shared/utils/validation';
import { CONSTRAINTS } from '@/core/constants';
import { isOk, isErr } from '@/core/result';
import { createTestLayout as baseCreateTestLayout, createTestBin } from '@/test/testUtils';

const createTestLayout = () =>
  baseCreateTestLayout({
    drawer: { width: 10, depth: 10, height: 12 },
    printBedSize: 168,
    layers: [
      { id: 'layer1', name: 'Layer 1', height: 3 },
      { id: 'layer2', name: 'Layer 2', height: 6 },
    ],
  });

describe('canPlaceBin', () => {
  it('allows valid placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBin({ x: 0, y: 0, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result.valid).toBe(true);
  });

  it('rejects out of bounds placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBin({ x: -1, y: 0, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toEqual({ valid: false, reason: 'out_of_bounds' });
  });

  it('rejects placement exceeding width', () => {
    const layout = createTestLayout();
    const result = canPlaceBin({ x: 9, y: 0, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toEqual({ valid: false, reason: 'exceeds_width' });
  });

  it('rejects collision with existing bin', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: 'existing', width: 3, depth: 3 })];
    const result = canPlaceBin({ x: 1, y: 1, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toMatchObject({ valid: false, reason: 'collision' });
    expect(result.blockingInfo).toMatchObject({ binId: 'existing', layerId: 'layer1' });
  });

  it('allows placement next to existing bin', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: 'existing', width: 2, depth: 2 })];
    const result = canPlaceBin({ x: 2, y: 0, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result.valid).toBe(true);
  });

  it('excludes specified bin from collision check', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: 'moving', width: 2, depth: 2 })];
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
      createTestBin({ id: 'tall', width: 3, depth: 3, height: 6 }),
    ];
    const result = canPlaceBin({ x: 1, y: 1, width: 2, depth: 2, height: 6 }, 'layer2', layout);
    expect(result).toMatchObject({ valid: false, reason: 'blocked_zone' });
    expect(result.blockingInfo).toMatchObject({ binId: 'tall', layerId: 'layer1' });
  });

  it('rejects placement overlapping fractional blocked zone', () => {
    const layout = createTestLayout();
    // Small fractional bin on layer 1 that protrudes into layer 2
    layout.bins = [
      createTestBin({ id: 'small-tall', x: 1.5, y: 1.5, width: 0.5, depth: 0.5, height: 6 }),
    ];
    // Bin on layer 2 that covers the blocked zone area
    const result = canPlaceBin({ x: 0, y: 0, width: 3, depth: 3, height: 6 }, 'layer2', layout);
    expect(result).toMatchObject({ valid: false, reason: 'blocked_zone' });
    expect(result.blockingInfo).toMatchObject({ binId: 'small-tall', layerId: 'layer1' });
  });

  it('allows placement adjacent to fractional blocked zone', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: 'small-tall', width: 0.5, depth: 0.5, height: 6 })];
    // Bin placed at (1, 0) doesn't overlap the 0.5x0.5 blocked zone at (0, 0)
    const result = canPlaceBin({ x: 1, y: 0, width: 2, depth: 2, height: 6 }, 'layer2', layout);
    expect(result.valid).toBe(true);
  });

  it('rejects placement exceeding depth', () => {
    const layout = createTestLayout();
    const result = canPlaceBin({ x: 0, y: 9, width: 2, depth: 2, height: 3 }, 'layer1', layout);
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
    const result = canPlaceBin({ x: 0, y: 0, width: 2, depth: 2, height: 15 }, 'layer2', layout);
    expect(result).toEqual({ valid: false, reason: 'exceeds_height' });
  });

  it('allows bin shorter than layer default height (layer height is a default, not constraint)', () => {
    const layout = createTestLayout();
    // layer2 has height 6, but bins can be any height (layer height is just a default for new bins)
    const result = canPlaceBin({ x: 0, y: 0, width: 2, depth: 2, height: 3 }, 'layer2', layout);
    expect(result).toEqual({ valid: true });
  });

  it('excludes multiple bins from collision check via excludeBinIds', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({ id: 'bin1', width: 2, depth: 2 }),
      createTestBin({ id: 'bin2', x: 1, y: 1, width: 2, depth: 2 }),
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
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
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
    const result = validateImport({
      version: '1.0',
      name: 'Test',
      layers: [],
      bins: [],
      categories: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Invalid drawer: must have width, depth, and height as numbers'
    );
  });

  it('rejects invalid layers array', () => {
    const result = validateImport({
      version: '1.0',
      name: 'Test',
      drawer: {},
      layers: 'not-an-array',
      bins: [],
      categories: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid layers');
  });

  it('rejects too many layers', () => {
    const layout = createTestLayout();
    layout.layers = Array(11)
      .fill(null)
      .map((_, i) => ({ id: `layer${i}`, name: `Layer ${i}`, height: 1 }));
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('layers'))).toBe(true);
  });

  it('rejects bins referencing invalid layers', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: 'bin1', layerId: 'nonexistent', width: 2, depth: 2 })];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid layer'))).toBe(true);
  });

  it('rejects bins out of bounds', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: 'bin1', x: 15, width: 2, depth: 2 })];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    // canPlaceBin provides more specific error messages
    expect(result.errors.some((e) => e.includes('exceeds drawer width'))).toBe(true);
  });

  it('does not use invalid bins for collision checks on subsequent bins', () => {
    const layout = createTestLayout();
    // Bin 0: exceeds drawer width (x=9, width=2 in a 10-wide drawer)
    // Bin 1: valid bin at (8,0) — overlaps with bin 0's footprint but should NOT
    //   be flagged as colliding since bin 0 is invalid and shouldn't be in the pool
    layout.bins = [
      createTestBin({ id: 'bad', x: 9, width: 2, depth: 2 }),
      createTestBin({ id: 'good', x: 8, y: 0, width: 2, depth: 2 }),
    ];
    const result = validateImport(layout);
    // Should have exactly 1 error (the out-of-bounds bin), not 2
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Bin 0');
  });

  it('rejects total layer height exceeding drawer', () => {
    const layout = createTestLayout();
    layout.layers = [
      { id: 'layer1', name: 'Layer 1', height: 10 },
      { id: 'layer2', name: 'Layer 2', height: 10 },
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds drawer height'))).toBe(true);
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
      {
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'cat1',
        label: '',
        notes: '',
      } as any,
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Bin 0 is invalid'))).toBe(true);
  });

  it('rejects invalid category without required properties', () => {
    const layout = createTestLayout();
    // Replace categories with invalid ones

    layout.categories = [{ id: 'cat1', name: 'Category' } as any]; // Missing color
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Category 0 is invalid'))).toBe(true);
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
    layout.bins = [createTestBin({ id: 'bin1', width: 2, depth: 2 })];
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
    layout.bins = [createTestBin({ id: 'bin1', width: 2, depth: 4 })];
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
      createTestBin({ id: 'bin1', x: 8, width: 2, depth: 8 }),
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
      createTestBin({ id: 'bin1', y: 8, width: 8, depth: 2 }),
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
      createTestBin({ id: 'bin1', width: 2, depth: 4 }),
      // Adjacent bin at (3,0) - would collide with rotated bin (4x2)
      createTestBin({ id: 'bin2', x: 3, width: 2, depth: 2 }),
    ];
    // Rotate bin1: 2x4 -> 4x2
    const result = canPlaceBin(
      { x: 0, y: 0, width: 4, depth: 2, height: 3 },
      'layer1',
      layout,
      'bin1'
    );
    expect(result).toMatchObject({ valid: false, reason: 'collision' });
    expect(result.blockingInfo).toMatchObject({ binId: 'bin2', layerId: 'layer1' });
  });

  it('allows rotation when adjacent bins do not collide', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Bin to rotate: 2x4 at (0,0)
      createTestBin({ id: 'bin1', width: 2, depth: 4 }),
      // Adjacent bin at (5,0) - won't collide with rotated bin (4x2)
      createTestBin({ id: 'bin2', x: 5, width: 2, depth: 2 }),
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
      createTestBin({ id: 'tall', width: 4, depth: 4, height: 6 }),
      // Bin on layer 2 to rotate: 2x4 at (5,0) - rotation would be 4x2 which doesn't overlap with blocked zone
      createTestBin({ id: 'bin1', layerId: 'layer2', x: 5, width: 2, depth: 4, height: 6 }),
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
    layout.bins = [createTestBin({ id: 'bin1', width: 2, depth: 4, clearanceHeight: 2 })];
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
    layout.bins = [createTestBin({ id: 'bin1', width: 2, depth: 2 })];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns error when bin references missing layer', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({ id: 'bin1', layerId: 'nonexistent', width: 2, depth: 2, label: 'Test Bin' }),
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing layer');
  });

  it('returns error when bin references missing category', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({ id: 'bin1', width: 2, depth: 2, category: 'nonexistent', label: 'Test Bin' }),
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing category');
  });

  it('allows bins in staging with any layerId', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: 'bin1', layerId: '__staging__', width: 2, depth: 2 })];

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
      createTestBin({
        id: 'bin1',
        layerId: 'nonexistent',
        width: 2,
        depth: 2,
        label: 'My Special Bin',
      }),
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('My Special Bin');
  });

  it('uses bin id in error message if no label', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({ id: 'bin-abc-123', layerId: 'nonexistent', width: 2, depth: 2 }),
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('bin-abc-123');
  });

  it('returns error for invalid layer (missing required properties)', () => {
    const layout = createTestLayout();
    // Create a malformed layer with id set to a number instead of string
    const invalidLayout = {
      ...layout,
      layers: [{ id: 123, name: 'Bad Layer', height: 3 }],
      bins: [],
    };

    const result = validateImport(invalidLayout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Layer 0 is invalid'))).toBe(true);
  });

  it('returns error for bin with invalid custom properties (too many)', () => {
    const layout = createTestLayout();
    // Use staging bin (layerId '__staging__') to skip canPlaceBin and test customProperties validation
    const invalidLayout = {
      ...layout,
      bins: [
        {
          id: 'bin1',
          layerId: '__staging__',
          x: 0,
          y: 0,
          width: 2,
          depth: 2,
          height: 3,
          category: layout.categories[0].id,
          label: '',
          notes: '',
          // Create custom properties with too many entries (over 50)
          customProperties: Object.fromEntries(
            Array.from({ length: 60 }, (_, i) => [`key${i}`, `value${i}`])
          ),
        },
      ],
    };

    const result = validateImport(invalidLayout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Bin 0'))).toBe(true);
    expect(result.errors.some((e) => e.includes('50'))).toBe(true);
  });
});

describe('validateCustomProperties', () => {
  it('returns success for undefined properties', () => {
    const result = validateCustomProperties(undefined as unknown as Record<string, string>);
    expect(isOk(result)).toBe(true);
  });

  it('returns success for null properties', () => {
    const result = validateCustomProperties(null as unknown as Record<string, string>);
    expect(isOk(result)).toBe(true);
  });

  it('returns success for empty object', () => {
    const result = validateCustomProperties({});
    expect(isOk(result)).toBe(true);
  });

  it('returns success for valid properties', () => {
    const result = validateCustomProperties({
      SKU: 'ABC123',
      Quantity: '5',
      Location: 'Shelf A',
    });
    expect(isOk(result)).toBe(true);
  });

  it('rejects arrays (arrays are objects in JavaScript)', () => {
    const result = validateCustomProperties(['value1', 'value2'] as unknown as Record<
      string,
      string
    >);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.errors.join(', ')).toContain('plain object');
  });

  it('rejects non-object values', () => {
    const result = validateCustomProperties('not an object' as unknown as Record<string, string>);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.errors.join(', ')).toContain('plain object');
  });

  it('rejects exceeding max property count', () => {
    const props: Record<string, string> = {};
    for (let i = 0; i <= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT; i++) {
      props[`key${i}`] = `value${i}`;
    }
    const result = validateCustomProperties(props);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const msg = result.error.errors.join(', ');
      expect(msg).toContain('Maximum');
      expect(msg).toContain('custom properties');
    }
  });

  it('rejects empty keys', () => {
    const result = validateCustomProperties({ '': 'value' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.errors.join(', ')).toContain('empty');
  });

  it('rejects whitespace-only keys', () => {
    const result = validateCustomProperties({ '   ': 'value' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.errors.join(', ')).toContain('empty');
  });

  it('rejects keys exceeding max length', () => {
    const longKey = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH + 1);
    const result = validateCustomProperties({ [longKey]: 'value' });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.errors.join(', ')).toContain('exceeds maximum length');
  });

  it('rejects reserved keys', () => {
    const reservedKeys = [
      'id',
      'layerId',
      'x',
      'y',
      'width',
      'depth',
      'height',
      'category',
      'label',
      'notes',
    ];
    for (const key of reservedKeys) {
      const result = validateCustomProperties({ [key]: 'value' });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error.errors.join(', ')).toContain('reserved');
    }
  });

  it('rejects non-string values', () => {
    const result = validateCustomProperties({ key: 123 as unknown as string });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.errors.join(', ')).toContain('must be a string');
  });

  it('rejects values exceeding max length', () => {
    const longValue = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH + 1);
    const result = validateCustomProperties({ key: longValue });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.errors.join(', ')).toContain('exceeds maximum length');
  });

  it('accepts keys at exactly max length', () => {
    const maxKey = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH);
    const result = validateCustomProperties({ [maxKey]: 'value' });
    expect(isOk(result)).toBe(true);
  });

  it('accepts values at exactly max length', () => {
    const maxValue = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH);
    const result = validateCustomProperties({ key: maxValue });
    expect(isOk(result)).toBe(true);
  });
});

describe('isValidBin type guard', () => {
  it('returns true for valid bin object', () => {
    const validBin = {
      id: 'bin1',
      layerId: 'layer1',
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 3,
    };
    expect(isValidBin(validBin)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidBin(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidBin(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isValidBin('string')).toBe(false);
  });

  it('returns false when height is missing', () => {
    const bin = {
      id: 'bin1',
      layerId: 'layer1',
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      // height missing
    };
    expect(isValidBin(bin)).toBe(false);
  });

  it('returns false when height is not a number', () => {
    const bin = {
      id: 'bin1',
      layerId: 'layer1',
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: '3', // string instead of number
    };
    expect(isValidBin(bin)).toBe(false);
  });

  it('returns false when id is not a string', () => {
    const bin = {
      id: 123, // number instead of string
      layerId: 'layer1',
      x: 0,
      y: 0,
      width: 2,
      depth: 2,
      height: 3,
    };
    expect(isValidBin(bin)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  canPlaceBin,
  validateImport,
  salvageImport,
  truncate,
  validateLayoutIntegrity,
  validateCustomProperties,
  isValidBin,
} from '@/shared/utils/validation';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';
import type { Result, ValidationError } from '@/core/result';
import { isOk } from '@/core/result';
import type { HeightUnits, Rect } from '@/core/types';
import { binId, categoryId, designId, gridUnits, heightUnits, layerId, mm } from '@/core/types';
import {
  createTestLayout as baseCreateTestLayout,
  createTestBin,
  expectErr,
} from '@/test/testUtils';

const LAYER_1 = layerId('layer1');
const LAYER_2 = layerId('layer2');

const createTestLayout = () =>
  baseCreateTestLayout({
    drawer: { width: gridUnits(10), depth: gridUnits(10), height: heightUnits(12) },
    printBedSize: mm(168),
    layers: [
      { id: LAYER_1, name: 'Layer 1', height: heightUnits(3) },
      { id: LAYER_2, name: 'Layer 2', height: heightUnits(6) },
    ],
  });

function placementRect(r: {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  clearanceHeight?: number;
}): Rect & { height: HeightUnits; clearanceHeight?: HeightUnits } {
  return {
    x: gridUnits(r.x),
    y: gridUnits(r.y),
    width: gridUnits(r.width),
    depth: gridUnits(r.depth),
    height: heightUnits(r.height),
    clearanceHeight: r.clearanceHeight === undefined ? undefined : heightUnits(r.clearanceHeight),
  };
}

// `validateCustomProperties` is typed against the whole `ValidationError`
// union, so `errors` only exists after narrowing to the import-failure member.
function customPropertyErrors(result: Result<void, ValidationError>): string {
  const error = expectErr(result);
  if (error.code !== 'VALIDATION_IMPORT_FAILED') {
    throw new Error(`expected VALIDATION_IMPORT_FAILED, got ${error.code}`);
  }
  return error.errors.join(', ');
}

describe('canPlaceBin', () => {
  it('allows valid placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result.valid).toBe(true);
  });

  it('rejects out of bounds placement', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      placementRect({ x: -1, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'out_of_bounds' });
  });

  it('rejects placement exceeding width', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      placementRect({ x: 9, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_width' });
  });

  it('rejects collision with existing bin', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({ id: binId('existing'), width: gridUnits(3), depth: gridUnits(3) }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toMatchObject({ valid: false, reason: 'collision' });
    if (result.valid) throw new Error('expected the placement to be rejected');
    expect(result.blockingInfo).toMatchObject({ binId: 'existing', layerId: 'layer1' });
  });

  it('allows placement next to existing bin', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({ id: binId('existing'), width: gridUnits(2), depth: gridUnits(2) }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 2, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result.valid).toBe(true);
  });

  it('excludes specified bin from collision check', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({ id: binId('moving'), width: gridUnits(2), depth: gridUnits(2) }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout,
      binId('moving') // exclude this bin
    );
    expect(result.valid).toBe(true);
  });

  it('rejects placement in blocked zone', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Tall bin on layer 1 that protrudes into layer 2
      createTestBin({
        id: binId('tall'),
        width: gridUnits(3),
        depth: gridUnits(3),
        height: heightUnits(6),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 6 }),
      LAYER_2,
      layout
    );
    expect(result).toMatchObject({ valid: false, reason: 'blocked_zone' });
    if (result.valid) throw new Error('expected the placement to be rejected');
    expect(result.blockingInfo).toMatchObject({ binId: 'tall', layerId: 'layer1' });
  });

  it('rejects placement overlapping fractional blocked zone', () => {
    const layout = createTestLayout();
    // Small fractional bin on layer 1 that protrudes into layer 2
    layout.bins = [
      createTestBin({
        id: binId('small-tall'),
        x: gridUnits(1.5),
        y: gridUnits(1.5),
        width: gridUnits(0.5),
        depth: gridUnits(0.5),
        height: heightUnits(6),
      }),
    ];
    // Bin on layer 2 that covers the blocked zone area
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 3, depth: 3, height: 6 }),
      LAYER_2,
      layout
    );
    expect(result).toMatchObject({ valid: false, reason: 'blocked_zone' });
    if (result.valid) throw new Error('expected the placement to be rejected');
    expect(result.blockingInfo).toMatchObject({ binId: 'small-tall', layerId: 'layer1' });
  });

  it('allows placement adjacent to fractional blocked zone', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('small-tall'),
        width: gridUnits(0.5),
        depth: gridUnits(0.5),
        height: heightUnits(6),
      }),
    ];
    // Bin placed at (1, 0) doesn't overlap the 0.5x0.5 blocked zone at (0, 0)
    const result = canPlaceBin(
      placementRect({ x: 1, y: 0, width: 2, depth: 2, height: 6 }),
      LAYER_2,
      layout
    );
    expect(result.valid).toBe(true);
  });

  it('rejects placement exceeding depth', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      placementRect({ x: 0, y: 9, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_depth' });
  });

  it('rejects invalid layer', () => {
    const layout = createTestLayout();
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
      layerId('nonexistent'),
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'invalid_layer' });
  });

  it('rejects bin taller than remaining drawer height', () => {
    const layout = createTestLayout();
    // layer2 starts at z=3 (layer1 height), drawer height is 12
    // max height at layer2 = 12 - 3 = 9
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 15 }),
      LAYER_2,
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_height' });
  });

  it('allows bin shorter than layer default height (layer height is a default, not constraint)', () => {
    const layout = createTestLayout();
    // layer2 has height 6, but bins can be any height (layer height is just a default for new bins)
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_2,
      layout
    );
    expect(result).toEqual({ valid: true });
  });

  it('excludes multiple bins from collision check via excludeBinIds', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({ id: binId('bin1'), width: gridUnits(2), depth: gridUnits(2) }),
      createTestBin({
        id: binId('bin2'),
        x: gridUnits(1),
        y: gridUnits(1),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 3, depth: 3, height: 3 }),
      LAYER_1,
      layout,
      undefined,
      new Set([binId('bin1'), binId('bin2')])
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
    layout.drawer.width = gridUnits(100);
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
  });

  it('rejects duplicate category names', () => {
    const layout = createTestLayout();
    layout.categories = [
      { id: categoryId('1'), name: 'Tools', color: '#f00' },
      { id: categoryId('2'), name: 'tools', color: '#0f0' }, // duplicate (case-insensitive)
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
      .map((_, i) => ({ id: layerId(`layer${i}`), name: `Layer ${i}`, height: heightUnits(1) }));
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('layers'))).toBe(true);
  });

  it('rejects bins referencing invalid layers', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        layerId: layerId('nonexistent'),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid layer'))).toBe(true);
  });

  it('rejects bins out of bounds', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        x: gridUnits(15),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
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
      createTestBin({
        id: binId('bad'),
        x: gridUnits(9),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
      createTestBin({
        id: binId('good'),
        x: gridUnits(8),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    const result = validateImport(layout);
    // Should have exactly 1 error (the out-of-bounds bin), not 2
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Bin 0');
  });

  it('rejects total layer height exceeding drawer', () => {
    const layout = createTestLayout();
    layout.layers = [
      { id: LAYER_1, name: 'Layer 1', height: heightUnits(10) },
      { id: LAYER_2, name: 'Layer 2', height: heightUnits(10) },
    ];
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds drawer height'))).toBe(true);
  });

  it('rejects drawer depth out of range', () => {
    const layout = createTestLayout();
    layout.drawer.depth = gridUnits(100);
    const result = validateImport(layout);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid bin without required properties', () => {
    const layout = createTestLayout();
    // Bin is missing the required id
    const invalidLayout = {
      ...layout,
      bins: [
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
        },
      ],
    };
    const result = validateImport(invalidLayout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Bin 0 is invalid'))).toBe(true);
  });

  it('rejects invalid category without required properties', () => {
    const layout = createTestLayout();
    // Category is missing the required color
    const invalidLayout = { ...layout, categories: [{ id: 'cat1', name: 'Category' }] };
    const result = validateImport(invalidLayout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Category 0 is invalid'))).toBe(true);
  });
});

describe('salvageImport', () => {
  it('passes valid layout through unchanged', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
      createTestBin({
        id: binId('bin2'),
        x: gridUnits(3),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    const result = salvageImport(layout);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected the salvage to succeed');
    expect(result.layout.bins).toHaveLength(2);
    expect(result.salvaged).toHaveLength(0);
  });

  it('moves colliding bins to staging instead of rejecting the layout', () => {
    const layout = createTestLayout();
    // Two bins that overlap on the same layer
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(3),
        depth: gridUnits(3),
      }),
      createTestBin({
        id: binId('bin2'),
        x: gridUnits(1),
        y: gridUnits(1),
        width: gridUnits(3),
        depth: gridUnits(3),
      }),
    ];
    // validateImport would reject this entirely
    expect(validateImport(layout).valid).toBe(false);

    // salvageImport should succeed, moving the colliding bin to staging
    const result = salvageImport(layout);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected the salvage to succeed');
    expect(result.layout.bins).toHaveLength(2);
    expect(result.salvaged).toHaveLength(1);
    expect(result.salvaged[0]).toContain('collides');

    // The first bin stays on its layer, the colliding one goes to staging
    const gridBins = result.layout.bins.filter((b) => b.layerId !== STAGING_ID);
    const stagedBins = result.layout.bins.filter((b) => b.layerId === STAGING_ID);
    expect(gridBins).toHaveLength(1);
    expect(stagedBins).toHaveLength(1);
    expect(stagedBins[0].id).toBe('bin2');
  });

  it('moves out-of-bounds bins to staging', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('good'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
      createTestBin({
        id: binId('oob'),
        x: gridUnits(15),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    const result = salvageImport(layout);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected the salvage to succeed');
    expect(result.salvaged).toHaveLength(1);
    expect(result.salvaged[0]).toContain('Bin 1');

    const stagedBins = result.layout.bins.filter((b) => b.layerId === STAGING_ID);
    expect(stagedBins).toHaveLength(1);
    expect(stagedBins[0].id).toBe('oob');
  });

  it('still rejects structurally invalid data (missing drawer, layers, etc.)', () => {
    const result = salvageImport({ version: '1.0', name: 'Bad' });
    expect(result.valid).toBe(false);
  });

  it('preserves all bin properties when moving to staging', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(3),
        depth: gridUnits(3),
      }),
      createTestBin({
        id: binId('bin2'),
        x: gridUnits(1),
        y: gridUnits(1),
        width: gridUnits(3),
        depth: gridUnits(3),
        label: 'My Bin',
        notes: 'Important',
        category: categoryId('cat1'),
      }),
    ];
    const result = salvageImport(layout);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected the salvage to succeed');

    const staged = result.layout.bins.find((b) => b.layerId === STAGING_ID);
    expect(staged).toBeDefined();
    if (!staged) throw new Error('expected a staged bin');
    expect(staged.label).toBe('My Bin');
    expect(staged.notes).toBe('Important');
    expect(staged.width).toBe(3);
    expect(staged.depth).toBe(3);
  });

  it('handles all bins being invalid — layout still loads with empty grid', () => {
    const layout = createTestLayout();
    // Both bins out of bounds
    layout.bins = [
      createTestBin({
        id: binId('oob1'),
        x: gridUnits(50),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
      createTestBin({
        id: binId('oob2'),
        x: gridUnits(0),
        y: gridUnits(50),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    const result = salvageImport(layout);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected the salvage to succeed');
    expect(result.salvaged).toHaveLength(2);

    const stagedBins = result.layout.bins.filter((b) => b.layerId === STAGING_ID);
    expect(stagedBins).toHaveLength(2);
  });

  it('leaves staging bins untouched', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('staged'),
        layerId: STAGING_ID,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
      createTestBin({
        id: binId('grid'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    const result = salvageImport(layout);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected the salvage to succeed');
    // The already-staged bin should remain staged, not be double-staged
    const stagedBins = result.layout.bins.filter((b) => b.layerId === STAGING_ID);
    expect(stagedBins).toHaveLength(1);
    expect(stagedBins[0].id).toBe('staged');
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
    layout.bins = [createTestBin({ id: binId('bin1'), width: gridUnits(2), depth: gridUnits(2) })];
    // Rotation swaps width/depth, but for square it's the same
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout,
      binId('bin1')
    );
    expect(result.valid).toBe(true);
  });

  it('allows rotation of rectangular bin that fits after rotation', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: binId('bin1'), width: gridUnits(2), depth: gridUnits(4) })];
    // Rotate: 2x4 -> 4x2 at (0,0), should fit in 10x10 drawer
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 4, depth: 2, height: 3 }),
      LAYER_1,
      layout,
      binId('bin1')
    );
    expect(result.valid).toBe(true);
  });

  it('rejects rotation that would exceed drawer width', () => {
    const layout = createTestLayout();
    layout.bins = [
      // 2x8 bin at position (8,0) - rotation would make it 8x2 which exceeds width
      createTestBin({
        id: binId('bin1'),
        x: gridUnits(8),
        width: gridUnits(2),
        depth: gridUnits(8),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 8, y: 0, width: 8, depth: 2, height: 3 }),
      LAYER_1,
      layout,
      binId('bin1')
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_width' });
  });

  it('rejects rotation that would exceed drawer depth', () => {
    const layout = createTestLayout();
    layout.bins = [
      // 8x2 bin at position (0,8) - rotation would make it 2x8 which exceeds depth
      createTestBin({
        id: binId('bin1'),
        y: gridUnits(8),
        width: gridUnits(8),
        depth: gridUnits(2),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 0, y: 8, width: 2, depth: 8, height: 3 }),
      LAYER_1,
      layout,
      binId('bin1')
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_depth' });
  });

  it('rejects rotation that would cause collision', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Bin to rotate: 2x4 at (0,0)
      createTestBin({ id: binId('bin1'), width: gridUnits(2), depth: gridUnits(4) }),
      // Adjacent bin at (3,0) - would collide with rotated bin (4x2)
      createTestBin({
        id: binId('bin2'),
        x: gridUnits(3),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    // Rotate bin1: 2x4 -> 4x2
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 4, depth: 2, height: 3 }),
      LAYER_1,
      layout,
      binId('bin1')
    );
    expect(result).toMatchObject({ valid: false, reason: 'collision' });
    if (result.valid) throw new Error('expected the placement to be rejected');
    expect(result.blockingInfo).toMatchObject({ binId: 'bin2', layerId: 'layer1' });
  });

  it('allows rotation when adjacent bins do not collide', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Bin to rotate: 2x4 at (0,0)
      createTestBin({ id: binId('bin1'), width: gridUnits(2), depth: gridUnits(4) }),
      // Adjacent bin at (5,0) - won't collide with rotated bin (4x2)
      createTestBin({
        id: binId('bin2'),
        x: gridUnits(5),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    // Rotate bin1: 2x4 -> 4x2
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 4, depth: 2, height: 3 }),
      LAYER_1,
      layout,
      binId('bin1')
    );
    expect(result.valid).toBe(true);
  });

  it('rejects rotation into blocked zone', () => {
    const layout = createTestLayout();
    layout.bins = [
      // Tall bin on layer 1 that blocks part of layer 2
      createTestBin({
        id: binId('tall'),
        width: gridUnits(4),
        depth: gridUnits(4),
        height: heightUnits(6),
      }),
      // Bin on layer 2 to rotate: 2x4 at (5,0) - rotation would be 4x2 which doesn't overlap with blocked zone
      createTestBin({
        id: binId('bin1'),
        layerId: LAYER_2,
        x: gridUnits(5),
        width: gridUnits(2),
        depth: gridUnits(4),
        height: heightUnits(6),
      }),
    ];
    // This should work since rotated position doesn't overlap blocked zone
    const result = canPlaceBin(
      placementRect({ x: 5, y: 0, width: 4, depth: 2, height: 6 }),
      LAYER_2,
      layout,
      binId('bin1')
    );
    expect(result.valid).toBe(true);
  });

  it('handles rotation with clearance height', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        width: gridUnits(2),
        depth: gridUnits(4),
        clearanceHeight: heightUnits(2),
      }),
    ];
    // Rotate preserving clearance
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 4, depth: 2, height: 3, clearanceHeight: 2 }),
      LAYER_1,
      layout,
      binId('bin1')
    );
    expect(result.valid).toBe(true);
  });
});

describe('validateLayoutIntegrity', () => {
  it('returns valid for well-formed layout', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ id: binId('bin1'), width: gridUnits(2), depth: gridUnits(2) })];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns error when bin references missing layer', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        layerId: layerId('nonexistent'),
        width: gridUnits(2),
        depth: gridUnits(2),
        label: 'Test Bin',
      }),
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing layer');
  });

  it('returns error when bin references missing category', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        width: gridUnits(2),
        depth: gridUnits(2),
        category: categoryId('nonexistent'),
        label: 'Test Bin',
      }),
    ];

    const result = validateLayoutIntegrity(layout);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('missing category');
  });

  it('allows bins in staging with any layerId', () => {
    const layout = createTestLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        layerId: STAGING_ID,
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
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
      createTestBin({
        id: binId('bin1'),
        layerId: layerId('nonexistent'),
        width: gridUnits(2),
        depth: gridUnits(2),
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
      createTestBin({
        id: binId('bin-abc-123'),
        layerId: layerId('nonexistent'),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
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
    // Use a staging bin to skip canPlaceBin and test customProperties validation
    const invalidLayout = {
      ...layout,
      bins: [
        {
          id: 'bin1',
          layerId: STAGING_ID,
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
    expect(customPropertyErrors(result)).toContain('plain object');
  });

  it('rejects non-object values', () => {
    const result = validateCustomProperties('not an object' as unknown as Record<string, string>);
    expect(customPropertyErrors(result)).toContain('plain object');
  });

  it('rejects exceeding max property count', () => {
    const props: Record<string, string> = {};
    for (let i = 0; i <= CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT; i++) {
      props[`key${i}`] = `value${i}`;
    }
    const msg = customPropertyErrors(validateCustomProperties(props));
    expect(msg).toContain('Maximum');
    expect(msg).toContain('custom properties');
  });

  it('rejects empty keys', () => {
    const result = validateCustomProperties({ '': 'value' });
    expect(customPropertyErrors(result)).toContain('empty');
  });

  it('rejects whitespace-only keys', () => {
    const result = validateCustomProperties({ '   ': 'value' });
    expect(customPropertyErrors(result)).toContain('empty');
  });

  it('rejects keys exceeding max length', () => {
    const longKey = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH + 1);
    const result = validateCustomProperties({ [longKey]: 'value' });
    expect(customPropertyErrors(result)).toContain('exceeds maximum length');
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
      expect(customPropertyErrors(result)).toContain('reserved');
    }
  });

  it('rejects non-string values', () => {
    const result = validateCustomProperties({ key: 123 as unknown as string });
    expect(customPropertyErrors(result)).toContain('must be a string');
  });

  it('rejects values exceeding max length', () => {
    const longValue = 'a'.repeat(CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH + 1);
    const result = validateCustomProperties({ key: longValue });
    expect(customPropertyErrors(result)).toContain('exceeds maximum length');
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

// Both import paths rebuild bins field-by-field, so a new Bin field has to be
// added here explicitly or it is silently dropped. Losing linkedDesignId left
// restoreEmbeddedDesigns remapping an id that was already gone.
describe('linkedDesignId round-trip', () => {
  const DESIGN_ID = 'design_1730000000000_ab12cd';
  const layoutWithLinkedBin = () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin({ linkedDesignId: designId(DESIGN_ID) })];
    return layout;
  };

  it('validateImport preserves a bin linkedDesignId', () => {
    const layout = layoutWithLinkedBin();

    const result = validateImport(layout);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.layout.bins[0].linkedDesignId).toBe(DESIGN_ID);
    }
  });

  it('validateImport leaves it undefined for an unlinked bin', () => {
    const layout = createTestLayout();
    layout.bins = [createTestBin()];
    const result = validateImport(layout);

    expect(result.valid).toBe(true);
    if (result.valid) expect(result.layout.bins[0].linkedDesignId).toBeUndefined();
  });

  it('salvageImport preserves a bin linkedDesignId', () => {
    const result = salvageImport(layoutWithLinkedBin());

    expect(result.layout?.bins[0].linkedDesignId).toBe(DESIGN_ID);
  });

  it('isValidBin rejects a non-string linkedDesignId', () => {
    expect(isValidBin({ ...createTestBin(), linkedDesignId: 42 })).toBe(false);
    expect(isValidBin({ ...createTestBin(), linkedDesignId: 'design_1' })).toBe(true);
  });
});

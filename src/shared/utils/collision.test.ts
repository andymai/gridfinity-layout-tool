import { describe, it, expect } from 'vitest';
import {
  getLayerZStartResult,
  getBin3DRectResult,
  footprintsOverlap,
  binsCollideResult,
  getBlockedZones,
  getDisplayLayers,
  checkLayerReorderCollisions,
  isInBlockedZone,
} from '@/shared/utils/collision';
import { isOk } from '@/core/result';
import type { Layer } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { createTestBin, expectOk, expectErr } from '@/test/testUtils';

const layers: Layer[] = [
  { id: 'layer1', name: 'Layer 1', height: 3 },
  { id: 'layer2', name: 'Layer 2', height: 6 },
  { id: 'layer3', name: 'Layer 3', height: 3 },
];

describe('getLayerZStartResult', () => {
  it('returns Ok(0) for first layer', () => {
    expect(expectOk(getLayerZStartResult('layer1', layers))).toBe(0);
  });

  it('sums heights for subsequent layers', () => {
    expect(expectOk(getLayerZStartResult('layer2', layers))).toBe(3);
    expect(expectOk(getLayerZStartResult('layer3', layers))).toBe(9);
  });

  it('returns Err for unknown layer', () => {
    expect(expectErr(getLayerZStartResult('unknown', layers)).code).toBe(
      'VALIDATION_INVALID_LAYER'
    );
  });

  it('returns Err for empty string layer ID', () => {
    expectErr(getLayerZStartResult('', layers));
  });
});

describe('getBin3DRectResult', () => {
  it('returns Ok with correct 3D rect for valid bin', () => {
    const bin = createTestBin({ id: '1', x: 2, y: 3, width: 4, depth: 5 });
    expect(expectOk(getBin3DRectResult(bin, layers))).toEqual({
      x: 2,
      y: 3,
      width: 4,
      depth: 5,
      zStart: 0,
      zEnd: 3, // height only, no clearance
    });
  });

  it('includes clearanceHeight in zEnd', () => {
    const bin = createTestBin({
      id: '1',
      layerId: 'layer2',
      width: 2,
      depth: 2,
      height: 4,
      clearanceHeight: 2,
    });
    const value = expectOk(getBin3DRectResult(bin, layers));
    expect(value.zStart).toBe(3); // layer2 starts at z=3
    expect(value.zEnd).toBe(9); // 3 + 4 + 2 = 9
  });

  it('returns Err for bin with invalid layer', () => {
    const bin = createTestBin({ id: '1', layerId: 'nonexistent', width: 2, depth: 2 });
    expect(expectErr(getBin3DRectResult(bin, layers)).code).toBe('VALIDATION_INVALID_LAYER');
  });
});

describe('footprintsOverlap', () => {
  it('detects overlapping rectangles', () => {
    const a = { x: 0, y: 0, width: 2, depth: 2 };
    const b = { x: 1, y: 1, width: 2, depth: 2 };
    expect(footprintsOverlap(a, b)).toBe(true);
  });

  it('returns false for adjacent rectangles', () => {
    const a = { x: 0, y: 0, width: 2, depth: 2 };
    const b = { x: 2, y: 0, width: 2, depth: 2 };
    expect(footprintsOverlap(a, b)).toBe(false);
  });

  it('returns false for separated rectangles', () => {
    const a = { x: 0, y: 0, width: 2, depth: 2 };
    const b = { x: 5, y: 5, width: 2, depth: 2 };
    expect(footprintsOverlap(a, b)).toBe(false);
  });
});

describe('binsCollideResult', () => {
  it('returns Ok(true) for overlapping bins on same layer', () => {
    const binA = createTestBin({ id: '1', width: 2, depth: 2 });
    const binB = createTestBin({ id: '2', x: 1, y: 1, width: 2, depth: 2 });
    expect(expectOk(binsCollideResult(binA, binB, layers))).toBe(true);
  });

  it('returns Ok(false) for bins on different layers with no vertical overlap', () => {
    const binA = createTestBin({ id: '1', width: 2, depth: 2 });
    const binB = createTestBin({ id: '2', layerId: 'layer2', width: 2, depth: 2 });
    expect(expectOk(binsCollideResult(binA, binB, layers))).toBe(false);
  });

  it('returns Ok(false) for staging bins', () => {
    const binA = createTestBin({ id: '1', layerId: STAGING_ID, width: 2, depth: 2 });
    const binB = createTestBin({ id: '2', width: 2, depth: 2 });
    expect(expectOk(binsCollideResult(binA, binB, layers))).toBe(false);
  });

  it('returns Ok(false) for non-overlapping footprints', () => {
    const binA = createTestBin({ id: '1', width: 2, depth: 2 });
    const binB = createTestBin({ id: '2', x: 5, y: 5, width: 2, depth: 2 });
    expect(expectOk(binsCollideResult(binA, binB, layers))).toBe(false);
  });

  it('returns Err when binA has invalid layer', () => {
    const binA = createTestBin({ id: '1', layerId: 'nonexistent', width: 2, depth: 2 });
    const binB = createTestBin({ id: '2', width: 2, depth: 2 });
    expect(expectErr(binsCollideResult(binA, binB, layers)).code).toBe('VALIDATION_INVALID_LAYER');
  });

  it('returns Err when binB has invalid layer', () => {
    const binA = createTestBin({ id: '1', width: 2, depth: 2 });
    const binB = createTestBin({ id: '2', layerId: 'nonexistent', width: 2, depth: 2 });
    expect(expectErr(binsCollideResult(binA, binB, layers)).code).toBe('VALIDATION_INVALID_LAYER');
  });
});

describe('getBlockedZones', () => {
  it('returns empty array when no protrusions', () => {
    const bins = [createTestBin({ id: '1', width: 2, depth: 2 })];
    expect(getBlockedZones('layer2', bins, layers)).toEqual([]);
  });

  it('returns blocked zone for protruding bin', () => {
    const bins = [
      createTestBin({ id: '1', width: 2, depth: 2, height: 6 }), // protrudes 3u into layer2
    ];
    const zones = getBlockedZones('layer2', bins, layers);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ x: 0, y: 0, width: 2, depth: 2, sourceBinId: '1' });
  });

  it('returns empty array for empty targetLayerId', () => {
    const bins = [createTestBin({ id: '1', width: 2, depth: 2, height: 6 })];
    expect(getBlockedZones('', bins, layers)).toEqual([]);
  });

  it('returns empty array for invalid targetLayerId', () => {
    const bins = [createTestBin({ id: '1', width: 2, depth: 2, height: 6 })];
    expect(getBlockedZones('nonexistent', bins, layers)).toEqual([]);
  });

  it('ignores staging bins', () => {
    const bins = [createTestBin({ id: '1', layerId: STAGING_ID, width: 2, depth: 2, height: 20 })];
    expect(getBlockedZones('layer2', bins, layers)).toEqual([]);
  });

  it('ignores bins on same or higher layer', () => {
    const bins = [
      createTestBin({ id: '1', layerId: 'layer2', width: 2, depth: 2, height: 6 }),
      createTestBin({ id: '2', layerId: 'layer3', width: 2, depth: 2, height: 6 }),
    ];
    // Checking layer2 - bins on layer2 or layer3 should not create blocked zones
    expect(getBlockedZones('layer2', bins, layers)).toEqual([]);
  });
});

describe('getDisplayLayers', () => {
  it('reverses array for display', () => {
    const result = getDisplayLayers(layers);
    expect(result[0].id).toBe('layer3');
    expect(result[1].id).toBe('layer2');
    expect(result[2].id).toBe('layer1');
  });

  it('does not mutate original array', () => {
    const original = [...layers];
    getDisplayLayers(layers);
    expect(layers).toEqual(original);
  });

  it('handles empty array', () => {
    expect(getDisplayLayers([])).toEqual([]);
  });

  it('handles single element', () => {
    const single = [{ id: 'only', name: 'Only', height: 3 }];
    expect(getDisplayLayers(single)).toEqual(single);
  });
});

describe('isInBlockedZone', () => {
  const blockedZones = [
    { x: 0, y: 0, width: 2, depth: 2, sourceBinId: 'bin1', sourceLayerId: 'layer1' },
    { x: 5, y: 5, width: 3, depth: 3, sourceBinId: 'bin2', sourceLayerId: 'layer1' },
  ];

  it('returns zone when position is inside', () => {
    const result = isInBlockedZone(1, 1, blockedZones);
    expect(result).not.toBeNull();
    expect(result?.sourceBinId).toBe('bin1');
  });

  it('returns null when position is outside all zones', () => {
    expect(isInBlockedZone(3, 3, blockedZones)).toBeNull();
  });

  it('returns zone at boundary (inclusive start)', () => {
    expect(isInBlockedZone(0, 0, blockedZones)).not.toBeNull();
    expect(isInBlockedZone(5, 5, blockedZones)).not.toBeNull();
  });

  it('returns null at boundary (exclusive end)', () => {
    expect(isInBlockedZone(2, 0, blockedZones)).toBeNull();
    expect(isInBlockedZone(0, 2, blockedZones)).toBeNull();
  });

  it('returns null for empty zones array', () => {
    expect(isInBlockedZone(0, 0, [])).toBeNull();
  });
});

describe('checkLayerReorderCollisions', () => {
  it('returns empty array when no collisions', () => {
    const bins = [
      createTestBin({ id: '1', width: 2, depth: 2 }),
      createTestBin({ id: '2', layerId: 'layer2', width: 2, depth: 2 }),
    ];
    // Swapping layers - bins still fit because they don't overlap vertically
    const newLayers: Layer[] = [
      { id: 'layer2', name: 'Layer 2', height: 6 },
      { id: 'layer1', name: 'Layer 1', height: 3 },
      { id: 'layer3', name: 'Layer 3', height: 3 },
    ];
    expect(checkLayerReorderCollisions(bins, layers, newLayers)).toEqual([]);
  });

  it('detects collisions when bins overlap after reorder', () => {
    const bins = [
      createTestBin({ id: '1', width: 2, depth: 2, height: 6 }),
      createTestBin({ id: '2', layerId: 'layer2', width: 2, depth: 2, height: 6 }),
    ];
    // With same positions and tall heights, they will collide
    const result = checkLayerReorderCollisions(bins, layers, layers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].binA.id).toBe('1');
    expect(result[0].binB.id).toBe('2');
  });

  it('ignores staging bins', () => {
    const bins = [
      createTestBin({ id: '1', layerId: STAGING_ID, width: 2, depth: 2, height: 6 }),
      createTestBin({ id: '2', width: 2, depth: 2, height: 6 }),
    ];
    expect(checkLayerReorderCollisions(bins, layers, layers)).toEqual([]);
  });

  it('returns empty when bins have no footprint overlap', () => {
    const bins = [
      createTestBin({ id: '1', width: 2, depth: 2, height: 6 }),
      createTestBin({ id: '2', x: 5, y: 5, width: 2, depth: 2, height: 6 }),
    ];
    expect(checkLayerReorderCollisions(bins, layers, layers)).toEqual([]);
  });
});

describe('clearanceHeight', () => {
  it('causes collision when clearance extends into upper layer bin', () => {
    // Bin on layer1 with height 3 (fits exactly) but clearance 3 (extends into layer2)
    const binA = createTestBin({ id: '1', width: 2, depth: 2, clearanceHeight: 3 });
    // Bin on layer2 at same footprint
    const binB = createTestBin({ id: '2', layerId: 'layer2', width: 2, depth: 2 });
    // Layer2 starts at z=3, binA extends to z=3+3=6 (height + clearance), binB is at z=3-6
    // They should collide because clearance from binA extends into binB's space
    const result = binsCollideResult(binA, binB, layers);
    expect(isOk(result) && result.value).toBe(true);
  });

  it('does not cause collision when clearance does not reach upper layer', () => {
    // Bin on layer1 with height 2 and clearance 1 (total 3, exactly at layer boundary)
    const binA = createTestBin({ id: '1', width: 2, depth: 2, height: 2, clearanceHeight: 1 });
    // Bin on layer2 at same footprint
    const binB = createTestBin({ id: '2', layerId: 'layer2', width: 2, depth: 2 });
    // binA: z=0-3 (height 2 + clearance 1), binB: z=3-6
    // They touch but don't overlap (exclusive boundary)
    const result = binsCollideResult(binA, binB, layers);
    expect(isOk(result) && result.value).toBe(false);
  });

  it('creates blocked zone when clearance extends into upper layer', () => {
    // Bin on layer1 with height 2 and clearance 2 (extends 1 unit into layer2)
    const bins = [createTestBin({ id: '1', width: 2, depth: 2, height: 2, clearanceHeight: 2 })];
    // Layer2 starts at z=3, bin extends to z=4 (height 2 + clearance 2)
    const zones = getBlockedZones('layer2', bins, layers);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ x: 0, y: 0, width: 2, depth: 2, sourceBinId: '1' });
  });

  it('does not create blocked zone when clearance stays within layer', () => {
    // Bin on layer1 with height 2 and clearance 1 (total 3, exactly at layer boundary)
    const bins = [createTestBin({ id: '1', width: 2, depth: 2, height: 2, clearanceHeight: 1 })];
    // Layer2 starts at z=3, bin extends to z=3 exactly - no protrusion
    const zones = getBlockedZones('layer2', bins, layers);
    expect(zones).toHaveLength(0);
  });

  it('defaults to 0 clearance when not specified', () => {
    // Bin without clearanceHeight should behave same as clearanceHeight: 0
    const binA = createTestBin({ id: '1', width: 2, depth: 2 });
    const binB = createTestBin({ id: '2', layerId: 'layer2', width: 2, depth: 2 });
    // Without clearance, layer1 bin (z=0-3) doesn't overlap with layer2 bin (z=3-6)
    const result = binsCollideResult(binA, binB, layers);
    expect(isOk(result) && result.value).toBe(false);
  });
});

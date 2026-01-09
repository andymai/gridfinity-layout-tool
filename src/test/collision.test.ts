import { describe, it, expect } from 'vitest';
import {
  getLayerZStart,
  footprintsOverlap,
  binsCollide,
  getBlockedZones,
  getDisplayLayers,
  checkLayerReorderCollisions,
  isInBlockedZone,
} from '../utils/collision';
import type { Layer, Bin } from '../types';
import { STAGING_ID } from '../constants';

const layers: Layer[] = [
  { id: 'layer1', name: 'Layer 1', height: 3 },
  { id: 'layer2', name: 'Layer 2', height: 6 },
  { id: 'layer3', name: 'Layer 3', height: 3 },
];

describe('getLayerZStart', () => {
  it('returns 0 for first layer', () => {
    expect(getLayerZStart('layer1', layers)).toBe(0);
  });

  it('sums heights for subsequent layers', () => {
    expect(getLayerZStart('layer2', layers)).toBe(3);
    expect(getLayerZStart('layer3', layers)).toBe(9);
  });

  it('throws for unknown layer', () => {
    expect(() => getLayerZStart('unknown', layers)).toThrow();
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

describe('binsCollide', () => {
  it('returns true for overlapping bins on same layer', () => {
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    const binB: Bin = { id: '2', layerId: 'layer1', x: 1, y: 1, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    expect(binsCollide(binA, binB, layers)).toBe(true);
  });

  it('returns false for bins on different layers with no vertical overlap', () => {
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    const binB: Bin = { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    expect(binsCollide(binA, binB, layers)).toBe(false);
  });

  it('returns true for tall bin protruding into upper layer', () => {
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' }; // extends into layer2
    const binB: Bin = { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    expect(binsCollide(binA, binB, layers)).toBe(true);
  });

  it('returns false for staging bins', () => {
    const binA: Bin = { id: '1', layerId: STAGING_ID, x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    const binB: Bin = { id: '2', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    expect(binsCollide(binA, binB, layers)).toBe(false);
  });
});

describe('getBlockedZones', () => {
  it('returns empty array when no protrusions', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' },
    ];
    expect(getBlockedZones('layer2', bins, layers)).toEqual([]);
  });

  it('returns blocked zone for protruding bin', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' }, // protrudes 3u into layer2
    ];
    const zones = getBlockedZones('layer2', bins, layers);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ x: 0, y: 0, width: 2, depth: 2, sourceBinId: '1' });
  });

  it('returns empty array for empty targetLayerId', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
    ];
    expect(getBlockedZones('', bins, layers)).toEqual([]);
  });

  it('returns empty array for invalid targetLayerId', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
    ];
    expect(getBlockedZones('nonexistent', bins, layers)).toEqual([]);
  });

  it('ignores staging bins', () => {
    const bins: Bin[] = [
      { id: '1', layerId: STAGING_ID, x: 0, y: 0, width: 2, depth: 2, height: 20, category: 'tools', label: '', notes: '' },
    ];
    expect(getBlockedZones('layer2', bins, layers)).toEqual([]);
  });

  it('ignores bins on same or higher layer', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
      { id: '2', layerId: 'layer3', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
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
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' },
      { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' },
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
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
      { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
    ];
    // With same positions and tall heights, they will collide
    const result = checkLayerReorderCollisions(bins, layers, layers);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].binA.id).toBe('1');
    expect(result[0].binB.id).toBe('2');
  });

  it('ignores staging bins', () => {
    const bins: Bin[] = [
      { id: '1', layerId: STAGING_ID, x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
      { id: '2', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
    ];
    expect(checkLayerReorderCollisions(bins, layers, layers)).toEqual([]);
  });

  it('returns empty when bins have no footprint overlap', () => {
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
      { id: '2', layerId: 'layer1', x: 5, y: 5, width: 2, depth: 2, height: 6, category: 'tools', label: '', notes: '' },
    ];
    expect(checkLayerReorderCollisions(bins, layers, layers)).toEqual([]);
  });
});

describe('clearanceHeight', () => {
  it('causes collision when clearance extends into upper layer bin', () => {
    // Bin on layer1 with height 3 (fits exactly) but clearance 3 (extends into layer2)
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, clearanceHeight: 3, category: 'tools', label: '', notes: '' };
    // Bin on layer2 at same footprint
    const binB: Bin = { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    // Layer2 starts at z=3, binA extends to z=3+3=6 (height + clearance), binB is at z=3-6
    // They should collide because clearance from binA extends into binB's space
    expect(binsCollide(binA, binB, layers)).toBe(true);
  });

  it('does not cause collision when clearance does not reach upper layer', () => {
    // Bin on layer1 with height 2 and clearance 1 (total 3, exactly at layer boundary)
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 2, clearanceHeight: 1, category: 'tools', label: '', notes: '' };
    // Bin on layer2 at same footprint
    const binB: Bin = { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    // binA: z=0-3 (height 2 + clearance 1), binB: z=3-6
    // They touch but don't overlap (exclusive boundary)
    expect(binsCollide(binA, binB, layers)).toBe(false);
  });

  it('creates blocked zone when clearance extends into upper layer', () => {
    // Bin on layer1 with height 2 and clearance 2 (extends 1 unit into layer2)
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 2, clearanceHeight: 2, category: 'tools', label: '', notes: '' },
    ];
    // Layer2 starts at z=3, bin extends to z=4 (height 2 + clearance 2)
    const zones = getBlockedZones('layer2', bins, layers);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ x: 0, y: 0, width: 2, depth: 2, sourceBinId: '1' });
  });

  it('does not create blocked zone when clearance stays within layer', () => {
    // Bin on layer1 with height 2 and clearance 1 (total 3, exactly at layer boundary)
    const bins: Bin[] = [
      { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 2, clearanceHeight: 1, category: 'tools', label: '', notes: '' },
    ];
    // Layer2 starts at z=3, bin extends to z=3 exactly - no protrusion
    const zones = getBlockedZones('layer2', bins, layers);
    expect(zones).toHaveLength(0);
  });

  it('defaults to 0 clearance when not specified', () => {
    // Bin without clearanceHeight should behave same as clearanceHeight: 0
    const binA: Bin = { id: '1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    const binB: Bin = { id: '2', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'tools', label: '', notes: '' };
    // Without clearance, layer1 bin (z=0-3) doesn't overlap with layer2 bin (z=3-6)
    expect(binsCollide(binA, binB, layers)).toBe(false);
  });
});

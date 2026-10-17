import { describe, it, expect, afterEach } from 'vitest';
import {
  footprintsOverlap,
  getDisplayLayers,
  isInBlockedZone,
  linkedExcessCacheKey,
  linkedExcessUnits,
  registerLinkedExcessResolver,
} from '@/shared/utils/collision';
import type { BlockedZone, Layer } from '@/core/types';
import { binId, designId, gridUnits, heightUnits, layerId } from '@/core/types';
import { createTestBin } from '@/test/testUtils';

const LAYER_1 = layerId('layer1');
const LAYER_2 = layerId('layer2');
const LAYER_3 = layerId('layer3');

const layers: Layer[] = [
  { id: LAYER_1, name: 'Layer 1', height: heightUnits(3) },
  { id: LAYER_2, name: 'Layer 2', height: heightUnits(6) },
  { id: LAYER_3, name: 'Layer 3', height: heightUnits(3) },
];

describe('linkedExcessUnits', () => {
  afterEach(() => {
    registerLinkedExcessResolver(null);
  });

  const linked = createTestBin({ id: binId('1'), linkedDesignId: designId('lidded') });

  it('reads the registered resolver for a linked bin', () => {
    registerLinkedExcessResolver(() => 2);
    expect(linkedExcessUnits(linked)).toBe(2);
    expect(linkedExcessUnits(createTestBin({ id: binId('2') }))).toBe(0);
  });

  it('ignores the resolver once unregistered', () => {
    registerLinkedExcessResolver(() => 2);
    registerLinkedExcessResolver(null);
    expect(linkedExcessUnits(linked)).toBe(0);
  });

  it('treats a non-finite or negative resolver value as zero excess', () => {
    for (const value of [Number.NaN, Infinity, -2]) {
      registerLinkedExcessResolver(() => value);
      expect(linkedExcessUnits(linked)).toBe(0);
    }
  });

  it('changes its cache key on re-registration and on a version bump', () => {
    let version = 0;
    registerLinkedExcessResolver(
      () => 0,
      () => version
    );
    const first = linkedExcessCacheKey();
    expect(linkedExcessCacheKey()).toBe(first);
    version = 1;
    const bumped = linkedExcessCacheKey();
    expect(bumped).not.toBe(first);
    registerLinkedExcessResolver(
      () => 0,
      () => version
    );
    expect(linkedExcessCacheKey()).not.toBe(bumped);
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
    const single: Layer[] = [{ id: layerId('only'), name: 'Only', height: heightUnits(3) }];
    expect(getDisplayLayers(single)).toEqual(single);
  });
});

describe('isInBlockedZone', () => {
  const blockedZones: BlockedZone[] = [
    {
      x: gridUnits(0),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
      sourceBinId: binId('bin1'),
      sourceLayerId: LAYER_1,
    },
    {
      x: gridUnits(5),
      y: gridUnits(5),
      width: gridUnits(3),
      depth: gridUnits(3),
      sourceBinId: binId('bin2'),
      sourceLayerId: LAYER_1,
    },
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

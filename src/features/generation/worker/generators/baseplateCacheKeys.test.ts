import { describe, it, expect } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { slabPocketsCacheKey } from './baseplateCacheKeys';

const base = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 4,
  depth: 4,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  connectorNubs: true,
  edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
  ...overrides,
});

describe('slabPocketsCacheKey — pocket mask vs outline (issue #2528)', () => {
  it('slabPocketsCacheKey keys on the pocket mask, not the outline curve', () => {
    const rectKey = slabPocketsCacheKey(base(), true);
    const maskAKey = slabPocketsCacheKey(base(), true, 'abc123');
    const maskBKey = slabPocketsCacheKey(base(), true, 'def456');
    expect(maskAKey).not.toBe(rectKey);
    expect(maskBKey).not.toBe(maskAKey);
    // Outlines that pocket the same cells hash to the same mask and share the
    // slab entry by design — the outline intersect runs post-cache.
    expect(slabPocketsCacheKey(base(), true, 'abc123')).toBe(maskAKey);
  });
});

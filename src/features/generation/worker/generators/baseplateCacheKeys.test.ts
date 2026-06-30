import { describe, it, expect } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { meshCacheKey } from './baseplateCacheKeys';

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

describe('meshCacheKey — connector fit offset (issue #2024)', () => {
  // The cache key must track CLAMPED groove geometry, not the raw offset, so
  // offsets that produce identical geometry reuse one cache entry.
  it('shares a key for offsets that clamp to the same effective clearance', () => {
    // Integral dovetail base clearance is 0.15mm; any offset ≤ -0.15 → 0.
    const a = meshCacheKey(base({ connectorFitOffset: -0.2 }), false);
    const b = meshCacheKey(base({ connectorFitOffset: -0.3 }), false);
    expect(a).toBe(b);
  });

  it('produces distinct keys when the effective clearance actually changes', () => {
    const nominal = meshCacheKey(base({ connectorFitOffset: 0 }), false);
    const looser = meshCacheKey(base({ connectorFitOffset: 0.1 }), false);
    expect(nominal).not.toBe(looser);
  });

  it('ignores the offset entirely when connectors are disabled', () => {
    const off0 = meshCacheKey(base({ connectorNubs: false, connectorFitOffset: 0 }), false);
    const off2 = meshCacheKey(base({ connectorNubs: false, connectorFitOffset: 0.2 }), false);
    expect(off0).toBe(off2);
  });

  it('keys the dovetail-key style on its own (tighter) base clearance', () => {
    // Key base clearance is 0.075mm; -0.2 and -0.1 both clamp to 0 → same key,
    // while -0.05 (→ 0.025) stays distinct.
    const key = (o: number) =>
      meshCacheKey(base({ connectorStyle: 'dovetailKey', connectorFitOffset: o }), false);
    expect(key(-0.2)).toBe(key(-0.1));
    expect(key(-0.05)).not.toBe(key(-0.1));
  });
});

describe('meshCacheKey — draft preview', () => {
  // The draft preview skips the lightweight floor cut, so its mesh differs from
  // the full build; the two must not alias onto one cache entry.
  it('produces distinct keys for draft vs full geometry', () => {
    const full = meshCacheKey(base({ magnetHoles: true }), false, false);
    const draft = meshCacheKey(base({ magnetHoles: true }), false, true);
    expect(full).not.toBe(draft);
  });

  it('defaults to the full-geometry key when draft is omitted', () => {
    expect(meshCacheKey(base(), false)).toBe(meshCacheKey(base(), false, false));
  });

  it('does not fragment the cache when draft cannot change geometry', () => {
    // No magnets ⇒ no lightweight floor cut ⇒ draft mesh == full mesh, so the
    // draft flag must not split the LRU.
    const noMag = (draft: boolean) => meshCacheKey(base({ magnetHoles: false }), false, draft);
    expect(noMag(true)).toBe(noMag(false));
    // lightweight explicitly off ⇒ likewise nothing for draft to skip.
    const noLw = (draft: boolean) =>
      meshCacheKey(base({ magnetHoles: true, lightweight: false }), false, draft);
    expect(noLw(true)).toBe(noLw(false));
  });
});

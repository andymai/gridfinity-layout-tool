import { describe, it, expect } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { meshCacheKey, slabPocketsCacheKey } from './baseplateCacheKeys';

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

describe('meshCacheKey — nozzle-dependent floor pads (issue #2559)', () => {
  // #2544 made the lightweight-floor magnet pad margin depend on nozzle size, so
  // the key must track nozzle for magnet+lightweight plates even with connectors
  // off — otherwise a wider nozzle serves the stale narrow-pad mesh.
  const floor = (nozzleSizeMm: number) =>
    meshCacheKey(base({ connectorNubs: false, magnetHoles: true, nozzleSizeMm }), false);

  it('keys on nozzle when the lightweight floor cut runs, connectors off', () => {
    expect(floor(0.4)).not.toBe(floor(0.8));
  });

  it('shares a key across nozzles when no floor cut consumes the pad margin', () => {
    // No magnets ⇒ no lightweight floor ⇒ nozzle has no geometric effect (and
    // connectors are off), so the plate keeps one entry across nozzle changes.
    const noMag = (nozzleSizeMm: number) =>
      meshCacheKey(base({ connectorNubs: false, magnetHoles: false, nozzleSizeMm }), false);
    expect(noMag(0.4)).toBe(noMag(0.8));

    // Lightweight explicitly off ⇒ the floor stays solid, so no nozzle-scaled pad.
    const noLw = (nozzleSizeMm: number) =>
      meshCacheKey(
        base({ connectorNubs: false, magnetHoles: true, lightweight: false, nozzleSizeMm }),
        false
      );
    expect(noLw(0.4)).toBe(noLw(0.8));

    // A solid floor suppresses the lightweight cut too.
    const solid = (nozzleSizeMm: number) =>
      meshCacheKey(
        base({ connectorNubs: false, magnetHoles: true, solidFloor: true, nozzleSizeMm }),
        false
      );
    expect(solid(0.4)).toBe(solid(0.8));
  });
});

describe('cache keys with outlines (issue #2528)', () => {
  const L_SHAPE = {
    vertices: [
      { x: 0, y: 0 },
      { x: 168, y: 0 },
      { x: 168, y: 84 },
      { x: 84, y: 84 },
      { x: 84, y: 168 },
      { x: 0, y: 168 },
    ],
  };
  const L_SHAPE_TWEAKED = {
    vertices: L_SHAPE.vertices.map((v, i) => (i === 0 ? { x: 0.5, y: 0 } : v)),
  };

  it('meshCacheKey separates shaped plates from rectangles and from each other', () => {
    const rect = meshCacheKey(base(), true);
    const shaped = meshCacheKey(base({ outline: L_SHAPE }), true);
    const tweaked = meshCacheKey(base({ outline: L_SHAPE_TWEAKED }), true);
    expect(shaped).not.toBe(rect);
    expect(tweaked).not.toBe(shaped);
  });

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

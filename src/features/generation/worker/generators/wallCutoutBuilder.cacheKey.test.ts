// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, WallCutout } from '@/shared/types/bin';
import { wallCutoutsFeature } from './wallCutoutBuilder';

// cacheKey is pure — no WASM init needed.
function keyFor(params: BinParams): string {
  const ctx = {
    params,
    dimensions: {
      shellKey: 'shell',
      innerW: 80,
      innerD: 40,
      wallHeight: 42,
      interiorHeight: 40,
      hasLip: true,
      compartmentsBakedIntoShell: false,
    },
  } as unknown as Parameters<typeof wallCutoutsFeature.cacheKey>[0];
  return wallCutoutsFeature.cacheKey(ctx);
}

function withFront(over: Partial<WallCutout>): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      front: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true, ...over },
    },
  };
}

describe('wallCutoutsFeature.cacheKey', () => {
  // The key serializes the whole `walls` object, so a new size field is covered
  // by construction — but only as long as it lives there. A field parked
  // outside `walls` would serve the previous cut back after the user edits it,
  // and a stale cut looks exactly like a correct one.
  it('changes when the absolute depth changes', () => {
    expect(keyFor(withFront({ depthMm: 10 }))).not.toBe(keyFor(withFront({ depthMm: 30 })));
  });

  it('separates an absolute depth from the percentage it overrides', () => {
    expect(keyFor(withFront({ depth: 50, depthMm: 20 }))).not.toBe(
      keyFor(withFront({ depth: 50, depthMm: null }))
    );
  });

  it('is stable for an unchanged config', () => {
    expect(keyFor(withFront({ depthMm: 20 }))).toBe(keyFor(withFront({ depthMm: 20 })));
  });
});

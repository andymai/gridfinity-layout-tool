// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { dividerBlendFeature } from './dividerBlendBuilder';

// cacheKey is pure — no WASM init needed.
function keyFor(params: BinParams, collarHeight = 0): string {
  const ctx = {
    params,
    dimensions: {
      shellKey: 'shell',
      innerW: 80,
      innerD: 40,
      wallHeight: 42,
      collarHeight,
      hasLip: true,
    },
  } as unknown as Parameters<typeof dividerBlendFeature.cacheKey>[0];
  return dividerBlendFeature.cacheKey(ctx);
}

describe('dividerBlendFeature.cacheKey', () => {
  // A collar lengthens the funnel the end trim mirrors, which changes its lean.
  it('changes with the collar', () => {
    expect(keyFor(DEFAULT_BIN_PARAMS, 0)).not.toBe(keyFor(DEFAULT_BIN_PARAMS, 6));
  });

  // The junction clears the fillet's rounded corner, so the slider moves the cut.
  it('changes with the interior fillet radius', () => {
    const at = (interiorFilletMm: number | undefined): string =>
      keyFor({ ...DEFAULT_BIN_PARAMS, interiorFilletMm });
    expect(at(undefined)).not.toBe(at(2.5));
    expect(at(2.5)).not.toBe(at(4));
  });
});

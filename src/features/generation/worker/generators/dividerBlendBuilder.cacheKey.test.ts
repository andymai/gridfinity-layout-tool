// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { dividerBlendFeature } from './dividerBlendBuilder';

// cacheKey is pure — no WASM init needed.
function keyFor(params: BinParams): string {
  const ctx = {
    params,
    dimensions: {
      shellKey: 'shell',
      innerW: 80,
      innerD: 40,
      wallHeight: 42,
      hasLip: true,
    },
  } as unknown as Parameters<typeof dividerBlendFeature.cacheKey>[0];
  return dividerBlendFeature.cacheKey(ctx);
}

describe('dividerBlendFeature.cacheKey', () => {
  // The junction clears the fillet's rounded corner, so the slider moves the cut.
  it('changes with the interior fillet radius', () => {
    const at = (interiorFilletMm: number | undefined): string =>
      keyFor({ ...DEFAULT_BIN_PARAMS, interiorFilletMm });
    expect(at(undefined)).not.toBe(at(2.5));
    expect(at(2.5)).not.toBe(at(4));
  });
});

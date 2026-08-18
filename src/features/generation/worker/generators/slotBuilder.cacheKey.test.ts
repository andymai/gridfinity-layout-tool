// @vitest-environment node
/**
 * Cache-staleness regression for slotted bins.
 *
 * A slot is sized to accept the divider piece that slides into it —
 * `slotWidth = dividerPieces.thickness + 2 * dividerPieces.clearance`. The
 * `slotCuts` key carried `slotConfig` (where the slots go) and `shellKey`
 * (the body), but neither of those mentions the piece, so dragging either
 * slider re-generated the bin and got the previous slot geometry back. The
 * divider pieces themselves are not feature-cached, so they DID grow — the
 * user printed thicker dividers and a bin still slotted for the old ones.
 *
 * Asserted against a cold generation of the same params rather than against
 * a restatement of the key: the failure is "the second design came back as
 * the first one", which only a warm cache can show.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { meshVolume } from './__kernel-tests__/meshAssertions';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

beforeEach(() => {
  clearAllCaches();
});

const SLOTTED: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 2,
  height: 4,
  style: 'slotted',
};

/**
 * Volume of `b` generated cold, and again with the caches warmed by `a` —
 * the two numbers a correct cache keeps equal.
 */
function coldAndWarm(a: BinParams, b: BinParams): { cold: number; warm: number; first: number } {
  const generateBin = getGenerateBin();
  clearAllCaches();
  const cold = meshVolume(generateBin(b));
  clearAllCaches();
  const first = meshVolume(generateBin(a));
  const warm = meshVolume(generateBin(b));
  return { cold, warm, first };
}

describe('slotCuts cache key', () => {
  it('re-cuts the slots when the divider gets thicker', () => {
    const { cold, warm, first } = coldAndWarm(SLOTTED, {
      ...SLOTTED,
      dividerPieces: { ...SLOTTED.dividerPieces, thickness: 2.4 },
    });

    // Guards against a vacuous pass: the edit has to move the geometry at all
    // before "the warm result matches the cold one" means anything.
    expect(cold, 'a thicker divider must widen the slots').not.toBeCloseTo(first, 3);
    expect(warm, 'a warm cache must not serve the previous slot width').toBeCloseTo(cold, 6);
  }, 90_000);

  it('re-cuts the slots when the divider clearance opens up', () => {
    const { cold, warm, first } = coldAndWarm(SLOTTED, {
      ...SLOTTED,
      dividerPieces: { ...SLOTTED.dividerPieces, clearance: 0.6 },
    });

    expect(cold, 'more clearance must widen the slots').not.toBeCloseTo(first, 3);
    expect(warm, 'a warm cache must not serve the previous slot clearance').toBeCloseTo(cold, 6);
  }, 90_000);

  it('shares a cache entry across divider heights, which no slot reads', () => {
    // The key carries the RESOLVED slot dimensions, not the whole
    // `dividerPieces` object — piece height is a property of the piece and
    // must not fragment the slot cache.
    const { cold, warm, first } = coldAndWarm(SLOTTED, {
      ...SLOTTED,
      dividerPieces: { ...SLOTTED.dividerPieces, height: 12 },
    });

    expect(first, 'divider height must not change the bin').toBeCloseTo(cold, 6);
    expect(warm).toBeCloseTo(cold, 6);
  }, 90_000);
});

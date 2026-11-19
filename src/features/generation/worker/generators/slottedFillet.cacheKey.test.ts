// @vitest-environment node
/**
 * Cache staleness for the interior fillet in a slotted bin. The fillet's
 * radius there depends on where the dividers stand, and the slot channel on
 * the radius, so an edit to either has to reach the fillet's key, the slot
 * cutter's key and, when a rounded rim bakes the fillet into the shell, the
 * shell's key. Asserted against a cold build of the same params: the failure
 * is the second design coming back as the first.
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
  interiorFilletMm: 12,
  slotConfig: {
    ...DEFAULT_BIN_PARAMS.slotConfig,
    x: { enabled: true, pitch: 40 },
    y: { enabled: false, pitch: 40 },
  },
};

function coldAndWarm(a: BinParams, b: BinParams): { cold: number; warm: number; first: number } {
  const generateBin = getGenerateBin();
  clearAllCaches();
  const cold = meshVolume(generateBin(b));
  clearAllCaches();
  const first = meshVolume(generateBin(a));
  const warm = meshVolume(generateBin(b));
  return { cold, warm, first };
}

const denser = (params: BinParams): BinParams => ({
  ...params,
  slotConfig: { ...params.slotConfig, x: { enabled: true, pitch: 10 } },
});

describe('slotted fillet cache keys', () => {
  it('rebuilds the fillet and its channels when the radius changes', () => {
    const { cold, warm, first } = coldAndWarm(
      { ...SLOTTED, interiorFilletMm: 2.5 },
      { ...SLOTTED, interiorFilletMm: 5 }
    );
    expect(cold).not.toBeCloseTo(first, 3);
    expect(warm).toBeCloseTo(cold, 6);
  }, 120_000);

  it('rebuilds the fillet when dividers move in close enough to hold it back', () => {
    const { cold, warm, first } = coldAndWarm(SLOTTED, denser(SLOTTED));
    expect(cold).not.toBeCloseTo(first, 3);
    expect(warm).toBeCloseTo(cold, 6);
  }, 120_000);

  it('rebuilds a fillet baked into a rounded rim when the dividers move', () => {
    const rimmed: BinParams = {
      ...SLOTTED,
      base: { ...SLOTTED.base, stackingLip: false, rimFillet: true },
    };
    const { cold, warm, first } = coldAndWarm(rimmed, denser(rimmed));
    expect(cold).not.toBeCloseTo(first, 3);
    expect(warm).toBeCloseTo(cold, 6);
  }, 120_000);

  it('recuts the channels when the floor groove goes off', () => {
    const { cold, warm, first } = coldAndWarm(SLOTTED, {
      ...SLOTTED,
      dividerPieces: { ...SLOTTED.dividerPieces, floorGroove: false },
    });
    expect(cold).not.toBeCloseTo(first, 3);
    expect(warm).toBeCloseTo(cold, 6);
  }, 120_000);
});

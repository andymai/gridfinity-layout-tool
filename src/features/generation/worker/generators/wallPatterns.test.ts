import { describe, it, expect } from 'vitest';
import { getSlotFreeWalls } from './wallPatterns';
import type { BinParams } from '@/shared/types/bin';

/** Minimal BinParams stub for testing wallPatterns functions. */
const BASE_PARAMS: BinParams = {
  width: 1,
  depth: 1,
  height: 3,
  gridUnitMm: 42,
  heightUnitMm: 7,
  wallThickness: 1.2,
  style: 'standard',
  slotConfig: {
    x: { enabled: false, pitch: 20 },
    y: { enabled: false, pitch: 20 },
  },
  base: { magnetHoles: false, screwHoles: false },
  lip: true,
  label: { enabled: false, width: 12, angle: 45, overhangAngle: 60 },
  compartments: { enabled: false, rows: 1, cols: 1, thickness: 1.2, cells: [true] },
  inserts: [],
  wallPattern: { enabled: false, pattern: 'honeycomb' as const },
  exportFileName: { template: 'gridfinity_{w}x{d}x{h}', separator: '_' },
} as BinParams;

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...BASE_PARAMS, ...overrides };
}

const DEFAULT_SLOT_CONFIG = BASE_PARAMS.slotConfig;

describe('getSlotFreeWalls', () => {
  it('returns all walls free for non-slotted bin', () => {
    const result = getSlotFreeWalls(makeParams({ style: 'standard' }));
    expect(result).toEqual({ front: true, back: true, left: true, right: true });
  });

  it('blocks left/right when x-axis slots enabled', () => {
    const result = getSlotFreeWalls(
      makeParams({
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_SLOT_CONFIG,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      })
    );
    expect(result).toEqual({ front: true, back: true, left: false, right: false });
  });

  it('blocks front/back when y-axis slots enabled', () => {
    const result = getSlotFreeWalls(
      makeParams({
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_SLOT_CONFIG,
          x: { enabled: false, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      })
    );
    expect(result).toEqual({ front: false, back: false, left: true, right: true });
  });

  it('blocks all walls when both axes have slots', () => {
    const result = getSlotFreeWalls(
      makeParams({
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_SLOT_CONFIG,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      })
    );
    expect(result).toEqual({ front: false, back: false, left: false, right: false });
  });
});

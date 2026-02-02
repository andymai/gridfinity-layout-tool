import { describe, it, expect, vi } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { getEffectiveSlotDimensions, buildSlotCuts } from './slotBuilder';

// Mock brepjs — slotBuilder imports it at module level.
// Vitest hoists vi.mock calls above imports automatically.
vi.mock('brepjs', () => ({
  drawRectangle: vi.fn(() => ({
    sketchOnPlane: vi.fn(() => ({
      extrude: vi.fn(() => ({
        translate: vi.fn(),
        fuse: vi.fn(() => ({ value: { translate: vi.fn(), fuse: vi.fn() } })),
      })),
    })),
  })),
  unwrap: vi.fn((result: unknown) =>
    result && typeof result === 'object' && 'value' in result
      ? (result as { value: unknown }).value
      : result
  ),
}));

function makeSlottedParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'slotted',
    ...overrides,
  };
}

describe('getEffectiveSlotDimensions', () => {
  it('delegates to shared slotMath with params extracted', () => {
    const params = makeSlottedParams({
      wallThickness: 0.95,
      dividerPieces: { thickness: 1.2, clearance: 0.1, height: 'auto' },
    });
    const result = getEffectiveSlotDimensions(params);
    expect(result.slotWidth).toBeCloseTo(1.4);
    expect(result.slotDepth).toBe(0.5);
  });
});

describe('buildSlotCuts', () => {
  it('returns null for non-slotted style', () => {
    const params = makeSlottedParams({ style: 'standard' });
    expect(buildSlotCuts(params, 80, 80, 30)).toBeNull();
  });

  it('returns null when no axes are enabled', () => {
    const params = makeSlottedParams({
      slotConfig: {
        x: { enabled: false, pitch: 40 },
        y: { enabled: false, pitch: 40 },
      },
    });
    expect(buildSlotCuts(params, 80, 80, 30)).toBeNull();
  });
});

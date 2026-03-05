import { describe, it, expect, vi } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { buildDividerPiece, buildUniqueDividerPieces } from './dividerBuilder';

// Mock brepjs — dividerBuilder imports it at module level.
// Vitest hoists vi.mock calls above imports automatically.
vi.mock('brepjs', () => {
  const mockShape = {};
  const mockTranslate = vi.fn(() => mockShape);
  return {
    box: vi.fn(() => mockShape),
    translate: mockTranslate,
  };
});

function makeSlottedParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'slotted',
    ...overrides,
  };
}

describe('buildDividerPiece', () => {
  it('creates a divider piece with correct dimensions', () => {
    const result = buildDividerPiece(80, 1.2, 20);
    expect(result).toBeDefined();
  });
});

describe('buildUniqueDividerPieces', () => {
  it('returns empty for non-slotted style', () => {
    const params = makeSlottedParams({ style: 'standard' });
    expect(buildUniqueDividerPieces(params, 80, 80, 30, false)).toEqual([]);
  });

  it('returns one piece when only X-axis is enabled', () => {
    const params = makeSlottedParams({
      slotConfig: {
        x: { enabled: true, pitch: 40 },
        y: { enabled: false, pitch: 40 },
      },
    });
    const pieces = buildUniqueDividerPieces(params, 80, 80, 30, false);
    expect(pieces).toHaveLength(1);
  });

  it('returns two pieces when both axes are enabled', () => {
    const params = makeSlottedParams({
      slotConfig: {
        x: { enabled: true, pitch: 40 },
        y: { enabled: true, pitch: 40 },
      },
    });
    const pieces = buildUniqueDividerPieces(params, 80, 80, 30, false);
    expect(pieces).toHaveLength(2);
  });
});

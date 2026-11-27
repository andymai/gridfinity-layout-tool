import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import { compartmentCount, featureScore, hasLabelText, isBinParams } from './designFeatures';

function withCompartments(rows: number, cols: number, cells: number[]): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, rows, cols, cells },
  };
}

describe('isBinParams', () => {
  it('accepts stored bin params and rejects other item kinds', () => {
    expect(isBinParams(DEFAULT_BIN_PARAMS)).toBe(true);
    expect(isBinParams(undefined)).toBe(false);
    expect(isBinParams({ width: 1 })).toBe(false);
  });
});

describe('compartmentCount', () => {
  it('counts merged cells once', () => {
    expect(compartmentCount(withCompartments(2, 2, [0, 0, 1, 2]))).toBe(3);
  });

  it('falls back to the grid size when cells are empty', () => {
    expect(compartmentCount(withCompartments(2, 3, []))).toBe(6);
  });
});

describe('hasLabelText', () => {
  it('sees compartment text only on label tabs, where the generator engraves it', () => {
    const base = withCompartments(1, 2, [0, 1]);
    const texted = {
      ...base,
      compartments: { ...base.compartments, compartmentTexts: ['', 'M3'] },
    };
    expect(hasLabelText(base)).toBe(false);
    expect(hasLabelText({ ...texted, label: { ...texted.label, enabled: false } })).toBe(false);
    expect(hasLabelText({ ...texted, label: { ...texted.label, enabled: true } })).toBe(true);
  });

  it('sees surface text', () => {
    expect(hasLabelText({ ...DEFAULT_BIN_PARAMS, surfaceText: { floorText: 'Bits' } })).toBe(true);
  });
});

describe('featureScore', () => {
  it('ranks a patterned wall above a plain one', () => {
    const plain = featureScore(DEFAULT_BIN_PARAMS);
    const patterned = featureScore({
      ...DEFAULT_BIN_PARAMS,
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
    });
    expect(patterned).toBeGreaterThan(plain);
  });
});

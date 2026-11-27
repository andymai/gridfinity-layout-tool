import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
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

  it('reads row text when label tabs span rows', () => {
    const spanning = {
      ...DEFAULT_BIN_PARAMS,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, span: true, rowTexts: ['Screws'] },
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, compartmentTexts: [] },
    };
    expect(hasLabelText(spanning)).toBe(true);
    expect(
      hasLabelText({
        ...spanning,
        label: { ...spanning.label, rowTexts: [] },
        compartments: { ...spanning.compartments, compartmentTexts: ['Hidden'] },
      })
    ).toBe(false);
  });

  it('follows the socket plate fit, not which list has text', () => {
    const socket = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket' as const, depth: 14 },
    };
    const fitting = {
      ...socket,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 1, rows: 1, cells: [0] },
      label: { ...socket.label, rowTexts: ['stale'] },
    };
    expect(hasLabelText(fitting)).toBe(false);
    const spanning = {
      ...socket,
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 4,
        rows: 1,
        cells: [0, 1, 2, 3],
        compartmentTexts: ['hidden'],
      },
      label: { ...socket.label, rowTexts: ['Drill bits'] },
    };
    expect(hasLabelText(spanning)).toBe(true);
  });

  it('reads lid text only on an enabled lid', () => {
    const withLidText = { ...DEFAULT_BIN_PARAMS, surfaceText: { lidText: 'Bits' } };
    expect(
      hasLabelText({ ...withLidText, lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: false } })
    ).toBe(false);
    expect(
      hasLabelText({ ...withLidText, lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } })
    ).toBe(true);
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

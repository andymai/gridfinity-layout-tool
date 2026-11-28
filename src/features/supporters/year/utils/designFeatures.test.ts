import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { compartmentCount, designWork, hasLabelText, isBinParams } from './designFeatures';

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

describe('designWork', () => {
  const patterned = {
    ...DEFAULT_BIN_PARAMS,
    wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true },
  };

  it('counts a wall pattern as one feature, like a scoop', () => {
    const scooped = {
      ...DEFAULT_BIN_PARAMS,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    };
    expect(designWork(patterned)).toBe(designWork(scooped));
  });

  it('ranks a design with more built into it above a patterned plain bin', () => {
    const worked = {
      ...DEFAULT_BIN_PARAMS,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, rows: 2, cols: 3, cells: [] },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
    };
    expect(designWork(worked)).toBeGreaterThan(designWork(patterned));
  });

  it('counts cutouts through an enabled lid like cutouts in the bin', () => {
    const lid = { ...DEFAULT_BIN_PARAMS.lid, enabled: true, cutouts: [] };
    const slot = {} as NonNullable<typeof lid.cutouts>[number];
    const plain = designWork({ ...DEFAULT_BIN_PARAMS, lid });
    const slotted = designWork({
      ...DEFAULT_BIN_PARAMS,
      lid: { ...lid, cutouts: [slot, slot, slot] },
    });
    expect(slotted - plain).toBe(6);
  });

  it('caps a large compartment grid, which is one preset', () => {
    const grid = (rows: number, cols: number) => ({
      ...DEFAULT_BIN_PARAMS,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, rows, cols, cells: [] },
    });
    expect(designWork(grid(10, 10))).toBe(designWork(grid(4, 4)));
  });
});

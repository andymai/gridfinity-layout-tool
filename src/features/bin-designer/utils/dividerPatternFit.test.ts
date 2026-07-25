import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { assessDividerPatternFit } from './dividerPatternFit';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 3,
    height: 6,
    wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
    compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    ...overrides,
  };
}

describe('assessDividerPatternFit', () => {
  it('reports a full fit on a roomy multi-compartment bin', () => {
    expect(assessDividerPatternFit(makeParams())).toBe('full');
  });

  it('is unavailable until both the pattern and the option are on', () => {
    expect(
      assessDividerPatternFit(
        makeParams({ wallPattern: { enabled: true, pattern: 'honeycomb', dividers: false } })
      )
    ).toBe('unavailable');
    expect(
      assessDividerPatternFit(
        makeParams({ wallPattern: { enabled: false, pattern: 'honeycomb', dividers: true } })
      )
    ).toBe('unavailable');
  });

  it('is unavailable with no dividers to pattern', () => {
    expect(
      assessDividerPatternFit(makeParams({ compartments: DEFAULT_BIN_PARAMS.compartments }))
    ).toBe('unavailable');
  });

  it('is unavailable on slotted and solid bins', () => {
    expect(assessDividerPatternFit(makeParams({ style: 'slotted' }))).toBe('unavailable');
    expect(
      assessDividerPatternFit(makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, solid: true } }))
    ).toBe('unavailable');
  });

  it('reports none when the dividers are too short for a band', () => {
    expect(
      assessDividerPatternFit(
        makeParams({
          compartments: {
            cols: 2,
            rows: 2,
            cells: [0, 1, 2, 3],
            thickness: 1.2,
            dividerHeight: 4,
          },
        })
      )
    ).toBe('none');
  });

  it('reports none when a short bin leaves no band at all', () => {
    expect(assessDividerPatternFit(makeParams({ height: 1 }))).toBe('none');
  });

  it('reports partial when the long dividers fit but the short ones do not', () => {
    // 1 wide x 2 deep on an 8x2 grid. One compartment fills columns 0-6 across
    // both rows, and the last column is split in two. That leaves a column
    // divider spanning the full ~81mm depth (fits) and a row divider spanning a
    // single ~4.9mm cell (too short for a hex plus its junction margins).
    const params = makeParams({
      width: 1,
      depth: 2,
      compartments: {
        cols: 8,
        rows: 2,
        cells: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2],
        thickness: 1.2,
      },
    });
    expect(assessDividerPatternFit(params)).toBe('partial');
  });

  it('does not report partial when every divider has the same room', () => {
    const params = makeParams({
      width: 4,
      depth: 4,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
    });
    expect(assessDividerPatternFit(params)).toBe('full');
  });

  it('scales with the pattern: a bolder scale needs more room', () => {
    const fine = makeParams({
      width: 1,
      depth: 2,
      compartments: { cols: 1, rows: 2, cells: [0, 1], thickness: 1.2 },
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true, scale: 0 },
    });
    const bold: BinParams = {
      ...fine,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true, scale: 1 },
    };
    const order = { unavailable: -1, none: 0, partial: 1, full: 2 } as const;
    expect(order[assessDividerPatternFit(bold)]).toBeLessThanOrEqual(
      order[assessDividerPatternFit(fine)]
    );
  });
});

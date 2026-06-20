import { describe, it, expect } from 'vitest';
import { collectDividers } from './dividerBlendResolvers';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, DividerOverride } from '@/features/bin-designer/types';

const INNER_W = 80;
const INNER_D = 80;

function makeParams(
  compartments: Partial<BinParams['compartments']>,
  overrides?: DividerOverride[]
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      ...compartments,
      ...(overrides ? { dividerOverrides: overrides } : {}),
    },
  };
}

describe('collectDividers tilt handling', () => {
  it('collects a straight divider', () => {
    const dividers = collectDividers(
      makeParams({ cols: 1, rows: 2, cells: [0, 1] }),
      INNER_W,
      INNER_D
    );
    expect(dividers).toHaveLength(1);
    expect(dividers[0].axis).toBe('horizontal');
  });

  it('skips a tilted divider (blends degrade gracefully on tilt)', () => {
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 10,
      offsetEnd: -10,
    };
    const dividers = collectDividers(
      makeParams({ cols: 1, rows: 2, cells: [0, 1] }, [override]),
      INNER_W,
      INNER_D
    );
    expect(dividers).toEqual([]);
  });

  it('keeps straight dividers while skipping only the tilted pair', () => {
    // 1×3 stack: boundaries 0|1 and 1|2. Tilt only 0|1.
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 8,
      offsetEnd: -8,
    };
    const dividers = collectDividers(
      makeParams({ cols: 1, rows: 3, cells: [0, 1, 2] }, [override]),
      INNER_W,
      INNER_D
    );
    expect(dividers).toHaveLength(1); // only the straight 1|2 divider survives
  });
});

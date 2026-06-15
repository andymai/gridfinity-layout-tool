import { describe, it, expect } from 'vitest';
import { computeBaseplateTiling } from './splitPlanner';
import { buildFullParams } from './buildFullParams';
import { stackGroupsFromTiling, planPhysicalStacks } from './stackPrint';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import type { BaseplateParams as CoreBaseplateParams } from '@/core/types';

/** Resolve groups + physical stacks for a drawer split on a given bed. */
function plan(stored: CoreBaseplateParams, units: number, bedMm: number) {
  const full = buildFullParams(stored, units, units, 42, 'end', 'end');
  const tiling = computeBaseplateTiling(full, bedMm);
  const groups = stackGroupsFromTiling(tiling, full);
  return { tiling, groups, towers: planPhysicalStacks(groups, 1) };
}

const stacking: CoreBaseplateParams = {
  ...DEFAULT_BASEPLATE_PARAMS,
  stackPrint: { enabled: true, sets: 1, gapMm: 0.2 as never, mode: 'airGap' },
};

describe('stack-print grouping', () => {
  it('dedupes an evenly-tiled drawer into one stackable group (16×16 @ 180mm)', () => {
    // 16/4 = 4 → sixteen identical 4×4 tiles. Stacking strips connectors,
    // magnets, and rounding, so all 16 tiles are byte-identical and dedupe.
    const { tiling, groups, towers } = plan(stacking, 16, 180);
    expect(tiling.pieces).toHaveLength(16);
    expect(groups).toHaveLength(1);
    expect(groups[0].quantity).toBe(16);
    // 16 copies capped at 8 per tower → two towers of 8.
    expect(towers.map((t) => t.copies)).toEqual([8, 8]);
  });

  it('does not over-merge a default (non-stacking) split — edges still distinguish pieces', () => {
    const { groups } = plan(DEFAULT_BASEPLATE_PARAMS, 16, 180);
    expect(groups.length).toBeGreaterThan(1);
  });

  it('leaves genuinely-unique pieces unmerged (14×14 @ 180mm has uneven tiles)', () => {
    // 14 = 4+4+3+3 → tiles of different sizes, so they can't all stack.
    const { groups, towers } = plan(stacking, 14, 180);
    expect(groups.length).toBeGreaterThan(1);
    expect(towers.length).toBeGreaterThan(1);
  });
});

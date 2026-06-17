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
  return { tiling, groups, towers: planPhysicalStacks(groups) };
}

const stacking: CoreBaseplateParams = {
  ...DEFAULT_BASEPLATE_PARAMS,
  stackPrint: { enabled: true, gapMm: 0.2 as never },
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

  it('retains dovetail connectors while stacking; preferIdenticalPieces shrinks the group count', () => {
    const connectored: CoreBaseplateParams = {
      ...DEFAULT_BASEPLATE_PARAMS,
      connectorNubs: true, // dovetail (default style) — kept while stacking now
      stackPrint: { enabled: true, gapMm: 0.2 as never },
    };
    // Connectors are no longer stripped, so edge position distinguishes
    // interior/edge/corner tiles → more than one group (unlike the connector-free
    // stack above, which dedupes to one).
    const plain = plan(connectored, 16, 180);
    expect(plain.groups.length).toBeGreaterThan(1);

    // preferIdenticalPieces folds opposite-corner tiles together → fewer groups,
    // recovering most of the dedup the bare stack would have had.
    const paired = plan({ ...connectored, preferIdenticalPieces: true }, 16, 180);
    expect(paired.groups.length).toBeLessThan(plain.groups.length);

    // Every tile is still printed exactly once regardless of grouping.
    const total = paired.groups.reduce((s, g) => s + g.quantity, 0);
    expect(total).toBe(paired.tiling.pieces.length);
    expect(paired.towers.reduce((s, t) => s + t.copies, 0)).toBe(total);
  });

  it('leaves genuinely-unique pieces unmerged (14×14 @ 180mm has uneven tiles)', () => {
    // 14 = 4+4+3+3 → tiles of different sizes, so they can't all stack.
    const { groups, towers } = plan(stacking, 14, 180);
    expect(groups.length).toBeGreaterThan(1);
    expect(towers.length).toBeGreaterThan(1);
  });

  // 180mm bed / 42mm grid → max 4-unit tiles. Square drawers divisible by 4
  // tile evenly into identical pieces (dedupe to 1 group when stacking); others
  // split unevenly and stay multi-group.
  describe('drawer × bed dedup matrix (stacking)', () => {
    const evenCases = [
      { units: 4, bed: 180, split: false }, // fits the bed, single plate
      { units: 8, bed: 180, split: true },
      { units: 12, bed: 180, split: true },
      { units: 16, bed: 180, split: true },
    ];
    it.each(evenCases)('$units×$units @ $bedmm → one stackable group', ({ units, bed, split }) => {
      const { tiling, groups, towers } = plan(stacking, units, bed);
      expect(tiling.isSplit).toBe(split);
      expect(groups).toHaveLength(1);
      // All pieces are identical, so every printed copy belongs to that group.
      expect(groups[0].quantity).toBe(tiling.pieces.length);
      expect(towers.reduce((s, t) => s + t.copies, 0)).toBe(tiling.pieces.length);
    });

    const unevenCases = [
      { units: 14, bed: 180 }, // 4+4+3+3
      { units: 10, bed: 180 }, // 4+3+3
      { units: 16, bed: 256 }, // 6+6+4
    ];
    it.each(unevenCases)('$units×$units @ $bedmm → stays multi-group', ({ units, bed }) => {
      const { groups, towers } = plan(stacking, units, bed);
      expect(groups.length).toBeGreaterThan(1);
      // No copies are lost or duplicated regardless of grouping.
      const totalPieces = groups.reduce((s, g) => s + g.quantity, 0);
      expect(towers.reduce((s, t) => s + t.copies, 0)).toBe(totalPieces);
    });
  });
});

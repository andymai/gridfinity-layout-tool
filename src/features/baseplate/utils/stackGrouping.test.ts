import { describe, it, expect } from 'vitest';
import { computeBaseplateTiling } from './splitPlanner';
import { buildFullParams } from './buildFullParams';
import { stackGroupsFromTiling, planPhysicalStacks, planStackPrint } from './stackPrint';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { mm, type StoredBaseplateParams } from '@/core/types';

/** Resolve groups + physical stacks for a drawer split on a given bed. */
function plan(stored: StoredBaseplateParams, units: number, bedMm: number) {
  const full = buildFullParams(stored, units, units, 42, 'end', 'end');
  const tiling = computeBaseplateTiling(full, bedMm);
  const groups = stackGroupsFromTiling(tiling, full);
  return { tiling, groups, towers: planPhysicalStacks(groups) };
}

const stacking: StoredBaseplateParams = {
  ...DEFAULT_BASEPLATE_PARAMS,
  stackPrint: { enabled: true, gapMm: 0.2 as never },
};

describe('stack-print grouping', () => {
  it('mixes uneven tiles from one eco baseplate, largest first and within the height cap', () => {
    const stored: StoredBaseplateParams = {
      ...stacking,
      ecoPlate: true,
      stackPrint: { enabled: true, gapMm: 0.2 as never, mixedSizes: true },
    };
    const full = buildFullParams(stored, 14, 14, 42, 'end', 'end');
    const tiling = computeBaseplateTiling(full, 180);
    const plan = planStackPrint(tiling, full, 1, 8, true);
    const wholeProject = planStackPrint(tiling, full, 1, 32, true);
    const old = planStackPrint(tiling, full, 1, 8, false);
    expect(full.ecoPlate).toBe(true);
    expect(tiling.isSplit).toBe(true);
    expect(plan.length).toBeLessThan(old.length);
    expect(plan.reduce((sum, tower) => sum + tower.copies, 0)).toBe(tiling.pieces.length);
    expect(wholeProject).toHaveLength(1);
    expect(wholeProject[0].copies).toBe(tiling.pieces.length);
    expect(
      wholeProject[0].layers?.some((layer) => layer.rotationDeg === 90 || layer.rotationDeg === 270)
    ).toBe(true);
    const byLabel = new Map(tiling.pieces.map((piece) => [piece.label, piece]));
    for (const tower of plan) {
      expect(tower.copies).toBeLessThanOrEqual(8);
      const layers = tower.layers ?? [];
      expect(layers).toHaveLength(tower.copies);
      for (let i = 1; i < layers.length; i++) {
        const bottom = byLabel.get(layers[0].sourceLabel)!;
        const prior = byLabel.get(layers[i - 1].sourceLabel)!;
        const current = byLabel.get(layers[i].sourceLabel)!;
        const priorTurned = layers[i - 1].rotationDeg === 90 || layers[i - 1].rotationDeg === 270;
        const currentTurned = layers[i].rotationDeg === 90 || layers[i].rotationDeg === 270;
        const priorWidth = priorTurned ? prior.depthUnits : prior.widthUnits;
        const priorDepth = priorTurned ? prior.widthUnits : prior.depthUnits;
        const currentWidth = currentTurned ? current.depthUnits : current.widthUnits;
        const currentDepth = currentTurned ? current.widthUnits : current.depthUnits;
        expect(currentWidth).toBeLessThanOrEqual(priorWidth);
        expect(currentDepth).toBeLessThanOrEqual(priorDepth);
        expect(layers[i].dxMm).toBeCloseTo((currentWidth - bottom.widthUnits) * 21);
        expect(layers[i].dyMm).toBeCloseTo((currentDepth - bottom.depthUnits) * 21);
      }
    }
    expect(plan.some((tower) => new Set(tower.layers?.map((l) => l.sourceLabel)).size > 1)).toBe(
      true
    );
  });

  it('puts four different connector-bearing parts of one drawer into one print tower', () => {
    const stored: StoredBaseplateParams = {
      ...stacking,
      connectorNubs: true,
      overTile: true,
      paddingLeft: mm(10),
      paddingRight: mm(10),
      paddingFront: mm(10),
      paddingBack: mm(10),
      stackPrint: { enabled: true, gapMm: 0.2 as never, mixedSizes: true },
    };
    const full = buildFullParams(stored, 8, 8, 42, 'end', 'end');
    const tiling = computeBaseplateTiling(full, 180);
    const plan = planStackPrint(tiling, full, 1, 8, true);
    expect(tiling.pieces).toHaveLength(4);
    expect(stackGroupsFromTiling(tiling, full)).toHaveLength(4);
    expect(plan).toHaveLength(1);
    expect(plan[0].copies).toBe(4);
    expect(new Set(plan[0].layers?.map((layer) => layer.pieceLabel))).toEqual(
      new Set(tiling.pieces.map((piece) => piece.label))
    );
    expect(new Set(plan[0].layers?.map((layer) => layer.sourceLabel)).size).toBe(4);
  });

  it('turns an upper margin onto the lower margin instead of open pockets', () => {
    const stored: StoredBaseplateParams = {
      ...stacking,
      paddingLeft: mm(10),
      paddingRight: mm(10),
      stackPrint: { enabled: true, gapMm: 0.2 as never, mixedSizes: true },
    };
    const full = buildFullParams(stored, 7, 4, 42, 'end', 'end');
    const tiling = computeBaseplateTiling(full, 180);
    const stacks = planStackPrint(tiling, full, 1, 8, true);

    expect(
      tiling.pieces.map((piece) => [piece.widthUnits, piece.paddingLeft, piece.paddingRight])
    ).toEqual([
      [4, 10, 0],
      [3, 0, 10],
    ]);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].layers?.[1]).toMatchObject({ flipAxis: 'y', dxMm: -21 });
  });

  it('stacks the distinct Eco Plate tiles of a 523 by 325 mm drawer with a tiled back margin', () => {
    const stored: StoredBaseplateParams = {
      ...stacking,
      ecoPlate: true,
      overTile: true,
      connectorNubs: true,
      paddingLeft: mm(10),
      paddingRight: mm(9),
      paddingBack: mm(31),
      stackPrint: { enabled: true, gapMm: 0.2 as never, mixedSizes: true },
    };
    const full = buildFullParams(stored, 12, 7, 42, 'end', 'end');
    const tiling = computeBaseplateTiling(full, 180);
    const plan = planStackPrint(tiling, full, 1, 32, true);
    expect(tiling.isSplit).toBe(true);
    expect(tiling.pieces).toHaveLength(6);
    expect(plan.map((tower) => tower.copies)).toEqual([4, 2]);
    expect(
      new Set(plan.flatMap((tower) => tower.layers?.map((layer) => layer.pieceLabel) ?? []))
    ).toEqual(new Set(tiling.pieces.map((piece) => piece.label)));
  });
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
    const connectored: StoredBaseplateParams = {
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

/**
 * Low-profile base scenarios.
 *
 * The low profile shortens every foot the socket builders make, so it has to
 * build cleanly under each of them: integral feet with and without hardware,
 * both lightweight modes, half feet, separate feet, the floorless spacer and
 * the base-only plate. Each exports watertight, and the integral-foot bins at
 * the standard total height, which is the whole point of the mode: the interior
 * gains what the feet lose.
 * How the parts MATE is measured in `lowProfileBase.kernel.test`.
 */
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BaseConfig } from '@/shared/types/bin';
import { assertWatertight, boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { CLEARANCE, LIP_HEIGHT } from '../generatorConstants';

const OVERHANG_MM = 10;

const low = (base: Partial<BaseConfig> = {}): BaseConfig => ({
  ...DEFAULT_BIN_PARAMS.base,
  lowProfile: true,
  ...base,
});

const variants: Array<{ label: string; base: Partial<BaseConfig> }> = [
  { label: 'standard', base: {} },
  { label: 'magnet', base: { style: 'magnet' } },
  { label: 'magnet+screw', base: { style: 'magnet_and_screw' } },
  { label: 'lightweight interior with magnets', base: { style: 'magnet', lightweight: true } },
  {
    label: 'lightweight underside',
    base: { lightweight: true, lightweightMode: 'underside' },
  },
  { label: 'half sockets', base: { halfSockets: true } },
];

export const lowProfile: ScenarioCase[] = [
  ...variants.map(({ label, base }) =>
    defineScenario('low profile', `${label} 2x2`, {
      assert: 'structural',
      forExport: true,
      params: { width: 2, depth: 2, height: 3, base: low(base) },
      customAssert: (result, params) => {
        assertWatertight(result, label);
        const bb = boundingBox(result.vertices);
        const expected = params.height * params.heightUnitMm + LIP_HEIGHT;
        if (Math.abs(bb.maxZ - bb.minZ - expected) > 0.05) {
          throw new Error(`${label}: total height ${bb.maxZ - bb.minZ}, expected ${expected}`);
        }
      },
    })
  ),
  defineScenario('low profile', 'spacer 2x2', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 2, base: low({ spacer: true }) },
    customAssert: (result) => assertWatertight(result, 'spacer'),
  }),
  defineScenario('low profile', 'base-only 2x2', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: low({ tile: true }) },
    customAssert: (result) => assertWatertight(result, 'base-only'),
  }),
  defineScenario('low profile', 'right overhang 1x3', {
    assert: 'structural',
    forExport: true,
    params: {
      width: 1,
      depth: 3,
      height: 6,
      base: low(),
      overhang: { left: 0, right: OVERHANG_MM, front: 0, back: 0, feet: false },
    },
    customAssert: (result, params) => {
      assertWatertight(result, 'right overhang');
      // Underside height across the grid edge, outward from the foot's top edge
      // to the overhang's wall. It may rise but never drop: a drop is a slot
      // the overhang hangs below, and that lower face is what the crest beside
      // the pocket catches in a standard plate.
      const gridEdge = (params.width * params.gridUnitMm) / 2;
      const footEdge = gridEdge - CLEARANCE / 2;
      const xs = [
        footEdge + 0.05,
        gridEdge - 0.05,
        gridEdge + 0.05,
        gridEdge + OVERHANG_MM / 2,
        footEdge + OVERHANG_MM - 0.05,
      ];
      const undersides = xs.map((x) => {
        const z = columnCrossings(result, x, 0).at(0);
        if (z === undefined || !Number.isFinite(z)) {
          throw new Error(`right overhang: no underside at x=${x.toFixed(2)}`);
        }
        return z;
      });
      for (let i = 1; i < undersides.length; i++) {
        if (undersides[i] < undersides[i - 1] - 0.01) {
          throw new Error(
            `right overhang: underside drops ${(undersides[i - 1] - undersides[i]).toFixed(3)}mm ` +
              `between x=${xs[i - 1].toFixed(2)} and x=${xs[i].toFixed(2)} (${undersides.map((z) => z.toFixed(3)).join(', ')})`
          );
        }
      }
    },
  }),
  defineScenario('low profile', 'right overhang with feet 1x2', {
    assert: 'structural',
    forExport: true,
    params: {
      width: 1,
      depth: 2,
      height: 3,
      base: low(),
      overhang: { left: 0, right: 14, front: 0, back: 0, feet: true },
    },
    customAssert: (result) => assertWatertight(result, 'right overhang with feet'),
  }),
  defineScenario('low profile', 'detachable feet 2x1', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 1, height: 3, base: low({ feet: 'detachable' }) },
    customAssert: (result) => assertWatertight(result, 'detachable feet'),
  }),
];

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
import { assertWatertight, boundingBox } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { LIP_HEIGHT } from '../generatorConstants';

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
  defineScenario('low profile', 'detachable feet 2x1', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 1, height: 3, base: low({ feet: 'detachable' }) },
    customAssert: (result) => assertWatertight(result, 'detachable feet'),
  }),
];

import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_LID_SLIDE_CONFIG, type LidSlideConfig } from '@/shared/types/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const lid = (slide: Partial<LidSlideConfig> = {}) => ({
  ...DEFAULT_BIN_PARAMS.lid,
  enabled: true,
  attachment: 'slide' as const,
  relieveInterior: true,
  slide: { ...DEFAULT_LID_SLIDE_CONFIG, ...slide },
});

const noLip = { ...DEFAULT_BIN_PARAMS.base, stackingLip: false };

export const slideLid: ScenarioCase[] = [
  defineScenario('sliding lid', 'recessed on a lipped bin', {
    assert: 'structural',
    params: { width: 3, depth: 2, height: 6, lid: lid() },
  }),
  defineScenario('sliding lid', 'recessed on a lipless bin', {
    assert: 'structural',
    params: { width: 3, depth: 2, height: 6, base: noLip, lid: lid() },
  }),
  defineScenario('sliding lid', 'flush on a lipless bin', {
    assert: 'structural',
    params: { width: 3, depth: 2, height: 6, base: noLip, lid: lid({ placement: 'flush' }) },
  }),
  defineScenario('sliding lid', 'entering through a side wall', {
    assert: 'structural',
    params: { width: 2, depth: 3, height: 5, lid: lid({ entrySide: 'left' }) },
  }),
  defineScenario('sliding lid', 'thin wall lined out to the channel', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 4, wallThickness: 0.8, lid: lid() },
  }),
  defineScenario('sliding lid', 'thick wall with a finger catch', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 4, wallThickness: 2.6, lid: lid({ pull: 'catch' }) },
  }),
  defineScenario('sliding lid', 'over compartments', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 6,
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      lid: lid({ pull: 'tab' }),
    },
  }),
  defineScenario('sliding lid', 'on a solid bin with a pocket', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 2,
      height: 5,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [makeCutout({ shape: 'circle', x: 5, y: 25, width: 20, depth: 20, cutDepth: 10 })],
      // The shallowest fill the channel clears, per `slideLidFillOffsetMm`.
      cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig, topOffset: 8.5 },
      lid: lid({ detent: false }),
    },
  }),
];

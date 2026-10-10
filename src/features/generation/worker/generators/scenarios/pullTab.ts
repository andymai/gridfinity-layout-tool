import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_PULL_TAB } from '@/shared/utils/pullTabPlan';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';

/** Both wall orientations exercise the raised body and both recess cutters. */
export const pullTab = [
  defineScenario('Pull tabs', 'width wall with mirrored finger recess', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 3,
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      pullTab: { ...DEFAULT_PULL_TAB, enabled: true, backRecess: true },
    },
  }),
  defineScenario('Pull tabs', 'percentage width on depth wall with mirrored recess', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      pullTab: {
        ...DEFAULT_PULL_TAB,
        enabled: true,
        backRecess: true,
        wall: 'depth',
        widthMode: 'percent',
        widthPercent: 80,
        recessHeight: 18,
      },
    },
  }),
];

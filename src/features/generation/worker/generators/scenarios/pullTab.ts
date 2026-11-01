import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_PULL_TAB, pullTabWallFields } from '@/shared/utils/pullTabPlan';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';

/**
 * Both wall orientations exercise the raised body and both recess cutters.
 * The opposite-walls case leads so the cache-key sweep, which takes the first
 * scenarios that build a feature, reads `walls`.
 */
export const pullTab = [
  defineScenario('Pull tabs', 'opposite walls with mirrored recesses and dividers', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 3,
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 1, 2, 3] },
      pullTab: {
        ...DEFAULT_PULL_TAB,
        ...pullTabWallFields(['front', 'back']),
        enabled: true,
        backRecess: true,
      },
    },
  }),
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
  defineScenario('Pull tabs', 'all four walls at a percent width', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      pullTab: {
        ...DEFAULT_PULL_TAB,
        ...pullTabWallFields(['front', 'back', 'left', 'right']),
        enabled: true,
        widthMode: 'percent',
        widthPercent: 60,
      },
    },
  }),
  defineScenario('Pull tabs', 'adjacent walls with a stacking lip at half-grid width', {
    assert: 'structural',
    params: {
      width: 2.5,
      depth: 2,
      height: 6,
      pullTab: { ...DEFAULT_PULL_TAB, ...pullTabWallFields(['back', 'left']), enabled: true },
    },
  }),
];

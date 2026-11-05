/**
 * A label tab held below the interior ceiling, under an interior fillet that
 * climbs to it. The corner stops level with the tab instead of standing proud.
 */

import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { LABEL_SOCKET_STACK_RELIEF_MM } from '@/shared/constants/labelPlates';
import {
  assertCornerLevelWithTab,
  assertShelfLevelAcrossTab,
} from '../__kernel-tests__/labelSocketClearance';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const labelTabFillet: ScenarioCase[] = [
  defineScenario('label tab fillet', 'lipped left-aligned tab stays level across a 10mm fillet', {
    params: {
      width: 2,
      depth: 2,
      height: 10,
      wallThickness: 2.4,
      interiorFilletMm: 10,
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        mode: 'socket' as const,
        depth: 14,
        width: 50,
        alignment: 'left' as const,
      },
    },
    customAssert: (result, params) =>
      assertShelfLevelAcrossTab(result, params, {
        sunkMm: LABEL_SOCKET_STACK_RELIEF_MM,
        label: 'lipped-left-fillet-10',
      }),
  }),

  // The rim's fuse takes the fillet into the shell, a different path to the same
  // trim: a text tab sinks to make room for its rim, and the corner stops with it.
  defineScenario(
    'label tab fillet',
    'rim-rounded bin keeps a text tab level across a 10mm fillet',
    {
      params: {
        width: 2,
        depth: 2,
        height: 6,
        wallThickness: 2.4,
        interiorFilletMm: 10,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false, rimFillet: true },
        label: {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          depth: 14,
          width: 50,
          alignment: 'left' as const,
          lip: true,
          lipHeight: 1,
        },
      },
      customAssert: (result, params) => assertCornerLevelWithTab(result, params, 'rim-shell-text'),
    }
  ),
];

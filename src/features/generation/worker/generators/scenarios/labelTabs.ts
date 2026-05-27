import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

export const labelTabs: ScenarioCase[] = [
  defineScenario('label tabs', '2\u00d72 label disabled', {
    params: {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: false, support: 'bracket', alignment: 'left' },
    },
  }),
  defineScenario('label tabs', '2\u00d72 label bracket left', {
    params: {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket', alignment: 'left' },
    },
  }),
  defineScenario('label tabs', '2\u00d72 label solid left', {
    params: {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid', alignment: 'left' },
    },
  }),
  defineScenario('label tabs', '2\u00d72 label bracket center', {
    params: {
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'center',
      },
    },
  }),
  defineScenario('label tabs', '2\u00d72 label bracket right', {
    params: {
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket', alignment: 'right' },
    },
  }),
  // Tall bin (6u \u2192 wallHeight \u2248 37mm) so the explicit `height: 20mm` lands
  // well below the wall top, exercising the dropped-shelf path from #1898.
  defineScenario('label tabs', '2\u00d72\u00d76 label dropped (height = 20mm)', {
    params: {
      height: 6,
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'left',
        height: 20,
      },
    },
  }),
];

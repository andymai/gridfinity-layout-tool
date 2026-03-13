import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { defineScenario } from '../__dual-kernel__/scenarioTypes';
import type { ScenarioCase } from '../__dual-kernel__/scenarioTypes';

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
];

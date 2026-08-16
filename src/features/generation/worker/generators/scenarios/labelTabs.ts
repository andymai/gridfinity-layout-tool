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
  // well below the wall top, exercising the dropped-shelf path from.
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
  // Front-anchored tab on a 2\u00d72 bin. Exercises the mirrored
  // grouping, shelf, gusset, and text-center logic for the front edge.
  defineScenario('label tabs', '2\u00d72 label front edge', {
    params: {
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'left',
        edges: 'front',
      },
    },
  }),
  // Both edges on a 2\u00d72 bin. Each compartment gets a back tab AND
  // a front tab. Compartment depth here is comfortably > 2\u00b7tabDepth, so no
  // collision drop fires.
  defineScenario('label tabs', '2\u00d72\u00d74 label both edges', {
    params: {
      height: 4,
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'left',
        edges: 'both',
      },
    },
  }),
  // 'both' + non-zero inset. Verifies that both tabs slide inward
  // symmetrically by `inset` mm from their respective anchor walls.
  defineScenario('label tabs', '2\u00d72\u00d74 label both + inset 5mm', {
    params: {
      height: 4,
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'solid',
        alignment: 'center',
        edges: 'both',
        inset: 5,
      },
    },
  }),
  // Collision drop. With innerD \u2248 39mm and tabDepth = 20mm,
  // 2\u00b720 + 2\u00b70 = 40 > 39 so the front tab is silently dropped per the
  // collision guard. Only the back tab should appear in the snapshot.
  defineScenario('label tabs', '1\u00d71 label both collision drops front', {
    params: {
      width: 1,
      depth: 1,
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'left',
        edges: 'both',
        depth: 20,
      },
    },
  }),
  // Raised lip on the free edge. The shelf auto-drops by the lip height
  // so the rim tops out at the interior ceiling.
  defineScenario('label tabs', '2\u00d72 label lip bracket', {
    params: {
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'left',
        lip: true,
        lipHeight: 1,
      },
    },
  }),
  // Lip on a solid support, taller rim \u2014 exercises the shelf-drop + fuse
  // against a continuous prism rather than discrete gussets.
  defineScenario('label tabs', '2\u00d72 label lip solid 2mm', {
    params: {
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'solid',
        alignment: 'center',
        lip: true,
        lipHeight: 2,
      },
    },
  }),
  // Lip on both edges \u2014 each tab's own free edge gets a rim.
  defineScenario('label tabs', '2\u00d72\u00d74 label lip both edges', {
    params: {
      height: 4,
      label: {
        ...DEFAULT_BIN_PARAMS.label,
        enabled: true,
        support: 'bracket',
        alignment: 'left',
        edges: 'both',
        lip: true,
        lipHeight: 1,
      },
    },
  }),
];

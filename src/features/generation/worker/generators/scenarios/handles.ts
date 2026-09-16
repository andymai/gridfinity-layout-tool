import { expect } from 'vitest';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_HANDLE_SIDE,
  DISABLED_WALL_CUTOUT,
} from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { computeHandleHoleGeometry } from '@/shared/utils/handleCutoutClip';
import { buildParams, defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { meshVolume } from '../__kernel-tests__/meshAssertions';
import { deriveDimensions } from '../pipeline/context';

/** Shorthand for enabled handle side with nullable overrides */
const ENABLED_SIDE = { ...DEFAULT_HANDLE_SIDE, enabled: true } as const;

/** X-axis slots groove the left and right walls, leaving front and back free. */
const X_SLOTTED_BIN = {
  width: 2,
  depth: 2,
  height: 5,
  style: 'slotted',
  slotConfig: {
    ...DEFAULT_BIN_PARAMS.slotConfig,
    x: { enabled: true, pitch: 20 },
    y: { enabled: false, pitch: 20 },
  },
} as const satisfies Partial<BinParams>;

const FRONT_BACK_HANDLES = {
  ...X_SLOTTED_BIN,
  handles: {
    ...DEFAULT_BIN_PARAMS.handles,
    enabled: true,
    front: ENABLED_SIDE,
    back: ENABLED_SIDE,
    left: DEFAULT_HANDLE_SIDE,
    right: DEFAULT_HANDLE_SIDE,
  },
} as const satisfies Partial<BinParams>;

/**
 * Material a rounded-rectangle grip takes out of `wallCount` walls: the hole's
 * face area (rectangle less the four corner fillets) driven through the wall.
 */
function expectedGripCutVolume(overrides: Partial<BinParams>, wallCount: number): number {
  const params = buildParams(overrides);
  const dim = deriveDimensions(params, false);
  const { effectiveHeight } = computeHandleHoleGeometry(
    dim.interiorHeight,
    params.handles.height,
    params.handles.verticalPosition
  );
  const width = dim.innerW * (params.handles.width / 100);
  const radius = Math.min(params.handles.cornerRadius, width / 2, effectiveHeight / 2);
  const faceArea = width * effectiveHeight - (4 - Math.PI) * radius * radius;
  return faceArea * params.wallThickness * wallCount;
}

export const handles: ScenarioCase[] = [
  defineScenario('handles', 'standard bin with front + side handle holes', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        left: ENABLED_SIDE,
        right: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'handle holes with label tabs (back suppression)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        back: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'handle holes with wall cutouts on same sides', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'handle holes + cutouts on all four walls', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
        right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 40, depth: 50 },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        back: ENABLED_SIDE,
        left: ENABLED_SIDE,
        right: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'handle holes with sharp corners (radius=0)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        cornerRadius: 0,
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'handle holes with max corner radius (oval)', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        cornerRadius: 10,
        height: 20,
        width: 60,
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'handle holes + wide cutout suppresses all segments', {
    assert: 'structural',
    params: {
      width: 1,
      depth: 1,
      height: 3,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 90, depth: 50 },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'handle holes + left-aligned cutout (asymmetric split)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: {
          ...DISABLED_WALL_CUTOUT,
          enabled: true,
          width: 30,
          depth: 50,
          alignment: 'left',
          offset: 0,
          widthMm: null,
        },
      },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        width: 90,
        front: ENABLED_SIDE,
      },
    },
  }),
  // --- New shape scenarios ---
  defineScenario('handles', 'oval shape handles on front wall', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        shape: 'oval',
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'scoop shape handles on front wall', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        shape: 'scoop',
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'multi-handle count=2 on wide bin', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        count: 2,
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'custom vertical position at 40%', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        verticalPosition: 0.4,
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'interior wall handles with 2x2 compartments', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 5,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        interior: true,
        front: ENABLED_SIDE,
      },
    },
  }),
  defineScenario('handles', 'grip holes through the slot-free walls of a slotted bin', {
    assert: 'structural',
    params: FRONT_BACK_HANDLES,
    compareWith: {
      params: {
        ...X_SLOTTED_BIN,
        handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: false },
      },
      assert: (withGrips, plain) => {
        const removed = meshVolume(plain) - meshVolume(withGrips);
        const expected = expectedGripCutVolume(FRONT_BACK_HANDLES, 2);
        expect(removed).toBeGreaterThan(expected * 0.9);
        expect(removed).toBeLessThan(expected * 1.1);
      },
    },
  }),
  defineScenario('handles', 'a slotted bin refuses grips on the walls its slots groove', {
    assert: 'structural',
    params: {
      ...X_SLOTTED_BIN,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
        back: ENABLED_SIDE,
        left: ENABLED_SIDE,
        right: ENABLED_SIDE,
      },
    },
    compareWith: {
      params: FRONT_BACK_HANDLES,
      assert: (allFourAsked, frontBackOnly) => {
        // Asking for all four walls must build the same solid as asking for the
        // two the slots leave alone.
        expect(meshVolume(allFourAsked)).toBeCloseTo(meshVolume(frontBackOnly), 3);
      },
    },
  }),
  defineScenario('handles', 'chamfer enabled on rectangle handles', {
    assert: 'structural',
    params: {
      width: 2,
      depth: 2,
      height: 5,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        chamfer: true,
        front: ENABLED_SIDE,
        left: ENABLED_SIDE,
      },
    },
  }),
];

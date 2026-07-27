/**
 * Spacer / riser scenarios (issue #2869).
 *
 * A spacer is a bin with its floor punched through every cell: the shelled feet
 * plus the webbing between them carry the structure, the stacking lip still
 * receives the bin above, and the outer envelope is unchanged — which is what
 * makes the stacking arithmetic work (a 2u spacer under a 2u bin reaches the top
 * of a 4u one).
 */
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { assertBoundingBoxMatchesParams } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const spacerBase = { ...DEFAULT_BIN_PARAMS.base, spacer: true };
const liteBase = { ...DEFAULT_BIN_PARAMS.base, lightweight: true };

export const spacer: ScenarioCase[] = [
  defineScenario('spacer', '1×1 spacer, 1u tall', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 1, base: spacerBase },
  }),
  defineScenario('spacer', '1×1 spacer, no lip', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 1, base: { ...spacerBase, stackingLip: false } },
  }),

  // Multi-cell is the load-bearing case: once the floor is gone, the only thing
  // holding the interior feet to the walls is the webbing between the cups. A
  // structurally-valid mesh here means nothing came loose as a separate solid.
  defineScenario('spacer', '3×3 spacer (interior feet must stay attached)', {
    assert: 'structural',
    forExport: true,
    timeout: 60_000,
    params: { width: 3, depth: 3, height: 2, base: spacerBase },
  }),

  // The envelope must match a plain bin of the same size/height, or the riser
  // would not stack to a predictable total.
  defineScenario('spacer', '2×2 spacer keeps the nominal envelope', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 3, base: spacerBase },
    customAssert: (result, params) => assertBoundingBoxMatchesParams(result, params, '2x2-spacer'),
  }),

  // Fractional footprint — the half-width foot column shells through too.
  defineScenario('spacer', '1.5×1 spacer (fractional)', {
    assert: 'structural',
    params: { width: 1.5, depth: 1, height: 1, base: spacerBase },
  }),

  defineScenario('spacer', '2×2 spacer + half sockets', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 1, base: { ...spacerBase, halfSockets: true } },
  }),

  // A magnet pad inside a through-hole would be a free-standing pillar, so the
  // constraint engine rules attachment hardware out and generation suppresses it
  // regardless — a crafted payload must still yield the plain spacer, not a
  // disconnected solid.
  defineScenario('spacer', '2×2 spacer ignores an attachment style', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 2, base: { ...spacerBase, style: 'magnet_and_screw' } },
    compareWith: {
      params: { width: 2, depth: 2, height: 2, base: spacerBase },
      forExport: true,
      assert: (withHardware, plain) => {
        if (withHardware.triangleCount !== plain.triangleCount) {
          throw new Error(
            `spacer honoured the attachment style (${withHardware.triangleCount} vs ${plain.triangleCount} tris) — pads would be free-standing`
          );
        }
      },
    },
  }),

  // It actually did something: a spacer differs from the lite bin it otherwise
  // looks like, which is the closest thing to it (both shell the feet).
  defineScenario('spacer', '2×2 spacer differs from a lite bin', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 2, base: spacerBase },
    compareWith: {
      params: { width: 2, depth: 2, height: 2, base: liteBase },
      assert: (spacerResult, lite) => {
        if (spacerResult.triangleCount === lite.triangleCount) {
          throw new Error(
            `spacer mesh (${spacerResult.triangleCount} tris) identical to lite — floor was not punched`
          );
        }
      },
    },
  }),

  // Export path fuses the shelled feet into the body — a watertight single solid.
  defineScenario('spacer', '2×2 spacer export', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 2, base: spacerBase },
    customAssert: (result, params) =>
      assertBoundingBoxMatchesParams(result, params, '2x2-spacer-export'),
  }),
];

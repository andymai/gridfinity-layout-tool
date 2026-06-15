import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { assertBoundingBoxMatchesParams } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const lite = { ...DEFAULT_BIN_PARAMS.base, lightweight: true };

export const lightweight: ScenarioCase[] = [
  defineScenario('lightweight', '1×1 lite, no lip', {
    assert: 'structural',
    params: { width: 1, depth: 1, base: { ...lite, stackingLip: false } },
  }),
  defineScenario('lightweight', '1×1 lite, lip', {
    assert: 'structural',
    params: { width: 1, depth: 1, base: { ...lite, stackingLip: true } },
  }),
  defineScenario('lightweight', '2×2 lite', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: lite },
    customAssert: (result, params) => assertBoundingBoxMatchesParams(result, params, '2x2-lite'),
  }),

  // Magnet/screw pads must be retained as islands (no crash, valid solid).
  defineScenario('lightweight', '2×2 lite + magnet pads', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: { ...lite, style: 'magnet' } },
  }),
  defineScenario('lightweight', '2×2 lite + screw pads', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: { ...lite, style: 'screw' } },
  }),
  defineScenario('lightweight', '2×2 lite + magnet & screw', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: { ...lite, style: 'magnet_and_screw' } },
  }),

  // Half sockets shell each quarter-cell.
  defineScenario('lightweight', '2×2 lite + half sockets', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: { ...lite, halfSockets: true } },
  }),

  // Solid bin → cups open downward (underside hollow), body stays solid.
  defineScenario('lightweight', '2×2 lite solid bin', {
    assert: 'structural',
    params: { width: 2, depth: 2, style: 'solid', base: { ...lite, solid: true } },
  }),

  // Solid lite + magnets: pads anchor at the foot bottom so the pocket is cut
  // (the downward-open cups must still receive the magnet from below).
  defineScenario('lightweight', '2×2 lite solid bin + magnet', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, style: 'solid', base: { ...lite, solid: true, style: 'magnet' } },
  }),

  // Fractional footprint (1.5×1) — fractional feet still shell.
  defineScenario('lightweight', '1.5×1 lite (fractional)', {
    assert: 'structural',
    params: { width: 1.5, depth: 1, base: lite },
  }),

  // Export path exercises the socket↔body fuse (watertight single solid).
  defineScenario('lightweight', '2×2 lite export', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, base: lite },
    customAssert: (result, params) =>
      assertBoundingBoxMatchesParams(result, params, '2x2-lite-export'),
  }),

  // Stress: bigger grid + export.
  defineScenario('lightweight', '4×4 lite export (stress)', {
    assert: 'structural',
    forExport: true,
    timeout: 60_000,
    params: { width: 4, depth: 4, base: { ...lite, style: 'magnet' } },
  }),

  // Compartments: dividers crossing cup recesses must keep a solid foot core
  // beneath them (open-floor clip). cols=3 in a 2-wide bin lands dividers
  // mid-cell; cols=2 lands them between cups.
  defineScenario('lightweight', '2×1 lite + mid-cell dividers (cols=3)', {
    assert: 'structural',
    forExport: true,
    params: {
      width: 2,
      depth: 1,
      base: lite,
      compartments: { cols: 3, rows: 1, thickness: 1.2, cells: [0, 1, 2] },
    },
  }),
  defineScenario('lightweight', '2×2 lite + 2×2 compartments + magnet', {
    assert: 'structural',
    forExport: true,
    timeout: 60_000,
    params: {
      width: 2,
      depth: 2,
      base: { ...lite, style: 'magnet' },
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
    },
  }),

  // It actually did something: lite differs from the solid-floor standard bin.
  defineScenario('lightweight', '2×2 lite differs from standard', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: lite },
    compareWith: {
      params: { width: 2, depth: 2, base: { ...DEFAULT_BIN_PARAMS.base, lightweight: false } },
      assert: (liteResult, standard) => {
        if (liteResult.triangleCount === standard.triangleCount) {
          throw new Error(
            `lite mesh (${liteResult.triangleCount} tris) identical to standard — floor was not shelled`
          );
        }
      },
    },
  }),
];

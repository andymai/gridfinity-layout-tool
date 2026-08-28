import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { assertBoundingBoxMatchesParams } from '../__kernel-tests__/meshAssertions';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const lite = { ...DEFAULT_BIN_PARAMS.base, lightweight: true };
/**
 * The inverted relief: shelled from underneath, interior floor left intact.
 * Geometry is verified by column probes in `undersideRelief.kernel.test.ts`;
 * these cases cover the combinations, including the ones only this mode can
 * reach because it keeps the floor the feature needs.
 */
const underside = { ...lite, lightweightMode: 'underside' as const };

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

  // ── Underside relief (#3524) ─────────────────────────────────────────────
  defineScenario('lightweight', '1×1 underside, no lip', {
    assert: 'structural',
    params: { width: 1, depth: 1, base: { ...underside, stackingLip: false } },
  }),
  defineScenario('lightweight', '2×2 underside', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: underside },
    customAssert: (result, params) =>
      assertBoundingBoxMatchesParams(result, params, '2x2-underside'),
  }),

  // Pads anchor at the foot bottom and reach the solid body above, since the
  // ring is open at the bottom and would otherwise leave them free-standing.
  defineScenario('lightweight', '2×2 underside + magnet & screw', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, base: { ...underside, style: 'magnet_and_screw' } },
  }),

  // Half sockets subdivide each foot; the relief's wider border has to still
  // leave a bore in a 0.5u cell.
  defineScenario('lightweight', '2×2 underside + half sockets', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: { ...underside, halfSockets: true } },
  }),

  // A fractional edge foot is clipped before it is shelled.
  defineScenario('lightweight', '1.5×1 underside (fractional)', {
    assert: 'structural',
    params: { width: 1.5, depth: 1, base: underside },
  }),

  // Export path: the ring meets the body on a PARTIAL coplanar face at the
  // socket top (the bore is open, the border is not), unlike the full face a
  // solid foot presents. That fuse is the one that has to stay watertight.
  defineScenario('lightweight', '2×2 underside export', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, base: underside },
    customAssert: (result, params) =>
      assertBoundingBoxMatchesParams(result, params, '2x2-underside-export'),
  }),

  // Dividers rest on the intact floor, so no cavity clip is applied — the
  // combination the interior mode needs `openFloorDrawings` for.
  defineScenario('lightweight', '2×1 underside + mid-cell dividers (cols=3)', {
    assert: 'structural',
    forExport: true,
    params: {
      width: 2,
      depth: 1,
      base: underside,
      compartments: { cols: 3, rows: 1, thickness: 1.2, cells: [0, 1, 2] },
    },
  }),

  // ── The three features only this mode can carry ──────────────────────────
  // Each is ruled out for the interior mode by a constraint rule, and each is
  // reachable here because the interior floor is a standard bin's.
  defineScenario('lightweight', '2×2 underside + finger scoop', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, base: underside, scoop: { enabled: true, radius: 'auto' } },
  }),
  defineScenario('lightweight', '2×2 underside + drainage holes', {
    assert: 'structural',
    forExport: true,
    params: {
      width: 2,
      depth: 2,
      base: underside,
      floorPattern: { enabled: true, pattern: 'round', scale: 0.5 },
    },
  }),
  defineScenario('lightweight', '2×2 underside, solid style + cutout', {
    assert: 'structural',
    forExport: true,
    params: {
      width: 2,
      depth: 2,
      style: 'solid',
      base: { ...underside, solid: true },
      cutouts: [makeCutout({ shape: 'circle', width: 20, depth: 20 })],
    },
  }),

  // A base-only bin is feet plus one thin plate, so it is where the relief pays
  // off most — and it was blocked from lite entirely before this mode existed.
  defineScenario('lightweight', '2×2 base-only + underside', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: { ...underside, tile: true } },
  }),

  // The reported repro (#3957 + #3958): a slotted bin on an underside-relief
  // base. One export exercises both printability fixes together — the slot
  // retention throat and the per-foot cross-web — across the partial-coplanar
  // socket↔body fuse the relief leaves.
  defineScenario('lightweight', '2×2 underside + slotted (retention + cross-web)', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, style: 'slotted', base: underside },
  }),

  // It did something, and something DIFFERENT from the interior mode: the two
  // shells differ only in offset and open direction, so a mode that silently
  // fell back would land on an identical mesh.
  defineScenario('lightweight', '2×2 underside differs from the interior mode', {
    assert: 'structural',
    params: { width: 2, depth: 2, base: underside },
    compareWith: {
      params: { width: 2, depth: 2, base: lite },
      assert: (undersideResult, interior) => {
        if (undersideResult.triangleCount === interior.triangleCount) {
          throw new Error(
            `underside mesh (${undersideResult.triangleCount} tris) identical to the interior mode — the relief direction was not applied`
          );
        }
      },
    },
  }),
];

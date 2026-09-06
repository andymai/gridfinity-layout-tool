/**
 * Base-only bin scenarios.
 *
 * The exact complement of the spacer: the feet and the floor stay, the wall
 * collapses to ZERO, and the stacking lip fuses onto the floor slab. The result
 * is a plate that still locks into a baseplate and still stacks.
 *
 * Three invariants are load-bearing here, one per way the mode has broken:
 *  - The HEIGHT. `params.height` is inert on a base-only bin (pinned to 1 purely to
 *    satisfy the range validators), so a regression that reads it instead of
 *    pinning `wallHeight` to 0 produces a 7mm wall.
 *  - The FLOOR. `buildBaseSocket` sizes each foot `CLEARANCE` narrower than its
 *    cell and rounds its corners, so adjacent feet meet nowhere. Without the
 *    slab the floor is one island per cell.
 *  - The FOOT. A stacking lip extends `LIP_TAPER_WIDTH` below its own base plane
 *    to blend into the wall it sits on. Dropped onto a zero-height wall that
 *    support lands inside the Gridfinity taper and fills it out to full width,
 *    leaving a foot that will not seat in a baseplate.
 */
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { SOCKET_HEIGHT, LIP_HEIGHT } from '../generatorConstants';
import {
  boundingBox,
  assertWatertight,
  isSolidThrough,
  sectionHalfWidth,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';
import type { CellMask } from '@/shared/utils/cellMask';

const tileBase = { ...DEFAULT_BIN_PARAMS.base, tile: true };
const plainBase = DEFAULT_BIN_PARAMS.base;

/** 3×3 ring at half-bin resolution: outer frame filled, centre 1u empty. */
const RING_MASK: CellMask = {
  cols: 6,
  rows: 6,
  cells: [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1,
  ],
};

/** Feet plus the floor slab — the whole body, lip aside. */
const BODY_MM = SOCKET_HEIGHT + DEFAULT_BIN_PARAMS.wallThickness;
/** Body plus the lip's net rise above it. */
const LIPPED_HEIGHT_MM = BODY_MM + LIP_HEIGHT;

function assertTotalZ(expected: number, label: string) {
  return (result: MeshData): void => {
    const bbox = boundingBox(result.vertices);
    const actual = bbox.maxZ - bbox.minZ;
    if (Math.abs(actual - expected) > 0.05) {
      throw new Error(
        `${label}: expected ${expected.toFixed(2)}mm total Z, got ${actual.toFixed(2)}mm. ` +
          `A base-only bin's wall is 0, so reading params.height would build a taller body.`
      );
    }
  };
}

export const tile: ScenarioCase[] = [
  defineScenario('tile', '1×1 base-only bin is a lipped plate', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 1, base: tileBase },
    customAssert: assertTotalZ(LIPPED_HEIGHT_MM, '1x1-base-only'),
  }),

  // The feet are 41.5mm on a 42mm pitch with rounded tops, so they touch
  // nowhere: these columns sit in the gap and are open air unless the slab
  // bridges them. Export mesh, so the socket is fused and the enter/exit
  // pairing is not confused by coincident socket-top/floor-bottom faces.
  defineScenario('tile', 'base-only floor bridges the gap between its feet', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: tileBase },
    customAssert: (result) => {
      // The gap between two feet spans only x ∈ [-0.25, 0.25], so these sit
      // mid-gap on one axis and are nudged off the other — a planar face is
      // fan-triangulated from the footprint centre, and a ray exactly along a
      // shared edge leans on the coincident-hit collapse rather than avoiding it.
      const columns: ReadonlyArray<readonly [number, number]> = [
        [0, 0.4], // four-foot junction — the widest void
        [0, 21.3], // along an internal grid line
        [21.3, 0], // the perpendicular one
      ];
      for (const [x, y] of columns) {
        if (!isSolidThrough(result, x, y, SOCKET_HEIGHT, BODY_MM)) {
          throw new Error(
            `2x2-base-only: no material between z=${SOCKET_HEIGHT} and z=${BODY_MM} at (${x}, ${y}) — ` +
              `the floor slab is missing and the bin is one disconnected island per cell.`
          );
        }
      }
    },
  }),

  // The foot must be indistinguishable from an ordinary bin's, or it
  // stops seating in a baseplate. Sampled inside the big taper, which is where
  // a lip built with its angled support back-fills the profile to full width.
  defineScenario('tile', 'base-only bin keeps the Gridfinity foot it stands on', {
    assert: 'structural',
    forExport: true,
    params: { width: 1, depth: 1, height: 1, base: tileBase },
    compareWith: {
      params: { width: 1, depth: 1, height: 3, base: plainBase },
      forExport: true,
      assert: (baseOnly, plain) => {
        for (const z of [2.85, 3.5, 4.5]) {
          const baseOnlyHalf = sectionHalfWidth(baseOnly, z);
          const plainHalf = sectionHalfWidth(plain, z);
          if (Math.abs(baseOnlyHalf - plainHalf) > 0.01) {
            throw new Error(
              `base-only foot deviates from a plain bin's at z=${z}mm: ` +
                `${baseOnlyHalf.toFixed(3)}mm vs ${plainHalf.toFixed(3)}mm half-width. ` +
                `The lip's angled support has filled the taper — the foot no longer seats in a baseplate.`
            );
          }
        }
      },
    },
  }),

  // The lip is a free choice on top of the slab, so clearing it must leave a
  // usable solid: the feet and the floor, still watertight and still bridged.
  defineScenario('tile', 'lip-less base-only bin is the floor slab alone', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: { ...tileBase, stackingLip: false } },
    customAssert: (result) => {
      assertTotalZ(BODY_MM, '2x2-base-only-lipless')(result);
      assertWatertight(result, '2x2-base-only-lipless');
      if (!isSolidThrough(result, 0, 21.3, SOCKET_HEIGHT, BODY_MM)) {
        throw new Error('2x2-base-only-lipless: the slab lost its floor once the lip was cleared.');
      }
    },
  }),

  // `height` is inert. One stored at 1u and one stored at 8u must be the
  // SAME solid — this is the assertion that fails if anything downstream starts
  // deriving the body from `height * heightUnitMm` again.
  defineScenario('tile', 'base-only bin ignores its stored height', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 1, base: tileBase },
    compareWith: {
      params: { width: 2, depth: 2, height: 8, base: tileBase },
      assert: (atOneU, atEightU) => {
        if (atOneU.triangleCount !== atEightU.triangleCount) {
          throw new Error(
            `base-only bin honoured its stored height (${atOneU.triangleCount} vs ${atEightU.triangleCount} tris) — wallHeight is not pinned to 0`
          );
        }
      },
    },
  }),

  // It actually did something: a base-only bin differs from the ordinary bin it is
  // derived from at the same footprint.
  defineScenario('tile', '2×2 base-only bin differs from a plain bin', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 2, base: tileBase },
    compareWith: {
      params: { width: 2, depth: 2, height: 2, base: plainBase },
      assert: (baseOnly, plain) => {
        if (baseOnly.triangleCount === plain.triangleCount) {
          throw new Error(
            `base-only mesh (${baseOnly.triangleCount} tris) identical to a plain bin — the wall was not collapsed`
          );
        }
      },
    },
  }),

  // A collar raises the outer walls + lip above the nominal height. Base-only has
  // no walls to raise, and `assembledHeight` ignores the field entirely, so
  // generation must too — otherwise `boxWallHeight = wallHeight + collarHeight`
  // is non-zero, the zero-wall branch never fires, and it silently builds
  // a box whose height the readout does not report.
  defineScenario('tile', 'base-only bin ignores an extra wall-height collar', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 1, base: tileBase, extraWallHeightMm: 6 },
    customAssert: assertTotalZ(LIPPED_HEIGHT_MM, '1x1-base-only-collar'),
  }),

  // Fractional footprint — the half-width foot column still resolves.
  defineScenario('tile', '1.5×1 base-only bin (fractional)', {
    assert: 'structural',
    params: { width: 1.5, depth: 1, height: 1, base: tileBase },
    customAssert: assertTotalZ(LIPPED_HEIGHT_MM, '1.5x1-base-only'),
  }),

  defineScenario('tile', '2×2 base-only bin + half sockets', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 1, base: { ...tileBase, halfSockets: true } },
  }),

  // The support-free lip takes `buildTopShape`'s non-stacking branch,
  // which skips the inner-hole ring the angled support needs. A ring footprint
  // is the one shape where that branch has a second loop to get right, and
  // nothing gates base-only off a custom footprint.
  defineScenario('tile', '3×3 ring base-only bin (mask with a hole)', {
    assert: 'structural',
    forExport: true,
    params: { width: 3, depth: 3, height: 1, base: tileBase, cellMask: RING_MASK },
    customAssert: (result) => {
      assertWatertight(result, 'ring-base-only');
      assertTotalZ(LIPPED_HEIGHT_MM, 'ring-base-only')(result);
      // A filled cell of the frame, away from both the hole and the perimeter,
      // and off the axes for the same reason the 2x2 columns are.
      if (!isSolidThrough(result, 42, 6.7, SOCKET_HEIGHT, BODY_MM)) {
        throw new Error('ring-base-only: the frame lost its floor slab.');
      }
    },
  }),

  // It takes the solid path (interior height is 0), so the export must be
  // a single watertight solid with no vestigial cavity.
  defineScenario('tile', '2×2 base-only export is watertight', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: tileBase },
    customAssert: (result) => {
      assertWatertight(result, '2x2-base-only-export');
      assertTotalZ(LIPPED_HEIGHT_MM, '2x2-base-only-export')(result);
    },
  }),

  // A magnet style still drills the feet — attachment hardware survives on a
  // base-only (unlike a spacer, whose through-holes leave no pad to stand on).
  defineScenario('tile', '2×2 base-only bin keeps attachment hardware', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: { ...tileBase, style: 'magnet_and_screw' } },
    compareWith: {
      params: { width: 2, depth: 2, height: 1, base: tileBase },
      forExport: true,
      assert: (withHardware, plainBaseOnly) => {
        if (withHardware.triangleCount === plainBaseOnly.triangleCount) {
          throw new Error(
            `base-only bin dropped its attachment hardware (${withHardware.triangleCount} tris) — the feet are still solid enough to drill`
          );
        }
      },
    },
  }),
];

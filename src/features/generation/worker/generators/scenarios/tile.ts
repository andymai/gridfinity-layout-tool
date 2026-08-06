/**
 * Wall-less tray scenarios.
 *
 * The exact complement of the spacer: the feet and the floor stay, the wall
 * collapses to ZERO, and the stacking lip fuses onto the floor slab. The result
 * is a plate that still locks into a baseplate and still stacks.
 *
 * Three invariants are load-bearing here, one per way the mode has broken:
 *  - The HEIGHT. `params.height` is inert on a tray (pinned to 1 purely to
 *    satisfy the range validators), so a regression that reads it instead of
 *    pinning `wallHeight` to 0 produces a 7mm wall.
 *  - The FLOOR. `buildBaseSocket` sizes each foot `CLEARANCE` narrower than its
 *    cell and rounds its corners, so adjacent feet meet nowhere. Without the
 *    slab the tray's floor is one island per cell.
 *  - The FOOT. A stacking lip extends `LIP_TAPER_WIDTH` below its own base plane
 *    to blend into the wall it sits on. Dropped onto a zero-height wall that
 *    support lands inside the Gridfinity taper and fills it out to full width,
 *    leaving a foot that will not seat in a baseplate.
 */
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { SOCKET_HEIGHT, LIP_HEIGHT, LIP_OVERLAP } from '../generatorConstants';
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

/** Feet plus the floor slab — the tray's whole body, lip aside. */
const TRAY_BODY_MM = SOCKET_HEIGHT + DEFAULT_BIN_PARAMS.wallThickness;
/** Body plus the lip's net rise above it. */
const TILE_HEIGHT_MM = TRAY_BODY_MM + LIP_HEIGHT - LIP_OVERLAP;

function assertTotalZ(expected: number, label: string) {
  return (result: MeshData): void => {
    const bbox = boundingBox(result.vertices);
    const actual = bbox.maxZ - bbox.minZ;
    if (Math.abs(actual - expected) > 0.05) {
      throw new Error(
        `${label}: expected ${expected.toFixed(2)}mm total Z, got ${actual.toFixed(2)}mm. ` +
          `A tray's wall is 0, so reading params.height would build a taller body.`
      );
    }
  };
}

export const tile: ScenarioCase[] = [
  defineScenario('tile', '1×1 tray is a lipped plate', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 1, base: tileBase },
    customAssert: assertTotalZ(TILE_HEIGHT_MM, '1x1-tray'),
  }),

  // The feet are 41.5mm on a 42mm pitch with rounded tops, so they touch
  // nowhere: these columns sit in the gap and are open air unless the slab
  // bridges them. Export mesh, so the socket is fused and the enter/exit
  // pairing is not confused by coincident socket-top/floor-bottom faces.
  defineScenario('tile', 'tray floor bridges the gap between its feet', {
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
        if (!isSolidThrough(result, x, y, SOCKET_HEIGHT, TRAY_BODY_MM)) {
          throw new Error(
            `2x2-tray: no material between z=${SOCKET_HEIGHT} and z=${TRAY_BODY_MM} at (${x}, ${y}) — ` +
              `the floor slab is missing and the tray is one disconnected island per cell.`
          );
        }
      }
    },
  }),

  // The tray's foot must be indistinguishable from an ordinary bin's, or it
  // stops seating in a baseplate. Sampled inside the big taper, which is where
  // a lip built with its angled support back-fills the profile to full width.
  defineScenario('tile', 'tray keeps the Gridfinity foot it stands on', {
    assert: 'structural',
    forExport: true,
    params: { width: 1, depth: 1, height: 1, base: tileBase },
    compareWith: {
      params: { width: 1, depth: 1, height: 3, base: plainBase },
      forExport: true,
      assert: (tray, plain) => {
        for (const z of [2.85, 3.5, 4.5]) {
          const trayHalf = sectionHalfWidth(tray, z);
          const plainHalf = sectionHalfWidth(plain, z);
          if (Math.abs(trayHalf - plainHalf) > 0.01) {
            throw new Error(
              `tray foot deviates from a plain bin's at z=${z}mm: ` +
                `${trayHalf.toFixed(3)}mm vs ${plainHalf.toFixed(3)}mm half-width. ` +
                `The lip's angled support has filled the taper — the foot no longer seats in a baseplate.`
            );
          }
        }
      },
    },
  }),

  // The lip is a free choice on top of the slab, so clearing it must leave a
  // usable solid: the feet and the floor, still watertight and still bridged.
  defineScenario('tile', 'lip-less tray is the floor slab alone', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: { ...tileBase, stackingLip: false } },
    customAssert: (result) => {
      assertTotalZ(TRAY_BODY_MM, '2x2-tray-lipless')(result);
      assertWatertight(result, '2x2-tray-lipless');
      if (!isSolidThrough(result, 0, 21.3, SOCKET_HEIGHT, TRAY_BODY_MM)) {
        throw new Error('2x2-tray-lipless: the slab lost its floor once the lip was cleared.');
      }
    },
  }),

  // `height` is inert. A tray stored at 1u and one stored at 8u must be the
  // SAME solid — this is the assertion that fails if anything downstream starts
  // deriving the body from `height * heightUnitMm` again.
  defineScenario('tile', 'tray ignores its stored height', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 1, base: tileBase },
    compareWith: {
      params: { width: 2, depth: 2, height: 8, base: tileBase },
      assert: (atOneU, atEightU) => {
        if (atOneU.triangleCount !== atEightU.triangleCount) {
          throw new Error(
            `tray honoured its stored height (${atOneU.triangleCount} vs ${atEightU.triangleCount} tris) — wallHeight is not pinned to 0`
          );
        }
      },
    },
  }),

  // It actually did something: a tray differs from the ordinary bin it is
  // derived from at the same footprint.
  defineScenario('tile', '2×2 tray differs from a plain bin', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 2, base: tileBase },
    compareWith: {
      params: { width: 2, depth: 2, height: 2, base: plainBase },
      assert: (tray, plain) => {
        if (tray.triangleCount === plain.triangleCount) {
          throw new Error(
            `tray mesh (${tray.triangleCount} tris) identical to a plain bin — the wall was not collapsed`
          );
        }
      },
    },
  }),

  // A collar raises the outer walls + lip above the nominal height. A tray has
  // no walls to raise, and `assembledHeight` ignores the field entirely, so
  // generation must too — otherwise `boxWallHeight = wallHeight + collarHeight`
  // is non-zero, the zero-wall branch never fires, and the tray silently builds
  // a box whose height the readout does not report.
  defineScenario('tile', 'tray ignores an extra wall-height collar', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 1, base: tileBase, extraWallHeightMm: 6 },
    customAssert: assertTotalZ(TILE_HEIGHT_MM, '1x1-tray-collar'),
  }),

  // Fractional footprint — the half-width foot column still resolves.
  defineScenario('tile', '1.5×1 tray (fractional)', {
    assert: 'structural',
    params: { width: 1.5, depth: 1, height: 1, base: tileBase },
    customAssert: assertTotalZ(TILE_HEIGHT_MM, '1.5x1-tray'),
  }),

  defineScenario('tile', '2×2 tray + half sockets', {
    assert: 'structural',
    params: { width: 2, depth: 2, height: 1, base: { ...tileBase, halfSockets: true } },
  }),

  // The tray's support-free lip takes `buildTopShape`'s non-stacking branch,
  // which skips the inner-hole ring the angled support needs. A ring footprint
  // is the one shape where that branch has a second loop to get right, and
  // nothing gates the tray off a custom footprint.
  defineScenario('tile', '3×3 ring tray (mask with a hole)', {
    assert: 'structural',
    forExport: true,
    params: { width: 3, depth: 3, height: 1, base: tileBase, cellMask: RING_MASK },
    customAssert: (result) => {
      assertWatertight(result, 'ring-tray');
      assertTotalZ(TILE_HEIGHT_MM, 'ring-tray')(result);
      // A filled cell of the frame, away from both the hole and the perimeter,
      // and off the axes for the same reason the 2x2 columns are.
      if (!isSolidThrough(result, 42, 6.7, SOCKET_HEIGHT, TRAY_BODY_MM)) {
        throw new Error('ring-tray: the frame lost its floor slab.');
      }
    },
  }),

  // The tray takes the solid path (interior height is 0), so the export must be
  // a single watertight solid with no vestigial cavity.
  defineScenario('tile', '2×2 tray export is watertight', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: tileBase },
    customAssert: (result) => {
      assertWatertight(result, '2x2-tray-export');
      assertTotalZ(TILE_HEIGHT_MM, '2x2-tray-export')(result);
    },
  }),

  // A magnet style still drills the feet — attachment hardware survives on a
  // tray (unlike a spacer, whose through-holes leave no pad to stand on).
  defineScenario('tile', '2×2 tray keeps attachment hardware', {
    assert: 'structural',
    forExport: true,
    params: { width: 2, depth: 2, height: 1, base: { ...tileBase, style: 'magnet_and_screw' } },
    compareWith: {
      params: { width: 2, depth: 2, height: 1, base: tileBase },
      forExport: true,
      assert: (withHardware, plainTray) => {
        if (withHardware.triangleCount === plainTray.triangleCount) {
          throw new Error(
            `tray dropped its attachment hardware (${withHardware.triangleCount} tris) — the feet are still solid enough to drill`
          );
        }
      },
    },
  }),
];

/**
 * Wall-less tray scenarios.
 *
 * The exact complement of the spacer: the floor and feet stay, the wall
 * collapses to ZERO, and the stacking lip fuses straight onto the floor slab.
 * The result is a ~9.3mm plate (SOCKET_HEIGHT + LIP_HEIGHT − LIP_OVERLAP) that
 * still locks into a baseplate and still stacks.
 *
 * The load-bearing invariant is the height: `params.height` is inert on a tray
 * (pinned to 1 purely to satisfy the range validators), so a regression that
 * reads it instead of pinning `wallHeight` to 0 produces a 7mm wall and these
 * assertions catch it.
 */
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { SOCKET_HEIGHT, LIP_HEIGHT, LIP_OVERLAP } from '../generatorConstants';
import { boundingBox, assertWatertight } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import type { MeshData } from '@/features/generation/bridge/types';

const tileBase = { ...DEFAULT_BIN_PARAMS.base, tile: true };
const plainBase = DEFAULT_BIN_PARAMS.base;

/** SOCKET_HEIGHT floor slab + the lip's net rise above it. */
const TILE_HEIGHT_MM = SOCKET_HEIGHT + LIP_HEIGHT - LIP_OVERLAP;

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
  defineScenario('tile', '1×1 tray is a 9.3mm plate', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 1, base: tileBase },
    customAssert: assertTotalZ(TILE_HEIGHT_MM, '1x1-tray'),
  }),

  // The lip is not optional on a tray: with the wall at 0 it IS the whole
  // shell, so a crafted payload that clears it must still generate the lipped
  // plate rather than an empty solid.
  defineScenario('tile', 'tray forces its lip on even when the payload clears it', {
    assert: 'structural',
    params: { width: 1, depth: 1, height: 1, base: { ...tileBase, stackingLip: false } },
    customAssert: assertTotalZ(TILE_HEIGHT_MM, '1x1-tray-lip-forced'),
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

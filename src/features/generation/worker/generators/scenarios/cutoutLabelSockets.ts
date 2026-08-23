/**
 * Swappable-label sockets cut into a shadow board.
 *
 * The custom asserts read the pocket back OUT OF THE MESH (its floor plane,
 * its measured width, and whether solid material survives beneath it) rather
 * than restating the arithmetic that produced it. Both failure modes this
 * feature can have are invisible to a bounding-box, triangle-count or
 * watertight assertion: a pocket that bled into a neighbouring cavity is still
 * a closed surface, and a pocket sunk the wrong amount is a sub-millimetre
 * error on a part that looks perfect.
 */

import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_FLOOR_MM,
  LABEL_SOCKET_STACK_RELIEF_MM,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { columnCrossings } from '../__kernel-tests__/meshAssertions';
import { planCutoutSocketsForParams } from '@/shared/utils/cutoutLabelSocketPlan';

const SOLID_BASE = { ...DEFAULT_BIN_PARAMS.base, solid: true };
const NO_LIP_SOLID_BASE = { ...SOLID_BASE, stackingLip: false };

/**
 * A 3x2 board with one cutout low on the surface and its label anchored into
 * the band above it: the plainest arrangement that has room for a plate.
 */
function board(over: Partial<BinParams> = {}): Partial<BinParams> {
  return {
    width: 3,
    depth: 2,
    height: 4,
    style: 'solid',
    base: NO_LIP_SOLID_BASE,
    cutouts: [
      makeCutout({
        id: 'socketed',
        x: 40,
        y: 10,
        width: 25,
        depth: 20,
        cutDepth: 8,
        label: 'M4',
        labelMode: 'socket',
        textAnchor: 'top',
      }),
    ],
    ...over,
  };
}

/** Interior dimensions the plan measures against, from the same params. */
function interior(params: BinParams): { innerW: number; innerD: number; wallHeight: number } {
  const innerW = params.width * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  const innerD = params.depth * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  // Solid boards fill to the interior ceiling; the socket hangs from there
  // less its own top offset, which the plan applies itself.
  const wallHeight = params.height * params.heightUnitMm - 4.75;
  return { innerW, innerD, wallHeight };
}

/**
 * Highest surface over a column: the plane a plate would rest against when
 * dropped straight down at (x, y).
 */
function surfaceZAt(result: MeshData, x: number, y: number): number {
  const crossings = columnCrossings(result, x, y);
  if (crossings.length === 0) return Number.NaN;
  return crossings[crossings.length - 1];
}

interface SocketExpectation {
  readonly label: string;
  readonly plateWidthU: LabelPlateWidthU;
}

/**
 * Verify the pocket the plan asked for actually exists in the mesh: opened to
 * the planned width, floored, and standing on solid material.
 */
function assertCutoutSocket(result: MeshData, params: BinParams, exp: SocketExpectation): void {
  const { innerW, innerD, wallHeight } = interior(params);
  const { sockets } = planCutoutSocketsForParams(params, innerW, innerD, wallHeight);
  expect(sockets, `${exp.label}: nothing planned`).toHaveLength(1);
  const socket = sockets[0];
  expect(socket.widthU, `${exp.label}: plate width`).toBe(exp.plateWidthU);

  const clearanceMm = effectiveLabelSocketClearance(
    params.nozzleSizeMm,
    params.label.plateFitOffset
  );
  const pocketW = labelPlateWidthMm(socket.widthU) + clearanceMm;
  const pocketD = LABEL_PLATE_HEIGHT_MM + clearanceMm;

  // The board's untouched fill surface, sampled well clear of the pocket and
  // the cutout. Read from the mesh so the pocket depth below is a DELTA
  // against the real surface rather than against a second copy of the
  // arithmetic that placed it.
  const fillZ = surfaceZAt(result, -innerW / 2 + 3, socket.centerY);
  expect(Number.isFinite(fillZ), `${exp.label}: no fill surface to measure against`).toBe(true);

  const pocketZ = surfaceZAt(result, socket.centerX, socket.centerY);
  expect(Number.isFinite(pocketZ), `${exp.label}: no surface inside the pocket`).toBe(true);
  expect(
    fillZ - pocketZ,
    `${exp.label}: pocket floor is not one click-in depth below the surface`
  ).toBeCloseTo(LABEL_SOCKET_CLICK_POCKET_DEPTH_MM, 1);

  // Opened to the planned width: just inside each end is pocket, just outside
  // each end is untouched surface. A pocket cut at the wrong width passes
  // every whole-mesh assertion there is.
  // The plate's long axis is always `pocketW`; `vertical` only says which
  // world axis it runs along.
  const alongHalf = pocketW / 2;
  const acrossHalf = pocketD / 2;
  const at = (offset: number): number =>
    socket.vertical
      ? surfaceZAt(result, socket.centerX, socket.centerY + offset)
      : surfaceZAt(result, socket.centerX + offset, socket.centerY);
  for (const sign of [-1, 1]) {
    expect(at(sign * (alongHalf - 1)), `${exp.label}: pocket short of its planned end`).toBeCloseTo(
      pocketZ,
      1
    );
    expect(
      at(sign * (alongHalf + 1)),
      `${exp.label}: pocket runs past its planned end`
    ).toBeCloseTo(fillZ, 1);
  }

  // The floor is what the plate lands on and the ribs bridge. A pocket that
  // strayed over a neighbouring cavity loses it while staying perfectly
  // watertight, so the band under the pocket is probed directly.
  //
  // Read through `columnCrossings` rather than `isSolidThrough`: the latter
  // pairs crossings by parity, and a planar face fan-triangulated from its own
  // centre puts shared edges right where a pocket-centre probe lands. Samples
  // are nudged off both centre lines for the same reason.
  const floorLo = pocketZ - LABEL_SOCKET_FLOOR_MM;
  const samples: readonly (readonly [number, number])[] = [
    [0.7, 0.7],
    [alongHalf - 1.3, 0.7],
    [-(alongHalf - 1.3), 0.7],
    [0.7, acrossHalf - 1.3],
    [0.7, -(acrossHalf - 1.3)],
  ];
  for (const [along, across] of samples) {
    const x = socket.centerX + (socket.vertical ? across : along);
    const y = socket.centerY + (socket.vertical ? along : across);
    const where = `(${x.toFixed(1)}, ${y.toFixed(1)})`;
    const crossings = columnCrossings(result, x, y);

    expect(
      crossings.at(-1) ?? Number.NaN,
      `${exp.label}: pocket floor is not the top surface at ${where}`
    ).toBeCloseTo(pocketZ, 1);
    // No surface inside the floor band means no void opened under the pocket.
    expect(
      crossings.filter((z) => z > floorLo + 0.05 && z < pocketZ - 0.05),
      `${exp.label}: void under the pocket floor at ${where}`
    ).toEqual([]);
  }
}

export const cutoutLabelSockets: ScenarioCase[] = [
  defineScenario('cutout label sockets', '3×2 board: socket above a cutout', {
    assert: 'structural',
    params: board(),
    customAssert: (result, params) =>
      assertCutoutSocket(result, params, { label: 'board socket', plateWidthU: 2 }),
  }),

  // A 90° socket is the whole reason a side-anchored label is usable: the gap
  // beside a cutout is rarely 38mm wide and usually 38mm tall.
  defineScenario('cutout label sockets', '3×2 board: 90° socket beside a cutout', {
    assert: 'structural',
    params: board({
      cutouts: [
        makeCutout({
          id: 'socketed',
          x: 70,
          y: 20,
          width: 25,
          depth: 25,
          cutDepth: 8,
          label: 'HEX',
          labelMode: 'socket',
          textAnchor: 'left',
          textAngle: 90,
        }),
      ],
    }),
    customAssert: (result, params) =>
      assertCutoutSocket(result, params, { label: '90° board socket', plateWidthU: 1 }),
  }),

  // Stated as a DELTA against the same board without a lip: the sink is
  // sub-millimetre, and asserting an absolute Z would just restate the
  // arithmetic that produced it.
  defineScenario('cutout label sockets', '3×2 lipped board: pocket sinks for stacking', {
    assert: 'structural',
    params: board({ base: SOLID_BASE }),
    compareWith: {
      params: { ...board(), base: NO_LIP_SOLID_BASE },
      assert: (lipped, plain) => {
        // Both boards have the same fill surface; only the pocket moves, so
        // the gap between them IS the relief.
        const probe = (mesh: MeshData, x: number, y: number) => surfaceZAt(mesh, x, y);
        const params = { ...DEFAULT_BIN_PARAMS, ...board() };
        const { innerW, innerD, wallHeight } = interior(params);
        const [socket] = planCutoutSocketsForParams(params, innerW, innerD, wallHeight).sockets;

        const surfaceDelta =
          probe(plain, -innerW / 2 + 3, socket.centerY) -
          probe(lipped, -innerW / 2 + 3, socket.centerY);
        const pocketDelta =
          probe(plain, socket.centerX, socket.centerY) -
          probe(lipped, socket.centerX, socket.centerY);

        expect(surfaceDelta).toBeCloseTo(0, 1);
        expect(pocketDelta).toBeCloseTo(LABEL_SOCKET_STACK_RELIEF_MM, 1);
      },
    },
  }),

  // The engraved path must be untouched by any of this: a design that never
  // asked for a socket cuts exactly what it always did.
  defineScenario('cutout label sockets', '3×2 board: engraved label unchanged', {
    params: board({
      cutouts: [
        makeCutout({
          id: 'engraved',
          x: 40,
          y: 10,
          width: 25,
          depth: 20,
          cutDepth: 8,
          label: 'M4',
          engraveLabel: true,
          textAnchor: 'top',
        }),
      ],
    }),
  }),
];

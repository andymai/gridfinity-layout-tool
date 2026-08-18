// @vitest-environment node
/**
 * Click a real plate into a real board and measure what happens.
 *
 * The board and the plate are separate solids, so nothing about either mesh
 * says the plate will go in: both are watertight, both have plausible triangle
 * counts, and every bounding-box assertion passes whether the pocket is 0.3mm
 * too small, floored by a neighbouring cavity, or missing its retention ribs
 * entirely. Mating the two is the only way to see it.
 *
 * Two questions, because either alone is satisfied by a broken part:
 *
 *  - Seated, does anything touch? A pocket cut narrow or shallow shows up as
 *    solid-on-solid overlap under the plate, swept across its WHOLE footprint
 *    rather than at a spot someone already suspected (CLAUDE.md gotcha 15).
 *  - Dropped, what stops it? A plate that falls to the pocket floor has no ribs
 *    to click behind and will not stay in. The descent is stated as a delta
 *    against the same board with the socket turned off, where the pocket is the
 *    only variable.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams, Cutout } from '@/shared/types/bin';
import type {
  MeshData,
  LabelPlateMeshData,
  LabelPlatesMeshData,
} from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { initTestKernel } from '@/test/initTestKernel';
import { seatDepth } from './__kernel-tests__/binSeating';
import { interferenceAt } from './__kernel-tests__/lidSeating';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import {
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_RIB_HEIGHT_MM,
  LABEL_SOCKET_RIB_START_MM,
} from '@/shared/constants/labelPlates';

let generateBin: (params: BinParams) => MeshData;
let generateLabelPlates: (params: BinParams) => LabelPlatesMeshData | null;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
  generateLabelPlates = (await import('./labelPlateGenerator')).generateLabelPlates;
}, 60000);

/** How far above the pocket floor the rib tops sit: where a rigid plate stops. */
const RIB_TOP_MM = LABEL_SOCKET_RIB_START_MM + LABEL_SOCKET_RIB_HEIGHT_MM;

/**
 * Overlap below this is meshing noise on the coincident plane where the plate's
 * bottom face meets the pocket floor, not contact.
 */
const NOISE_MM = 0.05;

/**
 * Worst solid-on-solid overlap (mm) anywhere under the seated plate.
 *
 * Swept rather than aimed, for the reason `worstSeatInterference` is: a probe
 * pointed at the place someone already suspected is how 2.8mm of overlap
 * shipped once already.
 *
 * The grid is deliberately NOT the plate's own bounds on a whole-millimetre
 * step. A plate is 11mm deep, so such a grid puts columns exactly on its outer
 * face planes, where the ray is coplanar with the side triangles and the span
 * parity flips: the recessed latch groove reads back as solid and the retention
 * rib it is designed to swallow reports a phantom 0.4mm clash. Sampling on an
 * off-pitch step with an offset keeps every column off a face plane, and the
 * grid is extended past the bounds so the real edges are still covered.
 */
function worstPlateInterference(
  board: MeshData,
  plate: MeshData,
  dz: number
): { readonly mm: number; readonly x: number; readonly y: number } {
  const bb = boundingBox(plate.vertices);
  let worst = { mm: 0, x: 0, y: 0 };
  for (let x = bb.minX - 0.3; x <= bb.maxX + 0.3; x += 0.97) {
    for (let y = bb.minY - 0.3; y <= bb.maxY + 0.3; y += 0.97) {
      const px = x + 0.013;
      const py = y + 0.017;
      const mm = interferenceAt(board, plate, px, py, dz);
      if (mm > worst.mm) worst = { mm, x: px, y: py };
    }
  }
  return worst;
}

const SOCKETED: Partial<Cutout> = {
  label: 'M4',
  labelMode: 'socket',
  textAnchor: 'top',
};

function board(cutoutOver: Partial<Cutout> = SOCKETED): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 4,
    style: 'solid',
    // No stacking lip, so the board's mesh maxZ IS the fill surface and the
    // descent below is measured from the plane the plate is pressed against.
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    cutouts: [
      {
        id: 'socketed',
        shape: 'rectangle',
        x: 40,
        y: 10,
        width: 25,
        depth: 20,
        cutDepth: 8,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
        ...cutoutOver,
      },
    ],
  };
}

/**
 * The plate as a probe-ready solid in the board's XY frame.
 *
 * A plate carries no edge lines (the preview does not draw them), so the field
 * is filled in empty rather than the probes being loosened to accept a
 * different shape.
 */
function plateSolid(plate: LabelPlateMeshData, dx = 0, dy = 0): MeshData {
  const vertices = new Float32Array(plate.vertices);
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] += dx;
    vertices[i + 1] += dy;
  }
  return {
    vertices,
    normals: plate.normals,
    indices: plate.indices,
    edgeVertices: new Float32Array(0),
    triangleCount: plate.triangleCount,
  };
}

describe('cutout label socket seating', () => {
  it('takes its plate with nothing touching anywhere under it', () => {
    const params = board();
    const bin = generateBin(params);
    const plates = generateLabelPlates(params);

    expect(plates?.plates).toHaveLength(1);
    const plate = plates?.plates[0];
    if (!plate) throw new Error('no plate generated');

    const seated = plateSolid(plate, plate.seatX, plate.seatY);
    const worst = worstPlateInterference(bin, seated, plate.seatZ);

    expect(
      worst.mm,
      `plate fouls the board by ${worst.mm.toFixed(3)}mm at (${worst.x.toFixed(1)}, ${worst.y.toFixed(1)})`
    ).toBeLessThan(NOISE_MM);
  }, 120000);

  it('stops on the retention ribs rather than falling to the pocket floor', () => {
    const params = board();
    const bin = generateBin(params);
    const plate = generateLabelPlates(params)?.plates[0];
    if (!plate) throw new Error('no plate generated');

    const descent = seatDepth(plateSolid(plate), bin, { dx: plate.seatX, dy: plate.seatY }, 1);

    // Pressed down from the fill surface, a rigid plate lands on the rib tops.
    // Reaching the floor instead would mean the ribs are absent: a pocket the
    // plate drops into and falls straight back out of.
    expect(descent.mm).toBeCloseTo(LABEL_SOCKET_CLICK_POCKET_DEPTH_MM - RIB_TOP_MM, 1);
    expect(descent.mm).toBeLessThan(LABEL_SOCKET_CLICK_POCKET_DEPTH_MM - NOISE_MM);
  }, 120000);

  it('descends nowhere at all on the same board with the socket off', () => {
    const socketed = board();
    const plate = generateLabelPlates(socketed)?.plates[0];
    if (!plate) throw new Error('no plate generated');

    // Same board, same cutout, engraved instead, so the pocket is the only
    // variable, so the descent above is entirely the socket's doing.
    const plain = generateBin(board({ ...SOCKETED, labelMode: 'engrave', engraveLabel: true }));
    const descent = seatDepth(plateSolid(plate), plain, { dx: plate.seatX, dy: plate.seatY }, 1);

    expect(descent.mm).toBeLessThan(NOISE_MM);
  }, 120000);
});

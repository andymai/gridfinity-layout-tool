// @vitest-environment node
/**
 * Real-kernel tests for the socket negative itself.
 *
 * The composed form (pocket minus ribs, cut in one pass) exists because the
 * boolean stage fuses before it cuts, so ribs handed over as fuse targets
 * would be carved back out by the pocket that follows them. That trade only
 * holds if the negative really is pocket-shaped with rib-shaped bites taken
 * out of it, which is what these measure, on the tool rather than through a
 * whole generated board.
 *
 * Seating is verified where it belongs, against real parts:
 * `cutoutSocketSeating.kernel.test.ts` mates a plate to a board, and
 * `scenarios/cutoutLabelSockets.ts` reads the cut pocket out of the mesh.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getBounds, mesh, withScope } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import { toIndexedMeshData } from './utils';
import { meshVolume } from './__kernel-tests__/meshAssertions';
import { buildCutoutSocketCutter } from './cutoutLabelSocketBuilder';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import { COPLANAR_MARGIN } from './generatorConstants';

beforeAll(async () => {
  const { initBrepjs } = await import('./__kernel-tests__/wasmInit');
  await initBrepjs();
}, 60_000);

const CLEARANCE = 0.3;
const TOP_Z = 20;

function cutterBounds(over: Partial<Parameters<typeof buildCutoutSocketCutter>[1]> = {}) {
  return withScope((scope: DisposalScope) =>
    getBounds(
      buildCutoutSocketCutter(scope, {
        centerX: 0,
        centerY: 0,
        topZ: TOP_Z,
        plateWidthU: 1,
        clearanceMm: CLEARANCE,
        vertical: false,
        ...over,
      })
    )
  );
}

describe('buildCutoutSocketCutter', () => {
  it('spans the plate plus its clearance, and opens past the surface', () => {
    const b = cutterBounds();

    expect(b.xMax - b.xMin).toBeCloseTo(labelPlateWidthMm(1) + CLEARANCE, 3);
    expect(b.yMax - b.yMin).toBeCloseTo(LABEL_PLATE_HEIGHT_MM + CLEARANCE, 3);
    expect(b.zMin).toBeCloseTo(TOP_Z - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM, 3);
    // Ending exactly on the face it opens through would leave the boolean two
    // coincident planes, so the cutter runs past it.
    expect(b.zMax).toBeCloseTo(TOP_Z + COPLANAR_MARGIN, 3);
  });

  it('grows with the plate width', () => {
    const oneU = cutterBounds({ plateWidthU: 1 });
    const twoU = cutterBounds({ plateWidthU: 2 });

    expect(twoU.xMax - twoU.xMin).toBeCloseTo(labelPlateWidthMm(2) + CLEARANCE, 3);
    expect(twoU.xMax - twoU.xMin).toBeGreaterThan(oneU.xMax - oneU.xMin);
    expect(twoU.yMax - twoU.yMin).toBeCloseTo(oneU.yMax - oneU.yMin, 3);
  });

  // Built horizontal and turned as a whole, so the two orientations cannot
  // describe different geometry.
  it('turns the whole negative for a 90° socket', () => {
    const flat = cutterBounds();
    const turned = cutterBounds({ vertical: true });

    expect(turned.xMax - turned.xMin).toBeCloseTo(flat.yMax - flat.yMin, 3);
    expect(turned.yMax - turned.yMin).toBeCloseTo(flat.xMax - flat.xMin, 3);
    expect(turned.zMin).toBeCloseTo(flat.zMin, 3);
    expect(turned.zMax).toBeCloseTo(flat.zMax, 3);
  });

  it('lands on the requested centre', () => {
    const b = cutterBounds({ centerX: -12, centerY: 7 });

    expect((b.xMin + b.xMax) / 2).toBeCloseTo(-12, 3);
    expect((b.yMin + b.yMax) / 2).toBeCloseTo(7, 3);
  });

  // The bites the ribs take are inside the pocket, so they change the tool's
  // VOLUME without changing its bounds. A negative that lost them would cut a
  // plain slot the plate drops straight through.
  it('has the rib bites taken out of it', () => {
    const withRibs = withScope((scope: DisposalScope) => {
      const cutter = buildCutoutSocketCutter(scope, {
        centerX: 0,
        centerY: 0,
        topZ: TOP_Z,
        plateWidthU: 1,
        clearanceMm: CLEARANCE,
        vertical: false,
      });
      const indexed = toIndexedMeshData(mesh(cutter, { tolerance: 0.01 }));
      return meshVolume({
        vertices: indexed.vertices,
        normals: indexed.normals,
        indices: indexed.indices,
        edgeVertices: new Float32Array(0),
        triangleCount: indexed.triangleCount,
      });
    });
    const pocketOnly =
      (labelPlateWidthMm(1) + CLEARANCE) *
      (LABEL_PLATE_HEIGHT_MM + CLEARANCE) *
      (LABEL_SOCKET_CLICK_POCKET_DEPTH_MM + COPLANAR_MARGIN);

    expect(withRibs).toBeGreaterThan(0);
    expect(withRibs).toBeLessThan(pocketOnly);
  });
});

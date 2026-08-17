// @vitest-environment node
/**
 * A detachable foot is only useful if it drops into a baseplate pocket, and
 * nothing about that is visible to a bounding-box, triangle-count or watertight
 * assertion: a foot built from a SCALED profile is a perfectly valid solid of
 * plausible size that simply perches on the pocket instead of entering it.
 *
 * So the central check here compares the foot's outer surface against a full
 * integral foot's at every breakpoint of the socket profile. They must agree
 * exactly, not closely — the foot is meant to BE a section of that profile, and
 * any drift is the kind that shows up as a bin sitting 4.75mm proud rather than
 * as anything a mesh check would flag.
 *
 * The rest pins down what the plan and the builder have to agree about: pins
 * that stop flush with the floor they pass through, holes where the plan put
 * them, and a magnet pocket that opens downward so the magnet can be inserted.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import type { MeshData } from '@/features/generation/bridge/types';
import { initTestKernel } from '@/test/initTestKernel';
import { footArmMm, footPinPositions, type FootPlacement } from '@/shared/utils/detachableFeetPlan';
import { boundingBox, isSolidThrough, meshTopologyStats } from './__kernel-tests__/meshAssertions';

import type { DetachableFeetGeometry, DetachableFeetOptions } from './detachableFeetBuilder';

type BuildFeet = (opts: DetachableFeetOptions) => DetachableFeetGeometry;
type BuildCell = (w: number, d: number) => Shape3D;

let buildDetachableFeet: BuildFeet;
let buildSingleCellSocket: BuildCell;
let meshOf: (shape: Shape3D) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  buildDetachableFeet = (await import('./detachableFeetBuilder')).buildDetachableFeet;
  buildSingleCellSocket = (await import('./socketBuilder')).buildSingleCellSocket;
  const { mesh } = await import('brepjs');
  const { toIndexedMeshData } = await import('./meshUtils');
  meshOf = (shape) => {
    const indexed = toIndexedMeshData(mesh(shape, { tolerance: 0.01, angularTolerance: 0.1 }));
    return {
      vertices: indexed.vertices,
      indices: indexed.indices,
      triangleCount: indexed.triangleCount,
    } as MeshData;
  };
}, 60000);

const PITCH = 42;
const CLEARANCE = 0.5;
const FLOOR = 1.2;
const PIN = 5;
const MAGNET_D = 6.5;
const MAGNET_DEPTH = 2;
const ARM = footArmMm({ magnetDiameterMm: MAGNET_D, magnetInsetFromEdgeMm: 8, pinDiameterMm: PIN });

/**
 * Z of every breakpoint in the socket profile, measured from the foot's top.
 * The loft's sections land exactly here, so a vertex-level comparison at these
 * depths is comparing the profile itself rather than the tessellation.
 */
const PROFILE_Z = [0, -0.25, -2.4, -4.2, -5];

/** A single L foot on a cell centred at the origin, hugging its +X/+Y corner. */
const CORNER_L: FootPlacement = {
  shape: 'L',
  x: PITCH / 2,
  y: PITCH / 2,
  dirX: 1,
  dirY: 1,
  cellW: PITCH,
  cellD: PITCH,
};

function feetOf(over: Partial<DetachableFeetOptions> = {}): DetachableFeetGeometry {
  return buildDetachableFeet({
    placements: [CORNER_L],
    armMm: ARM,
    pinDiameterMm: PIN,
    pinHoleDiameterMm: PIN,
    floorThicknessMm: FLOOR,
    forExport: true,
    ...over,
  });
}

/** Extreme coordinate on one axis among vertices sitting at `z`. */
function extremeAt(m: MeshData, z: number, axis: 0 | 1): number {
  let best = -Infinity;
  for (let i = 0; i < m.vertices.length; i += 3) {
    if (Math.abs(m.vertices[i + 2] - z) > 1e-4) continue;
    best = Math.max(best, m.vertices[i + axis]);
  }
  return best;
}

describe('detachable foot geometry', () => {
  it('reproduces the integral foot profile exactly on the faces it keeps', () => {
    const { feet, pinHoles } = feetOf();
    const full = buildSingleCellSocket(PITCH - CLEARANCE, PITCH - CLEARANCE);
    try {
      const footMesh = meshOf(feet[0]);
      const fullMesh = meshOf(full);
      for (const z of PROFILE_Z) {
        // The outer faces this foot keeps are its +X and +Y ones.
        expect(extremeAt(footMesh, z, 0)).toBeCloseTo(extremeAt(fullMesh, z, 0), 6);
        expect(extremeAt(footMesh, z, 1)).toBeCloseTo(extremeAt(fullMesh, z, 1), 6);
      }
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles.delete();
      full.delete();
    }
  });

  it('is one closed solid once its pins are on', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const stats = meshTopologyStats(meshOf(feet[0]));
      expect(stats.boundaryEdges).toBe(0);
      expect(stats.nonManifoldEdges).toBe(0);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles.delete();
    }
  });

  it('stops its pins flush with the floor they pass through', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const box = boundingBox(meshOf(feet[0]).vertices);
      // Top of the pins, not of the foot: the foot's own top face is Z=0.
      expect(box.maxZ).toBeCloseTo(FLOOR, 4);
      expect(box.minZ).toBeCloseTo(-5, 4);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles.delete();
    }
  });

  it('takes a thicker floor as a longer pin, so the fit never depends on wall thickness', () => {
    const thick = feetOf({ floorThicknessMm: 2.4 });
    try {
      expect(boundingBox(meshOf(thick.feet[0]).vertices).maxZ).toBeCloseTo(2.4, 4);
    } finally {
      thick.feet.forEach((f) => f.delete());
      thick.pinHoles.delete();
    }
  });

  it('opens its magnet pocket at the underside, where the magnet goes in', () => {
    const withMagnet = feetOf({
      magnet: { diameterMm: MAGNET_D, depthMm: MAGNET_DEPTH, positions: [[13, 13]] },
    });
    try {
      const m = meshOf(withMagnet.feet[0]);
      const { minZ } = boundingBox(m.vertices);
      // Nothing solid in the pocket's band...
      expect(isSolidThrough(m, 13, 13, minZ + 0.05, minZ + MAGNET_DEPTH - 0.05)).toBe(false);
      // ...and solid again above it, so the pocket is blind rather than a hole.
      expect(isSolidThrough(m, 13, 13, minZ + MAGNET_DEPTH + 0.1, minZ + 4)).toBe(true);
    } finally {
      withMagnet.feet.forEach((f) => f.delete());
      withMagnet.pinHoles.delete();
    }
  });

  it('leaves a plain foot solid where a magnet pocket would be', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const m = meshOf(feet[0]);
      const { minZ } = boundingBox(m.vertices);
      expect(isSolidThrough(m, 13, 13, minZ + 0.05, minZ + MAGNET_DEPTH)).toBe(true);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles.delete();
    }
  });

  it('punches its floor holes at the pin positions and nowhere else', () => {
    const { feet, pinHoles } = feetOf();
    try {
      const tool = meshOf(pinHoles);
      const box = boundingBox(tool.vertices);
      // The tool spans the floor with margin at both ends, so the holes go
      // clean through rather than leaving a skin.
      expect(box.minZ).toBeLessThan(0);
      expect(box.maxZ).toBeGreaterThan(FLOOR);

      for (const pin of footPinPositions(CORNER_L, ARM, PIN)) {
        expect(isSolidThrough(tool, pin.x, pin.y, 0.1, FLOOR - 0.1)).toBe(true);
      }
      // A point a full pin diameter off any of them is not drilled.
      expect(isSolidThrough(tool, CORNER_L.x, CORNER_L.y, 0.1, FLOOR - 0.1)).toBe(false);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles.delete();
    }
  });

  it('builds one solid per placement', () => {
    const bar: FootPlacement = {
      shape: 'bar',
      x: 0,
      y: PITCH / 2,
      dirX: 0,
      dirY: 1,
      cellW: PITCH,
      cellD: PITCH,
    };
    const { feet, pinHoles } = feetOf({ placements: [CORNER_L, bar] });
    try {
      expect(feet).toHaveLength(2);
      for (const f of feet) expect(meshTopologyStats(meshOf(f)).boundaryEdges).toBe(0);
    } finally {
      feet.forEach((f) => f.delete());
      pinHoles.delete();
    }
  });
});

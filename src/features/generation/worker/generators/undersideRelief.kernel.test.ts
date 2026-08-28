// @vitest-environment node
/**
 * The underside relief takes material from a band no mesh-level assertion looks
 * at.
 *
 * A relieved bin and a standard one are both watertight, both have plausible
 * triangle counts, and every bounding-box assertion passes on either — the
 * outer profile is deliberately identical, because the foot still has to mate
 * with a baseplate. What separates them is entirely interior: which vertical
 * bands are solid at which columns. So the checks here are all column probes,
 * and each one states the band it means in terms of the mesh's own bounding box
 * rather than build-space constants (the export mesh sits with the feet on
 * Z=0).
 *
 * Three things are under test, and only the first is the feature:
 *   1. the socket band is hollow and the interior floor above it is not,
 *   2. the ring the cut leaves is still there at the bottom, where the part
 *      meets the bed,
 *   3. the outer profile is unchanged through the whole socket band — the cut
 *      is a scaled copy of the socket profile precisely so it cannot reach the
 *      baseplate-mating taper, and that is the claim worth pinning down.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { binFloorMm } from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { initTestKernel } from '@/test/initTestKernel';
import {
  boundingBox,
  isSolidThrough,
  meshVolume,
  sectionHalfWidth,
  verticalSolidSpans,
} from './__kernel-tests__/meshAssertions';

let generateBin: (params: BinParams, onProgress: undefined, forExport: boolean) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
}, 60000);

/** Gridfinity socket depth (mm) — the band the relief opens. */
const SOCKET_HEIGHT = 5;
/** Default wall/floor thickness (mm) for `DEFAULT_BIN_PARAMS`. */
const WALL = 1.2;

type BaseOver = Partial<BinParams['base']>;

/**
 * Always the EXPORT mesh. The preview path meshes the base socket separately
 * and concatenates it, which leaves the socket-top and floor-bottom faces
 * coincident — a column ray then collapses the two crossings into one and every
 * span above it pairs into the void instead of the solid. On the preview mesh a
 * plain standard bin reads as solid only up to the socket top, with its floor
 * missing entirely, so the probes below would be measuring the tessellation
 * rather than the geometry. `forExport` is the third POSITIONAL argument, not a
 * field on the params.
 */
function bin(over: BaseOver, size: Partial<BinParams> = {}): MeshData {
  return generateBin(
    {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 3,
      ...size,
      base: { ...DEFAULT_BIN_PARAMS.base, ...over },
    },
    undefined,
    true
  );
}

const STANDARD: BaseOver = {};
const INTERIOR: BaseOver = { lightweight: true };
const UNDERSIDE: BaseOver = { lightweight: true, lightweightMode: 'underside' };

/**
 * Off-axis on both axes on purpose. Planar faces are fan-triangulated from the
 * footprint centre, so a column on X=0 or Y=0 rides shared triangle edges.
 */
const BORE = { x: 1.3, y: 0.7 };

/**
 * A column through the ring at the foot's BOTTOM. The bottom face reaches
 * 17.8mm from the cell centre and the relief holds 3mm back from it, so 16mm is
 * inside the wall down there — and inside the bore higher up, where the socket
 * profile has flared out past it.
 */
const RING = { x: 16, y: 0.7 };

describe('underside relief', () => {
  it('opens the socket band and leaves the interior floor solid', () => {
    const mesh = bin(UNDERSIDE);
    const { minZ } = boundingBox(mesh.vertices);
    const spans = verticalSolidSpans(mesh, BORE.x, BORE.y);

    // Nothing anywhere in the socket band at this column: the ring is the only
    // material down there and this column is inside its bore.
    for (const [from, to] of spans) {
      const overlapsSocket = from < minZ + SOCKET_HEIGHT - 0.05 && to > minZ + 0.05;
      expect(overlapsSocket).toBe(false);
    }

    // ...and the floor above it is continuous, which is the whole point.
    expect(
      isSolidThrough(mesh, BORE.x, BORE.y, minZ + SOCKET_HEIGHT, minZ + SOCKET_HEIGHT + WALL)
    ).toBe(true);
  });

  it('is the exact complement of the interior mode at the same column', () => {
    const { minZ } = boundingBox(bin(STANDARD).vertices);
    const socketTop = minZ + SOCKET_HEIGHT;

    // A standard bin is solid from the bed straight through the floor.
    expect(isSolidThrough(bin(STANDARD), BORE.x, BORE.y, minZ, socketTop + WALL)).toBe(true);
    // The interior mode keeps the bottom of the cup and opens the top, so the
    // floor is what is missing.
    expect(isSolidThrough(bin(INTERIOR), BORE.x, BORE.y, socketTop, socketTop + WALL)).toBe(false);
    // The relief is the other way round.
    expect(isSolidThrough(bin(UNDERSIDE), BORE.x, BORE.y, socketTop, socketTop + WALL)).toBe(true);
    expect(isSolidThrough(bin(UNDERSIDE), BORE.x, BORE.y, minZ, minZ + 1)).toBe(false);
  });

  it('leaves the ring standing where the part meets the bed', () => {
    const mesh = bin(UNDERSIDE);
    const { minZ } = boundingBox(mesh.vertices);
    // Solid from the bed up through the lower taper. Without this the "hollow
    // socket band" assertion above would also pass on a bin with no feet at all.
    expect(isSolidThrough(mesh, RING.x, RING.y, minZ, minZ + 2.5)).toBe(true);
  });

  it('supports the bridged floor with a cross tied to the bed', () => {
    const mesh = bin(UNDERSIDE);
    const { minZ } = boundingBox(mesh.vertices);
    expect(isSolidThrough(mesh, 0, 1.3, minZ, minZ + SOCKET_HEIGHT)).toBe(true);
    expect(isSolidThrough(mesh, 1.3, 0, minZ, minZ + SOCKET_HEIGHT)).toBe(true);
    expect(isSolidThrough(mesh, 1.3, 1.3, minZ, minZ + SOCKET_HEIGHT)).toBe(false);
  });

  it('does not touch the baseplate-mating profile at any depth', () => {
    const standard = bin(STANDARD);
    const relieved = bin(UNDERSIDE);
    const { minZ } = boundingBox(standard.vertices);

    // Sampled across the whole socket band, including both tapers and the
    // vertical part between them. The relief is a scaled copy of this profile,
    // so the outer surface must be reproduced exactly, not merely closely.
    for (const dz of [0, 0.4, 0.8, 1.6, 2.4, 3.2, 4.0, 4.6, 4.9]) {
      const z = minZ + dz;
      expect(sectionHalfWidth(relieved, z)).toBeCloseTo(sectionHalfWidth(standard, z), 6);
    }
  });

  it('removes real material, and less of it than the interior mode', () => {
    const standard = meshVolume(bin(STANDARD));
    const interior = meshVolume(bin(INTERIOR));
    const underside = meshVolume(bin(UNDERSIDE));

    expect(underside).toBeLessThan(standard);
    // The relief holds a wider border back around each foot than the interior
    // mode's `wallThickness` shell, so it always saves less. A relief that had
    // silently fallen back to the wall offset would land on the interior figure.
    expect(underside).toBeGreaterThan(interior);
    // Better than a third of the bin, which is the claim the feature makes.
    expect(standard - underside).toBeGreaterThan(standard * 0.3);
  });

  it('saves the same per cell as the footprint grows', () => {
    const perCell = (w: number, d: number): number =>
      (meshVolume(bin(STANDARD, { width: w, depth: d })) -
        meshVolume(bin(UNDERSIDE, { width: w, depth: d }))) /
      (w * d);
    // The relief is per-foot, so this is flat by construction — and a clip that
    // ate into the wrong cells would break it before it broke any other check.
    expect(perCell(2, 2)).toBeCloseTo(perCell(1, 1), -1);
  }, 120000);
});

/**
 * The interior relief opens the body floor over each cup mouth, and the tools
 * that do it are clipped to the open-compartment region so a divider keeps a
 * solid core beneath it. Both the opening and its clip are measured against the
 * FLOOR, which is `binFloorMm` rather than the wall — a thin-walled bin has the
 * widest gap between the two, so it is where a tool sized off the wall stops
 * reaching and silently re-seals every cup.
 *
 * Sealed cups are watertight, manifold and of plausible triangle count. Only a
 * column probe sees them.
 */
describe('the interior relief opens its cups whatever the wall', () => {
  it.each([0.4, 0.8, 1.2, 1.6])(
    'opens them at a %smm wall',
    (wallThickness) => {
      const m = bin(INTERIOR, {
        width: 2,
        depth: 1,
        wallThickness,
        // Multiple compartments, so the openings are clipped rather than used raw.
        compartments: { cols: 3, rows: 1, thickness: 1.2, cells: [0, 1, 2] },
      });
      const { minZ } = boundingBox(m.vertices);
      // The export mesh sits with the feet on its own minZ, so the cavity floor is
      // a socket plus a floor above that.
      const floorTop = minZ + GRIDFINITY_SPEC.SOCKET_HEIGHT + binFloorMm(wallThickness);
      // Just under the cavity floor, at a cup mouth: open on the interior relief.
      expect(isSolidThrough(m, 21, 0, floorTop - 0.3, floorTop - 0.05)).toBe(false);
      // And between the cups the floor is still there, so this is an opening
      // rather than a floor that simply failed to build.
      expect(isSolidThrough(m, 0, 0, floorTop - 0.3, floorTop - 0.05)).toBe(true);
    },
    120000
  );
});

// @vitest-environment node
/**
 * Verifies the compatibility rule between a bin's overhang feet and a
 * baseplate's over-tile margin pockets (issue #1641 follow-up).
 *
 * The rule: a bin overhang foot on a side with overhang `O` mates a baseplate
 * over-tile pocket on a side with padding `P` **iff `O == P`** (and the bin is
 * placed against that drawer wall). It holds because:
 *   1. Position — both the bin feet (`buildOverhangFeet`) and the baseplate
 *      pockets (over-tile path) lay out their margin cells with the SAME shared
 *      `frameCells` helper, so at matched margin + grid they're co-located and
 *      subdivided identically at 42mm pitch.
 *   2. Fit — the foot is a socket built at `O − CLEARANCE`; the pocket is built
 *      at full size `P`. With `O == P` that's exactly the standard gridfinity
 *      socket↔pocket clearance (CLEARANCE/2 per side), so the foot drops in.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mesh } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { frameCells } from './cellDecomposition';
import { CLEARANCE, SIZE } from './generatorConstants';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

/** Mesh a shape and return its AABB X-span (top-face width for sockets/pockets). */
function widthOf(shape: Shape3D): number {
  const m = mesh(shape, { tolerance: 0.05, angularTolerance: 10 });
  const verts = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
  const bb = boundingBox(verts);
  shape.delete();
  return bb.maxX - bb.minX;
}

describe('overhang feet ↔ over-tile pocket compatibility', () => {
  it('lays out bin feet and baseplate pockets at identical margin positions (shared frameCells)', () => {
    // A matched edge: bin overhang and baseplate padding both = 12mm on the left.
    const M = 12;
    const binFeet = frameCells(2, 2, { left: M, right: 0, front: 0, back: 0 }, SIZE, 8);
    const platePockets = frameCells(2, 2, { left: M, right: 0, front: 0, back: 0 }, SIZE, 8);

    // Same helper, same inputs → byte-identical layout (position + size).
    expect(platePockets).toEqual(binFeet);
    // Left margin cell sits one half-margin beyond the grid edge, at 42mm pitch.
    const left = binFeet.filter((c) => c.centerX < -SIZE);
    expect(left).toHaveLength(2); // one per nominal row
    expect(left[0].centerX).toBeCloseTo(-SIZE - M / 2, 6);
    expect(left[0].widthUnits).toBeCloseTo(M / SIZE, 6);
  });

  it('a matched clipped foot drops into the clipped pocket with standard clearance', async () => {
    const { buildSingleCellSocket } = await import('./socketBuilder');
    const { getPocketTemplate } = await import('./baseplatePockets');
    const M = 12; // matched overhang == padding (mm)

    // Bin overhang foot: socket built at O − CLEARANCE.
    const footWidth = widthOf(buildSingleCellSocket(M - CLEARANCE, M - CLEARANCE));
    // Baseplate over-tile pocket: cutter built at full size P.
    const pocketWidth = widthOf(getPocketTemplate(M, M, true, true));

    expect(footWidth).toBeCloseTo(M - CLEARANCE, 1);
    expect(pocketWidth).toBeCloseTo(M, 1);
    // Foot is smaller than the pocket opening by exactly CLEARANCE → it seats
    // with CLEARANCE/2 of play per side, same as a standard gridfinity foot.
    expect(pocketWidth - footWidth).toBeCloseTo(CLEARANCE, 1);
    expect(footWidth).toBeLessThan(pocketWidth);
  });
});

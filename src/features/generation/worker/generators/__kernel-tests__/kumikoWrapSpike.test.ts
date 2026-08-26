// @vitest-environment node
/**
 * Feasibility spike (not a CI gate): can the kumiko corner-wrap cutter be
 * built with exact BREP on the active kernel?
 *
 * The wrapped-lattice pattern is authored in unrolled (u, z) coordinates and
 * mapped onto the bin wall. Flat wall spans extrude trivially; the open
 * question is the rounded corner, where the cutter must be:
 *
 *   annular wedge  −  (vertical struts + horizontal struts + diagonal struts)
 *
 * with vertical struts as small-angle revolves (radial-plane sides),
 * horizontal struts as partial revolves, and diagonal struts as rectangles
 * swept along a helix (a straight line in unrolled space IS a helix on the
 * corner cylinder).
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/kumikoWrapSpike --reporter=verbose
 *   BREPJS_KERNEL=manifold pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/kumikoWrapSpike --reporter=verbose
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  drawRoundedRectangle,
  revolve,
  rotate,
  cut,
  fuseAll,
  unwrap,
  isValid,
  measureVolume,
  mesh,
  sketchHelix,
  orientedFace,
  planarFace,
  type Shape3D,
  type OrientedFace,
  type PlanarFace,
} from 'brepjs';
import { initBrepjs, getKernelName } from './wasmInit';
import { sketch } from '../meshUtils';

type RevolveProfile = OrientedFace & PlanarFace;

// Geometry mirroring a 1x1 bin corner: outer radius ~4mm, 1.2mm wall.
const R_OUT = 4;
const WALL_T = 1.2;
const R_IN = R_OUT - WALL_T;
const MARGIN = 1;
const R0 = R_IN - MARGIN;
const R1 = R_OUT + MARGIN;
const BAND_Z0 = 2;
const BAND_Z1 = 18;
const CORNER_ANGLE = Math.PI / 2;
const STRUT_W = 1.2;

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

/** Radial profile rect on the XZ plane: r ∈ [r0, r1], z ∈ [z0, z1]. */
function radialProfileFace(r0: number, r1: number, z0: number, z1: number): RevolveProfile {
  const drawing = drawRoundedRectangle(r1 - r0, z1 - z0, 0).translate((r0 + r1) / 2, (z0 + z1) / 2);
  const face = sketch(drawing, 'XZ').face();
  const oriented = unwrap(orientedFace(face));
  // Both brands are runtime-proven above; TS's planarFace signature drops the
  // oriented brand, so restore the intersection it verified.
  return unwrap(planarFace(oriented)) as RevolveProfile;
}

/** Annular wedge: radial rect revolved around Z from θ=0 to `angle`. */
function annularWedge(r0: number, r1: number, z0: number, z1: number, angle: number): Shape3D {
  const face = radialProfileFace(r0, r1, z0, z1);
  const wedge = unwrap(revolve(face, { axis: [0, 0, 1], at: [0, 0, 0], angle }));
  face.delete();
  return wedge;
}

/** Vertical strut at angle θ: small-angle revolve so both sides are radial planes. */
function verticalStrut(theta: number, widthMm: number): Shape3D {
  const dTheta = widthMm / R_OUT;
  const slab = annularWedge(R0, R1, BAND_Z0 - MARGIN, BAND_Z1 + MARGIN, dTheta);
  const placed = rotate(slab, ((theta - dTheta / 2) * 180) / Math.PI, { axis: [0, 0, 1] });
  slab.delete();
  return placed;
}

/** Horizontal strut: partial revolve of a thin radial rect across the corner. */
function horizontalStrut(zCenter: number, widthMm: number): Shape3D {
  return annularWedge(R0, R1, zCenter - widthMm / 2, zCenter + widthMm / 2, CORNER_ANGLE);
}

/**
 * Diagonal strut: rectangle swept along a helix. The unrolled segment runs
 * from (θ=0, z=z0) to (θ=span, z=z1); on the corner cylinder that is a helix
 * with pitch = Δz · 2π / span.
 */
function diagonalStrut(z0: number, z1: number, angleSpan: number, widthMm: number): Shape3D {
  const dz = Math.abs(z1 - z0);
  const pitch = (dz * 2 * Math.PI) / angleSpan;
  const rMid = (R_IN + R_OUT) / 2;
  const spine = sketchHelix(pitch, dz, rMid, [0, 0, Math.min(z0, z1)], [0, 0, 1], z1 < z0);
  return spine.sweepSketch(
    (plane) => drawRoundedRectangle(WALL_T + 2 * MARGIN + 2, widthMm, 0).sketchOnPlane(plane),
    { frenet: true }
  );
}

describe(`kumiko corner-wrap spike on ${getKernelName()}`, () => {
  it('builds a valid annular wedge via partial revolve', () => {
    const wedge = annularWedge(R0, R1, BAND_Z0, BAND_Z1, CORNER_ANGLE);
    expect(isValid(wedge)).toBe(true);
    const vol = unwrap(measureVolume(wedge));
    // Quarter annulus × height. Mesh kernels chord-approximate the arc, so
    // the measured volume sits slightly under the analytic value.
    const expected = (CORNER_ANGLE / 2) * (R1 * R1 - R0 * R0) * (BAND_Z1 - BAND_Z0);
    expect(vol).toBeGreaterThan(expected * 0.95);
    expect(vol).toBeLessThan(expected * 1.005);
    wedge.delete();
  });

  // The wrapped corner cutter needs exact curve queries (helix sweep) that
  // mesh kernels don't provide — on Manifold the draft tier uses the
  // phase-aligned flat-panel fallback instead, so these paths never run there.
  // Kernel name comes from the env (collection time — WASM not yet loaded).
  const exactOnly = getKernelName() === 'manifold' ? it.skip : it;

  exactOnly('builds valid vertical and horizontal struts', () => {
    const v = verticalStrut(Math.PI / 4, STRUT_W);
    const h = horizontalStrut((BAND_Z0 + BAND_Z1) / 2, STRUT_W);
    expect(isValid(v)).toBe(true);
    expect(isValid(h)).toBe(true);
    v.delete();
    h.delete();
  });

  exactOnly('builds a valid diagonal strut via helix sweep', () => {
    const d = diagonalStrut(4, 12, CORNER_ANGLE, STRUT_W);
    expect(isValid(d)).toBe(true);
    expect(unwrap(measureVolume(d))).toBeGreaterThan(0);
    d.delete();
  });

  exactOnly('wedge minus struts yields a valid cutter that opens a wall shell', () => {
    const wedge = annularWedge(R0, R1, BAND_Z0, BAND_Z1, CORNER_ANGLE);
    const struts = unwrap(
      fuseAll([
        verticalStrut(Math.PI / 4, STRUT_W),
        horizontalStrut(10, STRUT_W),
        diagonalStrut(4, 16, CORNER_ANGLE, STRUT_W),
        diagonalStrut(16, 4, CORNER_ANGLE, STRUT_W),
      ])
    );
    const cutter = unwrap(cut(wedge, struts));
    expect(isValid(cutter)).toBe(true);
    expect(unwrap(measureVolume(cutter))).toBeGreaterThan(0);

    // Quarter-cylinder wall shell: outer minus inner, full height 0..20.
    const outer = annularWedge(R_IN, R_OUT, 0, 20, CORNER_ANGLE);
    const opened = unwrap(cut(outer, cutter));
    expect(isValid(opened)).toBe(true);

    const solidVol = unwrap(measureVolume(outer));
    const openedVol = unwrap(measureVolume(opened));
    // The cutter must have removed a meaningful share of the band, but the
    // struts and keep-outs must survive.
    expect(openedVol).toBeLessThan(solidVol * 0.9);
    expect(openedVol).toBeGreaterThan(solidVol * 0.2);

    const meshed = mesh(opened, { tolerance: 0.1 });
    expect(meshed.triangles.length).toBeGreaterThan(0);

    console.log(
      `[${getKernelName()}] shell=${solidVol.toFixed(1)}mm³ opened=${openedVol.toFixed(1)}mm³ removed=${(
        (1 - openedVol / solidVol) *
        100
      ).toFixed(0)}% tris=${meshed.triangles.length}`
    );
  });
});

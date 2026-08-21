// @vitest-environment node
/**
 * Real-kernel verification of leaning compartment dividers.
 *
 * Two things are under test and neither is visible to a bounding-box, triangle
 * count or watertight assertion, because a leaning divider is a perfectly good
 * solid whichever way it leans and whatever it weighs:
 *
 *  - the wall keeps its PERPENDICULAR thickness at every height. Sizing the
 *    section on the plan footprint instead thins it by cos(lean), which a
 *    volume check cannot separate from a wall that is simply shorter.
 *  - the foot lands where the plan says it does. `sketchOnPlane('YZ', …)` is
 *    the frame the section is drawn in, and a wrong axis mapping or a negated
 *    origin (CLAUDE.md gotcha #12) leans the wall the wrong way or into the
 *    wrong axis while leaving a clean solid behind.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts dividerRake --reporter=verbose
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getKernelName } from './wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, DividerOverride } from '@/shared/types/bin';

const INNER_W = 80;
const INNER_D = 60;
const WALL_HEIGHT = 30;
const THICKNESS = 1.6;

interface Mesh {
  readonly vertices: ArrayLike<number>;
  readonly triangles: ArrayLike<number>;
}

function makeParams(override: DividerOverride, cols = 2, rows = 1): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    compartments: {
      cols,
      rows,
      thickness: THICKNESS,
      cells: Array.from({ length: cols * rows }, (_, i) => i),
      dividerOverrides: [override],
    },
  };
}

const lean = (rakeDeg: number, rest: Partial<DividerOverride> = {}): DividerOverride => ({
  compartmentA: 0,
  compartmentB: 1,
  offsetStart: 0,
  offsetEnd: 0,
  rakeDeg,
  ...rest,
});

/**
 * [minX, maxX] the surface reaches on the plane Z.
 *
 * Slices triangle edges rather than sampling vertices, for the reason
 * `sectionHalfWidth` does: a prism only carries vertices on its end caps, so
 * vertex sampling reads nothing at all in between. Signed, unlike
 * `sectionHalfWidth`, because where the wall leans TO is the whole question.
 */
function sectionXSpan({ vertices, triangles }: Mesh, z: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const edge = (a: number, b: number): void => {
    const za = vertices[a + 2];
    const zb = vertices[b + 2];
    if (za === zb || z < Math.min(za, zb) || z > Math.max(za, zb)) return;
    const t = (z - za) / (zb - za);
    const x = vertices[a] + t * (vertices[b] - vertices[a]);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  };
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 3;
    const b = triangles[i + 1] * 3;
    const c = triangles[i + 2] * 3;
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  return [lo, hi];
}

/** Same, along Y — used to confirm the clip left the wall spanning its run. */
function sectionYSpan({ vertices, triangles }: Mesh, z: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const edge = (a: number, b: number): void => {
    const za = vertices[a + 2];
    const zb = vertices[b + 2];
    if (za === zb || z < Math.min(za, zb) || z > Math.max(za, zb)) return;
    const t = (z - za) / (zb - za);
    const y = vertices[a + 1] + t * (vertices[b + 1] - vertices[a + 1]);
    lo = Math.min(lo, y);
    hi = Math.max(hi, y);
  };
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i] * 3;
    const b = triangles[i + 1] * 3;
    const c = triangles[i + 2] * 3;
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  return [lo, hi];
}

async function meshWalls(params: BinParams): Promise<Mesh> {
  const { mesh } = await import('brepjs');
  const { buildCompartmentWalls } = await import('../compartmentBuilder');
  const walls = buildCompartmentWalls(params, INNER_W, INNER_D, WALL_HEIGHT);
  if (!walls) throw new Error('expected divider walls');
  try {
    const m = mesh(walls, { tolerance: 0.005, angularTolerance: 5, cache: false });
    return { vertices: m.vertices, triangles: m.triangles };
  } finally {
    walls.delete();
  }
}

/** Heights to probe: off the floor and off the top so a chamfer or a clip
 *  artefact at either extreme cannot be what the assertion is reading. */
const PROBE_Z = [0.5, WALL_HEIGHT / 4, WALL_HEIGHT / 2, (3 * WALL_HEIGHT) / 4, WALL_HEIGHT - 0.5];

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe(`leaning compartment dividers on ${getKernelName()}`, () => {
  it('keeps perpendicular thickness at every height', async () => {
    for (const rakeDeg of [15, 30, 45]) {
      const m = await meshWalls(makeParams(lean(rakeDeg)));
      const cos = Math.cos((rakeDeg * Math.PI) / 180);
      for (const z of PROBE_Z) {
        const [lo, hi] = sectionXSpan(m, z);
        // Plan width is t/cos, so the distance between the two slanted faces
        // is that times cos. An oblique extrude of the plan rectangle would
        // read t here and t*cos as the real wall.
        expect((hi - lo) * cos).toBeCloseTo(THICKNESS, 2);
      }
    }
  });

  it('lands the foot where the plan says, and pivots on the top edge', async () => {
    const rakeDeg = 45;
    const m = await meshWalls(makeParams(lean(rakeDeg)));
    const tan = Math.tan((rakeDeg * Math.PI) / 180);
    for (const z of PROBE_Z) {
      const [lo, hi] = sectionXSpan(m, z);
      const centre = (lo + hi) / 2;
      // Boundary sits at x = 0 for a 2-column grid; the foot travels +X.
      expect(centre).toBeCloseTo((WALL_HEIGHT - z) * tan, 1);
    }
  });

  it('leans the other way for a negative angle', async () => {
    const m = await meshWalls(makeParams(lean(-30)));
    const [lo, hi] = sectionXSpan(m, 0.5);
    expect((lo + hi) / 2).toBeLessThan(-10);
  });

  it('still spans wall to wall along its run', async () => {
    const m = await meshWalls(makeParams(lean(45)));
    for (const z of PROBE_Z) {
      const [lo, hi] = sectionYSpan(m, z);
      expect(lo).toBeCloseTo(-INNER_D / 2, 1);
      expect(hi).toBeCloseTo(INNER_D / 2, 1);
    }
  });

  it('composes with a plan tilt', async () => {
    // Diagonal in plan AND leaning: still one plane, so the section is still a
    // constant-thickness band, only rotated about Z.
    const m = await meshWalls(makeParams(lean(30, { offsetStart: -8, offsetEnd: 8 })));
    for (let i = 0; i < m.vertices.length; i++) expect(Number.isFinite(m.vertices[i])).toBe(true);
    const top = sectionXSpan(m, WALL_HEIGHT - 0.5);
    const foot = sectionXSpan(m, 0.5);
    // The plan tilt spreads the top band across the run; the lean moves the
    // whole thing +X without collapsing it.
    expect(top[1] - top[0]).toBeGreaterThan(THICKNESS);
    expect((foot[0] + foot[1]) / 2).toBeGreaterThan((top[0] + top[1]) / 2);
  });

  it('builds an upright wall when the lean is zero', async () => {
    const m = await meshWalls(makeParams(lean(0, { offsetStart: 6, offsetEnd: 6 })));
    for (const z of PROBE_Z) {
      const [lo, hi] = sectionXSpan(m, z);
      expect((lo + hi) / 2).toBeCloseTo(6, 2);
      expect(hi - lo).toBeCloseTo(THICKNESS, 2);
    }
  });

  it('leans a horizontal divider along Y', async () => {
    const rakeDeg = 40;
    const m = await meshWalls(makeParams(lean(rakeDeg), 1, 2));
    const tan = Math.tan((rakeDeg * Math.PI) / 180);
    const at = (z: number): number => {
      const [lo, hi] = sectionYSpan(m, z);
      return (lo + hi) / 2;
    };
    for (const z of PROBE_Z) {
      expect(at(z)).toBeCloseTo((WALL_HEIGHT - z) * tan, 1);
    }
  });
});

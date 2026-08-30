/**
 * Scenario test: dividerOverrides actually affect generated geometry.
 *
 * Regression guard. The angled-divider feature ships a complete
 * UI + store + validator + override-aware feature builders, but the
 * default code path for rectangular standard bins is the multi-cavity
 * cut path, which used to draw axis-aligned cavities ignoring
 * dividerOverrides — so toggling the panel had no effect on the mesh.
 *
 * These tests exercise getGenerateBin (the full pipeline) and assert
 * that adding an override produces measurably different geometry.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('tilted dividers through full pipeline', () => {
  // 1×2 standard rect bin (the silverware-drawer use case):
  // the cut path is taken because compartments are rectangular and the
  // mask is full. This is the exact configuration the user reported.
  const baseParams: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 1,
    depth: 2,
    height: 3,
    compartments: {
      cols: 1,
      rows: 2,
      cells: [0, 1],
      thickness: 1.2,
    },
  };

  it('tilted divider produces measurably different geometry than the straight equivalent', () => {
    const generateBin = getGenerateBin();
    const straight = generateBin(baseParams);
    const tilted = generateBin({
      ...baseParams,
      compartments: {
        ...baseParams.compartments,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -10 }],
      },
    });
    expect(straight.vertices).not.toBeNull();
    expect(tilted.vertices).not.toBeNull();
    if (!straight.vertices || !tilted.vertices) return;
    // Vertex *count* is too weak — both quads tessellate to the same count.
    // Sum |y| picks up the off-axis displacement from the tilt.
    const sumAbsY = (verts: Float32Array): number => {
      let s = 0;
      for (let i = 1; i < verts.length; i += 3) s += Math.abs(verts[i]);
      return s;
    };
    expect(Math.abs(sumAbsY(tilted.vertices) - sumAbsY(straight.vertices))).toBeGreaterThan(10);
  }, 60_000);

  const TILT = [{ compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -10 }];

  const hasFiniteGeometry = (verts: Float32Array | null): boolean => {
    if (!verts || verts.length === 0) return false;
    for (let i = 0; i < verts.length; i++) {
      if (!Number.isFinite(verts[i])) return false;
    }
    return true;
  };

  it('tilted divider + interior wall cutout builds valid geometry (#2276)', () => {
    const generateBin = getGenerateBin();
    const result = generateBin({
      ...baseParams,
      walls: {
        ...baseParams.walls,
        enabled: true,
        interior: { ...baseParams.walls.left, enabled: true },
      },
      compartments: { ...baseParams.compartments, dividerOverrides: TILT },
    });
    expect(hasFiniteGeometry(result.vertices)).toBe(true);
  }, 60_000);

  it('tilted divider + interior handle holes build valid geometry (#2276)', () => {
    const generateBin = getGenerateBin();
    const result = generateBin({
      ...baseParams,
      handles: { ...baseParams.handles, enabled: true, interior: true },
      compartments: { ...baseParams.compartments, dividerOverrides: TILT },
    });
    expect(hasFiniteGeometry(result.vertices)).toBe(true);
  }, 60_000);

  it('cavity floor reflects the tilt — points exist only at off-axis Y positions', () => {
    const generateBin = getGenerateBin();
    const tilted = generateBin({
      ...baseParams,
      compartments: {
        ...baseParams.compartments,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -10 }],
      },
    });
    expect(tilted.vertices).not.toBeNull();
    if (!tilted.vertices) return;
    // 1×2 default gridUnitMm=42 → bin walls at Y≈±41.75, divider midpoint
    // at Y=0. A 10mm tilt should put cavity vertices at |y| ≈ 10 (well
    // away from the walls); a straight cavity has no vertices in this band.
    const verts = tilted.vertices;
    let foundTiltVertex = false;
    for (let i = 0; i < verts.length; i += 3) {
      const absY = Math.abs(verts[i + 1]);
      if (absY > 5 && absY < 25) {
        foundTiltVertex = true;
        break;
      }
    }
    expect(foundTiltVertex).toBe(true);
  }, 60_000);

  // A divider carrying BOTH an Angle (offsetStart ≠ offsetEnd) and a Lean
  // (rakeDeg) is one plane, so its foot line is the top line translated by the
  // WHOLE drift and still spans the full run at the floor. Keeping only the
  // across-run component of the drift sheared the foot off its run and left it
  // short of a wall, a wedge that poked past the compartment. Built from the
  // isolated divider walls so the check reads the divider's own foot,
  // not the bin body around it. (dividerRake.test.ts proves thickness and exact
  // placement under the profile kernel harness; this is the CI-gated tripwire.)
  it('compound angle + lean divider keeps its foot spanning the full run', async () => {
    const { mesh } = await import('brepjs');
    const { buildCompartmentWalls } = await import('./compartmentBuilder');
    const INNER_W = 80;
    const INNER_D = 60;
    const WALL_H = 30;
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      compartments: {
        cols: 2,
        rows: 1,
        thickness: 1.2,
        cells: [0, 1],
        dividerOverrides: [
          { compartmentA: 0, compartmentB: 1, offsetStart: -8, offsetEnd: 8, rakeDeg: 30 },
        ],
      },
    };
    const walls = buildCompartmentWalls(params, INNER_W, INNER_D, WALL_H);
    expect(walls).not.toBeNull();
    if (!walls) return;
    try {
      const m = mesh(walls, { tolerance: 0.01, angularTolerance: 5, cache: false });
      // Y-extent the divider surface reaches at z (slicing edges, since a prism
      // only carries vertices on its end caps).
      const ySpanAt = (z: number): [number, number] => {
        let lo = Infinity;
        let hi = -Infinity;
        const v = m.vertices;
        const tri = m.triangles;
        const edge = (a: number, b: number): void => {
          const za = v[a + 2];
          const zb = v[b + 2];
          if (za === zb || z < Math.min(za, zb) || z > Math.max(za, zb)) return;
          const t = (z - za) / (zb - za);
          lo = Math.min(lo, v[a + 1] + t * (v[b + 1] - v[a + 1]));
          hi = Math.max(hi, v[a + 1] + t * (v[b + 1] - v[a + 1]));
        };
        for (let i = 0; i < tri.length; i += 3) {
          const a = tri[i] * 3;
          const b = tri[i + 1] * 3;
          const c = tri[i + 2] * 3;
          edge(a, b);
          edge(b, c);
          edge(c, a);
        }
        return [lo, hi];
      };
      // Reaches both walls at the floor; the dropped-drift bug fell short.
      const [lo, hi] = ySpanAt(0.5);
      expect(lo).toBeCloseTo(-INNER_D / 2, 0);
      expect(hi).toBeCloseTo(INNER_D / 2, 0);
    } finally {
      walls.delete();
    }
  }, 60_000);
});

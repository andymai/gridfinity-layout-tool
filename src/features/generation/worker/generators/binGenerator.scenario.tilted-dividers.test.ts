/**
 * Scenario test: dividerOverrides actually affect generated geometry.
 *
 * Regression guard for #1822. The angled-divider feature ships a complete
 * UI + store + validator + override-aware feature builders, but the
 * default code path for rectangular standard bins is the multi-cavity
 * cut path (#1753), which used to draw axis-aligned cavities ignoring
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
  // 1×2 standard rect bin (the silverware-drawer use case from #1822):
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
    // A tilted parallelogram and an axis-aligned rectangle both tessellate
    // to the same vertex count (4 corners each), so a count-diff is too
    // weak. Compare positions instead: sum |y| across all vertices —
    // the tilt displaces interior cavity vertices by ±~10mm, while the
    // straight version has them at y ≈ ±half. Difference should be
    // dozens of mm if the override is honored.
    const sumAbsY = (verts: Float32Array): number => {
      let s = 0;
      for (let i = 1; i < verts.length; i += 3) s += Math.abs(verts[i]);
      return s;
    };
    expect(Math.abs(sumAbsY(tilted.vertices) - sumAbsY(straight.vertices))).toBeGreaterThan(10);
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
    // With the divider tilted, the bin's interior has vertices whose Y
    // landing is not at the symmetric cavity midpoint. Sample for any
    // vertex with Y in the tilt range (~ ±10 mm from midpoint, away from
    // the bin walls) — a straight cavity wouldn't produce one.
    //
    // 1×2 default gridUnitMm=42, depth=2 → outerD = 84-tolerance.
    // Midpoint is at Y=0 (bin coordinates centered). Walls are at
    // Y≈±41.75. A tilted-divider vertex should appear within Y ∈ (-25, 25)
    // but offset from Y=0 by close to the override magnitude.
    const verts = tilted.vertices;
    let foundTiltVertex = false;
    for (let i = 0; i < verts.length; i += 3) {
      const y = verts[i + 1];
      // Match the tilt magnitude (10mm) with generous tolerance for mesh
      // tessellation. Avoid the bin walls (>30mm from center).
      const absY = Math.abs(y);
      if (absY > 5 && absY < 25) {
        foundTiltVertex = true;
        break;
      }
    }
    expect(foundTiltVertex).toBe(true);
  }, 60_000);
});

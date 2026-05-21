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
});

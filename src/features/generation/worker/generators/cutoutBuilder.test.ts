// @vitest-environment node
/**
 * Real-kernel tests for `findBottomEdges` — the scoop-fillet edge selector.
 *
 * Regression for GH #2085: the selector must return only edges that lie flat in
 * the bottom plane, never a box's vertical corner edges. Filleting a vertical
 * edge rounds the cutout corner all the way to the top rim and leaves a
 * degenerate single-face sliver there, which exports as a non-manifold STL edge.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { box, getBounds } from 'brepjs';
import { findBottomEdges } from './cutoutBuilder';

beforeAll(async () => {
  const { initBrepjs } = await import('./__kernel-tests__/wasmInit');
  await initBrepjs();
}, 60_000);

describe('findBottomEdges', () => {
  it('selects only the flat bottom edges, excluding vertical corner edges', () => {
    // 20×20×10 box centered so its bottom face sits at z=0.
    const solid = box(20, 20, 10, { at: [0, 0, 5] });
    try {
      const edges = findBottomEdges(solid, 0, { minX: -10, minY: -10, maxX: 10, maxY: 10 });

      // A sharp box has exactly four bottom edges; the four verticals (zMax=10)
      // and four top edges (zMin=10) must be excluded.
      expect(edges.length).toBe(4);
      for (const e of edges) {
        const b = getBounds(e);
        // Every selected edge lies fully in the z≈0 plane — no vertical edge
        // (which spans up to the top) leaks in, in either direction.
        expect(b.zMin).toBeGreaterThanOrEqual(-0.1);
        expect(b.zMax).toBeLessThanOrEqual(0.1);
      }
    } finally {
      solid.delete();
    }
  }, 60_000);
});

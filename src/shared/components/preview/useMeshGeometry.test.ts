import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMeshGeometry } from './useMeshGeometry';

describe('useMeshGeometry', () => {
  it('exports a function', () => {
    expect(typeof useMeshGeometry).toBe('function');
  });

  // Regression: multi-color preview rendered as single color even though the
  // worker produced LIP-tagged face groups (issue surfaced by user screenshot
  // 2026-05-15). The hook adds groups *after* toCreasedNormals converts the
  // geometry to non-indexed; if the start/count offsets don't survive the
  // conversion, every face renders with material index 0 (body).
  describe('face group offsets', () => {
    // Two triangles sharing an edge between v1 and v2 (a quad split on a
    // diagonal): triangle 0 = v0,v1,v2 (body, materialIndex 0); triangle 1 =
    // v1,v3,v2 (lip, materialIndex 1). Indices [0,1,2, 1,3,2] reference only
    // 4 unique positions, so `toCreasedNormals` actually expands the position
    // buffer from 4 vertices to 6 — exercising the real index→position offset
    // remap. With 6 distinct vertices the expansion is a no-op and the test
    // can't distinguish "groups survived in index space" from "groups
    // survived in vertex space."
    function makeIndexed(): {
      vertices: Float32Array;
      normals: Float32Array;
      indices: Uint32Array;
      edgeVertices: Float32Array;
      faceGroups: readonly { start: number; count: number; materialIndex: number }[];
    } {
      // prettier-ignore
      const vertices = new Float32Array([
        0, 0, 0, // v0
        1, 0, 0, // v1
        0, 1, 0, // v2
        1, 1, 0, // v3
      ]);
      // prettier-ignore
      const normals = new Float32Array([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
        0, 0, 1,
      ]);
      const indices = new Uint32Array([0, 1, 2, 1, 3, 2]);
      return {
        vertices,
        normals,
        indices,
        edgeVertices: new Float32Array(0),
        faceGroups: [
          { start: 0, count: 3, materialIndex: 0 },
          { start: 3, count: 3, materialIndex: 1 },
        ],
      };
    }

    it('preserves group offsets through toCreasedNormals (indexed → non-indexed)', () => {
      const arrays = makeIndexed();
      const { result } = renderHook(() => useMeshGeometry(arrays));
      const geometry = result.current.geometry;
      expect(geometry).not.toBeNull();
      const groups = geometry!.groups;
      expect(groups).toHaveLength(2);
      expect(groups[0]).toMatchObject({ start: 0, count: 3, materialIndex: 0 });
      expect(groups[1]).toMatchObject({ start: 3, count: 3, materialIndex: 1 });
    });

    it('keeps the geometry drawable: each group range fits inside the position buffer', () => {
      const arrays = makeIndexed();
      const { result } = renderHook(() => useMeshGeometry(arrays));
      const geometry = result.current.geometry;
      expect(geometry).not.toBeNull();
      const posCount = geometry!.attributes['position']!.count;
      for (const g of geometry!.groups) {
        expect(g.start + g.count).toBeLessThanOrEqual(posCount);
      }
    });
  });
});

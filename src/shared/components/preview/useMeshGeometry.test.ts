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
    // Two triangles: indices 0..5 = first triangle "body" (materialIndex 0),
    // indices 6..11 = second triangle "lip" (materialIndex 1). When the user
    // sees an all-body bin, this end-to-end shape is what the geometry should
    // expose so Three.js can route each triangle to the right material.
    function makeIndexed(): {
      vertices: Float32Array;
      normals: Float32Array;
      indices: Uint32Array;
      edgeVertices: Float32Array;
      faceGroups: readonly { start: number; count: number; materialIndex: number }[];
    } {
      const vertices = new Float32Array([
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        0, // body triangle
        2,
        2,
        0,
        3,
        2,
        0,
        2,
        3,
        0, // lip triangle
      ]);
      const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
      const indices = new Uint32Array([0, 1, 2, 3, 4, 5]);
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

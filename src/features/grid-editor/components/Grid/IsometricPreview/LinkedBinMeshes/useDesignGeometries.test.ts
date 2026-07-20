import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import type { DesignId } from '@/core/types';
import { designId } from '@/core/types';
import type { MeshData } from '@/shared/types/generation';
import type { LinkedDesignMesh } from '@/shared/hooks/useLinkedDesignMeshes';
import {
  buildDesignGeometry,
  clearDesignGeometryCache,
  useDesignGeometries,
} from './useDesignGeometries';

/** Two-triangle quad in the XY plane. */
function makeMesh(withNormals: boolean): MeshData {
  const vertices = new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0]);
  return {
    vertices,
    normals: withNormals
      ? new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
      : new Float32Array(0),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    edgeVertices: new Float32Array(0),
    triangleCount: 2,
  };
}

function makeEntry(sig: string, withNormals = true): LinkedDesignMesh {
  return { sig, mesh: makeMesh(withNormals), width: 2, depth: 1 };
}

describe('buildDesignGeometry', () => {
  it('builds creased (non-indexed) geometry for worker meshes with normals', () => {
    const geometry = buildDesignGeometry(makeMesh(true));

    // toCreasedNormals drops the index: 2 triangles → 6 vertices
    expect(geometry.index).toBeNull();
    expect(geometry.attributes.position.count).toBe(6);
    expect(geometry.attributes.normal).toBeDefined();
    geometry.dispose();
  });

  it('keeps the index and computes normals for imported meshes', () => {
    const geometry = buildDesignGeometry(makeMesh(false));

    expect(geometry.index).not.toBeNull();
    expect(geometry.attributes.position.count).toBe(4);
    expect(geometry.attributes.normal).toBeDefined();
    geometry.dispose();
  });

  it('produces finite positions and normals', () => {
    const geometry = buildDesignGeometry(makeMesh(true));
    const positions = geometry.attributes.position.array as Float32Array;
    const normals = geometry.attributes.normal.array as Float32Array;

    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i])).toBe(true);
    }
    for (let i = 0; i < normals.length; i++) {
      expect(Number.isFinite(normals[i])).toBe(true);
    }
    geometry.dispose();
  });
});

describe('useDesignGeometries', () => {
  const D1 = designId('design-1');

  beforeEach(() => {
    clearDesignGeometryCache();
  });

  it('returns an empty map for no designs', () => {
    const { result } = renderHook(() => useDesignGeometries(new Map()));
    expect(result.current.size).toBe(0);
  });

  it('builds one geometry per design and carries footprint through', () => {
    const meshes = new Map<DesignId, LinkedDesignMesh>([[D1, makeEntry('d1:t1')]]);
    const { result } = renderHook(() => useDesignGeometries(meshes));

    const entry = result.current.get(D1);
    expect(entry?.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(entry?.width).toBe(2);
    expect(entry?.depth).toBe(1);
  });

  it('reuses the geometry across re-renders when the sig is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ meshes }: { meshes: Map<DesignId, LinkedDesignMesh> }) => useDesignGeometries(meshes),
      { initialProps: { meshes: new Map([[D1, makeEntry('d1:t1')]]) } }
    );
    const firstGeometry = result.current.get(D1)?.geometry;

    // New map identity, same sig — geometry instance is reused
    rerender({ meshes: new Map([[D1, makeEntry('d1:t1')]]) });
    expect(result.current.get(D1)?.geometry).toBe(firstGeometry);
  });

  it('rebuilds the geometry when the design sig changes (design edited)', () => {
    const { result, rerender } = renderHook(
      ({ meshes }: { meshes: Map<DesignId, LinkedDesignMesh> }) => useDesignGeometries(meshes),
      { initialProps: { meshes: new Map([[D1, makeEntry('d1:t1')]]) } }
    );
    const firstGeometry = result.current.get(D1)?.geometry;

    rerender({ meshes: new Map([[D1, makeEntry('d1:t2')]]) });

    expect(result.current.get(D1)?.geometry).not.toBe(firstGeometry);
  });

  it('disposes all cached geometries on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useDesignGeometries(new Map([[D1, makeEntry('d1:t1')]]))
    );
    const geometry = result.current.get(D1)?.geometry as THREE.BufferGeometry;
    let disposed = false;
    geometry.addEventListener('dispose', () => {
      disposed = true;
    });

    unmount();

    expect(disposed).toBe(true);
  });

  it('clearDesignGeometryCache disposes cached geometries', () => {
    const { result } = renderHook(() => useDesignGeometries(new Map([[D1, makeEntry('d1:t1')]])));
    const geometry = result.current.get(D1)?.geometry as THREE.BufferGeometry;
    let disposed = false;
    geometry.addEventListener('dispose', () => {
      disposed = true;
    });

    clearDesignGeometryCache();

    expect(disposed).toBe(true);
  });
});

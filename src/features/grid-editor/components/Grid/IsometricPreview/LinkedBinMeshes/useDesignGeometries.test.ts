import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import type { BinId } from '@/core/types';
import { binId } from '@/core/types';
import type { MeshData } from '@/shared/types/generation';
import type { LinkedDesignMesh } from '@/shared/hooks/useLinkedDesignMeshes';
import { GRIDFINITY_SPEC, socketHeightMm } from '@/shared/printSettings/gridfinityGeometry';
import {
  buildDesignGeometry,
  clearDesignGeometryCache,
  MAX_CACHE_SIZE,
  useDesignGeometries,
} from './useDesignGeometries';
import type { DesignGeometryEntry } from './useDesignGeometries';

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

  // Feet arrive spanning [-SOCKET_HEIGHT, 0] with the body starting at 0; the
  // preview contract is Z=0 bottom, so the merged assembly must be lifted a
  // socket. Without the lift the feet poke through the layer plane and the rim
  // still sits a socket below an integral neighbour's.
  it('merges detachable feet and lifts the assembly back to a Z=0 bottom', () => {
    const body: MeshData = {
      ...makeMesh(true),
      vertices: new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 10]),
    };
    const s = GRIDFINITY_SPEC.SOCKET_HEIGHT;
    const feet: MeshData = {
      ...makeMesh(true),
      vertices: new Float32Array([0, 0, -s, 10, 0, -s, 10, 10, -s, 0, 10, 0]),
    };
    const geometry = buildDesignGeometry({ ...body, detachableFeetMesh: feet });
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.z).toBeCloseTo(0, 6);
    // Body top (was 10) rides up with the lift.
    expect(geometry.boundingBox?.max.z).toBeCloseTo(10 + GRIDFINITY_SPEC.SOCKET_HEIGHT, 6);
    geometry.dispose();
  });

  it('lifts by the feet it was given, so low-profile feet land on Z=0 too', () => {
    const body: MeshData = {
      ...makeMesh(true),
      vertices: new Float32Array([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 10]),
    };
    const low = socketHeightMm(true);
    const feet: MeshData = {
      ...makeMesh(true),
      vertices: new Float32Array([0, 0, -low, 10, 0, -low, 10, 10, -low, 0, 10, 0]),
    };
    const geometry = buildDesignGeometry({ ...body, detachableFeetMesh: feet });
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.z).toBeCloseTo(0, 6);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(10 + low, 6);
    geometry.dispose();
  });

  it('leaves a feetless mesh in its own frame', () => {
    const geometry = buildDesignGeometry(makeMesh(true));
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.z).toBeCloseTo(0, 6);
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
  const B1 = binId('bin-1');

  beforeEach(() => {
    clearDesignGeometryCache();
  });

  it('returns an empty map for no designs', () => {
    const { result } = renderHook(() => useDesignGeometries(new Map()));
    expect(result.current.size).toBe(0);
  });

  it('builds one geometry per design and carries footprint through', () => {
    const meshes = new Map<BinId, LinkedDesignMesh>([[B1, makeEntry('d1:t1')]]);
    const { result } = renderHook(() => useDesignGeometries(meshes));

    const entry = result.current.get(B1);
    expect(entry?.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(entry?.width).toBe(2);
    expect(entry?.depth).toBe(1);
  });

  it('shares one entry between bins on the same mesh and keeps a variant apart', () => {
    const shared = makeEntry('d1:t1');
    const variant = makeEntry('d1:t1:no-own-overhang');
    const B2 = binId('bin-2');
    const B3 = binId('bin-3');
    const { result } = renderHook(() =>
      useDesignGeometries(
        new Map([
          [B1, shared],
          [B2, shared],
          [B3, variant],
        ])
      )
    );

    expect(result.current.get(B2)).toBe(result.current.get(B1));
    expect(result.current.get(B3)?.geometry).not.toBe(result.current.get(B1)?.geometry);
  });

  it('carries the body base through, raised by the lift that stands detachable feet on Z=0', () => {
    const s = GRIDFINITY_SPEC.SOCKET_HEIGHT;
    const feet: MeshData = {
      ...makeMesh(true),
      vertices: new Float32Array([0, 0, -s, 10, 0, -s, 10, 10, -s, 0, 10, 0]),
    };
    const socketed: LinkedDesignMesh = { ...makeEntry('d1:t1'), bodyBaseMm: s };
    const detached: LinkedDesignMesh = {
      ...makeEntry('d2:t1'),
      mesh: { ...makeMesh(true), detachableFeetMesh: feet },
      bodyBaseMm: 0,
    };
    const B2 = binId('bin-2');
    const B3 = binId('bin-3');
    const { result } = renderHook(() =>
      useDesignGeometries(
        new Map([
          [B1, socketed],
          [B2, detached],
          [B3, makeEntry('d3:t1')],
        ])
      )
    );

    expect(result.current.get(B1)?.bodyBaseMm).toBeCloseTo(s, 6);
    expect(result.current.get(B2)?.bodyBaseMm).toBeCloseTo(s, 6);
    expect(result.current.get(B3)?.bodyBaseMm).toBeUndefined();
  });

  it('reuses the geometry across re-renders when the sig is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ meshes }: { meshes: Map<BinId, LinkedDesignMesh> }) => useDesignGeometries(meshes),
      { initialProps: { meshes: new Map([[B1, makeEntry('d1:t1')]]) } }
    );
    const firstGeometry = result.current.get(B1)?.geometry;

    // New map identity, same sig — geometry instance is reused
    rerender({ meshes: new Map([[B1, makeEntry('d1:t1')]]) });
    expect(result.current.get(B1)?.geometry).toBe(firstGeometry);
  });

  it('rebuilds the geometry when the design sig changes (design edited)', () => {
    const { result, rerender } = renderHook(
      ({ meshes }: { meshes: Map<BinId, LinkedDesignMesh> }) => useDesignGeometries(meshes),
      { initialProps: { meshes: new Map([[B1, makeEntry('d1:t1')]]) } }
    );
    const firstGeometry = result.current.get(B1)?.geometry;

    rerender({ meshes: new Map([[B1, makeEntry('d1:t2')]]) });

    expect(result.current.get(B1)?.geometry).not.toBe(firstGeometry);
  });

  it('disposes all cached geometries on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useDesignGeometries(new Map([[B1, makeEntry('d1:t1')]]))
    );
    const geometry = result.current.get(B1)?.geometry as THREE.BufferGeometry;
    let disposed = false;
    geometry.addEventListener('dispose', () => {
      disposed = true;
    });

    unmount();

    expect(disposed).toBe(true);
  });

  it('clearDesignGeometryCache disposes cached geometries', () => {
    const { result } = renderHook(() => useDesignGeometries(new Map([[B1, makeEntry('d1:t1')]])));
    const geometry = result.current.get(B1)?.geometry as THREE.BufferGeometry;
    let disposed = false;
    geometry.addEventListener('dispose', () => {
      disposed = true;
    });

    clearDesignGeometryCache();

    expect(disposed).toBe(true);
  });

  describe('with more geometries in use than the cache bound', () => {
    type Meshes = Map<BinId, LinkedDesignMesh>;

    function manyMeshes(count: number, withRest: boolean): Meshes {
      const meshes: Meshes = new Map();
      for (let i = 0; i < count; i++) {
        const entry = makeEntry(`d${i}:t1`);
        meshes.set(
          binId(`bin-${i}`),
          withRest ? { ...entry, mesh: { ...entry.mesh, knifeRestMesh: makeMesh(true) } } : entry
        );
      }
      return meshes;
    }

    function geometriesOf(entries: Map<BinId, DesignGeometryEntry>): THREE.BufferGeometry[] {
      return [...entries.values()].flatMap((e) =>
        e.rest ? [e.geometry, e.rest.geometry] : [e.geometry]
      );
    }

    function countDisposals(geometries: THREE.BufferGeometry[]): () => number {
      let disposed = 0;
      for (const g of geometries) {
        g.addEventListener('dispose', () => {
          disposed++;
        });
      }
      return () => disposed;
    }

    const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    it('never disposes or rebuilds a geometry a bin still draws, rest geometries included', async () => {
      // Body plus rest per design puts the drawn set two past the bound.
      const meshes = manyMeshes(MAX_CACHE_SIZE / 2 + 1, true);
      const { result, rerender } = renderHook(
        ({ meshes }: { meshes: Meshes }) => useDesignGeometries(meshes),
        { initialProps: { meshes } }
      );
      const before = geometriesOf(result.current);
      expect(before).toHaveLength(MAX_CACHE_SIZE + 2);
      const disposals = countDisposals(before);

      // A new map of the same meshes, as an unrelated layout edit produces.
      rerender({ meshes: new Map(meshes) });
      await flushMicrotasks();

      const after = geometriesOf(result.current);
      expect(after).toHaveLength(before.length);
      after.forEach((g, i) => expect(g).toBe(before[i]));
      expect(disposals()).toBe(0);
    });

    it('disposes geometries no bin draws any more down to the bound', async () => {
      const meshes = manyMeshes(MAX_CACHE_SIZE + 8, false);
      const { result, rerender } = renderHook(
        ({ meshes }: { meshes: Meshes }) => useDesignGeometries(meshes),
        { initialProps: { meshes } }
      );
      const disposals = countDisposals(geometriesOf(result.current));

      rerender({ meshes: new Map() });
      await flushMicrotasks();

      expect(disposals()).toBe(8);
    });
  });
});

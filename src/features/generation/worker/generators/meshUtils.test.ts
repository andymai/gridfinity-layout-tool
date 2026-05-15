import { describe, it, expect } from 'vitest';
import { toIndexedMeshData } from './meshUtils';

describe('toIndexedMeshData', () => {
  it('converts mesh data to MeshData format', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
    };

    const result = toIndexedMeshData(meshInput);

    expect(result.vertices).toEqual(meshInput.vertices);
    expect(result.normals).toEqual(meshInput.normals);
    expect(result.indices).toEqual(meshInput.triangles);
    expect(result.triangleCount).toBe(1);
  });

  it('reuses Float32Array inputs without copying', () => {
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const triangles = new Uint32Array([0, 1, 2]);

    const result = toIndexedMeshData({ vertices, normals, triangles });

    expect(result.vertices).toBe(vertices);
    expect(result.normals).toBe(normals);
    expect(result.indices).toBe(triangles);
  });

  it('copies plain arrays to typed arrays', () => {
    const meshInput = {
      vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      triangles: [0, 1, 2],
    };

    const result = toIndexedMeshData(meshInput);

    expect(result.vertices).toBeInstanceOf(Float32Array);
    expect(result.normals).toBeInstanceOf(Float32Array);
    expect(result.indices).toBeInstanceOf(Uint32Array);
    expect(result.triangleCount).toBe(1);
  });

  it('returns empty edgeVertices when none provided', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0]),
      normals: new Float32Array([0, 0, 1]),
      triangles: new Uint32Array([0]),
    };

    const result = toIndexedMeshData(meshInput);
    expect(result.edgeVertices).toBeInstanceOf(Float32Array);
    expect(result.edgeVertices.length).toBe(0);
  });

  it('passes through Float32Array edgeVertices without copying', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0]),
      normals: new Float32Array([0, 0, 1]),
      triangles: new Uint32Array([0]),
    };
    const edges = new Float32Array([0, 0, 0, 1, 1, 1]);

    const result = toIndexedMeshData(meshInput, edges);
    expect(result.edgeVertices).toBe(edges);
  });

  it('converts plain array edgeVertices to Float32Array', () => {
    const meshInput = {
      vertices: new Float32Array([0, 0, 0]),
      normals: new Float32Array([0, 0, 1]),
      triangles: new Uint32Array([0]),
    };

    const result = toIndexedMeshData(meshInput, [0, 0, 0, 1, 1, 1]);
    expect(result.edgeVertices).toBeInstanceOf(Float32Array);
    expect(result.edgeVertices.length).toBe(6);
  });
});

describe('toIndexedMeshData faceGroups', () => {
  it('uses brepjs-propagated origin as the FeatureTag', () => {
    const meshResult = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
      faceGroups: [{ start: 0, count: 3, faceId: 1, origin: 1 /* FeatureTag.SCOOP */ }],
    };
    const result = toIndexedMeshData(meshResult);
    expect(result.faceGroups).toEqual([{ start: 0, count: 3, tag: 1 }]);
  });

  it('treats origin=0 as UNKNOWN (brepjs default when no setShapeOrigin was called)', () => {
    const meshResult = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
      faceGroups: [{ start: 0, count: 3, faceId: 1, origin: 0 }],
    };
    const result = toIndexedMeshData(meshResult);
    expect(result.faceGroups).toEqual([{ start: 0, count: 3, tag: 255 }]);
  });

  it('returns undefined faceGroups when mesh has no faceGroups', () => {
    const meshResult = {
      vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      triangles: new Uint32Array([0, 1, 2]),
    };
    const result = toIndexedMeshData(meshResult);
    expect(result.faceGroups).toBeUndefined();
  });
});

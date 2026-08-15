import { describe, it, expect } from 'vitest';
import { meshDataByteSize } from './meshBytes';
import type { MeshData } from '@/shared/types/generation';

function baseMesh(): MeshData {
  return {
    vertices: new Float32Array(10), // 40
    normals: new Float32Array(10), // 40
    indices: new Uint32Array(5), // 20
    edgeVertices: new Float32Array(5), // 20
    triangleCount: 1,
  };
}

const BASE_BYTES = 120;

describe('meshDataByteSize', () => {
  it('sums the four required buffers', () => {
    expect(meshDataByteSize(baseMesh())).toBe(BASE_BYTES);
  });

  it('counts a coarse LOD, which carries no normals or edges', () => {
    expect(
      meshDataByteSize({
        ...baseMesh(),
        coarseLOD: { vertices: new Float32Array(4), indices: new Uint32Array(2), triangleCount: 1 },
      })
    ).toBe(BASE_BYTES + 24);
  });

  it('counts the lid and its edge lines', () => {
    expect(
      meshDataByteSize({
        ...baseMesh(),
        lidMesh: {
          vertices: new Float32Array(2),
          normals: new Float32Array(2),
          indices: new Uint32Array(1),
          edgeVertices: new Float32Array(1),
          triangleCount: 1,
        },
      })
    ).toBe(BASE_BYTES + 24);
  });

  // Every companion has to be in the walk. An omission does not fail loudly —
  // it just lets a byte-budgeted cache grow past the cap it advertises.
  it.each([
    [
      'stackPlateMesh',
      {
        vertices: new Float32Array(2),
        normals: new Float32Array(2),
        indices: new Uint32Array(1),
        edgeVertices: new Float32Array(1),
        triangleCount: 1,
      },
    ],
    [
      'slideTrayMesh',
      {
        vertices: new Float32Array(2),
        normals: new Float32Array(2),
        indices: new Uint32Array(1),
        edgeVertices: new Float32Array(1),
        triangleCount: 1,
        restZ: 0,
      },
    ],
  ])('counts %s', (key, part) => {
    expect(meshDataByteSize({ ...baseMesh(), [key]: part })).toBe(BASE_BYTES + 24);
  });

  it('counts the connector key, which carries no edge lines', () => {
    expect(
      meshDataByteSize({
        ...baseMesh(),
        connectorKeyMesh: {
          vertices: new Float32Array(2),
          normals: new Float32Array(2),
          indices: new Uint32Array(2),
          triangleCount: 1,
        },
      })
    ).toBe(BASE_BYTES + 24);
  });

  it('counts every label plate, not just the first', () => {
    const plate = {
      vertices: new Float32Array(2),
      normals: new Float32Array(2),
      indices: new Uint32Array(1),
      triangleCount: 1,
      seatX: 0,
      seatY: 0,
      seatZ: 0,
      slideY: 1 as const,
      widthMm: 10,
    };
    expect(
      meshDataByteSize({
        ...baseMesh(),
        labelPlates: { plates: [plate, plate, plate], omittedCount: 0 },
      })
    ).toBe(BASE_BYTES + 3 * 20);
  });
});

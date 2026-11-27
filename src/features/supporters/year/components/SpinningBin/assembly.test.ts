import { describe, expect, it } from 'vitest';
import type { MeshData } from '@/shared/types/generation';
import { assemblyBox, assemblyParts, canSpin } from './assembly';

function part(points: readonly number[]): MeshData {
  return {
    vertices: new Float32Array(points),
    normals: new Float32Array(0),
    indices: new Uint32Array(0),
    edgeVertices: new Float32Array(0),
    triangleCount: 1,
  };
}

const body = part([-20, -20, 0, 20, 20, 30]);
const feet = part([-20, -20, -5, 20, 20, 0]);
const rest = part([-10, -20, 0, 10, 20, 12]);

describe('assemblyParts', () => {
  it('keeps the feet and a slant support in the bin frame and steps the rest beside it', () => {
    const parts = assemblyParts(
      { ...body, detachableFeetMesh: feet, slantSupportMesh: feet, knifeRestMesh: rest },
      { x: 50, y: 0 }
    );
    expect(parts.map((p) => p.offset)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [50, 0, 0],
    ]);
  });
});

describe('assemblyBox', () => {
  it('frames the whole assembly, rest and feet included', () => {
    const box = assemblyBox(
      assemblyParts({ ...body, detachableFeetMesh: feet, knifeRestMesh: rest }, { x: 50, y: 0 })
    );
    expect(box.center).toEqual([20, 0, 12.5]);
    expect(box.radius).toBeCloseTo(Math.hypot(80, 40, 35) / 2);
  });
});

describe('canSpin', () => {
  it('spins a bin whose every part it can place', () => {
    expect(canSpin({ mesh: { ...body, detachableFeetMesh: feet }, triangles: 1 })).toBe(true);
    expect(
      canSpin({ mesh: { ...body, knifeRestMesh: rest }, triangles: 1, restOffset: { x: 50, y: 0 } })
    ).toBe(true);
  });

  it('keeps the thumbnail for a part only the designer can place', () => {
    expect(canSpin({ mesh: { ...body, lidMesh: part([0, 0, 0]) }, triangles: 1 })).toBe(false);
    expect(canSpin({ mesh: { ...body, knifeRestMesh: rest }, triangles: 1 })).toBe(false);
  });
});

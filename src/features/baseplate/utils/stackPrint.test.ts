import { describe, it, expect } from 'vitest';
import type { StackPrintParams } from '@/core/types';
import {
  planPhysicalStacks,
  stackStrideMm,
  translateMeshZ,
  flipMeshUpsideDown,
  concatMeshes,
  meshBounds,
  buildInterfaceSheetMesh,
  type StackMeshArrays,
} from './stackPrint';

/** A trivial unit-cube-ish mesh: one triangle plus one edge segment. */
function sampleMesh(): StackMeshArrays {
  return {
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    edgeVertices: new Float32Array([0, 0, 0, 1, 0, 0]),
  };
}

describe('planPhysicalStacks', () => {
  it('multiplies group quantity by sets', () => {
    const stacks = planPhysicalStacks([{ label: 'A', quantity: 3 }], 2, 8);
    expect(stacks).toEqual([{ label: 'A', copies: 6 }]);
  });

  it('splits a group taller than the cap into multiple stacks', () => {
    const stacks = planPhysicalStacks([{ label: 'A', quantity: 18 }], 1, 8);
    expect(stacks).toEqual([
      { label: 'A', copies: 8 },
      { label: 'A', copies: 8 },
      { label: 'A', copies: 2 },
    ]);
  });

  it('handles multiple groups independently', () => {
    const stacks = planPhysicalStacks(
      [
        { label: 'A', quantity: 6 },
        { label: 'B', quantity: 2 },
      ],
      1,
      8
    );
    expect(stacks).toEqual([
      { label: 'A', copies: 6 },
      { label: 'B', copies: 2 },
    ]);
  });

  it('skips zero/negative quantities and clamps bad sets to 1', () => {
    expect(planPhysicalStacks([{ label: 'A', quantity: 0 }], 3)).toEqual([]);
    expect(planPhysicalStacks([{ label: 'A', quantity: 2 }], Number.NaN, 8)).toEqual([
      { label: 'A', copies: 2 },
    ]);
  });
});

describe('stackStrideMm', () => {
  const airGap: StackPrintParams = { enabled: true, sets: 1, gapMm: 0.2, mode: 'airGap' };
  const sheet: StackPrintParams = { enabled: true, sets: 1, gapMm: 0.3, mode: 'sacrificialSheet' };

  it('adds gapMm to plate height in air-gap mode', () => {
    expect(stackStrideMm(14.5, airGap)).toBeCloseTo(14.7, 5);
  });

  it('adds gapMm (the sheet thickness) to plate height in sacrificial-sheet mode', () => {
    expect(stackStrideMm(14.5, sheet)).toBeCloseTo(14.8, 5);
  });
});

describe('mesh transforms', () => {
  it('translateMeshZ shifts only Z of vertices and edges', () => {
    const out = translateMeshZ(sampleMesh(), 5);
    expect(Array.from(out.vertices)).toEqual([0, 0, 5, 1, 0, 5, 0, 1, 5]);
    expect(Array.from(out.edgeVertices)).toEqual([0, 0, 5, 1, 0, 5]);
    expect(Array.from(out.normals)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  });

  it('flipMeshUpsideDown is a proper rotation: negates Y, mirrors Z about pivot, keeps winding', () => {
    const out = flipMeshUpsideDown(sampleMesh(), 10);
    // z' = 2*pivot - z ; y' = -y. Normalize -0 -> 0 (negating 0 yields -0).
    const norm = (a: Float32Array): number[] => Array.from(a, (n) => n + 0);
    expect(norm(out.vertices)).toEqual([0, 0, 20, 1, 0, 20, 0, -1, 20]);
    expect(norm(out.normals)).toEqual([0, 0, -1, 0, 0, -1, 0, 0, -1]);
    // index order unchanged (no winding flip)
    expect(Array.from(out.indices)).toEqual([0, 1, 2]);
  });

  it('concatMeshes re-bases indices per mesh', () => {
    const out = concatMeshes([sampleMesh(), sampleMesh()]);
    expect(Array.from(out.indices)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(out.vertices.length).toBe(18);
  });
});

describe('buildInterfaceSheetMesh', () => {
  it('builds a closed box inset within the footprint at the requested Z', () => {
    const sheet = buildInterfaceSheetMesh(
      { minX: 0, maxX: 100, minY: 0, maxY: 50 },
      0.4,
      14.5,
      0.5
    );
    // 6 faces * 2 triangles = 12 triangles
    expect(sheet.indices.length).toBe(36);
    const b = meshBounds(sheet.vertices);
    expect(b.minX).toBeCloseTo(0.5, 5);
    expect(b.maxX).toBeCloseTo(99.5, 5);
    expect(b.minY).toBeCloseTo(0.5, 5);
    expect(b.maxY).toBeCloseTo(49.5, 5);
    expect(b.minZ).toBeCloseTo(14.5, 5);
    expect(b.maxZ).toBeCloseTo(14.9, 5);
  });

  it('produces a watertight vertex count (24 verts: 4 per face)', () => {
    const sheet = buildInterfaceSheetMesh({ minX: 0, maxX: 10, minY: 0, maxY: 10 }, 0.4, 0);
    expect(sheet.vertices.length).toBe(72); // 24 verts * 3
  });
});

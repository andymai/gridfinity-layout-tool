import { describe, it, expect } from 'vitest';
import type { StackPrintParams } from '@/core/types';
import {
  planPhysicalStacks,
  stackHeightCap,
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

  describe('edge cases (parameterized)', () => {
    type Group = { label: string; quantity: number };
    const cases: {
      name: string;
      groups: Group[];
      sets: number;
      cap?: number;
      expected: number[]; // tower copies, in order
    }[] = [
      { name: 'empty groups', groups: [], sets: 1, expected: [] },
      {
        name: 'single tile, one set',
        groups: [{ label: 'A', quantity: 1 }],
        sets: 1,
        expected: [1],
      },
      { name: 'exact cap', groups: [{ label: 'A', quantity: 8 }], sets: 1, cap: 8, expected: [8] },
      {
        name: 'one over cap',
        groups: [{ label: 'A', quantity: 9 }],
        sets: 1,
        cap: 8,
        expected: [8, 1],
      },
      {
        name: 'two full caps',
        groups: [{ label: 'A', quantity: 16 }],
        sets: 1,
        cap: 8,
        expected: [8, 8],
      },
      {
        name: 'sets multiplies then caps',
        groups: [{ label: 'A', quantity: 5 }],
        sets: 2,
        cap: 8,
        expected: [8, 2],
      },
      {
        name: 'zero quantity skipped',
        groups: [{ label: 'A', quantity: 0 }],
        sets: 5,
        expected: [],
      },
      {
        name: 'negative quantity skipped',
        groups: [{ label: 'A', quantity: -3 }],
        sets: 1,
        expected: [],
      },
      {
        name: 'fractional quantity floored',
        groups: [{ label: 'A', quantity: 3.9 }],
        sets: 1,
        cap: 8,
        expected: [3],
      },
      {
        name: 'fractional sets floored',
        groups: [{ label: 'A', quantity: 2 }],
        sets: 2.9,
        cap: 8,
        expected: [4],
      },
      {
        name: 'sets=0 clamps to 1',
        groups: [{ label: 'A', quantity: 3 }],
        sets: 0,
        cap: 8,
        expected: [3],
      },
      {
        name: 'sets negative clamps to 1',
        groups: [{ label: 'A', quantity: 3 }],
        sets: -4,
        cap: 8,
        expected: [3],
      },
      {
        name: 'NaN cap clamps to 1',
        groups: [{ label: 'A', quantity: 3 }],
        sets: 1,
        cap: Number.NaN,
        expected: [1, 1, 1],
      },
      {
        name: 'cap=1 → one tower per copy',
        groups: [{ label: 'A', quantity: 3 }],
        sets: 1,
        cap: 1,
        expected: [1, 1, 1],
      },
      {
        name: 'mixed groups, mixed caps',
        groups: [
          { label: 'A', quantity: 10 },
          { label: 'B', quantity: 1 },
        ],
        sets: 1,
        cap: 8,
        expected: [8, 2, 1],
      },
    ];

    it.each(cases)('$name → $expected', ({ groups, sets, cap, expected }) => {
      const towers = planPhysicalStacks(groups, sets, cap);
      expect(towers.map((t) => t.copies)).toEqual(expected);
      // Total baked copies must equal sum(floor(qty)>0 * floor(sets>=1)).
      const safeSets = Number.isFinite(sets) ? Math.max(1, Math.floor(sets)) : 1;
      const wantTotal = groups.reduce(
        (s, g) => s + Math.max(0, Math.floor(g.quantity)) * safeSets,
        0
      );
      expect(towers.reduce((s, t) => s + t.copies, 0)).toBe(wantTotal);
    });
  });
});

describe('stackHeightCap', () => {
  // 5mm tile (magnets stripped) + 0.2mm gap → 5.2mm stride.
  const cases: { name: string; maxZ: number; tile: number; gap: number; cap: number }[] = [
    { name: '250mm printer fits ~48 tiles', maxZ: 250, tile: 5, gap: 0.2, cap: 48 },
    { name: '180mm printer fits ~34', maxZ: 180, tile: 5, gap: 0.2, cap: 34 },
    { name: 'short 40mm printer fits 7', maxZ: 40, tile: 5, gap: 0.2, cap: 7 },
    { name: 'exactly one tile', maxZ: 5, tile: 5, gap: 0.2, cap: 1 },
    { name: 'below one tile clamps to 1', maxZ: 4, tile: 5, gap: 0.2, cap: 1 },
    { name: 'zero Z clamps to 1', maxZ: 0, tile: 5, gap: 0.2, cap: 1 },
    { name: 'no gap → tighter packing', maxZ: 250, tile: 5, gap: 0, cap: 50 },
    { name: 'negative gap treated as 0', maxZ: 200, tile: 5, gap: -1, cap: 40 },
    { name: 'zero stride clamps to 1', maxZ: 250, tile: 0, gap: 0, cap: 1 },
    { name: 'NaN tile height clamps to 1', maxZ: 250, tile: Number.NaN, gap: 0.2, cap: 1 },
  ];

  it.each(cases)('$name', ({ maxZ, tile, gap, cap }) => {
    expect(stackHeightCap(maxZ, tile, gap)).toBe(cap);
  });

  it('the resulting stack never exceeds the build height', () => {
    const tile = 5;
    const gap = 0.2;
    for (const maxZ of [40, 100, 180, 250, 400]) {
      const n = stackHeightCap(maxZ, tile, gap);
      const stackHeight = n * tile + (n - 1) * gap; // n tiles, n-1 gaps
      expect(stackHeight).toBeLessThanOrEqual(maxZ + 1e-9);
      // And one more tile would overflow (unless we're already at the floor of 1).
      if (n > 1) expect((n + 1) * tile + n * gap).toBeGreaterThan(maxZ);
    }
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

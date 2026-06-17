import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import type { StackPrintParams } from '@/core/types';
import {
  planPhysicalStacks,
  stackHeightCap,
  stackStrideMm,
  translateMesh,
  flipMeshUpsideDown,
  concatMeshes,
  meshBounds,
  buildTowerLayers,
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
  it('splits a group taller than the cap into multiple stacks', () => {
    const stacks = planPhysicalStacks([{ label: 'A', quantity: 18 }], 8);
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
      8
    );
    expect(stacks).toEqual([
      { label: 'A', copies: 6 },
      { label: 'B', copies: 2 },
    ]);
  });

  it('skips zero/negative quantities and clamps a bad cap to 1', () => {
    expect(planPhysicalStacks([{ label: 'A', quantity: 0 }], 3)).toEqual([]);
    expect(planPhysicalStacks([{ label: 'A', quantity: 2 }], Number.NaN)).toEqual([
      { label: 'A', copies: 1 },
      { label: 'A', copies: 1 },
    ]);
  });

  describe('edge cases (parameterized)', () => {
    type Group = { label: string; quantity: number };
    const cases: {
      name: string;
      groups: Group[];
      cap?: number;
      expected: number[]; // tower copies, in order
    }[] = [
      { name: 'empty groups', groups: [], expected: [] },
      { name: 'single tile', groups: [{ label: 'A', quantity: 1 }], expected: [1] },
      { name: 'exact cap', groups: [{ label: 'A', quantity: 8 }], cap: 8, expected: [8] },
      { name: 'one over cap', groups: [{ label: 'A', quantity: 9 }], cap: 8, expected: [8, 1] },
      { name: 'two full caps', groups: [{ label: 'A', quantity: 16 }], cap: 8, expected: [8, 8] },
      { name: 'over one cap', groups: [{ label: 'A', quantity: 10 }], cap: 8, expected: [8, 2] },
      { name: 'zero quantity skipped', groups: [{ label: 'A', quantity: 0 }], expected: [] },
      { name: 'negative quantity skipped', groups: [{ label: 'A', quantity: -3 }], expected: [] },
      {
        name: 'fractional quantity floored',
        groups: [{ label: 'A', quantity: 3.9 }],
        cap: 8,
        expected: [3],
      },
      {
        name: 'NaN cap clamps to 1',
        groups: [{ label: 'A', quantity: 3 }],
        cap: Number.NaN,
        expected: [1, 1, 1],
      },
      {
        name: 'cap=1 → one tower per copy',
        groups: [{ label: 'A', quantity: 3 }],
        cap: 1,
        expected: [1, 1, 1],
      },
      {
        name: 'mixed groups, mixed caps',
        groups: [
          { label: 'A', quantity: 10 },
          { label: 'B', quantity: 1 },
        ],
        cap: 8,
        expected: [8, 2, 1],
      },
    ];

    it.each(cases)('$name → $expected', ({ groups, cap, expected }) => {
      const towers = planPhysicalStacks(groups, cap);
      expect(towers.map((t) => t.copies)).toEqual(expected);
      // Total baked copies must equal sum(floor(qty)>0).
      const wantTotal = groups.reduce((s, g) => s + Math.max(0, Math.floor(g.quantity)), 0);
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
  const airGap: StackPrintParams = { enabled: true, gapMm: mm(0.2) };

  it('adds the air gap to plate height', () => {
    expect(stackStrideMm(14.5, airGap)).toBeCloseTo(14.7, 5);
  });
});

describe('mesh transforms', () => {
  it('translateMesh shifts vertices and edges by (dx, dy, dz)', () => {
    const out = translateMesh(sampleMesh(), 0, 0, 5);
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

describe('buildTowerLayers', () => {
  /** A 10mm-tall plate, footprint X[0,20] Y[0,30], with a down-facing normal. */
  function plate(): StackMeshArrays {
    return {
      vertices: new Float32Array([0, 0, 0, 20, 0, 0, 0, 30, 0, 0, 0, 10, 20, 0, 10, 0, 30, 10]),
      normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
      edgeVertices: new Float32Array(0),
    };
  }

  it('keeps the bottom plate upright and flips the rest, all sharing one XY footprint', () => {
    const layers = buildTowerLayers(plate(), 3, 10.2);
    expect(layers).toHaveLength(3);
    // Bottom plate: upright at Z[0,10], normal unchanged (down-facing).
    const b0 = meshBounds(layers[0].vertices);
    expect(b0.minZ).toBeCloseTo(0, 5);
    expect(b0.maxZ).toBeCloseTo(10, 5);
    expect(layers[0].normals[2]).toBeCloseTo(-1, 5);
    // Second plate: flipped (down normal becomes up), lifted by one stride.
    const b1 = meshBounds(layers[1].vertices);
    expect(b1.minZ).toBeCloseTo(10.2, 5);
    expect(layers[1].normals[2]).toBeCloseTo(1, 5);
    // All copies keep the source XY footprint (flip re-aligns the negated Y).
    for (const layer of layers) {
      const b = meshBounds(layer.vertices);
      expect(b.minX).toBeCloseTo(0, 5);
      expect(b.maxX).toBeCloseTo(20, 5);
      expect(b.minY).toBeCloseTo(0, 5);
      expect(b.maxY).toBeCloseTo(30, 5);
    }
  });

  it('clamps copies to at least 1', () => {
    expect(buildTowerLayers(plate(), 0, 10.2)).toHaveLength(1);
    expect(buildTowerLayers(plate(), 3.9, 10.2)).toHaveLength(3);
  });

  it('preserves an asymmetric connector protrusion through the flip', () => {
    // A plate whose +Y edge carries a dovetail tongue protruding to Y=33 — an
    // asymmetric footprint, the case that matters for stacked connectored tiles.
    // The flip must keep the protrusion (not clip it) but mirror it to the -Y
    // end so every layer still shares one bounding footprint.
    const base: StackMeshArrays = {
      // floor triangle (Y 0..30) + tongue tip triangle protruding to Y=33.
      vertices: new Float32Array([0, 0, 0, 20, 0, 0, 0, 30, 0, 8, 33, 5, 12, 33, 5, 10, 30, 5]),
      normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
      edgeVertices: new Float32Array(0),
    };
    const layers = buildTowerLayers(base, 2, 10);
    const upright = meshBounds(layers[0].vertices);
    const flipped = meshBounds(layers[1].vertices);
    // Footprint span survives the flip: Y still reaches the protrusion at 33.
    expect(flipped.minY).toBeCloseTo(upright.minY, 5);
    expect(flipped.maxY).toBeCloseTo(upright.maxY, 5);
    expect(upright.maxY).toBeCloseTo(33, 5);
    // Vertex 3 is a tongue tip: at +Y (33) when upright, mirrored to the -Y edge
    // (0) after the flip — asymmetry is re-centered, not lost.
    expect(layers[0].vertices[10]).toBeCloseTo(33, 5);
    expect(layers[1].vertices[10]).toBeCloseTo(0, 5);
  });
});

import { describe, it, expect } from 'vitest';
import { mm } from '@/core/types';
import type { DrawerOutline, StackPrintParams } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { computeBaseplateTiling, pieceToBaseplateParams } from './splitPlanner';
import { cornerCutVertices } from '@/shared/utils/cornerCutOutline';
import { buildFullParams } from './buildFullParams';
import type { BaseplatePiece, BaseplateTiling } from '../types/tiling';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import {
  planPhysicalStacks,
  isUnstackedSplit,
  stackHeightCap,
  stackStrideMm,
  stackGroupsFromTiling,
  translateMesh,
  flipMeshUpsideDown,
  concatMeshes,
  meshBounds,
  buildTowerLayers,
  bodyCenterYMm,
  planPlateFlip,
  evaluateStackPrint,
  type StackGroup,
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

describe('isUnstackedSplit', () => {
  const plate = (label: string, copies: number) => ({ label, copies });

  it('is true when every tower is a single plate with a distinct label', () => {
    expect(isUnstackedSplit([plate('A1', 1), plate('B1', 1), plate('A2', 1)], 3)).toBe(true);
  });

  it('is false when a label repeats (height-cap split of a deduped group)', () => {
    // planPhysicalStacks(cap=1) expands a quantity-2 group into two same-label
    // single-plate stacks — count + copies look 1:1 but the pieces are deduped.
    expect(isUnstackedSplit([plate('A1', 1), plate('A1', 1)], 2)).toBe(false);
  });

  it('is false when any tower stacks more than one plate', () => {
    expect(isUnstackedSplit([plate('A1', 2), plate('B1', 1)], 2)).toBe(false);
  });

  it('is false when the plan size does not match the piece count', () => {
    // Two pieces deduped into one tower → not a 1:1 mapping.
    expect(isUnstackedSplit([plate('A1', 1)], 2)).toBe(false);
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
    // The plate() body spans Y[0,30], so re-seating it takes 2 × 15.
    const layers = buildTowerLayers(plate(), 3, 10.2, { axis: 'x', offsetMm: 30 });
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
    // All copies keep the source XY footprint (flip re-aligns the negated Y
    // about the body centre).
    for (const layer of layers) {
      const b = meshBounds(layer.vertices);
      expect(b.minX).toBeCloseTo(0, 5);
      expect(b.maxX).toBeCloseTo(20, 5);
      expect(b.minY).toBeCloseTo(0, 5);
      expect(b.maxY).toBeCloseTo(30, 5);
    }
  });

  it('clamps copies to at least 1', () => {
    expect(buildTowerLayers(plate(), 0, 10.2, { axis: 'x', offsetMm: 30 })).toHaveLength(1);
    expect(buildTowerLayers(plate(), 3.9, 10.2, { axis: 'x', offsetMm: 30 })).toHaveLength(3);
  });

  it('defaults to an X-axis turn with no re-seat (origin-centred real meshes)', () => {
    // plate() body spans Y[0,30]; with no re-seat the flip lands the body at
    // Y[-30,0] — only correct for origin-centred input, which is what the
    // default is for.
    const layers = buildTowerLayers(plate(), 2, 10);
    const flipped = meshBounds(layers[1].vertices);
    expect(flipped.minY).toBeCloseTo(-30, 5);
    expect(flipped.maxY).toBeCloseTo(0, 5);
  });

  it('re-seats the flipped body on the upright one and mirrors the tongue to the opposite edge', () => {
    // A plate whose +Y (back) edge carries a dovetail tongue protruding to Y=33,
    // body Y[0,30] (centre 15). The flip must re-seat the BODY on the upright one
    // — not the bounding box — so the socket grids line up; the tongue then
    // mirrors to the -Y (front) edge instead of dragging the body off-axis.
    const base: StackMeshArrays = {
      // floor triangle (Y 0..30) + tongue tip triangle protruding to Y=33.
      vertices: new Float32Array([0, 0, 0, 20, 0, 0, 0, 30, 0, 8, 33, 5, 12, 33, 5, 10, 30, 5]),
      normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
      edgeVertices: new Float32Array(0),
    };
    const layers = buildTowerLayers(base, 2, 10, { axis: 'x', offsetMm: 30 });
    // Body corners (verts 0 and 2) still span exactly Y[0,30] after the flip:
    // the body footprint is preserved (vert0 Y 0→30, vert2 Y 30→0).
    expect(layers[1].vertices[1]).toBeCloseTo(30, 5);
    expect(layers[1].vertices[7]).toBeCloseTo(0, 5);
    // Vertex 3 is the tongue tip: +Y (33) upright, mirrored about the body centre
    // to the -Y edge (2*15 − 33 = −3) after the flip — not clipped, not centred
    // on the bounding box.
    expect(layers[0].vertices[10]).toBeCloseTo(33, 5);
    expect(layers[1].vertices[10]).toBeCloseTo(-3, 5);
  });

  it('does not shift an origin-centred body off-axis when a tongue protrudes (regression)', () => {
    // Real baseplate meshes are body-centred at the origin (slabOffsetY≈0). A
    // front tongue protruding to Y=-18 skews the bounding box, which the old
    // full-bbox re-centring used to chase — offsetting every flipped plate by the
    // protrusion. With the default body centre (0) the body stays put.
    const base: StackMeshArrays = {
      // body Y[-15,15] + tongue tip protruding to Y=-18 on the front edge.
      vertices: new Float32Array([
        -10, -15, 0, 10, -15, 0, 0, 15, 0, -2, -18, 4, 2, -18, 4, 0, -15, 4,
      ]),
      normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
      edgeVertices: new Float32Array(0),
    };
    const layers = buildTowerLayers(base, 2, 8); // default flip: no re-seat
    // Upright and flipped body corners (verts 0/1 at Y=-15, vert2 at Y=15) keep
    // the same span; the body centre stays at 0 (no off-axis drift).
    expect(layers[1].vertices[1]).toBeCloseTo(15, 5); // vert0 Y: -15 → 15
    expect(layers[1].vertices[7]).toBeCloseTo(-15, 5); // vert2 Y: 15 → -15
    // Tongue mirrors front→back: -18 → +18.
    expect(layers[0].vertices[10]).toBeCloseTo(-18, 5);
    expect(layers[1].vertices[10]).toBeCloseTo(18, 5);
  });
});

describe('bodyCenterYMm', () => {
  it('is 0 for symmetric or zero padding', () => {
    expect(bodyCenterYMm(0, 0)).toBe(0);
    expect(bodyCenterYMm(5, 5)).toBe(0);
  });

  it('tracks padding asymmetry: (back − front) / 2', () => {
    expect(bodyCenterYMm(0, 10)).toBeCloseTo(5, 5); // more back padding → +Y
    expect(bodyCenterYMm(8, 0)).toBeCloseTo(-4, 5); // front-only padding → −Y
  });
});

describe('planPlateFlip', () => {
  type FlipInput = Parameters<typeof planPlateFlip>[0];
  const plate = (o: Partial<FlipInput> = {}): FlipInput => ({
    width: 4,
    depth: 4,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    ...o,
  });

  it('turns about X with no re-seat when both axes are congruent', () => {
    expect(planPlateFlip(plate())).toEqual({ axis: 'x', offsetMm: 0 });
    expect(planPlateFlip(plate({ paddingFront: 8.5, paddingBack: 8.5 }))).toEqual({
      axis: 'x',
      offsetMm: 0,
    });
  });

  it('turns about Y when only the depth axis is padded asymmetrically (#3235)', () => {
    // The outer piece of a split drawer: the drawer-fit padding lands on its
    // front edge alone. Turning about X would shift its sockets by the full
    // 8.5mm; turning about Y maps the lattice onto itself.
    expect(planPlateFlip(plate({ paddingFront: 8.5 }))).toEqual({ axis: 'y', offsetMm: 0 });
    expect(planPlateFlip(plate({ paddingBack: 8.5 }))).toEqual({ axis: 'y', offsetMm: 0 });
  });

  it('keeps the X turn when the width axis is the asymmetric one', () => {
    expect(planPlateFlip(plate({ paddingLeft: 8.5 }))).toEqual({ axis: 'x', offsetMm: 0 });
  });

  it('re-seats the slab when neither axis is congruent', () => {
    // Nothing to gain either way, so the X turn stands and the slab is re-seated
    // by the depth-axis asymmetry as before.
    expect(planPlateFlip(plate({ paddingFront: 8.5, paddingLeft: 3 }))).toEqual({
      axis: 'x',
      offsetMm: -8.5,
    });
  });

  it('disqualifies an axis carrying a fractional cell', () => {
    // Mirroring moves the sliver to the opposite end, which no re-seat undoes.
    expect(planPlateFlip(plate({ width: 3.5 }))).toEqual({ axis: 'x', offsetMm: 0 });
    expect(planPlateFlip(plate({ depth: 3.5 }))).toEqual({ axis: 'y', offsetMm: 0 });
    expect(planPlateFlip(plate({ width: 3.5, depth: 3.5 }))).toEqual({ axis: 'x', offsetMm: 0 });
  });

  it('keeps the X turn for a custom perimeter, whose symmetry padding cannot prove', () => {
    const outline: DrawerOutline = {
      vertices: cornerCutVertices(4 * 42, 4 * 42, {
        tl: { kind: 'radius', r: 42 },
        tr: { kind: 'none' },
        bl: { kind: 'none' },
        br: { kind: 'none' },
      }),
    };
    expect(planPlateFlip(plate({ paddingFront: 8.5, outline }))).toEqual({
      axis: 'x',
      offsetMm: -8.5,
    });
  });

  it('breaks a padding tie toward the turn that keeps rounded corners in place (#4081)', () => {
    // A full-width front row of an unpadded split rounds its two front corners
    // only. Turning about X carries them to the back edge; Y swaps them.
    const frontRow = {
      left: 'exterior',
      right: 'exterior',
      front: 'exterior',
      back: 'join',
    } as const;
    expect(planPlateFlip(plate({ edges: frontRow }))).toEqual({ axis: 'y', offsetMm: 0 });
    // Unlinked radii on an unsplit plate.
    expect(planPlateFlip(plate({ cornerRadii: { tl: 8, tr: 8, bl: 0, br: 0 } }))).toEqual({
      axis: 'y',
      offsetMm: 0,
    });
    expect(planPlateFlip(plate({ cornerRadii: { tl: 8, tr: 0, bl: 8, br: 0 } }))).toEqual({
      axis: 'x',
      offsetMm: 0,
    });
  });

  it('never lets rounding override lattice congruence', () => {
    // A corner tile's lone rounded corner is congruent about neither axis, so
    // the padding decides as before and the corner lands on the opposite side.
    const corner = { left: 'exterior', right: 'join', front: 'exterior', back: 'join' } as const;
    expect(planPlateFlip(plate({ edges: corner }))).toEqual({ axis: 'x', offsetMm: 0 });
    expect(planPlateFlip(plate({ edges: corner, paddingFront: 8.5 }))).toEqual({
      axis: 'y',
      offsetMm: 0,
    });
  });
});

describe('stackGroupsFromTiling', () => {
  /** DEFAULT_BASEPLATE_PARAMS is a StoredBaseplateParams (no grid dims);
   * groupPiecesByFingerprint needs the resolved shape. */
  const resolvedDefault: ResolvedBaseplateParams = {
    width: 6,
    depth: 4,
    gridUnitMm: 42,
    magnetHoles: DEFAULT_BASEPLATE_PARAMS.magnetHoles,
    magnetDiameter: DEFAULT_BASEPLATE_PARAMS.magnetDiameter,
    magnetDepth: DEFAULT_BASEPLATE_PARAMS.magnetDepth,
    paddingLeft: DEFAULT_BASEPLATE_PARAMS.paddingLeft,
    paddingRight: DEFAULT_BASEPLATE_PARAMS.paddingRight,
    paddingFront: DEFAULT_BASEPLATE_PARAMS.paddingFront,
    paddingBack: DEFAULT_BASEPLATE_PARAMS.paddingBack,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
  };

  function splitPiece(label: string): BaseplatePiece {
    return {
      label,
      col: 0,
      row: 0,
      widthUnits: 3,
      depthUnits: 3,
      gridOffsetX: 0,
      gridOffsetY: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
      fractionalEdgeX: 'none',
      fractionalEdgeY: 'none',
      edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      placementRotationDeg: 0,
    };
  }

  function splitTiling(...labels: string[]): BaseplateTiling {
    return {
      isSplit: true,
      pieces: labels.map(splitPiece),
      margins: [],
      cols: labels.length,
      rows: 1,
      colSizes: labels.map(() => 3),
      rowSizes: [3],
      totalWidthUnits: 3 * labels.length,
      totalDepthUnits: 3,
      stackCount: 1,
      stackSeparatorThickness: 0,
      bedLoads: 1,
      paddingReductionHint: null,
      isCustomSplit: false,
      bedOverages: [],
    };
  }

  it('returns a single plate of quantity 1 for an unsplit layout by default', () => {
    expect(stackGroupsFromTiling(null, resolvedDefault)).toEqual([{ label: 'plate', quantity: 1 }]);
  });

  it('multiplies the single plate by the copy count', () => {
    expect(stackGroupsFromTiling(null, resolvedDefault, 3)).toEqual([
      { label: 'plate', quantity: 3 },
    ]);
  });

  it('clamps copies to a whole number ≥ 1', () => {
    expect(stackGroupsFromTiling(null, resolvedDefault, 0)[0].quantity).toBe(1);
    expect(stackGroupsFromTiling(null, resolvedDefault, 4.9)[0].quantity).toBe(4);
  });

  it('multiplies each identical-piece group by copies for a split layout', () => {
    // Two byte-identical pieces → one fingerprint group of 2; copies=3 → 6.
    const groups = stackGroupsFromTiling(splitTiling('A1', 'B1'), resolvedDefault, 3);
    expect(groups).toHaveLength(1);
    expect(groups[0].quantity).toBe(6);
  });

  it('feeds copies into the warning evaluator so a single plate becomes stackable', () => {
    // copies=1: the lone plate is "nothing to stack".
    expect(evaluateStackPrint(stackGroupsFromTiling(null, resolvedDefault, 1), 48, 5, 250)).toEqual(
      { kind: 'singlePlate' }
    );
    // copies=3: now there are repeated plates to combine.
    expect(evaluateStackPrint(stackGroupsFromTiling(null, resolvedDefault, 3), 48, 5, 250)).toEqual(
      { kind: 'ok' }
    );
  });

  it('shares one tower per opposite-corner pair on a point-symmetric shaped plate (#3113)', () => {
    // A 1-unit radius cut on all four corners of an 8×8 plate makes TL↔BR and
    // TR↔BL 180° rotations, so the 2×2 split dedupes into two shared towers of
    // quantity 2 — not four singletons.
    const U = 42;
    const outline: DrawerOutline = {
      vertices: cornerCutVertices(8 * U, 8 * U, {
        tl: { kind: 'radius', r: U },
        tr: { kind: 'radius', r: U },
        bl: { kind: 'radius', r: U },
        br: { kind: 'radius', r: U },
      }),
    };
    const params: ResolvedBaseplateParams = {
      ...resolvedDefault,
      width: 8,
      depth: 8,
      connectorNubs: true,
      preferIdenticalPieces: true,
      outline,
    };
    const tiling = computeBaseplateTiling(params, 4.5 * U);
    expect(tiling.pieces).toHaveLength(4);

    const groups = stackGroupsFromTiling(tiling, params);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.quantity === 2)).toBe(true);
  });
});

describe('evaluateStackPrint', () => {
  const g = (label: string, quantity: number): StackGroup => ({ label, quantity });

  it('is ok when a group has ≥2 plates and the cap fits at least 2', () => {
    expect(evaluateStackPrint([g('A', 4)], 8, 5, 250)).toEqual({ kind: 'ok' });
  });

  it('flags a single unsplit plate as nothing to stack', () => {
    expect(evaluateStackPrint([g('plate', 1)], 48, 5, 250)).toEqual({ kind: 'singlePlate' });
  });

  it('flags an all-unique split (no repeated plate) as nothing to stack', () => {
    expect(evaluateStackPrint([g('A', 1), g('B', 1)], 48, 5, 250)).toEqual({
      kind: 'singlePlate',
    });
  });

  it('flags a build height that fits only one plate per tower', () => {
    expect(evaluateStackPrint([g('A', 6)], 1, 5, 5)).toEqual({ kind: 'buildHeightCapped' });
  });

  it('prioritises plateTooTall over everything when a plate overflows the build height', () => {
    expect(evaluateStackPrint([g('A', 6)], 1, 300, 250)).toEqual({ kind: 'plateTooTall' });
  });

  it('treats a non-finite cap as 1 (build-height capped) when there is something to stack', () => {
    expect(evaluateStackPrint([g('A', 6)], Number.NaN, 5, 250)).toEqual({
      kind: 'buildHeightCapped',
    });
  });
});

describe('flip congruence on real plate geometry (#3235)', () => {
  // Drives the real (procedural) generator rather than a fixture mesh: the
  // socket lattice sits on the origin while the slab rides the padding
  // asymmetry, and only a generated plate carries both. features/baseplate may
  // not import features/generation, but this test may (see splitPlanner.test).
  /** Plan-view vertex positions, which is where a mis-turned plate shows up. */
  function footprint(vertices: Float32Array): Set<string> {
    const seen = new Set<string>();
    for (let i = 0; i < vertices.length; i += 3) {
      seen.add(`${vertices[i].toFixed(3)},${vertices[i + 1].toFixed(3)}`);
    }
    return seen;
  }

  // The reported drawer: 7×12 with symmetric fit padding, which the split hands
  // to the outer pieces one side at a time. Resolved through buildFullParams so
  // stacking strips what it strips in the app (magnets). Corners are square so
  // the test isolates the lattice: a corner tile's rounded corner is a real
  // asymmetry no turn undoes, covered by the rounding cases below.
  const parent = buildFullParams(
    {
      ...DEFAULT_BASEPLATE_PARAMS,
      syncWithLayout: true,
      paddingLeft: mm(0),
      paddingRight: mm(0),
      paddingFront: mm(8.5),
      paddingBack: mm(8.5),
      cornerRadius: mm(0),
      overTile: true,
      overTileHalfGrid: true,
      stackPrint: { enabled: true, gapMm: mm(0.2), copies: 10 },
    },
    7,
    12,
    42,
    'end',
    'end'
  );

  it('every tower plate keeps the same footprint as the one below it', async () => {
    const { generateBaseplateDirect } =
      await import('@/features/generation/worker/generators/baseplateDirectMesh');
    const tiling = computeBaseplateTiling(parent, 256, 256);
    expect(tiling.isSplit).toBe(true);
    const padded = tiling.pieces.filter((p) => p.paddingFront > 0 || p.paddingBack > 0);
    expect(padded.length).toBeGreaterThan(0);

    for (const piece of tiling.pieces) {
      const pieceParams = pieceToBaseplateParams(piece, parent);
      const mesh = generateBaseplateDirect(pieceParams, () => {});
      const layers = buildTowerLayers(
        { ...mesh, edgeVertices: new Float32Array(0) },
        2,
        10,
        planPlateFlip(pieceParams)
      );
      expect(footprint(layers[1].vertices), `piece ${piece.label}`).toEqual(
        footprint(layers[0].vertices)
      );
    }
  });

  it('turning a one-side-padded plate about X instead shifts its lattice by the padding', async () => {
    // The pre-fix behaviour, kept as the counter-example: the outer footprints
    // still line up (the re-seat lands the slab), but the sockets do not.
    const { generateBaseplateDirect } =
      await import('@/features/generation/worker/generators/baseplateDirectMesh');
    const front = computeBaseplateTiling(parent, 256, 256).pieces.find((p) => p.paddingFront > 0);
    if (!front) throw new Error('expected a front-padded piece');
    const pieceParams = pieceToBaseplateParams(front, parent);
    const mesh = generateBaseplateDirect(pieceParams, () => {});
    const base = { ...mesh, edgeVertices: new Float32Array(0) };
    const aboutX = buildTowerLayers(base, 2, 10, {
      axis: 'x',
      offsetMm: 2 * bodyCenterYMm(pieceParams.paddingFront, pieceParams.paddingBack),
    });
    expect(meshBounds(aboutX[1].vertices).minY).toBeCloseTo(meshBounds(aboutX[0].vertices).minY, 5);
    expect(footprint(aboutX[1].vertices)).not.toEqual(footprint(aboutX[0].vertices));
  });
});

describe('rounded corners under stacking (#4081)', () => {
  function footprint(vertices: Float32Array): Set<string> {
    const seen = new Set<string>();
    for (let i = 0; i < vertices.length; i += 3) {
      seen.add(`${vertices[i].toFixed(3)},${vertices[i + 1].toFixed(3)}`);
    }
    return seen;
  }

  function stackedDrawer(width: number, depth: number): ResolvedBaseplateParams {
    return buildFullParams(
      {
        ...DEFAULT_BASEPLATE_PARAMS,
        syncWithLayout: true,
        paddingLeft: mm(0),
        paddingRight: mm(0),
        paddingFront: mm(8.5),
        paddingBack: mm(8.5),
        cornerRadius: mm(8),
        stackPrint: { enabled: true, gapMm: mm(0.2), copies: 10 },
      },
      width,
      depth,
      42,
      'end',
      'end'
    );
  }

  async function towerFootprints(
    parent: ResolvedBaseplateParams,
    piece: BaseplatePiece
  ): Promise<{
    upright: Set<string>;
    flipped: Set<string>;
    bounds: ReturnType<typeof meshBounds>;
  }> {
    const { generateBaseplateDirect } =
      await import('@/features/generation/worker/generators/baseplateDirectMesh');
    const pieceParams = pieceToBaseplateParams(piece, parent);
    const mesh = generateBaseplateDirect(pieceParams, () => {});
    const layers = buildTowerLayers(
      { ...mesh, edgeVertices: new Float32Array(0) },
      2,
      10,
      planPlateFlip(pieceParams)
    );
    return {
      upright: footprint(layers[0].vertices),
      flipped: footprint(layers[1].vertices),
      bounds: meshBounds(layers[0].vertices),
    };
  }

  it('keeps the radius on the resolved plate', () => {
    expect(stackedDrawer(5, 12).cornerRadius).toBe(mm(8));
  });

  it('full-width rows round two corners the Y turn swaps, so every plate matches the one below', async () => {
    // 5 units fit a 256mm bed, so the split is rows only: front and back rows
    // each round two corners, interior rows none.
    const parent = stackedDrawer(5, 12);
    const tiling = computeBaseplateTiling(parent, 256, 256);
    expect(tiling.isSplit).toBe(true);
    expect(
      tiling.pieces.every((p) => p.edges.left === 'exterior' && p.edges.right === 'exterior')
    ).toBe(true);
    for (const piece of tiling.pieces) {
      const { upright, flipped } = await towerFootprints(parent, piece);
      expect(flipped, `piece ${piece.label}`).toEqual(upright);
    }
  });

  it('a corner tile carries its lone rounded corner across, and nothing else moves', async () => {
    // Two columns, so every outer-row piece is a corner tile with one rounded
    // corner. No turn keeps it in place; the accepted cost is that corner alone:
    // every vertex that moves is the arc or the padding strip fanning off it,
    // never the socket lattice.
    const parent = stackedDrawer(7, 12);
    const tiling = computeBaseplateTiling(parent, 256, 256);
    const radius = parent.cornerRadius ?? 0;
    expect(radius).toBeGreaterThan(0);
    let movedCorners = 0;
    for (const piece of tiling.pieces) {
      const { upright, flipped, bounds } = await towerFootprints(parent, piece);
      const reach = radius + Math.max(piece.paddingFront, piece.paddingBack) + 0.01;
      const corners = [
        [bounds.minX, bounds.minY],
        [bounds.minX, bounds.maxY],
        [bounds.maxX, bounds.minY],
        [bounds.maxX, bounds.maxY],
      ];
      const moved = [...upright, ...flipped].filter((v) => !(upright.has(v) && flipped.has(v)));
      for (const v of moved) {
        const [x, y] = v.split(',').map(Number);
        const nearest = Math.min(
          ...corners.map(([cx, cy]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)))
        );
        expect(nearest, `piece ${piece.label} vertex ${v}`).toBeLessThanOrEqual(reach);
      }
      if (moved.length > 0) movedCorners++;
    }
    expect(movedCorners).toBeGreaterThan(0);
  });
});

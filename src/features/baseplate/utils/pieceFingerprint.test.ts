import { describe, it, expect } from 'vitest';
import { computePieceFingerprint, groupPiecesByFingerprint } from './pieceFingerprint';
import { computeBaseplateTiling } from './splitPlanner';
import type { BaseplateParams } from '@/shared/types/bin';

function makeParams(overrides: Partial<BaseplateParams> = {}): BaseplateParams {
  return {
    width: 6,
    depth: 4,
    gridUnitMm: 42,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    fractionalEdgeX: 'end',
    fractionalEdgeY: 'end',
    ...overrides,
  };
}

describe('computePieceFingerprint', () => {
  it('produces identical keys for identical params', () => {
    const params = makeParams({ width: 3, depth: 3 });
    const fp1 = computePieceFingerprint(params);
    const fp2 = computePieceFingerprint(params);
    expect(fp1).toBe(fp2);
  });

  it('produces different keys when dimensions differ', () => {
    const a = makeParams({ width: 3, depth: 3 });
    const b = makeParams({ width: 3, depth: 4 });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });

  it('produces different keys when padding differs', () => {
    const a = makeParams({ width: 3, depth: 3, paddingLeft: 2 });
    const b = makeParams({ width: 3, depth: 3, paddingLeft: 0 });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });

  it('produces different keys when edges differ', () => {
    const a = makeParams({ width: 3, depth: 3 });
    const aWithEdges = {
      ...a,
      edges: {
        left: 'exterior' as const,
        right: 'join' as const,
        front: 'exterior' as const,
        back: 'join' as const,
      },
    };
    const bWithEdges = {
      ...a,
      edges: {
        left: 'join' as const,
        right: 'exterior' as const,
        front: 'join' as const,
        back: 'exterior' as const,
      },
    };
    expect(computePieceFingerprint(aWithEdges)).not.toBe(computePieceFingerprint(bWithEdges));
  });

  it('produces different keys when magnet config differs', () => {
    const a = makeParams({ width: 3, depth: 3, magnetHoles: true });
    const b = makeParams({ width: 3, depth: 3, magnetHoles: false });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });

  it('produces different keys when connectors differ', () => {
    const a = makeParams({ width: 3, depth: 3, connectorNubs: true });
    const b = makeParams({ width: 3, depth: 3, connectorNubs: false });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });

  it('produces different keys when invertDovetails differs', () => {
    const inverted = makeParams({ width: 3, depth: 3, invertDovetails: true });
    const normal = makeParams({ width: 3, depth: 3 });
    expect(computePieceFingerprint(inverted)).not.toBe(computePieceFingerprint(normal));
  });

  it('produces different keys when cornerRadii differ', () => {
    const a = makeParams({
      width: 3,
      depth: 3,
      cornerRadii: { tl: 2, tr: 2, bl: 2, br: 2 },
    });
    const b = makeParams({
      width: 3,
      depth: 3,
      cornerRadii: { tl: 2, tr: 0, bl: 2, br: 0 },
    });
    expect(computePieceFingerprint(a)).not.toBe(computePieceFingerprint(b));
  });
});

describe('groupPiecesByFingerprint', () => {
  it('groups identical pieces in a symmetric 2x2 split (no padding)', () => {
    const params = makeParams({ width: 12, depth: 12 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(true);
    expect(tiling.pieces.length).toBe(4);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    // Each corner has different edge combos (exterior left+front vs exterior right+front, etc.)
    // so group count depends on edge symmetry
    expect(groups.size).toBeGreaterThanOrEqual(1);
    expect(groups.size).toBeLessThanOrEqual(4);

    // Total indices across all groups must equal piece count
    let totalIndices = 0;
    for (const group of groups.values()) {
      totalIndices += group.indices.length;
    }
    expect(totalIndices).toBe(4);
  });

  it('groups identical pieces in a symmetric 3x3 split with padding', () => {
    const params = makeParams({
      width: 18,
      depth: 18,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(true);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    // Symmetric padding: at most 9 unique, likely fewer due to matching edge patterns
    expect(groups.size).toBeLessThanOrEqual(tiling.pieces.length);
    expect(groups.size).toBeGreaterThanOrEqual(1);
  });

  it('single piece (no split) produces one group', () => {
    const params = makeParams({ width: 3, depth: 3 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(false);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    expect(groups.size).toBe(1);
  });

  it('preserves correct params for each group', () => {
    const params = makeParams({ width: 12, depth: 12, magnetHoles: true });
    const tiling = computeBaseplateTiling(params, 256);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    for (const group of groups.values()) {
      expect(group.params.magnetHoles).toBe(true);
      expect(group.params.gridUnitMm).toBe(42);
    }
  });

  it('invertDovetails propagates to all piece fingerprints', () => {
    const normal = makeParams({ width: 10, depth: 8 });
    const inverted = makeParams({ width: 10, depth: 8, invertDovetails: true });
    const tilingNormal = computeBaseplateTiling(normal, 256);
    const tilingInverted = computeBaseplateTiling(inverted, 256);
    expect(tilingNormal.isSplit).toBe(true);

    const groupsNormal = groupPiecesByFingerprint(tilingNormal.pieces, normal);
    const groupsInverted = groupPiecesByFingerprint(tilingInverted.pieces, inverted);

    // Every fingerprint in the inverted set should differ from every normal one
    const normalFps = new Set([...groupsNormal.keys()]);
    for (const fp of groupsInverted.keys()) {
      expect(normalFps.has(fp)).toBe(false);
    }
  });

  // ─── preferIdenticalPieces canonicalization (#1640) ──────────────────────

  it('collapses opposite-corner pieces into a single group under the flag', () => {
    // 10×8 → 2×2 grid. Without canonicalization there are 4 distinct edge
    // layouts (one per corner). With the flag, A1≡C2 and A2≡C1 → 2 groups.
    const params = makeParams({
      width: 10,
      depth: 8,
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.pieces).toHaveLength(4);

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    expect(groups.size).toBe(2);

    // Each group covers a diagonal pair.
    for (const group of groups.values()) {
      expect(group.indices).toHaveLength(2);
    }
  });

  it('keeps the 4-corner pieces distinct when the flag is off (baseline)', () => {
    const params = makeParams({ width: 10, depth: 8, preferIdenticalPieces: false });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    expect(groups.size).toBe(4);
  });

  it('preferIdenticalPieces=false and =true produce different fingerprint sets', () => {
    const off = makeParams({ width: 10, depth: 8 });
    const on = makeParams({
      width: 10,
      depth: 8,
      connectorNubs: true,
      preferIdenticalPieces: true,
    });
    const groupsOff = groupPiecesByFingerprint(computeBaseplateTiling(off, 256).pieces, off);
    const groupsOn = groupPiecesByFingerprint(computeBaseplateTiling(on, 256).pieces, on);

    // Flag is part of the fingerprint, so the keysets must be disjoint even
    // for pieces that happen to share an edge layout.
    const offKeys = new Set([...groupsOff.keys()]);
    for (const fp of groupsOn.keys()) {
      expect(offKeys.has(fp)).toBe(false);
    }
  });

  it('keeps opposite-corner pieces distinct under non-180°-symmetric cornerRadii', () => {
    // buildSlabProfile only applies radii at EXTERIOR corners (interior
    // corners are always squared). In a 2×2 split each corner piece has
    // exactly one exterior corner, and canonical pairs sit at different
    // exterior positions: A1↔B2 are (bl, tr) and A2↔B1 are (tl, br). When
    // parent.bl ≠ parent.tr (or parent.tl ≠ parent.br), the two pieces
    // need physically different radii at their single exterior corner, so
    // they cannot share a generated mesh — fingerprints must diverge.
    // (Greptile review #5 suggested canonicalizing cornerRadii in the
    // fingerprint; that would force a shared mesh and put the wrong radius
    // at one of the world corners.)
    const params = makeParams({
      width: 10,
      depth: 8,
      connectorNubs: true,
      preferIdenticalPieces: true,
      cornerRadii: { tl: 1, tr: 2, bl: 3, br: 4 },
    });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    expect(groups.size).toBe(4);
  });

  it('still collapses opposite-corner pieces when cornerRadii are 180°-symmetric', () => {
    // 180°-symmetric: tl == br and tr == bl. Opposite corners get matching
    // radii at their respective exterior positions, so the generated
    // meshes are genuine rotations of each other and dedup correctly.
    const params = makeParams({
      width: 10,
      depth: 8,
      connectorNubs: true,
      preferIdenticalPieces: true,
      cornerRadii: { tl: 1, tr: 2, bl: 2, br: 1 },
    });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    expect(groups.size).toBe(2);
  });

  it('fingerprint ignores invertDovetails under preferIdenticalPieces', () => {
    // buildConnectors discards invertDovetails in paired mode (the layout is
    // symmetric by construction). Persisted differences in that flag must
    // not split the BREP cache for otherwise-identical geometry.
    const base = {
      width: 3,
      depth: 3,
      connectorNubs: true,
      preferIdenticalPieces: true,
    } as const;
    const fpInvertOff = computePieceFingerprint(makeParams({ ...base, invertDovetails: false }));
    const fpInvertOn = computePieceFingerprint(makeParams({ ...base, invertDovetails: true }));
    expect(fpInvertOff).toBe(fpInvertOn);
  });

  it('fingerprint still distinguishes invertDovetails when paired mode is off', () => {
    const fpOff = computePieceFingerprint(
      makeParams({ width: 3, depth: 3, connectorNubs: true, invertDovetails: false })
    );
    const fpOn = computePieceFingerprint(
      makeParams({ width: 3, depth: 3, connectorNubs: true, invertDovetails: true })
    );
    expect(fpOff).not.toBe(fpOn);
  });
});

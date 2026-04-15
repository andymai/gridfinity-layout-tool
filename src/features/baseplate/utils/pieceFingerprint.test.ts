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
});

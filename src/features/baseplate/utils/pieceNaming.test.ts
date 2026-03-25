import { describe, it, expect } from 'vitest';
import { classifyPieceRole, assignGroupNames } from './pieceNaming';
import { computeBaseplateTiling } from './splitPlanner';
import { groupPiecesByFingerprint } from './pieceFingerprint';
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

describe('classifyPieceRole', () => {
  it('identifies corner pieces (2 exterior edges)', () => {
    const edges = {
      left: 'exterior' as const,
      right: 'join' as const,
      front: 'exterior' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('corner');
  });

  it('identifies edge-x pieces (left exterior only)', () => {
    const edges = {
      left: 'exterior' as const,
      right: 'join' as const,
      front: 'join' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('edge-x');
  });

  it('identifies edge-x pieces (right exterior only)', () => {
    const edges = {
      left: 'join' as const,
      right: 'exterior' as const,
      front: 'join' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('edge-x');
  });

  it('identifies edge-y pieces (front exterior only)', () => {
    const edges = {
      left: 'join' as const,
      right: 'join' as const,
      front: 'exterior' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('edge-y');
  });

  it('identifies edge-y pieces (back exterior only)', () => {
    const edges = {
      left: 'join' as const,
      right: 'join' as const,
      front: 'join' as const,
      back: 'exterior' as const,
    };
    expect(classifyPieceRole(edges)).toBe('edge-y');
  });

  it('identifies center pieces (no exterior edges)', () => {
    const edges = {
      left: 'join' as const,
      right: 'join' as const,
      front: 'join' as const,
      back: 'join' as const,
    };
    expect(classifyPieceRole(edges)).toBe('center');
  });

  it('classifies 3-exterior-edge piece as corner', () => {
    const edges = {
      left: 'exterior' as const,
      right: 'join' as const,
      front: 'exterior' as const,
      back: 'exterior' as const,
    };
    expect(classifyPieceRole(edges)).toBe('corner');
  });
});

describe('assignGroupNames', () => {
  it('assigns unique names to groups in a 3x3 split', () => {
    const params = makeParams({
      width: 18,
      depth: 18,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    const names = assignGroupNames(groups, tiling.pieces);

    // All names should be unique
    const nameSet = new Set(names.values());
    expect(nameSet.size).toBe(names.size);

    // All names should be valid filename components
    for (const name of names.values()) {
      expect(name).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('uses role-based names for 2D grids', () => {
    const params = makeParams({
      width: 18,
      depth: 18,
      paddingLeft: 2,
      paddingRight: 2,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    const names = assignGroupNames(groups, tiling.pieces);

    const allNames = [...names.values()];
    // Should contain role-based names (corner, edge-x, edge-y, center variations)
    const hasRoleNames = allNames.some(
      (n) => n.startsWith('corner') || n.startsWith('edge') || n === 'center'
    );
    expect(hasRoleNames).toBe(true);
  });

  it('uses sequential fallback for 1xN strips', () => {
    // Force a 1xN strip: narrow width that fits on one column, tall depth that splits rows
    const params = makeParams({
      width: 3,
      depth: 18,
      paddingFront: 2,
      paddingBack: 2,
    });
    const tiling = computeBaseplateTiling(params, 256);
    if (!tiling.isSplit || tiling.cols > 1) return; // Only test if actually a strip

    const groups = groupPiecesByFingerprint(tiling.pieces, params);
    if (groups.size <= 1) return; // Only test if multiple groups exist

    const names = assignGroupNames(groups, tiling.pieces);
    for (const name of names.values()) {
      expect(name).toMatch(/^piece-[a-z]$/);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { countConnectorKeys } from './connectorKeys';
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

describe('countConnectorKeys', () => {
  it('returns 0 when connectors are off', () => {
    const params = makeParams({ width: 18, depth: 12, connectorStyle: 'bowtie' });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(true);
    expect(countConnectorKeys(tiling, params)).toBe(0);
  });

  it('returns 0 for dovetail style even with connectors on', () => {
    const params = makeParams({ width: 18, depth: 12, connectorNubs: true });
    const tiling = computeBaseplateTiling(params, 256);
    expect(countConnectorKeys(tiling, params)).toBe(0);
  });

  it('returns 0 when the baseplate is not split', () => {
    const params = makeParams({
      width: 4,
      depth: 4,
      connectorNubs: true,
      connectorStyle: 'bowtie',
    });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(false);
    expect(countConnectorKeys(tiling, params)).toBe(0);
  });

  it('counts each interior seam junction exactly once', () => {
    const params = makeParams({
      width: 18,
      depth: 12,
      connectorNubs: true,
      connectorStyle: 'bowtie',
    });
    const tiling = computeBaseplateTiling(params, 256);

    // Derive the expected count independently: sum of interior cell boundaries
    // along every right + back join edge across all pieces.
    let expected = 0;
    for (const p of tiling.pieces) {
      if (p.edges.right === 'join') expected += Math.max(0, Math.ceil(p.depthUnits) - 1);
      if (p.edges.back === 'join') expected += Math.max(0, Math.ceil(p.widthUnits) - 1);
    }

    expect(countConnectorKeys(tiling, params)).toBe(expected);
    expect(countConnectorKeys(tiling, params)).toBeGreaterThan(0);
  });

  it('matches a hand-computed 2×1 split (single vertical seam)', () => {
    // A wide, shallow plate that splits into exactly two columns sharing one
    // vertical seam. The seam spans the full depth; junctions = interior depth
    // cell boundaries of each shared row.
    const params = makeParams({
      width: 12,
      depth: 3,
      connectorNubs: true,
      connectorStyle: 'bowtie',
    });
    const tiling = computeBaseplateTiling(params, 256);

    const rightJoinPieces = tiling.pieces.filter((p) => p.edges.right === 'join');
    const backJoinPieces = tiling.pieces.filter((p) => p.edges.back === 'join');
    const expected =
      rightJoinPieces.reduce((n, p) => n + Math.max(0, Math.ceil(p.depthUnits) - 1), 0) +
      backJoinPieces.reduce((n, p) => n + Math.max(0, Math.ceil(p.widthUnits) - 1), 0);

    expect(countConnectorKeys(tiling, params)).toBe(expected);
  });
});

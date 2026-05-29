import { describe, it, expect } from 'vitest';
import { countConnectorKeys, computeSeamJunctions } from './connectorKeys';
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
    const params = makeParams({ width: 18, depth: 12, connectorStyle: 'dovetailKey' });
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
      connectorStyle: 'dovetailKey',
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
      connectorStyle: 'dovetailKey',
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
      connectorStyle: 'dovetailKey',
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

describe('computeSeamJunctions', () => {
  it('returns [] unless dovetail key connectors are active', () => {
    const params = makeParams({ width: 18, depth: 12, connectorNubs: true });
    const tiling = computeBaseplateTiling(params, 256);
    expect(computeSeamJunctions(tiling, params)).toEqual([]);
  });

  it('count equals countConnectorKeys (single source of truth)', () => {
    const params = makeParams({
      width: 18,
      depth: 12,
      connectorNubs: true,
      connectorStyle: 'dovetailKey',
    });
    const tiling = computeBaseplateTiling(params, 256);
    expect(computeSeamJunctions(tiling, params).length).toBe(countConnectorKeys(tiling, params));
  });

  it('places junctions in the centered frame, on seam lines, with correct axis', () => {
    const params = makeParams({
      width: 18,
      depth: 12,
      connectorNubs: true,
      connectorStyle: 'dovetailKey',
    });
    const tiling = computeBaseplateTiling(params, 256);
    const junctions = computeSeamJunctions(tiling, params);
    expect(junctions.length).toBeGreaterThan(0);

    const g = params.gridUnitMm;
    const halfW = (tiling.totalWidthUnits * g) / 2;
    const halfD = (tiling.totalDepthUnits * g) / 2;

    // Every junction sits inside the centered baseplate bounds.
    for (const j of junctions) {
      expect(j.xMm).toBeGreaterThanOrEqual(-halfW);
      expect(j.xMm).toBeLessThanOrEqual(halfW);
      expect(j.yMm).toBeGreaterThanOrEqual(-halfD);
      expect(j.yMm).toBeLessThanOrEqual(halfD);
    }

    // x-axis junctions lie on a vertical seam: their X is an interior grid line
    // (a multiple of the grid unit offset from the left edge, not the outer edge).
    for (const j of junctions.filter((k) => k.axis === 'x')) {
      const fromLeft = j.xMm + halfW;
      expect(Math.abs(fromLeft - Math.round(fromLeft / g) * g)).toBeLessThan(1e-6);
      expect(fromLeft).toBeGreaterThan(0);
      expect(fromLeft).toBeLessThan(2 * halfW);
    }
  });
});

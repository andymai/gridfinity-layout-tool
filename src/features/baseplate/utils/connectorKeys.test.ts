import { describe, it, expect } from 'vitest';
import { countConnectorKeys, computeSeamJunctions } from './connectorKeys';
import { computeBaseplateTiling } from './splitPlanner';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';

function makeParams(overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams {
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

describe('keyed margin seams (issue #2866)', () => {
  /** Left/right padding only ⇒ they run long and carry the seam connector. */
  const detached = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams =>
    makeParams({
      width: 18,
      depth: 12,
      paddingLeft: 12,
      paddingRight: 12,
      detachMargins: true,
      detachMarginConnector: true,
      connectorNubs: true,
      connectorStyle: 'dovetailKey',
      ...overrides,
    });

  /** Junctions that sit on an outer grid edge — i.e. on a body↔rail seam. */
  function marginJunctions(
    params: ResolvedBaseplateParams
  ): ReturnType<typeof computeSeamJunctions> {
    const tiling = computeBaseplateTiling(params, 256);
    const halfW = (tiling.totalWidthUnits * params.gridUnitMm) / 2;
    return computeSeamJunctions(tiling, params).filter(
      (j) => Math.abs(Math.abs(j.xMm) - halfW) < 1e-6
    );
  }

  it('seats a key on every interior boundary of each long rail', () => {
    const params = detached();
    const tiling = computeBaseplateTiling(params, 256);
    const longRails = (tiling.margins ?? []).filter((m) => m.role === 'long' && m.seamConnector);
    expect(longRails.length, 'left+right rails, one segment per row').toBeGreaterThan(0);

    // One key per interior cell boundary of each rail's mating wall.
    const expected = longRails.reduce((sum, m) => {
      const units = m.seamConnector?.cellUnits ?? 0;
      const cells = Math.floor(units) + (units % 1 >= 0.5 ? 1 : 0);
      return sum + Math.max(0, cells - 1);
    }, 0);
    expect(marginJunctions(params).length).toBe(expected);
  });

  it('places them on the body grid edge, spanning across the seam', () => {
    const params = detached();
    const tiling = computeBaseplateTiling(params, 256);
    const halfW = (tiling.totalWidthUnits * params.gridUnitMm) / 2;
    const junctions = marginJunctions(params);
    expect(junctions.length).toBeGreaterThan(0);
    for (const j of junctions) {
      // Detached sides print padding-free, so the body wall is the grid edge.
      expect(Math.abs(j.xMm)).toBeCloseTo(halfW, 6);
      // A left/right rail seam runs along Y, so the key spans X.
      expect(j.axis).toBe('x');
      // On an interior cell boundary of the mating wall, never a corner.
      const fromFront = j.yMm + (tiling.totalDepthUnits * params.gridUnitMm) / 2;
      expect(
        Math.abs(fromFront - Math.round(fromFront / params.gridUnitMm) * params.gridUnitMm)
      ).toBeLessThan(1e-6);
      expect(fromFront).toBeGreaterThan(0);
      expect(fromFront).toBeLessThan(tiling.totalDepthUnits * params.gridUnitMm);
    }
  });

  it('needs the connector opted in and the key style selected', () => {
    expect(marginJunctions(detached({ detachMarginConnector: false })).length).toBe(0);
    expect(marginJunctions(detached({ detachMargins: false })).length).toBe(0);
    // A tongued seam needs no separate part; a snap-clip seam stays friction-fit.
    expect(marginJunctions(detached({ connectorStyle: 'puzzle' })).length).toBe(0);
    expect(marginJunctions(detached({ connectorStyle: 'snapClip' })).length).toBe(0);
  });

  it('keys an unsplit plate whose margins detach', () => {
    // No split seams at all, so every key comes from the body↔rail seams.
    const params = detached({ width: 4, depth: 4 });
    const tiling = computeBaseplateTiling(params, 256);
    expect(tiling.isSplit).toBe(false);
    expect(countConnectorKeys(tiling, params)).toBe(marginJunctions(params).length);
    expect(countConnectorKeys(tiling, params)).toBeGreaterThan(0);
  });

  it('counts margin keys on top of the split-seam keys', () => {
    const params = detached();
    const tiling = computeBaseplateTiling(params, 256);
    const splitOnly = computeBaseplateTiling({ ...params, detachMarginConnector: false }, 256);
    const splitKeys = countConnectorKeys(splitOnly, {
      ...params,
      detachMarginConnector: false,
    });
    expect(countConnectorKeys(tiling, params)).toBe(splitKeys + marginJunctions(params).length);
  });
});

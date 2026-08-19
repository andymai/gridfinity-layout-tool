import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, OverhangConfig } from '@/shared/types/bin';
import { binSplitChunkUnits } from './binSplitFit';
import { getSplitPieceCount, getSplitPositions } from './splitPositions';

const BED = 180;

function params(over: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, width: 4, depth: 4, gridUnitMm: 42, ...over };
}

function overhang(sides: Partial<OverhangConfig>): OverhangConfig {
  return { left: 0, right: 0, front: 0, back: 0, enabled: true, ...sides };
}

/** Widest single piece an axis produces, in mm, with the overhang it carries. */
function widestPieceMm(
  sizeUnits: number,
  maxUnits: number,
  gridUnitMm: number,
  near: number,
  far: number
): number {
  const cuts = getSplitPositions(sizeUnits, maxUnits);
  const pieceUnits = sizeUnits / (cuts.length + 1);
  const pieceMm = pieceUnits * gridUnitMm;
  return cuts.length === 0 ? pieceMm + near + far : pieceMm + Math.max(near, far);
}

describe('binSplitChunkUnits', () => {
  it('matches the nominal capacity when the bin has no overhang', () => {
    expect(binSplitChunkUnits(params({ width: 8, depth: 8 }), BED)).toEqual({
      width: 4,
      depth: 4,
    });
  });

  it('reports no split for a bin that fits whole', () => {
    const p = params();
    const max = binSplitChunkUnits(p, BED);
    expect(p.width > max.width || p.depth > max.depth).toBe(false);
  });

  it('splits a bin whose overhang pushes it past the bed', () => {
    // 4 x 42mm = 168mm nominal, inside a 180mm bed. The overhang makes the real
    // part 271.5mm wide, which is the reported case (#3612).
    const p = params({ overhang: overhang({ left: 61.5, right: 42 }) });
    const max = binSplitChunkUnits(p, BED);

    expect(p.width > max.width).toBe(true);
    expect(getSplitPieceCount(p.width, p.depth, max.width, max.depth)).toBe(2);
    expect(widestPieceMm(p.width, max.width, p.gridUnitMm, 61.5, 42)).toBeLessThanOrEqual(BED);
  });

  it('leaves an axis with no overhang alone', () => {
    const p = params({ overhang: overhang({ left: 61.5, right: 42 }) });
    const max = binSplitChunkUnits(p, BED);
    expect(p.depth > max.depth).toBe(false);
  });

  it('does not split a bin the overhang still leaves inside the bed', () => {
    // 168mm + 10mm = 178mm. Charging the larger side against the bed up front
    // would have capped the axis at 2 units and split a part that fits.
    const p = params({ overhang: overhang({ left: 10 }) });
    const max = binSplitChunkUnits(p, BED);
    expect(p.width > max.width).toBe(false);
  });

  it('always yields a cut when it reports a split, even on a symmetric overhang', () => {
    // Both sides charged, the part overruns; the larger single side alone does
    // not — the axis must still come back below its own size or the caller
    // reports a split with no cut planes.
    const p = params({ overhang: overhang({ left: 8, front: 8, right: 8, back: 8 }) });
    const max = binSplitChunkUnits(p, BED);
    expect(p.width > max.width).toBe(true);
    expect(getSplitPositions(p.width, max.width)).not.toHaveLength(0);
    expect(widestPieceMm(p.width, max.width, p.gridUnitMm, 8, 8)).toBeLessThanOrEqual(BED);
  });

  it('uses the per-axis pitch on a non-square grid', () => {
    const p = params({ width: 8, depth: 8, gridUnitMm: 42, gridUnitMmY: 21 });
    expect(binSplitChunkUnits(p, BED)).toEqual({ width: 4, depth: 8 });
  });

  it('honours a separate bed depth', () => {
    expect(binSplitChunkUnits(params({ width: 8, depth: 8 }), 180, 250)).toEqual({
      width: 4,
      depth: 5.5,
    });
  });

  it('ignores an overhang the config disables', () => {
    const p = params({ overhang: { ...overhang({ left: 61.5 }), enabled: false } });
    expect(p.width > binSplitChunkUnits(p, BED).width).toBe(false);
  });

  it('ignores overhang on a partial cell mask, as the geometry pipeline does', () => {
    const p = params({
      overhang: overhang({ left: 61.5, right: 42 }),
      cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0] },
    });
    expect(p.width > binSplitChunkUnits(p, BED).width).toBe(false);
  });
});

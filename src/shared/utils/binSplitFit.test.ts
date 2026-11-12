import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, OverhangConfig } from '@/shared/types/bin';
import { binBedFit, binSplitChunkUnits, placedBinBedCapacity } from './binSplitFit';
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

  // A half-unit axis is the smallest there is, so "step the limit down" has to
  // mean halving rather than a fixed 0.5 — subtracting a whole step from it
  // leaves the same axis, and the caller gets "needs split" with no cut planes.
  it('cuts a half-unit axis whose overhang overruns the bed', () => {
    const p = params({ width: 0.5, depth: 1, overhang: overhang({ left: 100, right: 100 }) });
    const max = binSplitChunkUnits(p, BED);
    expect(p.width > max.width).toBe(true);
    expect(getSplitPositions(p.width, max.width)).not.toHaveLength(0);
    expect(widestPieceMm(p.width, max.width, p.gridUnitMm, 100, 100)).toBeLessThanOrEqual(BED);
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

describe('binSplitChunkUnits across a rectangular bed', () => {
  const WIDE = 256;
  const DEEP = 210;

  it('fits a bin that lies across the bed without a split', () => {
    const p = params({ width: 5, depth: 6 });
    const max = binSplitChunkUnits(p, WIDE, DEEP);
    expect(max).toEqual({ width: 5, depth: 6 });
    expect(p.width > max.width || p.depth > max.depth).toBe(false);
  });

  it('keeps the bed as given when the bin fits that way', () => {
    expect(binSplitChunkUnits(params({ width: 6, depth: 5 }), WIDE, DEEP)).toEqual({
      width: 6,
      depth: 5,
    });
  });

  it('charges the overhang against the bed axis the bin lies along', () => {
    // The overhang belongs to the bin's side, not the bed's: turned, it is
    // charged against the bed depth the width now lies along.
    const p = params({ width: 5, depth: 6, overhang: overhang({ left: 30 }) });
    const max = binSplitChunkUnits(p, WIDE, DEEP);
    expect(p.width > max.width || p.depth > max.depth).toBe(true);
  });

  it('turns the bin to cut fewer pieces when it fits neither way', () => {
    const p = params({ width: 4, depth: 12 });
    const max = binSplitChunkUnits(p, WIDE, DEEP);
    expect(getSplitPieceCount(p.width, p.depth, max.width, max.depth)).toBe(2);
  });
});

describe('binSplitChunkUnits on a slanted bin', () => {
  const big: BinParams = { ...DEFAULT_BIN_PARAMS, width: 8, depth: 8, height: 6 };
  const leaning: BinParams = { ...big, slant: { angleDeg: 30, side: 'back' } };

  it('never splits a bin the shear leans', () => {
    expect(binSplitChunkUnits(big, 256)).not.toEqual({ width: 8, depth: 8 });
    expect(binSplitChunkUnits(leaning, 256)).toEqual({ width: 8, depth: 8 });
  });

  it('splits as usual when a blocker cancels the slant', () => {
    const blocked = { ...leaning, slide: { ...leaning.slide, enabled: true } };
    expect(binSplitChunkUnits(blocked, 256)).toEqual(binSplitChunkUnits(big, 256));
  });

  it('gives the upright answer to a caller that passes no slant inputs', () => {
    const { width, depth, gridUnitMm, gridUnitMmY, overhang, cellMask } = leaning;
    expect(
      binSplitChunkUnits({ width, depth, gridUnitMm, gridUnitMmY, overhang, cellMask }, 256)
    ).toEqual(binSplitChunkUnits(big, 256));
  });
});

describe('binBedFit across the diagonal', () => {
  const long = params({ width: 1.5, depth: 7 });

  it('prints a 1.5 x 7 bin whole on a 256mm bed, keeping the square-on cut', () => {
    const fit = binBedFit(long, 256);
    expect(fit.diagonal).toBe(true);
    expect(fit.chunk).toEqual({ width: 1.5, depth: 7 });
    expect(binSplitChunkUnits(long, 256)).toEqual(fit.chunk);
    expect(getSplitPieceCount(1.5, 7, fit.squareOn.width, fit.squareOn.depth)).toBe(2);
  });

  it('charges both sides of the overhang against the diagonal', () => {
    // 63 + 294 = 357mm of sides fits 256 * sqrt(2) = 362mm; 6mm more does not.
    expect(binBedFit({ ...long, overhang: overhang({ front: 3, back: 2 }) }, 256).diagonal).toBe(
      true
    );
    expect(binBedFit({ ...long, overhang: overhang({ front: 3, back: 3 }) }, 256).diagonal).toBe(
      false
    );
  });

  it('is not diagonal for a bin that fits square-on or turned', () => {
    expect(binBedFit(params({ width: 5, depth: 6 }), 256, 210).diagonal).toBe(false);
    expect(binBedFit(params(), BED).diagonal).toBe(false);
  });

  it('never lays a slanted bin diagonally, since it never splits', () => {
    const leaning: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1.5,
      depth: 7,
      height: 6,
      slant: { angleDeg: 30, side: 'back' },
    };
    expect(binBedFit(leaning, 256)).toEqual({
      chunk: { width: 1.5, depth: 7 },
      squareOn: { width: 1.5, depth: 7 },
      diagonal: false,
      keptWhole: false,
    });
  });
});

describe('binBedFit with splitting turned off', () => {
  const long = params({ width: 6, depth: 1 });

  it('splits a design that predates the switch, as it always did', () => {
    const { splitToFitBed: _absent, ...legacy } = long;
    const fit = binBedFit(legacy, BED);
    expect(fit.chunk).toEqual({ width: 4, depth: 1 });
    expect(fit.keptWhole).toBe(false);
  });

  it('splits with the switch on', () => {
    const fit = binBedFit({ ...long, splitToFitBed: true }, BED);
    expect(fit.chunk).toEqual({ width: 4, depth: 1 });
    expect(binSplitChunkUnits({ ...long, splitToFitBed: true }, BED)).toEqual({
      width: 4,
      depth: 1,
    });
  });

  it('keeps a bin larger than the bed whole and says so', () => {
    const off = { ...long, splitToFitBed: false };
    expect(binBedFit(off, BED)).toEqual({
      chunk: { width: 6, depth: 1 },
      squareOn: { width: 6, depth: 1 },
      diagonal: false,
      keptWhole: true,
    });
    expect(binSplitChunkUnits(off, BED)).toEqual({ width: 6, depth: 1 });
  });

  it('says nothing about a bin that fits', () => {
    expect(binBedFit(params({ splitToFitBed: false }), BED).keptWhole).toBe(false);
  });

  it('counts the overhang when it decides the bin is larger than the bed', () => {
    const fit = binBedFit(
      params({ splitToFitBed: false, overhang: overhang({ left: 61.5, right: 42 }) }),
      BED
    );
    expect(fit.chunk).toEqual({ width: 4, depth: 4 });
    expect(fit.keptWhole).toBe(true);
  });

  it('offers no split for a bin that fits only lying diagonally', () => {
    const fit = binBedFit(params({ width: 1.5, depth: 7, splitToFitBed: false }), 256);
    expect(fit).toEqual({
      chunk: { width: 1.5, depth: 7 },
      squareOn: { width: 1.5, depth: 7 },
      diagonal: true,
      keptWhole: false,
    });
  });
});

describe('placedBinBedCapacity', () => {
  const fit = (over: Parameters<typeof placedBinBedCapacity>[0]) => placedBinBedCapacity(over, 256);
  const sides = (o: Partial<OverhangConfig>) => overhang(o);

  it('reads the bed capacity for a bin that fits, as before', () => {
    expect(fit({ width: 4, depth: 4, gridUnitMm: 42 })).toEqual({ width: 6, depth: 6 });
  });

  it('keeps the diagonal fit of a long bin', () => {
    expect(fit({ width: 1.5, depth: 7, gridUnitMm: 42 })).toEqual({
      width: 1.5,
      depth: 7,
      diagonal: true,
    });
  });

  // 6 x 42 = 252mm fits a 256mm bed; 9mm a side makes the part 270mm.
  it('cuts a bin that only its overhang pushes past the bed, as the print list does', () => {
    const o = sides({ left: 9, right: 9, front: 9, back: 9 });
    const cap = fit({ width: 6, depth: 6, gridUnitMm: 42, overhang: o });
    expect(cap).toEqual(
      binSplitChunkUnits({ ...params({ width: 6, depth: 6 }), overhang: o }, 256)
    );
    expect(6 > cap.width && 6 > cap.depth).toBe(true);
  });

  it('cuts only the axis the overhang overruns, and keeps the bed on the other', () => {
    const cap = fit({ width: 6, depth: 4, gridUnitMm: 42, overhang: sides({ left: 9 }) });
    expect(cap).toEqual({ width: 5.5, depth: 6 });
  });

  it('keeps that bin whole, with the cut it skips, when its design turns splitting off', () => {
    const cap = fit({
      width: 6,
      depth: 4,
      gridUnitMm: 42,
      overhang: sides({ left: 9 }),
      splitToFitBed: false,
    });
    expect(cap).toEqual({ width: 6, depth: 4, keptWhole: { width: 5.5, depth: 6 } });
  });

  it('cuts to the same pieces the print list lists when the overhang adds one', () => {
    // 12 units: two pieces of 6 on paper, three of 4 once 9mm a side is charged.
    const o = sides({ left: 9, right: 9 });
    const cap = fit({ width: 12, depth: 1, gridUnitMm: 42, overhang: o });
    const chunk = binSplitChunkUnits({ ...params({ width: 12, depth: 1 }), overhang: o }, 256);
    expect(getSplitPieceCount(12, 1, cap.width, cap.depth)).toBe(
      getSplitPieceCount(12, 1, chunk.width, chunk.depth)
    );
  });
});

import { describe, it, expect } from 'vitest';
import type { CellMask } from '@/shared/utils/cellMask';
import { maskCutFaces } from './splitMaskCutFaces';
import type { CutFace } from './splitConnectorFrame';

const PITCH = { x: 42, y: 42 };

/** Rows listed top-first for reading; stored bottom-first. */
function maskFromRows(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  return { cols: bottomFirst[0].length, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

/** A y-axis cut spanning the whole bin width, as `computeCutFaces` reports it. */
function yCut(position: number, widthUnits: number): CutFace {
  const outer = widthUnits * 42 - 0.5;
  return {
    axis: 'y',
    position,
    isMale: true,
    binEdgeMin: -outer / 2,
    binEdgeMax: outer / 2,
    pieceEdgeLength: outer,
    pieceCenterOffset: 0,
    perpendicularCuts: [],
  };
}

const BAR: (0 | 1)[] = [1, 1, 1, 1, 1, 1];
const STEM: (0 | 1)[] = [0, 0, 1, 1, 0, 0];
// 3×3: bar on top, stem below. Rows are 21mm; the bin spans y ±63.
const T_MASK = maskFromRows([BAR, BAR, STEM, STEM, STEM, STEM]);

describe('maskCutFaces', () => {
  it('narrows a cut through the stem to the stem, walled at both ends', () => {
    const [face, ...rest] = maskCutFaces([yCut(-30, 3)], T_MASK, PITCH);
    expect(rest).toHaveLength(0);
    expect(face.binEdgeMin).toBeCloseTo(-20.75);
    expect(face.binEdgeMax).toBeCloseTo(20.75);
    expect(face.pieceEdgeLength).toBeCloseTo(41.5);
    expect(face.pieceCenterOffset).toBeCloseTo(0);
  });

  it('keys no end where the far side of the cut carries on as floor', () => {
    // On the stem/bar boundary: the bar continues past both stem walls, so
    // the female half has no wall there for a groove.
    const [face] = maskCutFaces([yCut(21, 3)], T_MASK, PITCH);
    expect(face.binEdgeMin).toBe(Number.NEGATIVE_INFINITY);
    expect(face.binEdgeMax).toBe(Number.POSITIVE_INFINITY);
    expect(face.pieceEdgeLength).toBeCloseTo(42);
  });

  it('gives each separate run its own face', () => {
    const arm: (0 | 1)[] = [1, 1, 0, 0, 1, 1];
    const u = maskFromRows([arm, arm, arm, arm, BAR, BAR]);
    const faces = maskCutFaces([yCut(0, 3)], u, PITCH);
    expect(faces.map((f) => [f.binEdgeMin, f.binEdgeMax])).toEqual([
      [-62.75, -21.25],
      [21.25, 62.75],
    ]);
  });

  it('reproduces the rectangle face on a full mask', () => {
    const full = maskFromRows(Array.from({ length: 6 }, () => BAR));
    const rect = yCut(0, 3);
    const [face] = maskCutFaces([rect], full, PITCH);
    expect(face.binEdgeMin).toBeCloseTo(rect.binEdgeMin);
    expect(face.binEdgeMax).toBeCloseTo(rect.binEdgeMax);
    expect(face.pieceEdgeLength).toBeCloseTo(rect.pieceEdgeLength);
  });

  it('leaves a wall beyond the piece to the neighbouring piece', () => {
    // A perpendicular cut at x = 0 splits the stem; this piece spans x ≥ 0.
    const face: CutFace = { ...yCut(-30, 3), pieceEdgeLength: 62.75, pieceCenterOffset: 31.375 };
    const [run] = maskCutFaces([face], T_MASK, PITCH);
    expect(run.binEdgeMin).toBe(Number.NEGATIVE_INFINITY);
    expect(run.binEdgeMax).toBeCloseTo(20.75);
    expect(run.pieceCenterOffset - run.pieceEdgeLength / 2).toBeCloseTo(0);
  });
});

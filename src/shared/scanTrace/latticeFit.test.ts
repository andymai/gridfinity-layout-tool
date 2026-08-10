import { describe, it, expect } from 'vitest';
import {
  fitLattice,
  fitBestLattice,
  fullLatticeNodes,
  type LatticeCandidate,
  type LatticeSpec,
} from './latticeFit';
import { applyHomography, type Homography } from './perspective';
import type { Point } from './types';

const PITCH = 42;
// mm → image, with a real perspective component (h6/h7), not just a scale.
const FORWARD: Homography = [3.1, 0.12, 80, -0.09, 3.05, 60, 0.0009, 0.0006, 1];

const project = (p: Point): Point => applyHomography(FORWARD, p);

function spec(cols: number, rows: number, overrides: Partial<LatticeSpec> = {}): LatticeSpec {
  return {
    cols,
    rows,
    pitchMm: PITCH,
    nodes: fullLatticeNodes(cols, rows, PITCH),
    minCells: 8,
    maxRmsMm: 1.5,
    nodeSnapMm: 0.25 * PITCH,
    pointSnapMm: 0.25 * PITCH,
    ...overrides,
  };
}

/** Cells on a cols × rows lattice, each contributing just its centre. */
function cells(
  cols: number,
  rows: number,
  keep: (col: number, row: number) => boolean = () => true
): LatticeCandidate[] {
  const out: LatticeCandidate[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!keep(col, row)) continue;
      const centre = project({ x: col * PITCH, y: row * PITCH });
      out.push({
        center: centre,
        outline: [centre, centre, centre, centre],
        points: [{ image: centre, offsetMm: { x: 0, y: 0 } }],
      });
    }
  }
  return out;
}

/** Distance between two known mm points, as the fitted map reports it. */
function measured(h: Homography, a: Point, b: Point): number {
  const ma = applyHomography(h, project(a));
  const mb = applyHomography(h, project(b));
  return Math.hypot(mb.x - ma.x, mb.y - ma.y);
}

describe('fitLattice', () => {
  it('recovers true millimetres from a full lattice', () => {
    const fit = fitLattice(cells(4, 4), spec(4, 4));
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.cells).toHaveLength(16);
    expect(fit.rmsMm).toBeLessThan(0.01);
    expect(measured(fit.homography, { x: 0, y: 0 }, { x: 60, y: 80 })).toBeCloseTo(100, 3);
  });

  it('tolerates missing cells where the tool covers them', () => {
    const ring = cells(4, 4, (col, row) => col === 0 || col === 3 || row === 0 || row === 3);
    const fit = fitLattice(ring, spec(4, 4));
    expect(fit).not.toBeNull();
    expect(fit?.cells).toHaveLength(12);
  });

  // Every INTEGER MULTIPLE of the true lattice explains the same points exactly:
  // a 4×4 grid fitted against a 7×7 trial pins its corners to nodes 0 and 6, so
  // every cell lands on an even node with zero residual — at twice the true
  // scale. Cell count, residual and span all pass. Only the requirement that the
  // fitted lattice be the FINEST one consistent with the data catches it.
  it('refuses a doubled lattice that fits perfectly at the wrong scale', () => {
    expect(fitLattice(cells(4, 4), spec(7, 7))).toBeNull();
  });

  it('picks the true scale when the doubled one is also on offer', () => {
    const fit = fitBestLattice(
      cells(4, 4),
      [
        [4, 4],
        [7, 7],
      ],
      (cols, rows) => spec(cols, rows)
    );
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(measured(fit.homography, { x: 0, y: 0 }, { x: 60, y: 80 })).toBeCloseTo(100, 3);
  });

  it('refuses cells clustered in one corner of the claimed extent', () => {
    const corner = cells(6, 6, (col, row) => col <= 2 && row <= 2);
    expect(fitLattice(corner, spec(6, 6))).toBeNull();
  });

  it("refuses a fit whose residual exceeds the caller's budget", () => {
    expect(fitLattice(cells(4, 4), spec(4, 4, { maxRmsMm: -1 }))).toBeNull();
  });

  it('refuses when too few cells were found', () => {
    expect(fitLattice(cells(4, 4), spec(4, 4, { minCells: 20 }))).toBeNull();
  });
});

describe('fitBestLattice', () => {
  const extents: ReadonlyArray<readonly [number, number]> = [
    [4, 4],
    [4, 5],
    [5, 4],
  ];

  it('discovers the extent it was not told', () => {
    const fit = fitBestLattice(cells(4, 5), extents, (cols, rows) => spec(cols, rows));
    expect(fit).not.toBeNull();
    expect(fit?.cells).toHaveLength(20);
    if (fit)
      expect(measured(fit.homography, { x: 0, y: 0 }, { x: 126, y: 168 })).toBeCloseTo(210, 3);
  });

  // Applied during selection, so an implausible best answer cannot hide a
  // usable runner-up behind it.
  it("honours the caller's plausibility test", () => {
    const rejectAll = fitBestLattice(
      cells(4, 4),
      extents,
      (c, r) => spec(c, r),
      () => false
    );
    expect(rejectAll).toBeNull();

    const only45 = fitBestLattice(
      cells(4, 5),
      extents,
      (c, r) => spec(c, r),
      (fit) => fit.cells.length < 20
    );
    expect(only45).toBeNull();
  });
});

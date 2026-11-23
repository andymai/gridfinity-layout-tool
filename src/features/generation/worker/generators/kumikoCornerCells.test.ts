import { describe, it, expect } from 'vitest';
import { cornerCells } from './kumikoCornerCells';
import type { CornerCell, CornerCellPiece } from './kumikoCornerCells';
import type { KumikoLattice, KumikoSegment } from './patterns';

const RADIUS = 3.75;
const FACE_RADIUS = RADIUS + 0.02;
const ARC = (Math.PI / 2) * RADIUS;
const FACETS = 7;
const STEP = Math.PI / 2 / FACETS;
const U0 = 34;
const BAND_Z0 = 3;
const BAND_HEIGHT = 20;
const PERIMETER = 160;

function lattice(segments: KumikoSegment[], fillingTemplate: KumikoSegment[] = []): KumikoLattice {
  return {
    segments,
    fillingTemplate,
    vertices: fillingTemplate.length > 0 ? [{ u: U0 + ARC / 2, z: BAND_HEIGHT / 2 }] : [],
    strutWidth: 1.2,
    columnPitch: 5,
    cellSize: 6,
  };
}

function cells(l: KumikoLattice): CornerCell[] | null {
  return cornerCells(l, U0, U0 + ARC, BAND_Z0, BAND_HEIGHT, RADIUS, FACE_RADIUS, PERIMETER);
}

function pieceArea(piece: CornerCellPiece): number {
  const ring = (pts: readonly (readonly [number, number])[]): number => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) / 2;
  };
  return ring(piece.outer) - piece.holes.reduce((sum, h) => sum + ring(h), 0);
}

const totalArea = (all: readonly CornerCell[]): number =>
  all.reduce((sum, cell) => sum + cell.reduce((s, piece) => s + pieceArea(piece), 0), 0);

const ts = (piece: CornerCellPiece): number[] => piece.outer.map(([t]) => t);

describe('cornerCells', () => {
  it('returns null when no strut reaches the corner', () => {
    // A strut on the far side of the perimeter.
    expect(cells(lattice([{ a: [100, 0], b: [100, BAND_HEIGHT] }]))).toBeNull();
  });

  it('cuts the band into one cell above a horizontal strut and one below', () => {
    const zMid = BAND_HEIGHT / 2;
    const all = cells(lattice([{ a: [U0 - 5, zMid], b: [U0 + ARC + 5, zMid] }])) ?? [];
    expect(all).toHaveLength(2);
    for (const cell of all) {
      // Each cell runs the whole arc: one piece on each facet.
      expect(cell).toHaveLength(FACETS);
      for (const piece of cell) {
        for (const [, z] of piece.outer) {
          expect(z).toBeGreaterThanOrEqual(BAND_Z0 - 1e-6);
          expect(z).toBeLessThanOrEqual(BAND_Z0 + BAND_HEIGHT + 1e-6);
        }
      }
    }
    const zs = all.flatMap((cell) => cell.flatMap((piece) => piece.outer.map(([, z]) => z)));
    // The strut is 1.2 wide plus the coplanar overlap on each side.
    expect(zs.some((z) => Math.abs(z - (BAND_Z0 + zMid - 0.6)) < 0.05)).toBe(true);
    expect(zs.some((z) => Math.abs(z - (BAND_Z0 + zMid + 0.6)) < 0.05)).toBe(true);
  });

  it('makes neighbor facets meet on the face radius', () => {
    const all = cells(lattice([{ a: [U0 - 5, 2], b: [U0 + ARC + 5, 2] }])) ?? [];
    // No cell corner lies inside the arc, so the seams stay regular.
    const edge = FACE_RADIUS * Math.sin(STEP / 2);
    for (const cell of all) {
      cell.forEach((piece, k) => {
        expect(piece.phiMid).toBeCloseTo((k + 0.5) * STEP, 6);
        expect(Math.min(...ts(piece))).toBeCloseTo(-edge, 5);
        expect(Math.max(...ts(piece))).toBeCloseTo(edge, 5);
      });
    }
  });

  it('splits the band at a vertical strut', () => {
    const uMid = U0 + ARC / 2;
    const all = cells(lattice([{ a: [uMid, 0], b: [uMid, BAND_HEIGHT] }])) ?? [];
    // One cell on each side of the strut.
    expect(all).toHaveLength(2);
    const mids = all.map((cell) => cell.map((piece) => piece.phiMid));
    const [low, high] = Math.max(...mids[0]) < Math.max(...mids[1]) ? mids : [mids[1], mids[0]];
    expect(Math.min(...low)).toBeLessThan(STEP);
    expect(Math.max(...high)).toBeGreaterThan(Math.PI / 2 - STEP);
    expect(totalArea(all)).toBeLessThan(FACE_RADIUS * (Math.PI / 2) * BAND_HEIGHT);
  });

  it('moves a seam off a cell corner', () => {
    // The strut's left edge is on the regular seam between facets 2 and 3.
    const seam = (3 * ARC) / FACETS;
    const uStrut = U0 + seam + 0.61;
    const all = cells(lattice([{ a: [uStrut, 0], b: [uStrut, BAND_HEIGHT] }])) ?? [];
    const pieces = all.flat();
    // No facet middle is at the regular angle of facet 2 any more.
    expect(pieces.every((piece) => Math.abs(piece.phiMid - 2.5 * STEP) > 0.01)).toBe(true);
    // No piece is a thin strip along a seam.
    for (const piece of pieces) {
      expect(Math.max(...ts(piece)) - Math.min(...ts(piece))).toBeGreaterThan(0.05);
    }
  });

  it('drops a sliver between two struts that almost touch', () => {
    const zMid = BAND_HEIGHT / 2;
    // Two horizontal struts 1.21 apart: a 0.01 gap less the coplanar overlap.
    const all =
      cells(
        lattice([
          { a: [U0 - 5, zMid], b: [U0 + ARC + 5, zMid] },
          { a: [U0 - 5, zMid + 1.21], b: [U0 + ARC + 5, zMid + 1.21] },
        ])
      ) ?? [];
    expect(all).toHaveLength(2);
  });

  it('stamps the filling template at a vertex', () => {
    const bare = cells(lattice([{ a: [U0 - 5, 2], b: [U0 + ARC + 5, 2] }])) ?? [];
    const filled =
      cells(
        lattice(
          [{ a: [U0 - 5, 2], b: [U0 + ARC + 5, 2] }],
          [{ a: [-1, -3], b: [1, 3], width: 0.8 }]
        )
      ) ?? [];
    expect(totalArea(filled)).toBeLessThan(totalArea(bare));
  });
});

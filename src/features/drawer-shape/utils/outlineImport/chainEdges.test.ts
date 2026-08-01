import { describe, it, expect } from 'vitest';
import { flattenOutline, polylineSignedArea } from '@/shared/utils/drawerOutlineGeometry';
import { chainEdges, type Edge } from './chainEdges';

const edge = (ax: number, ay: number, bx: number, by: number, bulge = 0): Edge => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  bulge,
});

const area = (vertices: Parameters<typeof flattenOutline>[0]['vertices']) =>
  Math.abs(polylineSignedArea(flattenOutline({ vertices })));

/** Four sides of a 100 × 80 rectangle, already head-to-tail. */
const SQUARE: Edge[] = [
  edge(0, 0, 100, 0),
  edge(100, 0, 100, 80),
  edge(100, 80, 0, 80),
  edge(0, 80, 0, 0),
];

describe('chainEdges', () => {
  it('closes a loop from edges given in order', () => {
    const loops = chainEdges(SQUARE);
    expect(loops).toHaveLength(1);
    expect(loops[0].vertices).toHaveLength(4);
    expect(area(loops[0].vertices)).toBeCloseTo(8000, 6);
  });

  // CAD writes entities in whatever order the shape was drawn, not in
  // traversal order, so the walk cannot assume anything about the input.
  it('closes a loop from edges given out of order', () => {
    const shuffled = [SQUARE[2], SQUARE[0], SQUARE[3], SQUARE[1]];
    const loops = chainEdges(shuffled);
    expect(loops).toHaveLength(1);
    expect(area(loops[0].vertices)).toBeCloseTo(8000, 6);
  });

  it('joins an edge that runs the wrong way', () => {
    const reversed = [SQUARE[0], edge(100, 80, 100, 0), SQUARE[2], SQUARE[3]];
    const loops = chainEdges(reversed);
    expect(loops).toHaveLength(1);
    expect(area(loops[0].vertices)).toBeCloseTo(8000, 6);
  });

  // A bulge bows right of travel, so reversing an edge without flipping it
  // turns an outward bow into an inward bite.
  it('flips a bulge when it reverses the edge that carries it', () => {
    const forward = chainEdges([edge(0, 0, 100, 0, 0.5), edge(100, 0, 0, 0, 0.5)]);
    const reversed = chainEdges([edge(0, 0, 100, 0, 0.5), edge(0, 0, 100, 0, -0.5)]);
    expect(forward).toHaveLength(1);
    expect(reversed).toHaveLength(1);
    // Same lens either way: reversing the second edge and negating its bulge
    // describes the same physical arc.
    expect(area(reversed[0].vertices)).toBeCloseTo(area(forward[0].vertices), 6);
  });

  // Rounded coordinates mean shared endpoints are rarely bit-identical.
  it('joins endpoints that are close but not identical', () => {
    const sloppy = [edge(0, 0, 100, 0), edge(100.02, 0, 100, 80), SQUARE[2], SQUARE[3]];
    expect(chainEdges(sloppy)).toHaveLength(1);
  });

  // Per-axis comparison describes a square, which would accept a diagonal gap
  // of tol * sqrt(2) — wider than the tolerance claims to allow.
  it('measures the gap as a distance, not per axis', () => {
    // (0.04, 0.04) is 0.0566mm apart: inside the tolerance on either axis
    // alone, outside it as an actual distance.
    const diagonal = [edge(0, 0, 100, 0), edge(100.04, 0.04, 100, 80), SQUARE[2], SQUARE[3]];
    expect(chainEdges(diagonal)).toHaveLength(0);

    // (0.03, 0.03) is 0.0424mm apart, genuinely within tolerance.
    const inside = [edge(0, 0, 100, 0), edge(100.03, 0.03, 100, 80), SQUARE[2], SQUARE[3]];
    expect(chainEdges(inside)).toHaveLength(1);
  });

  it('refuses to join a gap wider than the tolerance', () => {
    const gapped = [edge(0, 0, 100, 0), edge(105, 0, 100, 80), SQUARE[2], SQUARE[3]];
    expect(chainEdges(gapped)).toHaveLength(0);
  });

  // Bridging a gap would invent an edge the user never drew, so an open chain
  // is dropped rather than force-closed.
  it('drops an open chain instead of closing it', () => {
    expect(chainEdges([SQUARE[0], SQUARE[1], SQUARE[2]])).toHaveLength(0);
  });

  it('finds several separate loops', () => {
    const second: Edge[] = [
      edge(200, 0, 240, 0),
      edge(240, 0, 240, 40),
      edge(240, 40, 200, 40),
      edge(200, 40, 200, 0),
    ];
    const loops = chainEdges([...SQUARE, ...second]);
    expect(loops).toHaveLength(2);
    expect(loops.map((l) => Math.round(area(l.vertices))).sort((a, b) => a - b)).toEqual([
      1600, 8000,
    ]);
  });

  it('consumes each edge at most once', () => {
    const loops = chainEdges(SQUARE);
    expect(loops.reduce((n, l) => n + l.vertices.length, 0)).toBe(SQUARE.length);
  });

  it('returns nothing for no edges', () => {
    expect(chainEdges([])).toEqual([]);
  });
});

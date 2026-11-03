import { describe, it, expect } from 'vitest';
import { polylineCrosses } from './outlineSegments';
import { dropCoincidentPoints, COINCIDENT_POINT_EPSILON, withoutTinyLoops } from './polyline';

const p = (x: number, y: number): { x: number; y: number } => ({ x, y });

describe('dropCoincidentPoints', () => {
  it('removes a duplicate consecutive vertex (snap-to-grid duplicate)', () => {
    const result = dropCoincidentPoints([p(0, 0), p(10, 0), p(10, 0), p(5, 10)]);
    expect(result).toEqual([p(0, 0), p(10, 0), p(5, 10)]);
  });

  it('keeps collinear-but-distinct points (does not over-collapse)', () => {
    const result = dropCoincidentPoints([p(0, 0), p(5, 0), p(10, 0), p(0, 10)]);
    expect(result).toHaveLength(4);
  });

  it('drops a trailing point coincident with the first when closed', () => {
    const result = dropCoincidentPoints([p(0, 0), p(10, 0), p(5, 10), p(0, 0)], true);
    expect(result).toEqual([p(0, 0), p(10, 0), p(5, 10)]);
  });

  it('drops a whole trailing run coincident with the first when closed', () => {
    const result = dropCoincidentPoints([p(0, 0), p(10, 0), p(5, 10), p(0, 0), p(0, 0)], true);
    expect(result).toEqual([p(0, 0), p(10, 0), p(5, 10)]);
  });

  it('keeps a first/last coincidence when open (closed=false)', () => {
    // An open polyline (e.g. the in-progress drawing preview) has no implicit
    // closing edge, so a first==last point is meaningful and must be kept.
    const result = dropCoincidentPoints([p(0, 0), p(10, 0), p(0, 0)], false);
    expect(result).toEqual([p(0, 0), p(10, 0), p(0, 0)]);
  });

  it('collapses an all-coincident path to a single point', () => {
    const result = dropCoincidentPoints([p(3, 3), p(3, 3), p(3, 3)]);
    expect(result).toEqual([p(3, 3)]);
  });

  it('merges points within epsilon and keeps points just beyond it', () => {
    const within = dropCoincidentPoints([p(0, 0), p(COINCIDENT_POINT_EPSILON / 2, 0), p(5, 5)]);
    expect(within).toHaveLength(2);
    const beyond = dropCoincidentPoints([p(0, 0), p(COINCIDENT_POINT_EPSILON * 10, 0), p(5, 5)]);
    expect(beyond).toHaveLength(3);
  });

  it('returns references to the original point objects (no allocation, no mutation)', () => {
    const input = [p(0, 0), p(10, 0), p(5, 10)];
    const result = dropCoincidentPoints(input);
    expect(result[0]).toBe(input[0]);
    expect(input).toHaveLength(3);
  });

  it('handles empty and single-point input', () => {
    expect(dropCoincidentPoints([])).toEqual([]);
    expect(dropCoincidentPoints([p(1, 2)])).toEqual([p(1, 2)]);
  });
});

describe('withoutTinyLoops', () => {
  const at = (x: number, y: number) => p(x, y);
  // A 10 mm square whose top edge curls over itself, as a fold or a rounded
  // zigzag does: the edge back from (5.2, 9.8) crosses the one it left.
  const CURLED = [
    p(0, 0),
    p(10, 0),
    p(10, 10),
    p(6, 10),
    p(4.8, 10),
    p(5.2, 9.8),
    p(5, 10.2),
    p(0, 10),
  ];

  it('cuts a small loop out at its crossing', () => {
    expect(polylineCrosses(CURLED)).toBe(true);
    const fixed = withoutTinyLoops(CURLED, 0.5, at);
    expect(polylineCrosses(fixed)).toBe(false);
    expect(fixed).toHaveLength(CURLED.length - 1);
    expect(fixed[0]).toEqual(p(6, 10));
    expect(fixed[1].x).toBeCloseTo(5.1);
    expect(fixed[1].y).toBeCloseTo(10);
  });

  it('leaves a loop as large as a part of the shape, crossing and all', () => {
    const bowtie = [p(0, 0), p(10, 10), p(10, 0), p(0, 10)];
    expect(withoutTinyLoops(bowtie, 0.5, at)).toEqual(bowtie);
  });

  it('leaves a ring that never crosses itself alone', () => {
    const square = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];
    expect(withoutTinyLoops(square, 0.5, at)).toEqual(square);
  });
});

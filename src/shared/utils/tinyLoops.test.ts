import { describe, it, expect } from 'vitest';
import { polylineCrosses } from './outlineSegments';
import { withoutTinyLoops } from './tinyLoops';

const p = (x: number, y: number): { x: number; y: number } => ({ x, y });

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

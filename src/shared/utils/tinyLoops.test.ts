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
    // The curl's two points give way to the one where it crossed.
    expect(fixed).toHaveLength(CURLED.length - 1);
    expect(fixed).not.toContainEqual(p(4.8, 10));
    expect(fixed).not.toContainEqual(p(5.2, 9.8));
    const cutAt = fixed[4];
    expect(cutAt.x).toBeCloseTo(5.1);
    expect(cutAt.y).toBeCloseTo(10);
  });

  it('finds a small loop however finely it is drawn', () => {
    // Every edge split in 21: the crossing edges end up far apart in the ring.
    const dense = CURLED.flatMap((a, i) => {
      const b = CURLED[(i + 1) % CURLED.length];
      return Array.from({ length: 21 }, (_, s) =>
        p(a.x + ((b.x - a.x) * s) / 21, a.y + ((b.y - a.y) * s) / 21)
      );
    });
    expect(polylineCrosses(dense)).toBe(true);
    expect(polylineCrosses(withoutTinyLoops(dense, 0.5, at))).toBe(false);
  });

  it('never measures a loop that crosses itself, whose lobes can cancel', () => {
    const lobed = [p(0, -1), p(0, 1), p(10, 11), p(10, 1), p(0, 11), p(-0.01, -1), p(0.01, 1)];
    const xs = withoutTinyLoops(lobed, 0.5, at).map((q) => q.x);
    // The outline still spans its 10 mm, rather than collapsing to a sliver.
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(9.9);
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

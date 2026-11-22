import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { transformPoints } from './pointTransform';
import { toDrawnFrame } from './pathRings';

function point(x: number, y: number, overrides: Partial<PathPoint> = {}): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false, ...overrides };
}

const RING = [point(0, 0), point(10, 0), point(10, 10), point(0, 10)];

function path(rotation = 0): Cutout {
  return {
    id: 'p',
    shape: 'path',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path: RING,
  };
}

const BOX = { minX: 10, minY: 0, maxX: 10, maxY: 10 };

const xy = (p: { x: number; y: number }) => [
  Number(p.x.toFixed(6)) + 0,
  Number(p.y.toFixed(6)) + 0,
];

describe('transformPoints', () => {
  it('scales the selection about the opposite corner', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const out = transformPoints(
      path(),
      RING,
      [1, 2],
      { handle: 'ne', box, startX: 10, startY: 10 },
      { x: 15, y: 10 },
      false
    );
    expect(out.map(xy)).toEqual([
      [0, 0],
      [15, 0],
      [15, 10],
      [0, 10],
    ]);
  });

  it('does not jump when a grip is pressed off its corner', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const out = transformPoints(
      path(),
      RING,
      [0, 1, 2, 3],
      { handle: 'ne', box, startX: 10.5, startY: 10.5 },
      { x: 10.5, y: 10.5 },
      false
    );
    expect(out.map(xy)).toEqual(RING.map(xy));
  });

  it('keeps the proportions with Shift', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const out = transformPoints(
      path(),
      RING,
      [0, 1, 2, 3],
      { handle: 'ne', box, startX: 10, startY: 10 },
      { x: 20, y: 12 },
      true
    );
    expect(xy(out[2])).toEqual([20, 20]);
  });

  it('does not scale across a selection with no width', () => {
    const out = transformPoints(
      path(),
      RING,
      [1, 2],
      { handle: 'ne', box: BOX, startX: 10, startY: 10 },
      { x: 30, y: 20 },
      false
    );
    expect(xy(out[1])).toEqual([10, 0]);
    expect(xy(out[2])).toEqual([10, 20]);
  });

  it('turns the selection about its middle', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const out = transformPoints(
      path(),
      RING,
      [0, 1, 2, 3],
      { handle: 'rotate', box, startX: 5, startY: 20 },
      { x: -10, y: 5 },
      false
    );
    // A quarter turn counter-clockwise about (5, 5).
    expect(xy(out[0])).toEqual([10, 0]);
    expect(xy(out[1])).toEqual([10, 10]);
  });

  it('snaps a turn to 15° steps with Shift', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const tilted = {
      x: 5 + 15 * Math.cos((102 * Math.PI) / 180),
      y: 5 + 15 * Math.sin((102 * Math.PI) / 180),
    };
    const out = transformPoints(
      path(),
      RING,
      [0, 1, 2, 3],
      { handle: 'rotate', box, startX: 5, startY: 20 },
      tilted,
      true
    );
    expect(xy(out[0])).toEqual(
      xy(
        transformPoints(
          path(),
          RING,
          [0, 1, 2, 3],
          { handle: 'rotate', box, startX: 5, startY: 20 },
          {
            x: 5 + 15 * Math.cos((105 * Math.PI) / 180),
            y: 5 + 15 * Math.sin((105 * Math.PI) / 180),
          },
          false
        )[0]
      )
    );
  });

  it('scales a handle with its point', () => {
    const ring = [point(0, 0), point(10, 0, { handleOut: { dx: 0, dy: 2 } }), point(10, 10)];
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const out = transformPoints(
      path(),
      ring,
      [1],
      { handle: 'ne', box, startX: 10, startY: 10 },
      { x: 10, y: 20 },
      false
    );
    expect(out[1].handleOut?.dy).toBeCloseTo(4, 9);
  });

  it('scales a turned path along the box it draws', () => {
    const turned = path(90);
    const drawn = RING.map((p) => toDrawnFrame(turned, p.x, p.y));
    const xs = drawn.map((p) => p.x);
    const ys = drawn.map((p) => p.y);
    const box = {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
    const out = transformPoints(
      turned,
      RING,
      [0, 1, 2, 3],
      { handle: 'ne', box, startX: box.maxX, startY: box.maxY },
      { x: box.maxX + 10, y: box.maxY },
      false
    );
    const after = out.map((p) => toDrawnFrame(turned, p.x, p.y));
    const width = Math.max(...after.map((p) => p.x)) - Math.min(...after.map((p) => p.x));
    const depth = Math.max(...after.map((p) => p.y)) - Math.min(...after.map((p) => p.y));
    expect(width).toBeCloseTo(20, 6);
    expect(depth).toBeCloseTo(10, 6);
  });
});

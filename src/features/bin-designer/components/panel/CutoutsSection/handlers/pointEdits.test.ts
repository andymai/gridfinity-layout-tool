import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import {
  allSmooth,
  drawnBox,
  movePoints,
  normalizeSelection,
  pointsInRect,
  removePoints,
  setPointKind,
  toggleIndex,
} from './pointEdits';
import { toDrawnFrame } from './pathRings';

function point(x: number, y: number, overrides: Partial<PathPoint> = {}): PathPoint {
  return { x, y, handleIn: null, handleOut: null, symmetric: false, ...overrides };
}

const SQUARE = [point(0, 0), point(10, 0), point(10, 10), point(0, 10)];

function path(points: PathPoint[], overrides: Partial<Cutout> = {}): Cutout {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    id: 'p',
    shape: 'path',
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...ys) - Math.min(...ys),
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path: points,
    ...overrides,
  };
}

describe('normalizeSelection', () => {
  it('sorts, drops repeats and drops indices past the ring', () => {
    expect(normalizeSelection([3, 1, 3, 9, -1, 0], 4)).toEqual([0, 1, 3]);
  });
});

describe('toggleIndex', () => {
  it('adds a point that is not selected and takes out one that is', () => {
    expect(toggleIndex([0, 2], 1)).toEqual([0, 1, 2]);
    expect(toggleIndex([0, 1, 2], 1)).toEqual([0, 2]);
  });
});

describe('pointsInRect', () => {
  it('picks the points inside the marquee', () => {
    expect(pointsInRect(path(SQUARE), { minX: 5, minY: -1, maxX: 11, maxY: 11 })).toEqual({
      ring: 0,
      indices: [1, 2],
    });
  });

  it('takes the ring with the most points inside, so a selection stays on one ring', () => {
    const island = [point(4, 4), point(6, 4), point(6, 6), point(4, 6)];
    const cutout = { ...path(SQUARE), holes: [island] };
    expect(pointsInRect(cutout, { minX: 3, minY: 3, maxX: 11, maxY: 7 })).toEqual({
      ring: 1,
      indices: [0, 1, 2, 3],
    });
  });

  it('reads the points where a turned path draws them', () => {
    const turned = path(SQUARE, { rotation: 90 });
    const drawn = toDrawnFrame(turned, 10, 0);
    const near = {
      minX: drawn.x - 0.1,
      minY: drawn.y - 0.1,
      maxX: drawn.x + 0.1,
      maxY: drawn.y + 0.1,
    };
    expect(pointsInRect(turned, near)).toEqual({ ring: 0, indices: [1] });
  });

  it('holds nothing when no point is inside', () => {
    expect(pointsInRect(path(SQUARE), { minX: 20, minY: 20, maxX: 30, maxY: 30 })).toBeNull();
  });
});

describe('movePoints', () => {
  it('moves only the chosen points, and their handles ride along', () => {
    const ring = [point(0, 0, { handleOut: { dx: 2, dy: 0 } }), point(10, 0), point(10, 10)];
    const moved = movePoints(ring, [0, 2], 1, -1);
    expect(moved.map((p) => [p.x, p.y])).toEqual([
      [1, -1],
      [10, 0],
      [11, 9],
    ]);
    expect(moved[0].handleOut).toEqual({ dx: 2, dy: 0 });
  });
});

describe('removePoints', () => {
  it('removes every chosen point', () => {
    expect(removePoints(SQUARE, [1, 3])?.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 10],
    ]);
  });

  it('refuses to leave fewer points than a path needs', () => {
    expect(removePoints(SQUARE, [0, 1, 2])).toBeNull();
  });
});

describe('setPointKind', () => {
  it('gives a smooth point handles along the line through its neighbours', () => {
    const [, smooth] = setPointKind(SQUARE, [1], 'smooth');
    // Neighbours (0,0) and (10,10): the tangent runs at 45°.
    expect(smooth.handleOut?.dx).toBeCloseTo(smooth.handleOut?.dy ?? NaN, 9);
    expect(smooth.handleIn?.dx).toBeCloseTo(-(smooth.handleOut?.dx ?? NaN), 9);
    expect(Math.hypot(smooth.handleOut?.dx ?? 0, smooth.handleOut?.dy ?? 0)).toBeCloseTo(10 / 3, 9);
  });

  it('takes the handles off a corner', () => {
    const curved = setPointKind(SQUARE, [0, 1], 'smooth');
    expect(allSmooth(curved, [0, 1])).toBe(true);
    const sharp = setPointKind(curved, [0], 'corner');
    expect(sharp[0].handleIn).toBeNull();
    expect(sharp[0].handleOut).toBeNull();
    expect(allSmooth(sharp, [0, 1])).toBe(false);
  });
});

describe('drawnBox', () => {
  it('is the box of the chosen points as drawn', () => {
    expect(drawnBox(path(SQUARE), 0, [0, 2])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });

  it('is null for a ring that is gone', () => {
    expect(drawnBox(path(SQUARE), 3, [0])).toBeNull();
  });
});

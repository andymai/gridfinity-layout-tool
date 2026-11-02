import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { getCutoutBounds } from './maskFit';
import { convexHull, minAreaTurn } from './minAreaTurn';

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

function cut(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 30,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

/** A 40 × 10 bar drawn at 30° as a path, its box fitted to it. */
function tiltedBar(): Cutout {
  const a = (30 * Math.PI) / 180;
  const pts = [
    [0, 0],
    [40, 0],
    [40, 10],
    [0, 10],
  ].map(([x, y]) => ({
    x: 50 + x * Math.cos(a) - y * Math.sin(a),
    y: 20 + x * Math.sin(a) + y * Math.cos(a),
  }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return cut({
    shape: 'path',
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...ys) - Math.min(...ys),
    path: pts.map((p) => corner(p.x, p.y)),
  });
}

const size = (c: Cutout, rotation: number) => {
  const b = getCutoutBounds({ ...c, rotation });
  return { w: b.maxX - b.minX, d: b.maxY - b.minY };
};

describe('convexHull', () => {
  it('keeps the corners and drops points inside and along edges', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 4, y: 6 },
      { x: 0, y: 10 },
    ]);
    expect(hull).toHaveLength(4);
  });
});

describe('minAreaTurn', () => {
  it('lays a shape drawn at an angle square to the board, landscape', () => {
    const bar = tiltedBar();
    const turn = minAreaTurn(bar);
    if (turn === null) throw new Error('no turn');
    const { w, d } = size(bar, turn);
    expect(w).toBeCloseTo(40, 6);
    expect(d).toBeCloseTo(10, 6);
  });

  it('stands a portrait rectangle on its side', () => {
    expect(minAreaTurn(cut({ width: 10, depth: 30 }))).toBe(90);
  });

  it('leaves a landscape rectangle as it is, and squares a turned one', () => {
    expect(minAreaTurn(cut())).toBe(0);
    expect(minAreaTurn(cut({ rotation: 30 }))).toBe(0);
  });

  // The board measures a round by its turned box, which only a square turn keeps tight.
  it('squares a turned round to the nearer of its two square turns', () => {
    expect(minAreaTurn(cut({ shape: 'circle', width: 20, depth: 20, rotation: 37 }))).toBe(0);
    expect(minAreaTurn(cut({ shape: 'circle', width: 20, depth: 20, rotation: 70 }))).toBe(90);
  });

  it('keeps a shape whose box is already within a hair of its best', () => {
    expect(minAreaTurn(cut({ rotation: 0.01 }))).toBe(0.01);
    expect(minAreaTurn(cut({ rotation: 0.3 }))).toBe(0);
  });

  it('answers in the half turn either side of zero', () => {
    for (const rotation of [-170, -95, 95, 170, 260]) {
      const turn = minAreaTurn(cut({ width: 10, depth: 30, rotation }));
      expect(turn).toBeGreaterThan(-90);
      expect(turn).toBeLessThanOrEqual(90);
    }
  });

  it('leaves text, knife slots and repeats to their own turn', () => {
    expect(minAreaTurn(cut({ shape: 'text' }))).toBeNull();
    expect(minAreaTurn(cut({ shape: 'knifeSlot' }))).toBeNull();
    const array = {
      mode: 'grid' as const,
      cols: 2,
      rows: 1,
      pitchX: 40,
      pitchY: 0,
      count: 0,
      radius: 0,
      startAngle: 0,
      rotateToCenter: false,
    };
    expect(minAreaTurn(cut({ width: 10, depth: 30, array }))).toBeNull();
  });
});

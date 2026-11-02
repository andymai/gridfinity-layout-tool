import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { placeSplits } from './splitLinePlacement';

const SPLIT = { a: { x: -5, y: -10 }, b: { x: -5, y: 10 }, cutDepth: 4 };

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'c',
  shape: 'rectangle',
  x: 20,
  y: 30,
  width: 40,
  depth: 20,
  cutDepth: 10,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  split: SPLIT,
  ...overrides,
});

const array = {
  mode: 'grid' as const,
  cols: 2,
  rows: 1,
  pitchX: 50,
  pitchY: 0,
  count: 2,
  radius: 0,
  startAngle: 0,
  rotateToCenter: false,
};

describe('placeSplits', () => {
  it('places the line where it meets the outline, side A to its left', () => {
    const [s] = placeSplits([cutout()], new Map());
    expect(s.from).toEqual({ x: 35, y: 30 });
    expect(s.to).toEqual({ x: 35, y: 50 });
    expect(s.sideA.x).toBeCloseTo(27.5);
    expect(s.sideB.x).toBeCloseTo(47.5);
    expect(s.live).toBe(true);
  });

  it('names each side at its middle, however many points its corners have', () => {
    const [s] = placeSplits([cutout({ cornerRadius: 5 })], new Map());
    expect(s.sideA.x).toBeCloseTo(27.5, 0);
    expect(s.sideA.y).toBeCloseTo(40, 5);
  });

  it('turns the line with the pocket', () => {
    const [s] = placeSplits([cutout({ rotation: 90 })], new Map());
    expect(s.from.y).toBeCloseTo(45);
    expect(s.to.y).toBeCloseTo(45);
    expect(s.sideA.y).toBeGreaterThan(45);
  });

  it('draws one line per copy of a repeat, and follows a drag', () => {
    const splits = placeSplits([cutout({ array })], new Map([['c', { x: 0 }]]));
    expect(splits.map((s) => s.from.x)).toEqual([15, 65]);
    expect(splits.every((s) => s.ownerId === 'c')).toBe(true);
  });

  it('dashes a paused split and skips a shape that cannot hold one', () => {
    expect(placeSplits([cutout({ leanDeg: 10 })], new Map())[0].live).toBe(false);
    expect(placeSplits([cutout({ shape: 'text' })], new Map())).toEqual([]);
    expect(placeSplits([cutout({ split: undefined })], new Map())).toEqual([]);
  });
});

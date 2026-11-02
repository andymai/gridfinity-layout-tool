import { describe, it, expect } from 'vitest';
import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { depthAt, fromSplitFrame, toSplitFrame } from '@/shared/utils/cutoutSplit';
import { flipCutoutHorizontal, flipCutoutVertical } from './geometryFlips';

const corner = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

function pocket(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'p',
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
    split: { a: { x: -5, y: -10 }, b: { x: 3, y: 10 }, cutDepth: 4 },
    ...overrides,
  };
}

const L_PATH = [corner(20, 30), corner(60, 30), corner(60, 40), corner(35, 50), corner(20, 50)];

/** The depth under a world point, read the way the builder reads it. */
const depthUnder = (c: Cutout, x: number, y: number): number => depthAt(c, toSplitFrame(c, x, y));

describe.each([
  ['horizontal', flipCutoutHorizontal, (x: number, y: number, cx: number) => [2 * cx - x, y]],
  [
    'vertical',
    flipCutoutVertical,
    (x: number, y: number, _cx: number, cy: number) => [x, 2 * cy - y],
  ],
] as const)('a %s flip', (_name, flip, mirror) => {
  it.each([
    ['an unturned rectangle', pocket()],
    ['a turned rectangle', pocket({ rotation: 30 })],
    ['a turned round', pocket({ shape: 'circle', rotation: 70 })],
    ['a path', pocket({ shape: 'path', path: L_PATH })],
  ])('keeps each depth on its mirrored half of %s', (_shape, before) => {
    const after = { ...before, ...flip(before) };
    const cx = before.x + before.width / 2;
    const cy = before.y + before.depth / 2;
    for (const own of [
      { x: -12, y: 2 },
      { x: 12, y: -2 },
      { x: -2, y: 7 },
      { x: 8, y: 6 },
    ]) {
      const p = fromSplitFrame(before, own);
      const [mx, my] = mirror(p.x, p.y, cx, cy);
      expect(depthUnder(after, mx, my)).toBe(depthUnder(before, p.x, p.y));
    }
  });

  it('leaves a pocket without a split without one', () => {
    expect('split' in flip(pocket({ split: undefined }))).toBe(false);
  });
});

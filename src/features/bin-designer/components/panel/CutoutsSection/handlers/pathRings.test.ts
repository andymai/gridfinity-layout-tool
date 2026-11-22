import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { cutsAsDrawn, pathBoundsUpdate, ringsOf, toDrawnFrame, toPathFrame } from './pathRings';

const corner = (x: number, y: number) => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

function path(rotation: number): Cutout {
  return {
    id: 'p',
    shape: 'path',
    x: 0,
    y: 0,
    width: 20,
    depth: 10,
    cutDepth: 5,
    rotation,
    cornerRadius: 0,
    label: '',
    groupId: null,
    path: [corner(0, 0), corner(20, 0), corner(20, 10), corner(0, 10)],
    holes: [[corner(5, 3), corner(8, 3), corner(8, 6)]],
  };
}

describe('pathRings', () => {
  it('turns a point out to where it is drawn and back', () => {
    const turned = path(37);
    const drawn = toDrawnFrame(turned, 20, 0);
    const back = toPathFrame(turned, drawn.x, drawn.y);
    expect(back.x).toBeCloseTo(20, 9);
    expect(back.y).toBeCloseTo(0, 9);
  });

  it('leaves an unturned path where it is stored', () => {
    expect(toDrawnFrame(path(0), 3, 4)).toEqual({ x: 3, y: 4 });
  });

  it('numbers the outline 0 and each island after it', () => {
    const rings = ringsOf(path(0));
    expect(rings).toHaveLength(2);
    expect(rings[1]).toHaveLength(3);
  });

  it('boxes a new outline by its points', () => {
    expect(pathBoundsUpdate([corner(2, 1), corner(9, 1), corner(9, 4)])).toMatchObject({
      x: 2,
      y: 1,
      width: 7,
      depth: 3,
    });
  });
});

describe('cutsAsDrawn', () => {
  const box = (x: number, y: number, size: number) => [
    corner(x, y),
    corner(x + size, y),
    corner(x + size, y + size),
    corner(x, y + size),
  ];

  it('holds for an outline with islands well inside it and apart', () => {
    expect(cutsAsDrawn([box(0, 0, 40), box(5, 5, 10), box(25, 25, 10)])).toBe(true);
  });

  it('fails when an island reaches out of the outline', () => {
    expect(cutsAsDrawn([box(0, 0, 40), box(35, 5, 10)])).toBe(false);
  });

  it('fails when two islands overlap', () => {
    expect(cutsAsDrawn([box(0, 0, 40), box(5, 5, 10), box(10, 10, 10)])).toBe(false);
  });

  it('fails when the outline crosses itself', () => {
    expect(cutsAsDrawn([[corner(0, 0), corner(40, 40), corner(40, 0), corner(0, 40)]])).toBe(false);
  });
});

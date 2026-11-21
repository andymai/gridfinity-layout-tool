import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { pathBoundsUpdate, ringsOf, toDrawnFrame, toPathFrame } from './pathRings';

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

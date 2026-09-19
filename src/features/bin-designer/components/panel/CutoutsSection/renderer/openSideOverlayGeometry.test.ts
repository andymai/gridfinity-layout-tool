import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Cutout } from '@/features/bin-designer/types';
import { openSideOverlayLoops } from './openSideOverlayGeometry';

const HOST = { ...DEFAULT_BIN_PARAMS, base: { ...DEFAULT_BIN_PARAMS.base, solid: true } };
const FRAME = { binWidth: 81.1, binDepth: 39.1, wallThickness: 1.2 };

function rect(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'r1',
    shape: 'rectangle',
    x: 30,
    y: 9.55,
    width: 30,
    depth: 20,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

describe('openSideOverlayLoops', () => {
  it('draws one strip per open side from the pocket edge out past the wall', () => {
    const loops = openSideOverlayLoops(rect({ openSides: ['right', 'front'] }), HOST, FRAME);
    expect(loops).toHaveLength(2);
    // Sides come back in canonical order: front before right.
    const [front, right] = loops;
    expect(right).toEqual([
      [60, 9.55],
      [88.3, 9.55],
      [88.3, 29.55],
      [60, 29.55],
    ]);
    expect(front).toEqual([
      [30, -7.2],
      [60, -7.2],
      [60, 9.55],
      [30, 9.55],
    ]);
  });

  it('draws nothing for a pocket the builder leaves enclosed', () => {
    expect(openSideOverlayLoops(rect(), HOST, FRAME)).toEqual([]);
    expect(openSideOverlayLoops(rect({ openSides: ['right'], rotation: 45 }), HOST, FRAME)).toEqual(
      []
    );
    expect(openSideOverlayLoops(rect({ openSides: ['right'] }), DEFAULT_BIN_PARAMS, FRAME)).toEqual(
      []
    );
  });

  it('follows a quarter turn', () => {
    const [loop] = openSideOverlayLoops(rect({ openSides: ['back'], rotation: 90 }), HOST, FRAME);
    // Centre (45, 19.55); quarter-turned the pocket spans 20 along X.
    expect(loop[0]).toEqual([35, 19.55 + 15]);
    expect(loop[2]).toEqual([55, 39.1 + 7.2]);
  });
});

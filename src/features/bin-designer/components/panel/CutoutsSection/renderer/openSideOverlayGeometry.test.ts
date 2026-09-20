import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { Cutout } from '@/features/bin-designer/types';
import { openSideOverlayStrips } from './openSideOverlayGeometry';

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

function host(cutouts: Cutout[], solid = true) {
  return {
    ...DEFAULT_BIN_PARAMS,
    base: { ...DEFAULT_BIN_PARAMS.base, solid },
    cutouts,
  };
}

describe('openSideOverlayStrips', () => {
  it('draws one strip per open side from the pocket edge out past the wall', () => {
    const strips = openSideOverlayStrips(
      host([rect({ openSides: [{ side: 'right' }, { side: 'front', tunnel: true }] })]),
      FRAME
    );
    expect(strips).toHaveLength(2);
    const [front, right] = strips;
    expect(front.tunnel).toBe(true);
    expect(front.loop).toEqual([
      [30, -7.2],
      [60, -7.2],
      [60, 9.55],
      [30, 9.55],
    ]);
    expect(right.tunnel).toBe(false);
    expect(right.loop).toEqual([
      [60, 9.55],
      [88.3, 9.55],
      [88.3, 29.55],
      [60, 29.55],
    ]);
  });

  it('draws nothing for a pocket the builder leaves enclosed', () => {
    expect(openSideOverlayStrips(host([rect()]), FRAME)).toEqual([]);
    expect(
      openSideOverlayStrips(host([rect({ openSides: [{ side: 'right' }] })], false), FRAME)
    ).toEqual([]);
  });

  it('narrows to the channel width and follows a turn', () => {
    const [strip] = openSideOverlayStrips(
      host([rect({ openSides: [{ side: 'back', widthMm: 10 }], rotation: 90 })]),
      FRAME
    );
    // Centre (45, 19.55); quarter-turned the pocket spans 20 along X and 30 along Y.
    expect(strip.loop[0]).toEqual([40, 19.55 + 15]);
    expect(strip.loop[2]).toEqual([50, 39.1 + 7.2]);
  });
});

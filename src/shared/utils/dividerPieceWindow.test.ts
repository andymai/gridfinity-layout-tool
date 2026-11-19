import { describe, expect, it } from 'vitest';
import type { WallConfig, WallCutout } from '@/shared/types/bin';
import { planPieceWindow } from './dividerPieceWindow';

const side = (over: Partial<WallCutout> = {}): WallCutout => ({
  enabled: false,
  width: 0,
  depth: 0,
  alignment: 'center',
  offset: 0,
  widthMm: null,
  ...over,
});

const walls = (interior: Partial<WallCutout>, enabled = true): WallConfig => ({
  enabled,
  shape: 'u-shape',
  width: 0,
  depth: 0,
  front: side(),
  back: side(),
  left: side(),
  right: side(),
  interior: side({ enabled: true, width: 40, depth: 50, ...interior }),
});

describe('planPieceWindow', () => {
  it('sizes the window on the span in the cavity and the height above the floor', () => {
    const window = planPieceWindow(walls({}), 1.2, 100, 0, 40);
    expect(window).toMatchObject({ offset: 0, width: 40, depth: 20 });
  });

  it('places the window from the centre of the standing span', () => {
    const centred = planPieceWindow(walls({}), 1.2, 100, 3, 40);
    expect(centred?.offset).toBe(3);
    const left = planPieceWindow(walls({ alignment: 'left' }), 1.2, 100, 0, 40);
    expect(left?.offset).toBeLessThan(0);
  });

  it('takes millimetre sizes as they are, up to the span', () => {
    const window = planPieceWindow(walls({ widthMm: 25, depthMm: 12 }), 1.2, 100, 0, 40);
    expect(window).toMatchObject({ width: 25, depth: 12 });
  });

  it('cuts nothing when the interior cutout or all wall cutouts are off', () => {
    expect(planPieceWindow(walls({ enabled: false }), 1.2, 100, 0, 40)).toBeNull();
    expect(planPieceWindow(walls({}, false), 1.2, 100, 0, 40)).toBeNull();
  });
});

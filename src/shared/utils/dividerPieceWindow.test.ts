import { describe, expect, it } from 'vitest';
import type { WallConfig, WallCutout } from '@/shared/types/bin';
import {
  clearOfNotches,
  keepBottomBand,
  planPieceWindow,
  windowBottomBand,
  windowCornerBand,
  WINDOW_BOTTOM_BAND_MM,
  WINDOW_NOTCH_BRIDGE_MM,
} from './dividerPieceWindow';
import { dividerJointClearance, tongueBandHalf } from './dividerJoint';
import { cornerRiseMm } from './slottedFillet';

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

describe('clearOfNotches', () => {
  const deep = (): NonNullable<ReturnType<typeof planPieceWindow>> => {
    const window = planPieceWindow(walls({ depth: 80 }), 1.2, 100, 0, 40);
    if (!window) throw new Error('no window');
    return window;
  };

  it('stops a window over a notch short of it, by the bridge', () => {
    const window = clearOfNotches(deep(), [{ offset: 0, width: 2 }], 40, 20.25);
    expect(window?.depth).toBeCloseTo(40 - 20.25 - WINDOW_NOTCH_BRIDGE_MM, 6);
  });

  it('leaves a window alone when no notch is under it', () => {
    expect(clearOfNotches(deep(), [{ offset: 45, width: 2 }], 40, 20.25)).toEqual(deep());
  });

  it('counts the shoulder round-over as part of the opening', () => {
    const window = { ...deep(), radii: { top: 6, bottom: 0 } };
    // 20 + 6 + 1 reaches a notch centred 26 mm off.
    expect(clearOfNotches(window, [{ offset: 26, width: 2 }], 40, 20.25)?.depth).toBeLessThan(
      window.depth
    );
  });

  it('drops a window that no room is left for', () => {
    expect(clearOfNotches(deep(), [{ offset: 0, width: 2 }], 20, 19)).toBeNull();
  });
});

describe('windowReach against a notch', () => {
  it('reads the round-over as the cutter draws it, clamped to the opening', () => {
    // A 25 mm radius on a 10 x 16 mm window is clamped well short of 25, so
    // notches 27 mm off stay clear and the window keeps its depth.
    const window = {
      offset: 0,
      width: 10,
      depth: 16,
      cornerSlack: { left: Infinity, right: Infinity },
      radii: { top: 25, bottom: 0 },
    };
    const kept = clearOfNotches(
      window,
      [
        { offset: 27, width: 2 },
        { offset: -27, width: 2 },
      ],
      20,
      10.25
    );
    expect(kept?.depth).toBe(16);
  });
});

describe('keepBottomBand', () => {
  it('keeps solid under a window that drops the whole height', () => {
    const full = planPieceWindow(walls({ depth: 100 }), 1.2, 100, 0, 40);
    if (!full) throw new Error('no window');
    expect(keepBottomBand(full, 40)?.depth).toBeCloseTo(40 - WINDOW_BOTTOM_BAND_MM, 6);
    expect(keepBottomBand(full, 40, 9)?.depth).toBeCloseTo(31, 6);
  });

  it('leaves a shallower window as it is', () => {
    const half = planPieceWindow(walls({}), 1.2, 100, 0, 40);
    if (!half) throw new Error('no window');
    expect(keepBottomBand(half, 40)).toBe(half);
  });
});

describe('windowBottomBand', () => {
  const fit = { printBed: { widthMm: 200, depthMm: 200 }, nozzleSizeMm: 0.4 };

  it('keeps the plain band on a piece the export ships whole', () => {
    expect(windowBottomBand(30, 290)).toBe(WINDOW_BOTTOM_BAND_MM);
    expect(windowBottomBand(30, 150, fit)).toBe(WINDOW_BOTTOM_BAND_MM);
  });

  it('keeps room for a seam tongue on a piece the bed splits', () => {
    const joint = 2 * tongueBandHalf(dividerJointClearance(0.4)) + 0.5;
    expect(windowBottomBand(30, 290, fit)).toBeCloseTo(joint, 6);
    expect(joint).toBeGreaterThan(WINDOW_BOTTOM_BAND_MM);
  });
});

describe('windowCornerBand', () => {
  // A 100mm piece with 0.3mm tabs: its window spans the 99.4mm between them.
  const full = planPieceWindow(walls({ width: 100 }), 1.2, 99.4, 0, 40);
  const narrow = planPieceWindow(walls({ width: 40 }), 1.2, 99.4, 0, 40);
  const corners = { radius: 3.4, low: true, high: false };

  it('raises the band over a rounded corner the window reaches', () => {
    if (!full) throw new Error('no window');
    const band = windowCornerBand(full, 100, corners, WINDOW_BOTTOM_BAND_MM);
    // The opening's side stands 0.3mm in from the end, over the corner's curve.
    expect(band).toBeCloseTo(WINDOW_BOTTOM_BAND_MM + cornerRiseMm(3.4, 0.3), 6);
    expect(band).toBeGreaterThan(WINDOW_BOTTOM_BAND_MM + 1.5);
  });

  it('leaves the band alone clear of the corner, or with no corner', () => {
    if (!full || !narrow) throw new Error('no window');
    expect(windowCornerBand(narrow, 100, corners, WINDOW_BOTTOM_BAND_MM)).toBe(
      WINDOW_BOTTOM_BAND_MM
    );
    expect(windowCornerBand(full, 100, null, WINDOW_BOTTOM_BAND_MM)).toBe(WINDOW_BOTTOM_BAND_MM);
    expect(windowCornerBand(full, 100, { ...corners, low: false }, WINDOW_BOTTOM_BAND_MM)).toBe(
      WINDOW_BOTTOM_BAND_MM
    );
  });
});

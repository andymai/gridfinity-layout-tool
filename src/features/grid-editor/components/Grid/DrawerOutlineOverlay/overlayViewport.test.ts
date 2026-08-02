import { describe, expect, it } from 'vitest';

import { computeOverlayViewport } from './overlayViewport';

describe('computeOverlayViewport', () => {
  it('frames to the plate when the shape sits inside it', () => {
    const vp = computeOverlayViewport(100, 80, 0, 0, {
      minX: 10,
      maxX: 90,
      minY: 5,
      maxY: 70,
    });
    expect(vp).toEqual({
      svgW: 100,
      svgH: 80,
      offsetX: 0,
      offsetY: 0,
      originX: 0,
      originY: 0,
    });
  });

  it('keeps the padding offset (and no origin shift) for an in-bounds shape with padding', () => {
    const vp = computeOverlayViewport(120, 100, 10, 8, {
      minX: 10,
      maxX: 110,
      minY: 5,
      maxY: 95,
    });
    expect(vp).toMatchObject({ svgW: 120, svgH: 100, offsetX: -10, offsetY: -8 });
    expect(vp.originX).toBe(0);
    expect(vp.originY).toBe(0);
  });

  it('grows right and up when the shape overflows the plate (#3107)', () => {
    const vp = computeOverlayViewport(100, 80, 0, 0, {
      minX: 10,
      maxX: 120,
      minY: 5,
      maxY: 95,
    });
    // Right overflow widens the canvas; top overflow lifts the SVG so it stays
    // visible (offsetY drops by the 15px overrun).
    expect(vp.svgW).toBe(120);
    expect(vp.svgH).toBe(95);
    expect(vp.offsetX).toBe(0);
    expect(vp.offsetY).toBe(-15);
    expect(vp.originX).toBe(0);
    expect(vp.originY).toBe(0);
  });

  it('shifts the origin left/down when the shape reaches past the plate origin', () => {
    const vp = computeOverlayViewport(100, 80, 0, 0, {
      minX: -20,
      maxX: 90,
      minY: -10,
      maxY: 70,
    });
    // Left overflow moves the SVG out (offsetX) and negatives the origin so the
    // mm→px mapping shifts to keep the far side on-canvas.
    expect(vp.svgW).toBe(120);
    expect(vp.svgH).toBe(90);
    expect(vp.offsetX).toBe(-20);
    expect(vp.offsetY).toBe(0);
    expect(vp.originX).toBe(-20);
    expect(vp.originY).toBe(-10);
  });
});

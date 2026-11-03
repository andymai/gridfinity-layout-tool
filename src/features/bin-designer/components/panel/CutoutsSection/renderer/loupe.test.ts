import { describe, it, expect } from 'vitest';
import { LOUPE_MARGIN_PX, LOUPE_PX, loupeFrustum, loupeRect, loupeTopLeft } from './loupe';

const CANVAS = { width: 800, height: 600 };

describe('loupeRect', () => {
  it('sits along the top, away from the point', () => {
    const right = loupeRect({ x: 100, y: 300 }, CANVAS);
    expect(right).toEqual({
      x: CANVAS.width - LOUPE_MARGIN_PX - LOUPE_PX,
      y: CANVAS.height - LOUPE_MARGIN_PX - LOUPE_PX,
      size: LOUPE_PX,
    });
    expect(loupeRect({ x: 700, y: 300 }, CANVAS)?.x).toBe(LOUPE_MARGIN_PX);
  });

  it('shrinks to fit half of a narrow canvas, and gives none on one too small', () => {
    expect(loupeRect({ x: 10, y: 10 }, { width: 364, height: 600 })?.size).toBe(164);
    expect(loupeRect({ x: 10, y: 10 }, { width: 200, height: 600 })).toBeNull();
  });
});

describe('loupeFrustum', () => {
  it('spans the inset, half each way', () => {
    expect(loupeFrustum(168)).toEqual({ left: -84, right: 84, top: 84, bottom: -84 });
  });
});

describe('loupeTopLeft', () => {
  it('lays the same corner out from the top-left', () => {
    expect(loupeTopLeft(100, CANVAS)).toEqual({
      left: 800 - LOUPE_MARGIN_PX - LOUPE_PX,
      top: LOUPE_MARGIN_PX,
      size: LOUPE_PX,
    });
    expect(loupeTopLeft(700, CANVAS)?.left).toBe(LOUPE_MARGIN_PX);
  });
});

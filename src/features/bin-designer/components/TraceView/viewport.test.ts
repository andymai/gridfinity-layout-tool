import { describe, it, expect } from 'vitest';
import { fitView, toImage, zoomAt, MAX_SCALE } from './viewport';

describe('fitView', () => {
  it('fits the photo inside the box with a margin, centred', () => {
    const view = fitView({ width: 1000, height: 500 }, { width: 848, height: 848 });
    expect(view.scale).toBeCloseTo(0.8);
    expect(view.x).toBeCloseTo(24);
    expect(view.y).toBeCloseTo((848 - 400) / 2);
  });

  it('is limited by the tighter side', () => {
    const view = fitView({ width: 400, height: 800 }, { width: 1048, height: 448 });
    expect(view.scale).toBeCloseTo(0.5);
    expect(view.x).toBeCloseTo((1048 - 200) / 2);
  });
});

describe('zoomAt', () => {
  it('keeps the photo point under the cursor where it was', () => {
    const view = { scale: 1, x: 10, y: 20 };
    const at = { x: 110, y: 70 };
    const before = toImage(view, at);
    const after = toImage(zoomAt(view, 2, at, 0.1, MAX_SCALE), at);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('stops at the zoom limits', () => {
    const view = { scale: 1, x: 0, y: 0 };
    expect(zoomAt(view, 100, { x: 0, y: 0 }, 0.5, MAX_SCALE).scale).toBe(MAX_SCALE);
    expect(zoomAt(view, 0.01, { x: 0, y: 0 }, 0.5, MAX_SCALE).scale).toBe(0.5);
  });
});

describe('toImage', () => {
  it('reads a screen point in photo pixels', () => {
    expect(toImage({ scale: 2, x: 100, y: 50 }, { x: 300, y: 150 })).toEqual({ x: 100, y: 50 });
  });
});

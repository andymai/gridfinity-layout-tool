import { describe, expect, it } from 'vitest';
import { calculateFitZoom, planBinFrame } from './frameBin';
import type { BinFrameInput } from './frameBin';

const base: BinFrameInput = {
  bin: { x: 8, y: 6, width: 1, depth: 1, height: 3 },
  zStart: 0,
  drawer: { width: 10, depth: 8, height: 12 },
  depthToGridScale: 1,
  heightToGridScale: 7 / 42,
  viewport: { width: 800, height: 600 },
  currentZoom: 30,
  currentTargetZ: 1,
  exploded: false,
};

describe('planBinFrame', () => {
  it('looks at the bin centre, on its resting height', () => {
    const frame = planBinFrame({ ...base, zStart: 6 });
    expect(frame.target).toEqual([8.5, 6.5, (6 + 1.5) * (7 / 42)]);
  });

  it('scales the depth axis of a non-square grid', () => {
    const frame = planBinFrame({ ...base, depthToGridScale: 0.5 });
    expect(frame.target[1]).toBeCloseTo(3.25);
  });

  it('zooms in toward the bin, capped at four times the drawer fit', () => {
    const drawerFit = calculateFitZoom(10, 8, 12, 7 / 42, 800, 600);
    const frame = planBinFrame({ ...base, currentZoom: drawerFit });
    expect(frame.zoom).toBeGreaterThan(drawerFit);
    expect(frame.zoom).toBeLessThanOrEqual(drawerFit * 4);
  });

  it('never zooms out from a closer view', () => {
    expect(planBinFrame({ ...base, currentZoom: 5000 }).zoom).toBe(5000);
  });

  it('keeps height and zoom in the exploded view, and has no zoom for a perspective camera', () => {
    const exploded = planBinFrame({ ...base, exploded: true });
    expect(exploded.target[2]).toBe(1);
    expect(exploded.zoom).toBeNull();
    expect(planBinFrame({ ...base, currentZoom: null }).zoom).toBeNull();
  });
});

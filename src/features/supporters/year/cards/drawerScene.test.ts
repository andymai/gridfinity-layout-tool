import { describe, expect, it } from 'vitest';
import { BEAT } from '../look/motion';
import { binStarts, fitDrawer, planBins } from './drawerScene';
import { drawerPreview } from './sceneFixtures.testUtils';
import { CONTENT_W, MARGIN } from './scene';

describe('fitDrawer', () => {
  it.each([
    [23, 19],
    [50, 50],
    [50, 4],
    [4, 50],
    [1, 1],
    [0.5, 0.5],
  ])('fits a %s × %s drawer inside the box, centred across', (width, depth) => {
    const fit = fitDrawer(width, depth, CONTENT_W, 800);
    expect(fit.width).toBeLessThanOrEqual(CONTENT_W + 1e-6);
    expect(fit.height).toBeLessThanOrEqual(800 + 1e-6);
    expect(fit.left - MARGIN).toBeCloseTo(MARGIN + CONTENT_W - (fit.left + fit.width));
    expect(Math.max(fit.width / CONTENT_W, fit.height / 800)).toBeCloseTo(1);
  });
});

describe('planBins', () => {
  it('cuts bins to the drawer and drops any wholly outside it', () => {
    const bins = planBins(
      drawerPreview(4, 3, [
        [3, 2, 2, 2, '#f00'],
        [5, 0, 1, 1, '#0f0'],
        [0, 0, 1, 1, '#00f'],
      ])
    );
    expect(bins).toEqual([
      { x: 3, y: 2, w: 1, d: 1, group: '#f00' },
      { x: 0, y: 0, w: 1, d: 1, group: '#00f' },
    ]);
  });

  it('keeps bins of every layer, the preview having merged them', () => {
    const bins = planBins(
      drawerPreview(2, 2, [
        [0, 0, 1, 1, '#f00'],
        [0, 0, 1, 1, '#0f0'],
      ])
    );
    expect(bins).toHaveLength(2);
  });
});

describe('binStarts', () => {
  it('fills front to back, each row left to right, on the triplet grid', () => {
    const bins = [
      { x: 0, y: 0, w: 1, d: 1, group: 'a' },
      { x: 5, y: 0, w: 1, d: 1, group: 'a' },
      { x: 0, y: 3, w: 1, d: 1, group: 'a' },
    ];
    const [front, right, back] = binStarts(bins, 6);
    expect(front).toBeLessThan(right ?? 0);
    expect(right).toBeLessThan(back ?? 0);
    for (const start of [front, right, back]) {
      expect(((start ?? 0) / (BEAT / 12)) % 1).toBeCloseTo(0, 6);
      expect(start).toBeLessThan(4 * BEAT);
    }
  });
});

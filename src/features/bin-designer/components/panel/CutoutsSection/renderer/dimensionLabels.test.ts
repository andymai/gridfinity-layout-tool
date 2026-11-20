import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { dimensionLabelPositions } from './dimensionLabels';

const cutout = (overrides: Partial<Cutout>): Cutout => ({
  id: 'c',
  shape: 'rectangle',
  x: 30,
  y: 10,
  width: 10,
  depth: 60,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const ZOOM = 4;

describe('dimensionLabelPositions', () => {
  it('names each size with one decimal', () => {
    const { width, depth } = dimensionLabelPositions(cutout({}), ZOOM);
    expect(width.text).toBe('10.0mm');
    expect(depth.text).toBe('60.0mm');
  });

  it('puts the width below and the depth left of an unturned shape', () => {
    const { width, depth } = dimensionLabelPositions(cutout({}), ZOOM);
    expect(width.at[0]).toBeCloseTo(35, 9);
    expect(width.at[1]).toBeLessThan(10);
    expect(depth.at[0]).toBeLessThan(30);
    expect(depth.at[1]).toBeCloseTo(40, 9);
  });

  it('keeps each label beside the edge it measures on a turned shape', () => {
    const { width, depth } = dimensionLabelPositions(cutout({ rotation: 90 }), ZOOM);
    expect(width.at[0]).toBeLessThan(5);
    expect(width.at[1]).toBeCloseTo(40, 9);
    expect(depth.at[0]).toBeCloseTo(35, 9);
    expect(depth.at[1]).toBeLessThan(35);
  });

  it('keeps both labels off the top, where the rotation handle sits', () => {
    for (const rotation of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const { width, depth } = dimensionLabelPositions(cutout({ rotation }), ZOOM);
      expect(width.at[1], `width at ${rotation}°`).toBeLessThanOrEqual(40 + 1e-9);
      expect(depth.at[1], `depth at ${rotation}°`).toBeLessThan(40 + 30);
    }
    const flipped = dimensionLabelPositions(cutout({ rotation: 180 }), ZOOM);
    expect(flipped.width.at[1]).toBeLessThan(10);
  });

  it('keeps both labels below the centre at every angle', () => {
    for (let rotation = 0; rotation < 360; rotation += 5) {
      const { width, depth } = dimensionLabelPositions(cutout({ rotation }), ZOOM);
      expect(width.at[1], `width at ${rotation}°`).toBeLessThanOrEqual(40 + 1e-9);
      expect(depth.at[1], `depth at ${rotation}°`).toBeLessThanOrEqual(40 + 1e-9);
    }
  });

  it('clears the handles that a small cutout moves out', () => {
    const small = cutout({ width: 2, depth: 10, rotation: 90 });
    const { width } = dimensionLabelPositions(small, ZOOM);
    const chipRight = width.at[0] + (width.text.length * 6.2 + 8) / 2 / ZOOM;
    expect((26 - chipRight) * ZOOM).toBeGreaterThanOrEqual(15);
  });

  it('grows the chips with the root font size', () => {
    const at16 = dimensionLabelPositions(cutout({ rotation: 90 }), ZOOM).width.at[0];
    const at32 = dimensionLabelPositions(cutout({ rotation: 90 }), ZOOM, 32).width.at[0];
    expect(at32).toBeLessThan(at16);
  });

  it('moves a label to the other edge when its chip would leave the view', () => {
    const atWall = cutout({ x: 0, y: 30, width: 10, depth: 20 });
    const view = { minX: -5, maxX: 100, minY: -50, maxY: 100 };
    const { depth } = dimensionLabelPositions(atWall, ZOOM, 16, view);
    expect(depth.at[0]).toBeGreaterThan(10);
  });

  it('never moves a label up to the rotation handle to stay in view', () => {
    const atFloor = cutout({ x: 30, y: 0, width: 10, depth: 20 });
    const view = { minX: -50, maxX: 100, minY: 0, maxY: 100 };
    const { width } = dimensionLabelPositions(atFloor, ZOOM, 16, view);
    expect(width.at[1]).toBeLessThan(0);
  });

  it('clears a vertical edge by half a chip width, not half its height', () => {
    const { width } = dimensionLabelPositions(cutout({ rotation: 90 }), ZOOM);
    const gapPx = (5 - width.at[0]) * ZOOM;
    const halfChipPx = (width.text.length * 6.2 + 8) / 2;
    expect(gapPx).toBeGreaterThan(halfChipPx);
  });
});

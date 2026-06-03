import { describe, it, expect } from 'vitest';
import {
  createDefaultCutout,
  defaultPlaceSize,
  resizeKeepingCenter,
  flattenCutoutArray,
} from './cutoutHelpers';
import type { Cutout } from '@/features/bin-designer/types';

describe('createDefaultCutout', () => {
  it('seeds a default hexagon side count for polygons', () => {
    const c = createDefaultCutout('id', 'polygon', 0, 0, 16, 14);
    expect(c.sides).toBe(6);
  });

  it('seeds insertion clearance for insert shapes only', () => {
    expect(createDefaultCutout('id', 'polygon', 0, 0, 16, 14).clearance).toBeGreaterThan(0);
    expect(createDefaultCutout('id', 'circle', 0, 0, 15, 15).clearance).toBeGreaterThan(0);
    expect(createDefaultCutout('id', 'slot', 0, 0, 30, 12).clearance).toBeGreaterThan(0);
    expect(createDefaultCutout('id', 'rectangle', 0, 0, 20, 20).clearance).toBeUndefined();
    expect(createDefaultCutout('id', 'rectangle', 0, 0, 20, 20).sides).toBeUndefined();
  });
});

describe('defaultPlaceSize', () => {
  it('gives a slot an oblong (non-square) footprint so it does not render round', () => {
    const slot = defaultPlaceSize('slot');
    expect(slot.width).toBeGreaterThan(slot.depth);
  });

  it('gives a regular polygon its natural aspect (width != depth for a hexagon)', () => {
    const poly = defaultPlaceSize('polygon');
    expect(poly.width).toBeGreaterThan(poly.depth);
  });

  it('keeps circle and rectangle square', () => {
    expect(defaultPlaceSize('circle').width).toBe(defaultPlaceSize('circle').depth);
    expect(defaultPlaceSize('rectangle').width).toBe(defaultPlaceSize('rectangle').depth);
  });
});

describe('resizeKeepingCenter', () => {
  it('keeps the cutout center fixed when resizing', () => {
    const r = resizeKeepingCenter({ x: 10, y: 10, width: 20, depth: 20 }, 10, 10, 100, 100);
    // Original center (20,20); new 10×10 box centered there → origin (15,15).
    expect(r.x).toBe(15);
    expect(r.y).toBe(15);
    expect(r.width).toBe(10);
    expect(r.depth).toBe(10);
  });

  it('clamps the origin so the box stays inside the bin', () => {
    const r = resizeKeepingCenter({ x: 0, y: 0, width: 10, depth: 10 }, 40, 40, 30, 30);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.width).toBe(30);
    expect(r.depth).toBe(30);
  });
});

describe('flattenCutoutArray', () => {
  const master = (over: Partial<Cutout> = {}): Cutout => ({
    id: 'm',
    shape: 'circle',
    x: 0,
    y: 0,
    width: 8,
    depth: 8,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...over,
  });

  it('is a no-op when there is no array', () => {
    expect(flattenCutoutArray(master())).toEqual({ masterPatch: {}, added: [] });
  });

  it('strips the array from the master and adds the other instances with fresh ids', () => {
    const c = master({
      array: {
        mode: 'grid',
        cols: 3,
        rows: 1,
        pitchX: 10,
        pitchY: 10,
        count: 3,
        radius: 20,
        startAngle: 0,
        rotateToCenter: true,
      },
    });
    const { masterPatch, added } = flattenCutoutArray(c);
    expect(masterPatch).toEqual({ array: undefined });
    expect(added).toHaveLength(2); // 3 instances − the master
    expect(added.every((a) => a.array === undefined)).toBe(true);
    expect(new Set(added.map((a) => a.id)).size).toBe(2); // unique ids
    expect(added.every((a) => a.id !== 'm')).toBe(true);
  });
});

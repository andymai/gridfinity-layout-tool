import { describe, it, expect } from 'vitest';
import { isPlaceableCutout } from './libraryCutoutCheck';

const rect = { shape: 'rectangle', x: 0, y: 0, width: 10, depth: 5, cutDepth: 3 };

describe('isPlaceableCutout', () => {
  it('takes a cutout with finite geometry', () => {
    expect(isPlaceableCutout(rect, undefined)).toBe(true);
  });

  it('refuses an unknown shape, missing or zero size, and a short path', () => {
    expect(isPlaceableCutout({ ...rect, shape: 'blob' }, undefined)).toBe(false);
    expect(isPlaceableCutout({ ...rect, width: Number.NaN }, undefined)).toBe(false);
    expect(isPlaceableCutout({ ...rect, depth: 0 }, undefined)).toBe(false);
    expect(isPlaceableCutout({ ...rect, shape: 'path', path: [{ x: 0, y: 0 }] }, undefined)).toBe(
      false
    );
  });

  it('needs the mesh that a mesh cutout names', () => {
    const mesh = { ...rect, shape: 'mesh', meshId: 'm1' };
    expect(isPlaceableCutout(mesh, {})).toBe(false);
    expect(isPlaceableCutout(mesh, { m1: { hash: 'a' } })).toBe(true);
  });
});

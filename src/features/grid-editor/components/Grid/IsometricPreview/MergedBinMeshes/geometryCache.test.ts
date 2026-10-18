import { describe, it, expect, afterEach } from 'vitest';
import { clearGeometryCache, getCachedGeometry } from './geometryCache';

afterEach(() => {
  clearGeometryCache();
});

describe('getCachedGeometry', () => {
  it('shares one geometry between alike bins, and builds another for a slanted one', () => {
    const shear = { x: 0, y: 0.5, pivot: 0.1 };
    const upright = getCachedGeometry(2, 1, 1, '#808080');
    expect(getCachedGeometry(2, 1, 1, '#808080')).toBe(upright);
    const slanted = getCachedGeometry(2, 1, 1, '#808080', undefined, shear);
    expect(slanted).not.toBe(upright);
    expect(getCachedGeometry(2, 1, 1, '#808080', undefined, { ...shear })).toBe(slanted);
  });
});

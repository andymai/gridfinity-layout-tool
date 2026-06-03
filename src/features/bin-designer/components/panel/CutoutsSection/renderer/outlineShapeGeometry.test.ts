import { describe, it, expect } from 'vitest';
import {
  bakeDistanceField,
  DF_RESOLUTION,
  MIN_POLYLINE_POINTS,
  outlineVertexShader,
  outlineFragmentShader,
} from './outlineShapeGeometry';

describe('outlineShapeGeometry', () => {
  it('exposes the shared shader strings and constants', () => {
    expect(outlineVertexShader).toContain('gl_Position');
    expect(outlineFragmentShader).toContain('u_distField');
    expect(MIN_POLYLINE_POINTS).toBe(3);
  });

  it('bakes a DF_RESOLUTION² texture covering the polygon bbox', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const { texture, boundsMin, boundsSize } = bakeDistanceField(square, 5, 5);
    expect(texture.image.data).toHaveLength(DF_RESOLUTION * DF_RESOLUTION);
    // Centered on (5,5): local bounds are [-5,5] padded by 0.5 each side.
    expect(boundsMin[0]).toBeCloseTo(-5.5, 4);
    expect(boundsSize[0]).toBeCloseTo(11, 4);
    texture.dispose();
  });

  it('stores higher distance values toward the interior than the edge', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    const { texture } = bakeDistanceField(square, 10, 10);
    const data = texture.image.data as Uint8Array;
    const center = data[(DF_RESOLUTION / 2) * DF_RESOLUTION + DF_RESOLUTION / 2];
    const corner = data[0];
    expect(center).toBeGreaterThan(corner);
    texture.dispose();
  });
});

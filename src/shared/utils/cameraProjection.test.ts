import { describe, it, expect } from 'vitest';
import { distanceToOrthoZoom, orthoZoomToDistance } from './cameraProjection';

describe('cameraProjection', () => {
  it('round-trips distance ↔ zoom for typical preview parameters', () => {
    const fov = 45;
    const viewportH = 600;
    const distance = 200;
    const zoom = distanceToOrthoZoom(distance, fov, viewportH);
    const back = orthoZoomToDistance(zoom, fov, viewportH);
    expect(back).toBeCloseTo(distance, 6);
  });

  it('produces zoom > 1 when distance is smaller than viewport-half / tan(fov/2)', () => {
    // At fov=45°, viewportH=600, distance=200: half-fov tan ≈ 0.4142, zoom ≈ 3.62
    const zoom = distanceToOrthoZoom(200, 45, 600);
    expect(zoom).toBeGreaterThan(3);
    expect(zoom).toBeLessThan(4);
  });

  it('zoom scales inversely with distance', () => {
    const fov = 45;
    const viewportH = 800;
    const z1 = distanceToOrthoZoom(100, fov, viewportH);
    const z2 = distanceToOrthoZoom(200, fov, viewportH);
    expect(z1).toBeCloseTo(z2 * 2, 6);
  });

  it('zoom scales linearly with viewport height', () => {
    const fov = 45;
    const distance = 150;
    const z1 = distanceToOrthoZoom(distance, fov, 400);
    const z2 = distanceToOrthoZoom(distance, fov, 800);
    expect(z2).toBeCloseTo(z1 * 2, 6);
  });

  it('round-trips zoom ↔ distance', () => {
    const fov = 60;
    const viewportH = 720;
    const zoom = 5.5;
    const distance = orthoZoomToDistance(zoom, fov, viewportH);
    const back = distanceToOrthoZoom(distance, fov, viewportH);
    expect(back).toBeCloseTo(zoom, 6);
  });
});

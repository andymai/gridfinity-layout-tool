import { describe, expect, it } from 'vitest';
import { OFF_GRID_WARNING_MM, detectGridFromSize } from './meshGridDetection';

describe('detectGridFromSize', () => {
  it('reads an exact lipless 2×1×3U bin (outer = W·42 − 0.5)', () => {
    const detected = detectGridFromSize({ x: 83.5, y: 41.5, z: 21 });
    expect(detected.width).toBe(2);
    expect(detected.depth).toBe(1);
    expect(detected.heightUnits).toBe(3);
    expect(detected.hasLip).toBe(false);
    expect(detected.offGrid).toBe(false);
    expect(detected.deviation.x).toBeCloseTo(0, 5);
    expect(detected.deviation.z).toBeCloseTo(0, 5);
  });

  it('reads a lipped 3U bin (25.4mm) as 3U with lip, not 4U', () => {
    const detected = detectGridFromSize({ x: 41.5, y: 41.5, z: 25.4 });
    expect(detected.heightUnits).toBe(3);
    expect(detected.hasLip).toBe(true);
    expect(detected.deviation.z).toBeCloseTo(0, 5);
    expect(detected.offGrid).toBe(false);
  });

  it('snaps half-unit footprints (1.5 units = 62.5mm outer)', () => {
    const detected = detectGridFromSize({ x: 62.5, y: 41.5, z: 14 });
    expect(detected.width).toBe(1.5);
    expect(detected.depth).toBe(1);
    expect(detected.deviation.x).toBeCloseTo(0, 5);
  });

  it('flags an off-grid model with per-axis deviations', () => {
    // 70mm is between 1.5u (62.5) and 2u (83.5) — nearest is 1.5u, off by 7.5mm.
    const detected = detectGridFromSize({ x: 70, y: 41.5, z: 21 });
    expect(detected.width).toBe(1.5);
    expect(detected.deviation.x).toBeGreaterThan(OFF_GRID_WARNING_MM);
    expect(detected.offGrid).toBe(true);
  });

  it('tolerates print-scale slop within the warning threshold', () => {
    const detected = detectGridFromSize({ x: 83.2, y: 41.7, z: 21.3 });
    expect(detected.width).toBe(2);
    expect(detected.depth).toBe(1);
    expect(detected.heightUnits).toBe(3);
    expect(detected.offGrid).toBe(false);
  });

  it('clamps to designer bounds (tiny and huge meshes)', () => {
    const tiny = detectGridFromSize({ x: 5, y: 5, z: 2 });
    expect(tiny.width).toBe(0.5);
    expect(tiny.depth).toBe(0.5);
    expect(tiny.heightUnits).toBe(1);

    const huge = detectGridFromSize({ x: 900, y: 900, z: 400 });
    expect(huge.width).toBe(16);
    expect(huge.depth).toBe(16);
    expect(huge.heightUnits).toBe(20);
    expect(huge.offGrid).toBe(true);
  });

  it('respects custom grid units', () => {
    const detected = detectGridFromSize({ x: 99.5, y: 49.5, z: 24 }, 50, 8);
    expect(detected.width).toBe(2);
    expect(detected.depth).toBe(1);
    expect(detected.heightUnits).toBe(3);
    expect(detected.deviation.x).toBeCloseTo(0, 5);
  });
});

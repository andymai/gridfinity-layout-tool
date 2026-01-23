import { describe, it, expect } from 'vitest';
import { generateInserts } from '../worker/generators/insertGenerator';
import type { Insert } from '@/features/bin-designer/types';

function makeInsert(overrides: Partial<Insert> = {}): Insert {
  return {
    id: 'test-1',
    templateId: null,
    shape: 'rectangle',
    x: 5,
    y: 5,
    width: 15,
    depth: 15,
    cutDepth: 20,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    ...overrides,
  };
}

describe('generateInserts', () => {
  const innerWidth = 70;
  const innerDepth = 70;
  const wallThickness = 0.95;
  const baseHeight = 7;
  const maxPocketHeight = 14; // 3U bin: 21mm - 7mm base = 14mm cavity
  const halfW = 41.7; // ~2 grid units: (2*42 - 0.6) / 2
  const halfD = 41.7;

  it('returns empty mesh for no inserts', () => {
    const result = generateInserts([], innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);
    expect(result.triangleCount).toBe(0);
    expect(result.vertices.length).toBe(0);
  });

  it('generates geometry for a rectangle insert', () => {
    const inserts = [makeInsert({ shape: 'rectangle', width: 20, depth: 30 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    // 4 walls, each is a box = 12 triangles each = 48 total
    expect(result.triangleCount).toBe(48);
    expect(result.vertices.length).toBe(48 * 9);
    expect(result.normals.length).toBe(48 * 9);
  });

  it('generates geometry for a circle insert', () => {
    const inserts = [makeInsert({ shape: 'circle', width: 15, depth: 15 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    // Ring with 24 segments, 8 triangles per segment = 192
    expect(result.triangleCount).toBe(192);
  });

  it('generates geometry for a hexagon insert', () => {
    const inserts = [makeInsert({ shape: 'hexagon', width: 15, depth: 15 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    // Ring with 6 segments, 8 triangles per segment = 48
    expect(result.triangleCount).toBe(48);
  });

  it('generates geometry for a rounded-rect insert', () => {
    const inserts = [makeInsert({ shape: 'rounded-rect', width: 20, depth: 30, cornerRadius: 3 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    // 4 straight walls (boxes) + 4 quarter rings (6 segments each)
    // Boxes: 4 * 12 = 48 triangles
    // Quarter rings: 4 * (6 * 8) = 192 triangles
    // Total: 240
    expect(result.triangleCount).toBe(240);
  });

  it('generates geometry for a slot insert (same as rectangle)', () => {
    const inserts = [makeInsert({ shape: 'slot', width: 10, depth: 40 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    expect(result.triangleCount).toBe(48); // Same as rectangle
  });

  it('clamps pocket height to maxPocketHeight', () => {
    // cutDepth of 50mm but max is 14mm
    const inserts = [makeInsert({ cutDepth: 50 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    // Should still generate geometry (clamped to 14mm)
    expect(result.triangleCount).toBeGreaterThan(0);

    // Verify Z values don't exceed baseHeight + maxPocketHeight
    const maxZ = baseHeight + maxPocketHeight;
    for (let i = 2; i < result.vertices.length; i += 3) {
      expect(result.vertices[i]).toBeLessThanOrEqual(maxZ + 0.001); // Floating point tolerance
    }
  });

  it('skips inserts with zero cutDepth', () => {
    const inserts = [makeInsert({ cutDepth: 0 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    expect(result.triangleCount).toBe(0);
  });

  it('handles multiple inserts', () => {
    const inserts = [
      makeInsert({ id: '1', shape: 'circle', x: 5, y: 5, width: 15, depth: 15 }),
      makeInsert({ id: '2', shape: 'rectangle', x: 30, y: 30, width: 20, depth: 20 }),
    ];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    // Circle: 192 + Rectangle: 48 = 240
    expect(result.triangleCount).toBe(240);
  });

  it('applies 90-degree rotation to rectangle (swaps width/depth)', () => {
    const normal = [makeInsert({ shape: 'rectangle', width: 10, depth: 30, rotation: 0 })];
    const rotated = [makeInsert({ shape: 'rectangle', width: 10, depth: 30, rotation: 90 })];

    const resultNormal = generateInserts(normal, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);
    const resultRotated = generateInserts(rotated, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    // Same triangle count (both are 4-wall rectangles)
    expect(resultNormal.triangleCount).toBe(resultRotated.triangleCount);

    // But geometry differs (rotated should swap dimensions)
    // Verify they're not identical
    let identical = true;
    for (let i = 0; i < resultNormal.vertices.length; i++) {
      if (Math.abs(resultNormal.vertices[i] - resultRotated.vertices[i]) > 0.001) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(false);
  });

  it('positions inserts relative to bin interior', () => {
    const inserts = [makeInsert({ x: 0, y: 0, shape: 'rectangle', width: 10, depth: 10 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    // The insert at (0,0) should start at (-halfW + wallThickness, -halfD + wallThickness)
    const expectedMinX = -halfW + wallThickness;
    const expectedMinY = -halfD + wallThickness;

    // Find min X and Y in vertices
    let minX = Infinity, minY = Infinity;
    for (let i = 0; i < result.vertices.length; i += 3) {
      minX = Math.min(minX, result.vertices[i]);
      minY = Math.min(minY, result.vertices[i + 1]);
    }

    expect(minX).toBeCloseTo(expectedMinX, 2);
    expect(minY).toBeCloseTo(expectedMinY, 2);
  });

  it('all vertices have Z >= baseHeight', () => {
    const inserts = [makeInsert({ shape: 'circle', width: 20, depth: 20 })];
    const result = generateInserts(inserts, innerWidth, innerDepth, wallThickness, baseHeight, maxPocketHeight, halfW, halfD);

    for (let i = 2; i < result.vertices.length; i += 3) {
      expect(result.vertices[i]).toBeGreaterThanOrEqual(baseHeight - 0.001);
    }
  });
});

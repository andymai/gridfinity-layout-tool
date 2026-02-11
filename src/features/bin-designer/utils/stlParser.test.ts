import { describe, it, expect } from 'vitest';
import { parseSTLBinary } from './stlParser';
import { buildSTLBuffer } from '@/features/generation/export/stlExporter';

describe('parseSTLBinary', () => {
  /** Build a binary STL with known data for round-trip testing */
  function makeSTL(vertices: Float32Array, normals: Float32Array): ArrayBuffer {
    return buildSTLBuffer(vertices, normals, 'test');
  }

  it('round-trips a single triangle through build → parse', () => {
    const vertices = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

    const buffer = makeSTL(vertices, normals);
    const parsed = parseSTLBinary(buffer);

    // Vertices should match exactly
    expect(parsed.vertices).toHaveLength(9);
    expect(parsed.vertices[0]).toBeCloseTo(1);
    expect(parsed.vertices[1]).toBeCloseTo(2);
    expect(parsed.vertices[2]).toBeCloseTo(3);
    expect(parsed.vertices[3]).toBeCloseTo(4);
    expect(parsed.vertices[4]).toBeCloseTo(5);
    expect(parsed.vertices[5]).toBeCloseTo(6);
    expect(parsed.vertices[6]).toBeCloseTo(7);
    expect(parsed.vertices[7]).toBeCloseTo(8);
    expect(parsed.vertices[8]).toBeCloseTo(9);

    // Face normal replicated to all 3 vertices
    for (let i = 0; i < 9; i += 3) {
      expect(parsed.normals[i]).toBeCloseTo(0);
      expect(parsed.normals[i + 1]).toBeCloseTo(0);
      expect(parsed.normals[i + 2]).toBeCloseTo(1);
    }
  });

  it('round-trips multiple triangles', () => {
    const vertices = new Float32Array([
      // Triangle 1
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      // Triangle 2
      1, 1, 0, 2, 1, 0, 1, 2, 0,
    ]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);

    const buffer = makeSTL(vertices, normals);
    const parsed = parseSTLBinary(buffer);

    expect(parsed.vertices).toHaveLength(18);
    expect(parsed.normals).toHaveLength(18);

    // First triangle normal
    expect(parsed.normals[0]).toBeCloseTo(0);
    expect(parsed.normals[2]).toBeCloseTo(1);

    // Second triangle normal
    expect(parsed.normals[9]).toBeCloseTo(0);
    expect(parsed.normals[11]).toBeCloseTo(-1);
  });

  it('throws on buffer too small', () => {
    expect(() => parseSTLBinary(new ArrayBuffer(10))).toThrow(/too small/);
  });

  it('throws on triangle count mismatch', () => {
    // Build a buffer with header claiming 100 triangles but only 84 bytes total (0 payload)
    const buffer = new ArrayBuffer(84);
    const view = new DataView(buffer);
    view.setUint32(80, 100, true); // claim 100 triangles
    expect(() => parseSTLBinary(buffer)).toThrow(/does not match/);
  });

  it('throws on misaligned payload size', () => {
    // 84-byte header + 30 bytes of junk (not a multiple of 50-byte triangle records)
    const buffer = new ArrayBuffer(84 + 30);
    const view = new DataView(buffer);
    view.setUint32(80, 0, true);
    expect(() => parseSTLBinary(buffer)).toThrow(/not a multiple/);
  });

  it('handles empty mesh (0 triangles)', () => {
    const buffer = new ArrayBuffer(84);
    const view = new DataView(buffer);
    view.setUint32(80, 0, true);

    const parsed = parseSTLBinary(buffer);
    expect(parsed.vertices).toHaveLength(0);
    expect(parsed.normals).toHaveLength(0);
  });
});

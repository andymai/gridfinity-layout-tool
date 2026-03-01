import { describe, it, expect } from 'vitest';
import { parseSTLBinary } from './stlParser';
import { isOk, isErr } from '@/core/result';
import { buildSTLBuffer } from '@/shared/generation/export';

describe('parseSTLBinary', () => {
  /** Build a binary STL with known data for round-trip testing */
  function makeSTL(vertices: Float32Array, normals: Float32Array): ArrayBuffer {
    return buildSTLBuffer(vertices, normals, 'test');
  }

  it('round-trips a single triangle through build → parse', () => {
    const vertices = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

    const buffer = makeSTL(vertices, normals);
    const result = parseSTLBinary(buffer);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const parsed = result.value;

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
    const result = parseSTLBinary(buffer);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const parsed = result.value;

    expect(parsed.vertices).toHaveLength(18);
    expect(parsed.normals).toHaveLength(18);

    // First triangle normal
    expect(parsed.normals[0]).toBeCloseTo(0);
    expect(parsed.normals[2]).toBeCloseTo(1);

    // Second triangle normal
    expect(parsed.normals[9]).toBeCloseTo(0);
    expect(parsed.normals[11]).toBeCloseTo(-1);
  });

  it('returns Err on buffer too small', () => {
    const result = parseSTLBinary(new ArrayBuffer(10));
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('VALIDATION_IMPORT_FAILED');
    expect(result.error.errors[0]).toMatch(/too small/);
  });

  it('returns Err on triangle count mismatch', () => {
    // Build a buffer with header claiming 100 triangles but only 84 bytes total (0 payload)
    const buffer = new ArrayBuffer(84);
    const view = new DataView(buffer);
    view.setUint32(80, 100, true); // claim 100 triangles
    const result = parseSTLBinary(buffer);
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.errors[0]).toMatch(/does not match/);
  });

  it('returns Err on misaligned payload size', () => {
    // 84-byte header + 30 bytes of junk (not a multiple of 50-byte triangle records)
    const buffer = new ArrayBuffer(84 + 30);
    const view = new DataView(buffer);
    view.setUint32(80, 0, true);
    const result = parseSTLBinary(buffer);
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.errors[0]).toMatch(/not a multiple/);
  });

  it('handles empty mesh (0 triangles)', () => {
    const buffer = new ArrayBuffer(84);
    const view = new DataView(buffer);
    view.setUint32(80, 0, true);

    const result = parseSTLBinary(buffer);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.vertices).toHaveLength(0);
    expect(result.value.normals).toHaveLength(0);
  });
});

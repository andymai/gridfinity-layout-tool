import { describe, it, expect } from 'vitest';
import { exportSTL, buildSTLBuffer, getSTLFileSize } from '@/features/generation/export/stlExporter';

describe('stlExporter', () => {
  // Helper: create a simple 1-triangle mesh (3 vertices, 9 floats)
  function createSingleTriangle() {
    const vertices = new Float32Array([
      0, 0, 0, // v1
      1, 0, 0, // v2
      0, 1, 0, // v3
    ]);
    const normals = new Float32Array([
      0, 0, 1, // n1
      0, 0, 1, // n2
      0, 0, 1, // n3
    ]);
    return { vertices, normals };
  }

  // Helper: create a 2-triangle mesh
  function createTwoTriangles() {
    const vertices = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0, // tri 1
      1, 0, 0, 1, 1, 0, 0, 1, 0, // tri 2
    ]);
    const normals = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1, // tri 1
      0, 0, 1, 0, 0, 1, 0, 0, 1, // tri 2
    ]);
    return { vertices, normals };
  }

  describe('exportSTL', () => {
    it('produces a Blob with correct MIME type', () => {
      const { vertices, normals } = createSingleTriangle();
      const blob = exportSTL(vertices, normals, 'test');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/sla');
    });

    it('produces correct file size for 1 triangle', () => {
      const { vertices, normals } = createSingleTriangle();
      const blob = exportSTL(vertices, normals, 'test');
      // 80 header + 4 count + 1 * 50 = 134 bytes
      expect(blob.size).toBe(134);
    });

    it('produces correct file size for 2 triangles', () => {
      const { vertices, normals } = createTwoTriangles();
      const blob = exportSTL(vertices, normals, 'test');
      // 80 header + 4 count + 2 * 50 = 184 bytes
      expect(blob.size).toBe(184);
    });

    it('writes correct header text', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = buildSTLBuffer(vertices, normals, 'my-bin');
      const header = new Uint8Array(buffer, 0, 80);

      // Decode ASCII header
      const headerText = String.fromCharCode(...header).replace(/\0+$/, '');
      expect(headerText).toContain('Gridfinity Layout Tool');
      expect(headerText).toContain('my-bin');
    });

    it('writes correct triangle count in header', () => {
      const { vertices, normals } = createTwoTriangles();
      const buffer = buildSTLBuffer(vertices, normals, 'test');
      const view = new DataView(buffer);

      const count = view.getUint32(80, true); // LE at offset 80
      expect(count).toBe(2);
    });

    it('writes correct normal vector for each triangle', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = buildSTLBuffer(vertices, normals, 'test');
      const view = new DataView(buffer);

      // Normal starts at offset 84 (80 header + 4 count)
      const nx = view.getFloat32(84, true);
      const ny = view.getFloat32(88, true);
      const nz = view.getFloat32(92, true);

      expect(nx).toBeCloseTo(0);
      expect(ny).toBeCloseTo(0);
      expect(nz).toBeCloseTo(1);
    });

    it('writes correct vertex coordinates', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = buildSTLBuffer(vertices, normals, 'test');
      const view = new DataView(buffer);

      // First vertex starts at offset 96 (84 normal + 12 bytes)
      const v1x = view.getFloat32(96, true);
      const v1y = view.getFloat32(100, true);
      const v1z = view.getFloat32(104, true);
      expect(v1x).toBeCloseTo(0);
      expect(v1y).toBeCloseTo(0);
      expect(v1z).toBeCloseTo(0);

      // Second vertex
      const v2x = view.getFloat32(108, true);
      const v2y = view.getFloat32(112, true);
      const v2z = view.getFloat32(116, true);
      expect(v2x).toBeCloseTo(1);
      expect(v2y).toBeCloseTo(0);
      expect(v2z).toBeCloseTo(0);

      // Third vertex
      const v3x = view.getFloat32(120, true);
      const v3y = view.getFloat32(124, true);
      const v3z = view.getFloat32(128, true);
      expect(v3x).toBeCloseTo(0);
      expect(v3y).toBeCloseTo(1);
      expect(v3z).toBeCloseTo(0);
    });

    it('sets attribute byte count to 0', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = buildSTLBuffer(vertices, normals, 'test');
      const view = new DataView(buffer);

      // Attribute at offset 132 (84 + 12 normal + 36 vertices)
      const attr = view.getUint16(132, true);
      expect(attr).toBe(0);
    });

    it('truncates long header names to 80 bytes', () => {
      const { vertices, normals } = createSingleTriangle();
      const longName = 'a'.repeat(200);
      const buffer = buildSTLBuffer(vertices, normals, longName);

      // File should still have correct size
      expect(buffer.byteLength).toBe(134);
    });

    it('throws for non-divisible-by-9 vertex count', () => {
      const vertices = new Float32Array(10); // Not divisible by 9
      const normals = new Float32Array(10);
      expect(() => exportSTL(vertices, normals)).toThrow('not divisible by 9');
    });

    it('throws for mismatched normal/vertex lengths', () => {
      const vertices = new Float32Array(9);
      const normals = new Float32Array(18);
      expect(() => exportSTL(vertices, normals)).toThrow('length mismatch');
    });

    it('handles empty mesh (0 triangles)', () => {
      const vertices = new Float32Array(0);
      const normals = new Float32Array(0);
      const blob = exportSTL(vertices, normals, 'empty');
      expect(blob.size).toBe(84); // 80 header + 4 count (0)
    });

    it('uses default name when none provided', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = buildSTLBuffer(vertices, normals);
      const header = new Uint8Array(buffer, 0, 80);
      const headerText = String.fromCharCode(...header).replace(/\0+$/, '');
      expect(headerText).toContain('gridfinity-bin');
    });
  });

  describe('getSTLFileSize', () => {
    it('returns 84 for 0 triangles', () => {
      expect(getSTLFileSize(0)).toBe(84);
    });

    it('returns 134 for 1 triangle', () => {
      expect(getSTLFileSize(1)).toBe(134);
    });

    it('returns correct size for large mesh', () => {
      expect(getSTLFileSize(1000)).toBe(80 + 4 + 1000 * 50);
    });

    it('matches actual blob size', () => {
      const { vertices, normals } = createTwoTriangles();
      const blob = exportSTL(vertices, normals, 'test');
      expect(blob.size).toBe(getSTLFileSize(2));
    });
  });
});

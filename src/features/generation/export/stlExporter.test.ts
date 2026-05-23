import { describe, it, expect } from 'vitest';
import {
  exportSTL,
  buildSTLBuffer,
  buildSTLBufferFromIndexed,
  getSTLFileSize,
} from '@/features/generation/export/stlExporter';

describe('stlExporter', () => {
  // Helper: create a simple 1-triangle mesh (3 vertices, 9 floats)
  function createSingleTriangle() {
    const vertices = new Float32Array([
      0,
      0,
      0, // v1
      1,
      0,
      0, // v2
      0,
      1,
      0, // v3
    ]);
    const normals = new Float32Array([
      0,
      0,
      1, // n1
      0,
      0,
      1, // n2
      0,
      0,
      1, // n3
    ]);
    return { vertices, normals };
  }

  // Helper: create a 2-triangle mesh
  function createTwoTriangles() {
    const vertices = new Float32Array([
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0, // tri 1
      1,
      0,
      0,
      1,
      1,
      0,
      0,
      1,
      0, // tri 2
    ]);
    const normals = new Float32Array([
      0,
      0,
      1,
      0,
      0,
      1,
      0,
      0,
      1, // tri 1
      0,
      0,
      1,
      0,
      0,
      1,
      0,
      0,
      1, // tri 2
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

    it('throws on empty mesh (0 triangles)', () => {
      // STL binary is structurally valid with 0 triangles, but slicers reject
      // it and 3MF doesn't allow it — reject at the shared validation boundary.
      expect(() => exportSTL(new Float32Array(0), new Float32Array(0), 'empty')).toThrow(
        /empty mesh/
      );
    });

    it('uses default name when none provided', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = buildSTLBuffer(vertices, normals);
      const header = new Uint8Array(buffer, 0, 80);
      const headerText = String.fromCharCode(...header).replace(/\0+$/, '');
      expect(headerText).toContain('gridfinity-bin');
    });
  });

  describe('buildSTLBufferFromIndexed', () => {
    it('produces same output as buildSTLBuffer for equivalent mesh', () => {
      // Flat mesh: 1 triangle with 3 unique vertices
      const flatVerts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const flatNormals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

      // Indexed mesh: same geometry
      const indexedVerts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const indexedNormals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
      const indices = new Uint32Array([0, 1, 2]);

      const flatBuffer = buildSTLBuffer(flatVerts, flatNormals, 'test');
      const indexedBuffer = buildSTLBufferFromIndexed(
        indexedVerts,
        indexedNormals,
        indices,
        'test'
      );

      expect(indexedBuffer.byteLength).toBe(flatBuffer.byteLength);
      expect(new Uint8Array(indexedBuffer)).toEqual(new Uint8Array(flatBuffer));
    });

    it('correctly dereferences shared vertices', () => {
      // 4 unique vertices, 2 triangles sharing edge
      const vertices = new Float32Array([
        0,
        0,
        0, // v0
        1,
        0,
        0, // v1
        0,
        1,
        0, // v2
        1,
        1,
        0, // v3
      ]);
      const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
      const indices = new Uint32Array([0, 1, 2, 1, 3, 2]);

      const buffer = buildSTLBufferFromIndexed(vertices, normals, indices, 'test');
      const view = new DataView(buffer);

      // Should have 2 triangles
      expect(view.getUint32(80, true)).toBe(2);
      expect(buffer.byteLength).toBe(80 + 4 + 2 * 50);

      // Verify first triangle vertex positions (v0, v1, v2)
      expect(view.getFloat32(96, true)).toBeCloseTo(0); // v0.x
      expect(view.getFloat32(108, true)).toBeCloseTo(1); // v1.x
      expect(view.getFloat32(120, true)).toBeCloseTo(0); // v2.x

      // Verify second triangle vertex positions (v1, v3, v2)
      expect(view.getFloat32(146, true)).toBeCloseTo(1); // v1.x
      expect(view.getFloat32(158, true)).toBeCloseTo(1); // v3.x
      expect(view.getFloat32(170, true)).toBeCloseTo(0); // v2.x
    });

    it('computes face normals when normals array is empty', () => {
      const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const normals = new Float32Array(0);
      const indices = new Uint32Array([0, 1, 2]);

      const buffer = buildSTLBufferFromIndexed(vertices, normals, indices, 'test');
      const view = new DataView(buffer);

      // Normal should be (0, 0, 1) for a triangle in XY plane
      expect(view.getFloat32(84, true)).toBeCloseTo(0);
      expect(view.getFloat32(88, true)).toBeCloseTo(0);
      expect(view.getFloat32(92, true)).toBeCloseTo(1);
    });

    it('handles empty mesh', () => {
      const buffer = buildSTLBufferFromIndexed(
        new Float32Array(0),
        new Float32Array(0),
        new Uint32Array(0),
        'empty'
      );
      expect(buffer.byteLength).toBe(84); // header + count only
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

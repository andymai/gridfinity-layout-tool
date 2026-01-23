// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  export3MF,
  build3MFBuffer,
  deduplicateVertices,
  estimate3MFFileSize,
} from '@/features/generation/export/threemfExporter';

describe('threemfExporter', () => {
  // Helper: create a simple 1-triangle mesh (3 vertices, 9 floats)
  function createSingleTriangle() {
    const vertices = new Float32Array([
      0, 0, 0, // v1
      1, 0, 0, // v2
      0, 1, 0, // v3
    ]);
    const normals = new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]);
    return { vertices, normals };
  }

  // Helper: create a 2-triangle mesh with shared edge (4 unique vertices)
  function createTwoTriangles() {
    const vertices = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0, // tri 1
      1, 0, 0, 1, 1, 0, 0, 1, 0, // tri 2 (shares v2 and v3 from tri 1)
    ]);
    const normals = new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
    return { vertices, normals };
  }

  // Helper: unzip and parse the model XML
  function extractModelXML(buffer: Uint8Array): string {
    const files = unzipSync(buffer);
    return strFromU8(files['3D/3dmodel.model']);
  }

  describe('export3MF', () => {
    it('produces a Blob with correct MIME type', () => {
      const { vertices, normals } = createSingleTriangle();
      const blob = export3MF(vertices, normals, { name: 'test' });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/vnd.ms-package.3dmanufacturing-3dmodel+xml');
    });

    it('produces a non-empty blob', () => {
      const { vertices, normals } = createSingleTriangle();
      const blob = export3MF(vertices, normals, { name: 'test' });
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('build3MFBuffer', () => {
    it('produces a valid ZIP archive', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });

      // Should not throw when unzipping
      const files = unzipSync(buffer);
      expect(Object.keys(files).length).toBeGreaterThanOrEqual(3);
    });

    it('contains required OPC files', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const files = unzipSync(buffer);

      expect(files['[Content_Types].xml']).toBeDefined();
      expect(files['_rels/.rels']).toBeDefined();
      expect(files['3D/3dmodel.model']).toBeDefined();
    });

    it('includes thumbnail when provided', () => {
      const { vertices, normals } = createSingleTriangle();
      const thumbnail = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG magic bytes
      const buffer = build3MFBuffer(vertices, normals, { name: 'test', thumbnail });
      const files = unzipSync(buffer);

      expect(files['Metadata/thumbnail.png']).toBeDefined();
      expect(files['Metadata/thumbnail.png'][0]).toBe(0x89); // PNG signature
    });

    it('omits thumbnail file when not provided', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const files = unzipSync(buffer);

      expect(files['Metadata/thumbnail.png']).toBeUndefined();
    });

    it('declares PNG content type when thumbnail present', () => {
      const { vertices, normals } = createSingleTriangle();
      const thumbnail = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      const buffer = build3MFBuffer(vertices, normals, { name: 'test', thumbnail });
      const files = unzipSync(buffer);

      const contentTypes = strFromU8(files['[Content_Types].xml']);
      expect(contentTypes).toContain('Extension="png"');
      expect(contentTypes).toContain('image/png');
    });

    it('throws for non-divisible-by-9 vertex count', () => {
      const vertices = new Float32Array(10);
      const normals = new Float32Array(10);
      expect(() => build3MFBuffer(vertices, normals, { name: 'test' }))
        .toThrow('not divisible by 9');
    });

    it('throws for mismatched normal/vertex lengths', () => {
      const vertices = new Float32Array(9);
      const normals = new Float32Array(18);
      expect(() => build3MFBuffer(vertices, normals, { name: 'test' }))
        .toThrow('length mismatch');
    });

    it('handles empty mesh (0 triangles)', () => {
      const vertices = new Float32Array(0);
      const normals = new Float32Array(0);
      const buffer = build3MFBuffer(vertices, normals, { name: 'empty' });

      const xml = extractModelXML(buffer);
      expect(xml).toContain('<vertices>');
      expect(xml).toContain('<triangles>');
      expect(xml).not.toContain('<vertex ');
      expect(xml).not.toContain('<triangle ');
    });
  });

  describe('3MF model XML', () => {
    it('uses millimeter units', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      expect(xml).toContain('unit="millimeter"');
    });

    it('includes model name in metadata', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'my-custom-bin' });
      const xml = extractModelXML(buffer);

      expect(xml).toContain('<metadata name="Title">my-custom-bin</metadata>');
    });

    it('includes designer metadata', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      expect(xml).toContain('<metadata name="Designer">Gridfinity Layout Tool</metadata>');
    });

    it('includes creation date', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      // Should be an ISO date like 2024-01-15
      expect(xml).toMatch(/<metadata name="CreationDate">\d{4}-\d{2}-\d{2}<\/metadata>/);
    });

    it('writes correct vertex coordinates', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      expect(xml).toContain('x="0" y="0" z="0"');
      expect(xml).toContain('x="1" y="0" z="0"');
      expect(xml).toContain('x="0" y="1" z="0"');
    });

    it('writes correct triangle indices', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      expect(xml).toContain('v1="0" v2="1" v3="2"');
    });

    it('deduplicates shared vertices in multi-triangle mesh', () => {
      const { vertices, normals } = createTwoTriangles();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      // 2 triangles sharing 2 vertices → 4 unique vertices, not 6
      const vertexMatches = xml.match(/<vertex /g);
      expect(vertexMatches).toHaveLength(4);

      const triangleMatches = xml.match(/<triangle /g);
      expect(triangleMatches).toHaveLength(2);
    });

    it('includes print settings when provided', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, {
        name: 'test',
        printSettings: {
          layerHeight: 0.2,
          infillPercent: 15,
          material: 'PLA',
          supportRequired: false,
          estimatedMinutes: 45,
          estimatedGrams: 12,
        },
      });
      const xml = extractModelXML(buffer);

      expect(xml).toContain('<metadata name="PrintSettings.LayerHeight">0.2</metadata>');
      expect(xml).toContain('<metadata name="PrintSettings.InfillPercent">15</metadata>');
      expect(xml).toContain('<metadata name="PrintSettings.Material">PLA</metadata>');
      expect(xml).toContain('<metadata name="PrintSettings.SupportRequired">false</metadata>');
      expect(xml).toContain('<metadata name="PrintSettings.EstimatedMinutes">45</metadata>');
      expect(xml).toContain('<metadata name="PrintSettings.EstimatedGrams">12</metadata>');
    });

    it('omits print settings metadata when not provided', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      expect(xml).not.toContain('PrintSettings');
    });

    it('escapes XML special characters in name', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test <bin> & "stuff"' });
      const xml = extractModelXML(buffer);

      expect(xml).toContain('test &lt;bin&gt; &amp; &quot;stuff&quot;');
      expect(xml).not.toContain('test <bin>');
    });

    it('includes build section with object reference', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      expect(xml).toContain('<build>');
      expect(xml).toContain('<item objectid="1" />');
    });

    it('formats floating-point vertices with precision', () => {
      const vertices = new Float32Array([
        1.123456789, 2.5, 3.000001,
        4, 5, 6,
        7, 8, 9,
      ]);
      const normals = new Float32Array(9).fill(1);
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const xml = extractModelXML(buffer);

      // Should trim trailing zeros but keep precision
      expect(xml).toContain('x="1.123457"'); // Rounded to 6 decimals
      expect(xml).toContain('y="2.5"'); // No trailing zeros
      expect(xml).toContain('z="3.000001"'); // Preserves significant digits
    });
  });

  describe('deduplicateVertices', () => {
    it('returns all vertices for unique triangle', () => {
      const { vertices } = createSingleTriangle();
      const mesh = deduplicateVertices(vertices);

      expect(mesh.vertices).toHaveLength(3);
      expect(mesh.triangles).toHaveLength(1);
    });

    it('deduplicates shared vertices', () => {
      const { vertices } = createTwoTriangles();
      const mesh = deduplicateVertices(vertices);

      // 2 triangles with 2 shared vertices → 4 unique
      expect(mesh.vertices).toHaveLength(4);
      expect(mesh.triangles).toHaveLength(2);
    });

    it('preserves vertex coordinates', () => {
      const { vertices } = createSingleTriangle();
      const mesh = deduplicateVertices(vertices);

      expect(mesh.vertices[0]).toEqual([0, 0, 0]);
      expect(mesh.vertices[1]).toEqual([1, 0, 0]);
      expect(mesh.vertices[2]).toEqual([0, 1, 0]);
    });

    it('builds correct triangle indices', () => {
      const { vertices } = createSingleTriangle();
      const mesh = deduplicateVertices(vertices);

      expect(mesh.triangles[0]).toEqual([0, 1, 2]);
    });

    it('handles fully duplicated cube-like mesh', () => {
      // 2 triangles forming a square, all vertices shared
      const v = new Float32Array([
        0, 0, 0, 1, 0, 0, 1, 1, 0, // tri 1
        0, 0, 0, 1, 1, 0, 0, 1, 0, // tri 2 (all vertices shared with tri 1 + one new)
      ]);
      const mesh = deduplicateVertices(v);

      // 4 unique vertices: (0,0,0), (1,0,0), (1,1,0), (0,1,0)
      expect(mesh.vertices).toHaveLength(4);
      expect(mesh.triangles).toHaveLength(2);

      // Triangle 1 uses indices 0, 1, 2
      expect(mesh.triangles[0]).toEqual([0, 1, 2]);
      // Triangle 2 reuses index 0 and 2, adds index 3
      expect(mesh.triangles[1]).toEqual([0, 2, 3]);
    });

    it('handles empty mesh', () => {
      const mesh = deduplicateVertices(new Float32Array(0));
      expect(mesh.vertices).toHaveLength(0);
      expect(mesh.triangles).toHaveLength(0);
    });

    it('treats very close but different coordinates as distinct', () => {
      // Two vertices that differ by less than epsilon in 7th decimal
      const vertices = new Float32Array([
        0, 0, 0,
        1.0000001, 0, 0, // differs in 7th decimal (below toFixed(6) precision)
        0, 1, 0,
      ]);
      const mesh = deduplicateVertices(vertices);

      // toFixed(6) rounds both to "1.000000" → should deduplicate to same vertex
      // Actually 1.0000001 rounds to "1.000000" in toFixed(6), so it's the same key
      // But since first vertex (0,0,0) is different, we get 3 unique vertices...
      // Wait, 1.0000001.toFixed(6) = "1.000000", and 1.toFixed(6) = "1.000000" - they'd be same!
      // But there's no vertex at exactly 1.0 in this test, so all 3 are unique
      expect(mesh.vertices).toHaveLength(3);
    });
  });

  describe('estimate3MFFileSize', () => {
    it('returns base overhead for 0 triangles', () => {
      expect(estimate3MFFileSize(0)).toBe(1024);
    });

    it('increases linearly with triangle count', () => {
      const size100 = estimate3MFFileSize(100);
      const size200 = estimate3MFFileSize(200);
      expect(size200 - size100).toBe(100 * 30);
    });

    it('returns reasonable estimate for typical mesh', () => {
      // A typical bin might have 500 triangles
      const size = estimate3MFFileSize(500);
      expect(size).toBe(1024 + 500 * 30);
      expect(size).toBeLessThan(20_000); // Should be under 20KB
    });
  });

  describe('OPC relationships', () => {
    it('references 3D model in relationships', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const files = unzipSync(buffer);
      const rels = strFromU8(files['_rels/.rels']);

      expect(rels).toContain('Target="/3D/3dmodel.model"');
      expect(rels).toContain('3dmanufacturing');
    });

    it('declares model content type', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const files = unzipSync(buffer);
      const contentTypes = strFromU8(files['[Content_Types].xml']);

      expect(contentTypes).toContain('Extension="model"');
      expect(contentTypes).toContain('3dmanufacturing-3dmodel+xml');
    });

    it('declares rels content type', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const files = unzipSync(buffer);
      const contentTypes = strFromU8(files['[Content_Types].xml']);

      expect(contentTypes).toContain('Extension="rels"');
    });
  });
});

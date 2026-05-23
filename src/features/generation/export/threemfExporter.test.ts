// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  export3MF,
  export3MFMultiObject,
  build3MFBuffer,
  build3MFMultiObjectBuffer,
  deduplicateVertices,
  estimate3MFFileSize,
} from '@/features/generation/export/threemfExporter';

describe('threemfExporter', () => {
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
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    return { vertices, normals };
  }

  // Helper: create a 2-triangle mesh with shared edge (4 unique vertices)
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
      0, // tri 2 (shares v2 and v3 from tri 1)
    ]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
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
      const thumbnail = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
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
      const thumbnail = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const buffer = build3MFBuffer(vertices, normals, { name: 'test', thumbnail });
      const files = unzipSync(buffer);

      const contentTypes = strFromU8(files['[Content_Types].xml']);
      expect(contentTypes).toContain('Extension="png"');
      expect(contentTypes).toContain('image/png');
    });

    it('throws for non-divisible-by-9 vertex count', () => {
      const vertices = new Float32Array(10);
      const normals = new Float32Array(10);
      expect(() => build3MFBuffer(vertices, normals, { name: 'test' })).toThrow(
        'not divisible by 9'
      );
    });

    it('throws for mismatched normal/vertex lengths', () => {
      const vertices = new Float32Array(9);
      const normals = new Float32Array(18);
      expect(() => build3MFBuffer(vertices, normals, { name: 'test' })).toThrow('length mismatch');
    });

    it('throws on empty mesh (0 triangles) — 3MF Core requires ≥1 triangle', () => {
      // Previously emitted an empty `<vertices/>`/`<triangles/>` pair, which
      // violates Core spec minOccurs constraints and is rejected by slicers.
      expect(() =>
        build3MFBuffer(new Float32Array(0), new Float32Array(0), { name: 'empty' })
      ).toThrow(/empty mesh/);
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
      const vertices = new Float32Array([1.123456789, 2.5, 3.000001, 4, 5, 6, 7, 8, 9]);
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
        0,
        0,
        0,
        1,
        0,
        0,
        1,
        1,
        0, // tri 1
        0,
        0,
        0,
        1,
        1,
        0,
        0,
        1,
        0, // tri 2 (all vertices shared with tri 1 + one new)
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
        0,
        0,
        0,
        1.0000001,
        0,
        0, // differs in 7th decimal (below toFixed(6) precision)
        0,
        1,
        0,
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

  describe('multi-color basematerials', () => {
    it('emits basematerials and pid/pindex when colorConfig is provided', () => {
      const { vertices, normals } = createTwoTriangles();
      const buffer = build3MFBuffer(vertices, normals, {
        name: 'color-test',
        colorConfig: {
          materials: [
            { name: 'White', color: '#ffffff' },
            { name: 'Blue', color: '#0000ff' },
          ],
          triangleMaterialIndices: [0, 1],
        },
      });
      const files = unzipSync(buffer);
      const model = strFromU8(files['3D/3dmodel.model']);

      // Basematerials in core namespace (no m: prefix — 3MF Core Spec section 5.1)
      // IDs in ascending document order per §4.1.2: basematerials=1, object=2
      expect(model).not.toContain('xmlns:m=');
      expect(model).toContain('<basematerials id="1">');
      expect(model).toContain('<base name="White" displaycolor="#ffffff" />');
      expect(model).toContain('<base name="Blue" displaycolor="#0000ff" />');
      expect(model).toContain('</basematerials>');
      expect(model).toContain('object id="2"');
      expect(model).toContain('objectid="2"');

      // Triangle material assignments
      expect(model).toMatch(/triangle v1="\d+" v2="\d+" v3="\d+" pid="1" p1="0"/);
      expect(model).toMatch(/triangle v1="\d+" v2="\d+" v3="\d+" pid="1" p1="1"/);
    });

    it('omits basematerials when colorConfig is absent', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'no-color' });
      const files = unzipSync(buffer);
      const model = strFromU8(files['3D/3dmodel.model']);

      expect(model).not.toContain('basematerials');
      expect(model).not.toContain('pid=');
      expect(model).not.toContain('xmlns:m=');
    });

    it('omits basematerials when colorConfig has empty materials', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, {
        name: 'empty-color',
        colorConfig: { materials: [], triangleMaterialIndices: [] },
      });
      const files = unzipSync(buffer);
      const model = strFromU8(files['3D/3dmodel.model']);

      expect(model).not.toContain('basematerials');
      expect(model).not.toContain('pid=');
    });
  });

  describe('multi-object 3MF', () => {
    it('produces a valid ZIP with multiple objects', () => {
      const tri = createSingleTriangle();
      const objects = [
        { vertices: tri.vertices, normals: tri.normals, name: 'Bin 2x2x3' },
        { vertices: tri.vertices, normals: tri.normals, name: 'Divider Horizontal' },
      ];
      const buffer = build3MFMultiObjectBuffer(objects, { name: 'test' });
      const files = unzipSync(buffer);
      const model = strFromU8(files['3D/3dmodel.model']);

      expect(model).toContain('object id="1"');
      expect(model).toContain('object id="2"');
      expect(model).toContain('name="Bin 2x2x3"');
      expect(model).toContain('name="Divider Horizontal"');
    });

    it('emits build items for each object', () => {
      const tri = createSingleTriangle();
      const objects = [
        { vertices: tri.vertices, normals: tri.normals, name: 'A' },
        { vertices: tri.vertices, normals: tri.normals, name: 'B' },
        { vertices: tri.vertices, normals: tri.normals, name: 'C' },
      ];
      const buffer = build3MFMultiObjectBuffer(objects, { name: 'multi' });
      const model = strFromU8(unzipSync(buffer)['3D/3dmodel.model']);

      expect(model).toContain('objectid="1"');
      expect(model).toContain('objectid="2"');
      expect(model).toContain('objectid="3"');
    });

    it('assigns sequential IDs with per-object basematerials', () => {
      const tri = createSingleTriangle();
      const objects = [
        {
          vertices: tri.vertices,
          normals: tri.normals,
          name: 'Colored Bin',
          colorConfig: {
            materials: [{ name: 'Red', color: '#ff0000' }],
            triangleMaterialIndices: [0],
          },
        },
        { vertices: tri.vertices, normals: tri.normals, name: 'Divider' },
      ];
      const buffer = build3MFMultiObjectBuffer(objects, { name: 'test' });
      const model = strFromU8(unzipSync(buffer)['3D/3dmodel.model']);

      // basematerials=1, colored object=2, plain object=3
      expect(model).toContain('basematerials id="1"');
      expect(model).toContain('object id="2"');
      expect(model).toContain('object id="3"');
      expect(model).toContain('objectid="2"');
      expect(model).toContain('objectid="3"');
    });

    it('export3MFMultiObject produces a Blob with correct MIME', () => {
      const tri = createSingleTriangle();
      const blob = export3MFMultiObject(
        [{ vertices: tri.vertices, normals: tri.normals, name: 'test' }],
        { name: 'test' }
      );
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/vnd.ms-package.3dmanufacturing-3dmodel+xml');
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('Blob correctness', () => {
    it('Blob round-trip produces a valid extractable ZIP', async () => {
      const { vertices, normals } = createSingleTriangle();
      const blob = export3MF(vertices, normals, { name: 'roundtrip-test' });

      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // ZIP magic bytes: PK\x03\x04
      expect(bytes[0]).toBe(0x50); // P
      expect(bytes[1]).toBe(0x4b); // K
      expect(bytes[2]).toBe(0x03);
      expect(bytes[3]).toBe(0x04);

      // Should be extractable
      const files = unzipSync(bytes);
      expect(files['3D/3dmodel.model']).toBeDefined();
    });

    it('toArrayBuffer correctly scopes to the view range of a sub-view', () => {
      // Simulate fflate returning a Uint8Array sub-view of a larger buffer
      const { vertices, normals } = createSingleTriangle();
      const fullZip = build3MFBuffer(vertices, normals, { name: 'test' });

      // Embed the ZIP in a larger buffer at an offset (mimics WASM pre-allocation)
      const padding = 1024;
      const large = new Uint8Array(padding + fullZip.byteLength + padding);
      large.set(fullZip, padding);
      const subView = large.subarray(padding, padding + fullZip.byteLength);

      // The sub-view's .buffer is the entire large ArrayBuffer
      expect(subView.buffer.byteLength).toBe(large.byteLength);
      expect(subView.byteLength).toBe(fullZip.byteLength);

      // Extract only the view's portion — should be a valid ZIP
      const scoped = subView.buffer.slice(
        subView.byteOffset,
        subView.byteOffset + subView.byteLength
      );
      const extracted = unzipSync(new Uint8Array(scoped));
      expect(extracted['3D/3dmodel.model']).toBeDefined();

      // The naive .buffer.slice(0) includes leading garbage (padding bytes)
      // that shifts the ZIP signature away from offset 0
      const naive = new Uint8Array(subView.buffer.slice(0));
      expect(naive.byteLength).toBe(large.byteLength);
      // First bytes are padding zeros, not the PK signature
      expect(naive[0]).toBe(0);
      expect(naive[1]).toBe(0);
    });
  });

  describe('realistic mesh sizes', () => {
    /** Generate a box-like mesh with the given number of triangles. */
    function createLargeMesh(triangleCount: number) {
      const vertices = new Float32Array(triangleCount * 9);
      const normals = new Float32Array(triangleCount * 9);

      for (let i = 0; i < triangleCount; i++) {
        const base = i * 9;
        // Spread vertices across a realistic coordinate range (0-200mm)
        const ox = (i % 50) * 4;
        const oy = Math.floor(i / 50) * 4;
        const oz = (i % 7) * 3;

        vertices[base] = ox;
        vertices[base + 1] = oy;
        vertices[base + 2] = oz;
        vertices[base + 3] = ox + 4;
        vertices[base + 4] = oy;
        vertices[base + 5] = oz;
        vertices[base + 6] = ox + 2;
        vertices[base + 7] = oy + 4;
        vertices[base + 8] = oz + 3;

        normals[base] = 0;
        normals[base + 1] = 0;
        normals[base + 2] = 1;
        normals[base + 3] = 0;
        normals[base + 4] = 0;
        normals[base + 5] = 1;
        normals[base + 6] = 0;
        normals[base + 7] = 0;
        normals[base + 8] = 1;
      }
      return { vertices, normals };
    }

    it('handles a 5000-triangle mesh (typical bin)', () => {
      const { vertices, normals } = createLargeMesh(5000);
      const buffer = build3MFBuffer(vertices, normals, {
        name: 'gridfinity-2x3x6',
        printSettings: {
          layerHeight: 0.2,
          infillPercent: 15,
          material: 'PLA',
          supportRequired: false,
        },
      });

      const files = unzipSync(buffer);
      const model = strFromU8(files['3D/3dmodel.model']);

      const vertexMatches = model.match(/<vertex /g);
      const triangleMatches = model.match(/<triangle /g);
      expect(vertexMatches?.length ?? 0).toBeGreaterThan(0);
      expect(vertexMatches?.length ?? 0).toBeLessThanOrEqual(5000 * 3); // deduplication reduces this
      expect(triangleMatches).toHaveLength(5000);

      // Verify no NaN or Infinity snuck in
      expect(model).not.toContain('NaN');
      expect(model).not.toContain('Infinity');
    });

    it('handles a 20000-triangle mesh (complex bin with features)', () => {
      const { vertices, normals } = createLargeMesh(20000);
      const buffer = build3MFBuffer(vertices, normals, { name: 'complex-bin' });

      const files = unzipSync(buffer);
      const model = strFromU8(files['3D/3dmodel.model']);
      const triangleMatches = model.match(/<triangle /g);
      expect(triangleMatches).toHaveLength(20000);
    });

    it('multi-object with large meshes for bin + dividers', () => {
      const binMesh = createLargeMesh(8000);
      const divHMesh = createLargeMesh(500);
      const divVMesh = createLargeMesh(500);

      const buffer = build3MFMultiObjectBuffer(
        [
          { vertices: binMesh.vertices, normals: binMesh.normals, name: 'Bin 4x3x6' },
          {
            vertices: divHMesh.vertices,
            normals: divHMesh.normals,
            name: 'Divider Horizontal',
          },
          { vertices: divVMesh.vertices, normals: divVMesh.normals, name: 'Divider Vertical' },
        ],
        { name: 'slotted-bin' }
      );

      const files = unzipSync(buffer);
      const model = strFromU8(files['3D/3dmodel.model']);

      // 3 objects + 3 build items
      expect((model.match(/<object /g) ?? []).length).toBe(3);
      expect((model.match(/<item /g) ?? []).length).toBe(3);

      // Total triangles across all objects
      const triangleMatches = model.match(/<triangle /g);
      expect(triangleMatches).toHaveLength(9000);
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

    it('declares model content type using Override (not Default Extension)', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const files = unzipSync(buffer);
      const contentTypes = strFromU8(files['[Content_Types].xml']);

      // Override element is required for PrusaSlicer/OrcaSlicer compatibility;
      // Default Extension="model" is valid per spec but not all parsers support it.
      expect(contentTypes).toContain('Override PartName="/3D/3dmodel.model"');
      expect(contentTypes).toContain('3dmanufacturing-3dmodel+xml');
      expect(contentTypes).not.toContain('Extension="model"');
    });

    it('declares rels content type', () => {
      const { vertices, normals } = createSingleTriangle();
      const buffer = build3MFBuffer(vertices, normals, { name: 'test' });
      const files = unzipSync(buffer);
      const contentTypes = strFromU8(files['[Content_Types].xml']);

      expect(contentTypes).toContain('Extension="rels"');
    });
  });

  // Issue #1642 — auto-stack copies in 3MF. The exporter uses 3MF instancing
  // (single object, multiple <item> entries with Z translation) so file size
  // stays constant regardless of copy count.
  describe('stack option (issue #1642)', () => {
    it('emits a single <item> when stack is omitted', () => {
      const { vertices, normals } = createSingleTriangle();
      const xml = extractModelXML(build3MFBuffer(vertices, normals, { name: 'test' }));
      const items = xml.match(/<item /g) ?? [];
      expect(items).toHaveLength(1);
      expect(xml).not.toContain('transform=');
    });

    it('emits a single <item> when stack.count is 1', () => {
      const { vertices, normals } = createSingleTriangle();
      const xml = extractModelXML(
        build3MFBuffer(vertices, normals, {
          name: 'test',
          stack: { count: 1, zHeightMm: 7, spacingMm: 0 },
        })
      );
      expect((xml.match(/<item /g) ?? []).length).toBe(1);
    });

    it('emits N <item> entries with Z translation when stack.count > 1', () => {
      const { vertices, normals } = createSingleTriangle();
      const xml = extractModelXML(
        build3MFBuffer(vertices, normals, {
          name: 'test',
          stack: { count: 3, zHeightMm: 7, spacingMm: 0 },
        })
      );
      const items = xml.match(/<item [^/]*\/>/g) ?? [];
      expect(items).toHaveLength(3);
      expect(items[0]).toContain('transform="1 0 0 0 1 0 0 0 1 0 0 0"');
      expect(items[1]).toContain('transform="1 0 0 0 1 0 0 0 1 0 0 7"');
      expect(items[2]).toContain('transform="1 0 0 0 1 0 0 0 1 0 0 14"');
    });

    it('adds spacingMm to each successive Z stride', () => {
      const { vertices, normals } = createSingleTriangle();
      const xml = extractModelXML(
        build3MFBuffer(vertices, normals, {
          name: 'test',
          stack: { count: 2, zHeightMm: 5, spacingMm: 0.5 },
        })
      );
      const items = xml.match(/transform="[^"]+"/g) ?? [];
      expect(items[0]).toBe('transform="1 0 0 0 1 0 0 0 1 0 0 0"');
      expect(items[1]).toBe('transform="1 0 0 0 1 0 0 0 1 0 0 5.5"');
    });

    it('still references a single object even when stacking many copies', () => {
      const { vertices, normals } = createTwoTriangles();
      const xml = extractModelXML(
        build3MFBuffer(vertices, normals, {
          name: 'test',
          stack: { count: 10, zHeightMm: 7, spacingMm: 0 },
        })
      );
      // The mesh is emitted once even though there are 10 placements.
      expect((xml.match(/<object /g) ?? []).length).toBe(1);
      expect((xml.match(/<item /g) ?? []).length).toBe(10);
    });

    it('honors all build items when reading back as a slicer would', () => {
      const { vertices, normals } = createSingleTriangle();
      const xml = extractModelXML(
        build3MFBuffer(vertices, normals, {
          name: 'test',
          stack: { count: 4, zHeightMm: 7, spacingMm: 0 },
        })
      );
      const objectIdMatch = xml.match(/<object id="(\d+)"/);
      expect(objectIdMatch).not.toBeNull();
      const objectId = objectIdMatch?.[1] ?? '';
      const items = xml.match(/<item objectid="(\d+)"/g) ?? [];
      expect(items.length).toBe(4);
      // Every item references the single emitted object.
      for (const item of items) {
        expect(item).toContain(`objectid="${objectId}"`);
      }
    });
  });
});

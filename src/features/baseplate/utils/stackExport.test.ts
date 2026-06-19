import { describe, it, expect } from 'vitest';
import type { StackPrintParams } from '@/core/types';
import { mm } from '@/core/types';
import { buildStackExportSoup } from './stackExport';
import { meshBounds } from './stackPrint';

/** A single 10mm-tall plate as triangle soup: two triangles spanning Z 0..10. */
function platePlateSoup(): { vertices: Float32Array; normals: Float32Array } {
  const vertices = new Float32Array([
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    30,
    0, // bottom triangle
    0,
    0,
    10,
    20,
    0,
    10,
    0,
    30,
    10, // top triangle
  ]);
  const normals = new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  return { vertices, normals };
}

const airGap: StackPrintParams = { enabled: true, gapMm: mm(0.2) };

describe('buildStackExportSoup', () => {
  it('replicates a plate into N copies along Z', () => {
    const base = platePlateSoup();
    const out = buildStackExportSoup(base.vertices, base.normals, 3, airGap);
    // 2 triangles * 3 copies = 6 triangles = 54 floats
    expect(out.vertices.length).toBe(54);
    // stack spans 0 to 3 plates with 0.2 gaps: top copy max Z = 2*(10.2)+10 = 30.4
    const b = meshBounds(out.vertices);
    expect(b.minZ).toBeCloseTo(0, 4);
    expect(b.maxZ).toBeCloseTo(30.4, 4);
  });

  it('keeps the bottom plate upright (normals unchanged)', () => {
    const base = platePlateSoup();
    const out = buildStackExportSoup(base.vertices, base.normals, 1, airGap);
    const b = meshBounds(out.vertices);
    expect(b.minZ).toBeCloseTo(0, 4);
    expect(b.maxZ).toBeCloseTo(10, 4);
    // A lone plate prints right-side up — the downward normal stays downward.
    expect(out.normals[2]).toBeCloseTo(-1, 4);
  });

  it('flips every plate above the bottom one (normals inverted on copy 2+)', () => {
    const base = platePlateSoup();
    const out = buildStackExportSoup(base.vertices, base.normals, 2, airGap);
    // copy 0 (triangles 0-1) upright; copy 1 (triangles 2-3) flipped.
    // First vertex of the second copy starts at float index 18.
    expect(out.normals[2]).toBeCloseTo(-1, 4); // bottom plate: unchanged
    expect(out.normals[18 + 2]).toBeCloseTo(1, 4); // second plate: flipped
  });

  it('returns empty geometry for an empty base mesh', () => {
    const out = buildStackExportSoup(new Float32Array(0), new Float32Array(0), 4, airGap);
    expect(out.vertices.length).toBe(0);
  });

  it('threads bodyCenterY so a protruding-tongue plate seats squarely when flipped', () => {
    // Body Y[0,30] (centre 15) with a tongue tip protruding to Y=33. Without the
    // body centre the flipped copy would be dragged off-axis by the protrusion.
    const vertices = new Float32Array([
      0, 0, 0, 20, 0, 0, 0, 30, 0, 8, 33, 5, 12, 33, 5, 10, 30, 5,
    ]);
    const normals = new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const out = buildStackExportSoup(vertices, normals, 2, airGap, 15);
    // Second copy starts at float index 18; its tongue tip (vertex 3 → index 27+1)
    // mirrors about the body centre to the front edge (2*15 − 33 = −3), while the
    // body corners stay within Y[0,30].
    expect(out.vertices[18 + 9 + 1]).toBeCloseTo(-3, 4);
    expect(out.vertices[18 + 1]).toBeCloseTo(30, 4); // body corner Y 0 → 30
    expect(out.vertices[18 + 7]).toBeCloseTo(0, 4); // body corner Y 30 → 0
  });

  describe('triangle counts (parameterized)', () => {
    const PLATE_TRIS = 2;
    const cases: { name: string; copies: number; tris: number }[] = [
      { name: '1 copy', copies: 1, tris: 2 },
      { name: '3 copies', copies: 3, tris: 6 },
      { name: '5 copies', copies: 5, tris: 10 },
      { name: 'copies=0 treated as 1', copies: 0, tris: 2 },
      { name: 'fractional copies floored', copies: 3.9, tris: 6 },
    ];

    it.each(cases)('$name', ({ copies, tris }) => {
      const base = platePlateSoup();
      const out = buildStackExportSoup(base.vertices, base.normals, copies, airGap);
      const totalTris = out.vertices.length / 9;
      expect(totalTris).toBe(tris);
      expect(totalTris).toBe(PLATE_TRIS * Math.max(1, Math.floor(copies)));
    });
  });
});

import { describe, it, expect } from 'vitest';
import type { StackPrintParams } from '@/core/types';
import { mm } from '@/core/types';
import { buildStackExportSoup } from './stackExport';
import { meshBounds } from './stackPrint';

/** A single 10mm-tall plate as triangle soup: two stacked triangles spanning Z 0..10. */
function platePlateSoup(): { vertices: Float32Array; normals: Float32Array } {
  // One triangle at z=0, one at z=10 (enough to give a 10mm Z extent + XY footprint).
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

const airGap: StackPrintParams = { enabled: true, sets: 1, gapMm: mm(0.2), mode: 'airGap' };
const sheet: StackPrintParams = {
  enabled: true,
  sets: 1,
  gapMm: mm(0.2),
  mode: 'sacrificialSheet',
};

describe('buildStackExportSoup', () => {
  it('replicates a plate into N copies along Z (air gap, no material indices)', () => {
    const base = platePlateSoup();
    const out = buildStackExportSoup(base.vertices, base.normals, 3, airGap, {
      includeSheets: false,
    });
    // 2 triangles * 3 copies = 6 triangles = 54 floats
    expect(out.vertices.length).toBe(54);
    expect(out.materialIndices).toBeUndefined();
    // stack spans from 0 to 3 plates with 0.2 gaps: top copy max Z = 2*(10.2)+10 = 30.4
    const b = meshBounds(out.vertices);
    expect(b.minZ).toBeCloseTo(0, 4);
    expect(b.maxZ).toBeCloseTo(30.4, 4);
  });

  it('flips the plate upside down (normals inverted)', () => {
    const base = platePlateSoup();
    const out = buildStackExportSoup(base.vertices, base.normals, 1, airGap, {
      includeSheets: false,
    });
    // single copy stays in 0..10
    const b = meshBounds(out.vertices);
    expect(b.minZ).toBeCloseTo(0, 4);
    expect(b.maxZ).toBeCloseTo(10, 4);
    // the originally-downward normal (0,0,-1) becomes upward after the flip
    expect(out.normals[2]).toBeCloseTo(1, 4);
  });

  it('inserts N-1 sheets with material index 1 in sacrificial mode', () => {
    const base = platePlateSoup();
    const out = buildStackExportSoup(base.vertices, base.normals, 3, sheet, {
      includeSheets: true,
    });
    expect(out.materialIndices).toBeDefined();
    const plateTris = 2 * 3; // 6
    const sheetTris = 12 * 2; // 2 sheets * 12 triangles each
    expect(out.materialIndices!.length).toBe(plateTris + sheetTris);
    // plate triangles tagged 0, sheet triangles tagged 1
    expect(out.materialIndices!.slice(0, plateTris).every((m) => m === 0)).toBe(true);
    expect(out.materialIndices!.slice(plateTris).every((m) => m === 1)).toBe(true);
  });

  it('omits sheets when includeSheets is false even in sacrificial mode', () => {
    const base = platePlateSoup();
    const out = buildStackExportSoup(base.vertices, base.normals, 3, sheet, {
      includeSheets: false,
    });
    expect(out.materialIndices).toBeUndefined();
    expect(out.vertices.length).toBe(54); // plates only
  });

  // base plate = 2 triangles; each interface sheet = 12 triangles (a closed box).
  const PLATE_TRIS = 2;
  const SHEET_TRIS = 12;

  describe('triangle + material counts (parameterized)', () => {
    const cases: {
      name: string;
      copies: number;
      stack: StackPrintParams;
      includeSheets: boolean;
      plateTris: number; // expected plate triangles
      sheetTris: number; // expected sheet triangles (0 = no material indices)
    }[] = [
      {
        name: 'air gap, 1 copy',
        copies: 1,
        stack: airGap,
        includeSheets: false,
        plateTris: 2,
        sheetTris: 0,
      },
      {
        name: 'air gap, 3 copies',
        copies: 3,
        stack: airGap,
        includeSheets: false,
        plateTris: 6,
        sheetTris: 0,
      },
      {
        name: 'air gap ignores includeSheets',
        copies: 3,
        stack: airGap,
        includeSheets: true,
        plateTris: 6,
        sheetTris: 0,
      },
      {
        name: 'sheet mode but sheets off',
        copies: 3,
        stack: sheet,
        includeSheets: false,
        plateTris: 6,
        sheetTris: 0,
      },
      {
        name: 'sheet, 1 copy → no seams',
        copies: 1,
        stack: sheet,
        includeSheets: true,
        plateTris: 2,
        sheetTris: 0,
      },
      {
        name: 'sheet, 2 copies → 1 sheet',
        copies: 2,
        stack: sheet,
        includeSheets: true,
        plateTris: 4,
        sheetTris: 12,
      },
      {
        name: 'sheet, 5 copies → 4 sheets',
        copies: 5,
        stack: sheet,
        includeSheets: true,
        plateTris: 10,
        sheetTris: 48,
      },
      {
        name: 'copies=0 treated as 1',
        copies: 0,
        stack: airGap,
        includeSheets: false,
        plateTris: 2,
        sheetTris: 0,
      },
      {
        name: 'fractional copies floored',
        copies: 3.9,
        stack: airGap,
        includeSheets: false,
        plateTris: 6,
        sheetTris: 0,
      },
    ];

    it.each(cases)('$name', ({ copies, stack, includeSheets, plateTris, sheetTris }) => {
      const base = platePlateSoup();
      const out = buildStackExportSoup(base.vertices, base.normals, copies, stack, {
        includeSheets,
      });
      const totalTris = out.vertices.length / 9;
      expect(totalTris).toBe(plateTris + sheetTris);
      if (sheetTris > 0) {
        expect(out.materialIndices).toHaveLength(totalTris);
        // plate triangles tagged 0, sheet triangles tagged 1.
        expect(out.materialIndices!.filter((m) => m === 0)).toHaveLength(plateTris);
        expect(out.materialIndices!.filter((m) => m === 1)).toHaveLength(sheetTris);
      } else {
        expect(out.materialIndices).toBeUndefined();
      }
      // sanity: PLATE_TRIS-derived expectation matches the copies math.
      const n = Math.max(1, Math.floor(copies));
      expect(plateTris).toBe(PLATE_TRIS * n);
      expect(sheetTris).toBe(
        includeSheets && stack.mode === 'sacrificialSheet' && n >= 2 ? SHEET_TRIS * (n - 1) : 0
      );
    });

    it('returns empty geometry for an empty base mesh', () => {
      const out = buildStackExportSoup(new Float32Array(0), new Float32Array(0), 4, sheet, {
        includeSheets: true,
      });
      expect(out.vertices.length).toBe(0);
      expect(out.materialIndices).toBeUndefined();
    });
  });
});

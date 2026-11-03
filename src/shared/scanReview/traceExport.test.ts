import { describe, it, expect } from 'vitest';
import type { PathPoint } from '@/shared/types/bin';
import type { SceneShape } from '@/shared/scanTrace';
import type { CleanedTool } from './scanFlow';
import {
  SCAN_CLEARANCE_MM,
  toolsFromShapes,
  traceDxf,
  traceExportBlob,
  traceSvg,
} from './traceExport';

const pt = (x: number, y: number, extra: Partial<PathPoint> = {}): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
  ...extra,
});

const square = (x: number, y: number, size: number): PathPoint[] => [
  pt(x, y),
  pt(x + size, y),
  pt(x + size, y + size),
  pt(x, y + size),
];

/** A 10 mm square with a 4 mm square island, traced 20 mm in and 30 mm down. */
const RING: CleanedTool = { path: square(20, 30, 10), holes: [square(23, 33, 4)] };
/** A 6 mm square further down the photo, so lower once Y is up. */
const LOWER: CleanedTool = { path: square(20, 50, 6), holes: [] };

const AS_TRACED = { clearance: false, thicknessMm: 10 };
const CLEARED = { clearance: true, thicknessMm: 10 };

/** Each POLYLINE's vertices in a DXF, by layer. */
function dxfRings(dxf: string): Map<string, { x: number; y: number }[][]> {
  const lines = dxf.split('\n').map((l) => l.trim());
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([lines[i], lines[i + 1]]);
  const rings = new Map<string, { x: number; y: number }[][]>();
  let ring: { x: number; y: number }[] | null = null;
  let vertex: { x?: number; layer?: string } | null = null;
  for (const [code, value] of pairs) {
    if (code === '0') {
      vertex = value === 'VERTEX' ? {} : null;
      if (value === 'POLYLINE') ring = [];
      if (value === 'SEQEND') ring = null;
    } else if (vertex && code === '8') vertex.layer = value;
    else if (vertex && code === '10') vertex.x = Number(value);
    else if (vertex && code === '20' && ring && vertex.layer && vertex.x !== undefined) {
      const layer = vertex.layer;
      if (ring.length === 0) rings.set(layer, [...(rings.get(layer) ?? []), ring]);
      ring.push({ x: vertex.x, y: Number(value) });
    }
  }
  return rings;
}

const extent = (ring: readonly { x: number; y: number }[]) => {
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

/** The triangles of a binary STL, as vertex triples. */
function stlTriangles(buffer: ArrayBuffer): number[][][] {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const triangles: number[][][] = [];
  for (let t = 0; t < count; t++) {
    const base = 84 + t * 50 + 12;
    const at = (k: number) => view.getFloat32(base + k * 4, true);
    triangles.push([0, 1, 2].map((v) => [at(v * 3), at(v * 3 + 1), at(v * 3 + 2)]));
  }
  return triangles;
}

describe('toolsFromShapes', () => {
  const shape: SceneShape = {
    imagePoints: [],
    outputPoints: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ],
    holes: [
      {
        imagePoints: [],
        outputPoints: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 2, y: 2 },
        ],
      },
    ],
  };

  it('keeps a shape’s holes as islands only when asked', () => {
    expect(toolsFromShapes([shape], true)[0].holes).toHaveLength(1);
    expect(toolsFromShapes([shape], false)[0]).toEqual({
      path: [pt(0, 0), pt(5, 0), pt(5, 5)],
      holes: [],
    });
  });
});

describe('traceSvg', () => {
  it('is sized in millimetres round the tools, with a 2 mm margin, one even-odd path a tool', () => {
    const svg = traceSvg([RING, LOWER], AS_TRACED);
    // The tools span 10 by 26 mm.
    expect(svg).toContain('width="14mm" height="30mm" viewBox="0 0 14 30"');
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('M 2 2 L 12 2 L 12 12 L 2 12 Z M 5 5 L 9 5 L 9 9 L 5 9 Z');
  });

  it('keeps curves as curves when drawn as traced', () => {
    const curved: CleanedTool = {
      path: [pt(0, 0, { handleOut: { dx: 5, dy: -3 } }), pt(10, 0), pt(10, 10), pt(0, 10)],
      holes: [],
    };
    expect(traceSvg([curved], AS_TRACED)).toContain(' C ');
  });

  it('grows each outline by the clearance', () => {
    const grown = 10 + 2 * SCAN_CLEARANCE_MM + 4;
    expect(traceSvg([RING], CLEARED)).toContain(`width="${grown}mm"`);
  });
});

describe('traceDxf', () => {
  it('puts each tool on a layer of its own, Y up from the origin', () => {
    const rings = dxfRings(traceDxf([RING, LOWER], AS_TRACED));
    expect([...rings.keys()]).toEqual(['TOOL_1', 'TOOL_2']);
    const [outline, island] = rings.get('TOOL_1') ?? [];
    expect(extent(outline)).toEqual({ minX: 0, maxX: 10, minY: 16, maxY: 26 });
    expect(extent(island)).toEqual({ minX: 3, maxX: 7, minY: 19, maxY: 23 });
    // Lower in the photo, so nearer the origin once Y is up.
    expect(extent((rings.get('TOOL_2') ?? [])[0])).toEqual({ minX: 0, maxX: 6, minY: 0, maxY: 6 });
  });

  it('grows the outline and shrinks the island by the clearance', () => {
    const [outline, island] = dxfRings(traceDxf([RING], CLEARED)).get('TOOL_1') ?? [];
    const c = SCAN_CLEARANCE_MM;
    const o = extent(outline);
    const i = extent(island);
    expect(o.maxX - o.minX).toBeCloseTo(10 + 2 * c);
    expect(i.maxX - i.minX).toBeCloseTo(4 - 2 * c);
  });
});

describe('the STL', () => {
  async function solid(tools: readonly CleanedTool[]) {
    const built = await traceExportBlob(tools, 'stl', AS_TRACED);
    if (!built.ok) throw new Error('the STL was not built');
    return stlTriangles(await built.value.arrayBuffer());
  }

  // Two squares meeting at one corner, traced as one outline through it.
  const PINCHED: CleanedTool = {
    path: [pt(0, 0), pt(5, 0), pt(5, 5), pt(10, 5), pt(10, 10), pt(5, 10), pt(5, 5), pt(0, 5)],
    holes: [],
  };

  // A square with a bay cut in from one corner, the outline running round
  // the bay and back through that corner.
  const BAYED: CleanedTool = {
    path: [pt(0, 0), pt(2, 4), pt(4, 2), pt(0, 0), pt(10, 0), pt(10, 10), pt(0, 10)],
    holes: [],
  };
  // A 20 mm square whose 10 mm island has a sliver of tool, 6 mm², pinched
  // off inside it at one corner.
  const ISLAND_BAY: CleanedTool = {
    path: square(0, 0, 20),
    holes: [[pt(5, 5), pt(7, 9), pt(9, 7), pt(5, 5), pt(15, 5), pt(15, 15), pt(5, 15)]],
  };

  it.each([
    ['two tools, one with an island', [RING, LOWER]],
    ['an outline that pinches at a point', [PINCHED]],
    ['an outline pinched round a bay', [BAYED]],
    ['an island pinched round tool left in it', [ISLAND_BAY]],
  ])(
    'is closed: every edge meets one other triangle, running the other way (%s)',
    async (_, tools) => {
      const key = (p: number[]) => p.map((v) => v.toFixed(5)).join(',');
      const edges = new Map<string, number>();
      for (const tri of await solid(tools)) {
        for (let k = 0; k < 3; k++) {
          const edge = `${key(tri[k])}>${key(tri[(k + 1) % 3])}`;
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      for (const [edge, count] of edges) {
        const [a, b] = edge.split('>');
        expect(count).toBe(1);
        expect(edges.get(`${b}>${a}`)).toBe(1);
      }
    }
  );

  it.each([
    ['as traced', RING],
    [
      'wound the other way',
      { path: [...RING.path].reverse(), holes: [[...RING.holes[0]].reverse()] },
    ],
  ])('extrudes each tool to the thickness, its island open through it (%s)', async (_, tool) => {
    const triangles = await solid([tool]);
    const zs = triangles.flat().map((p) => p[2]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([0, 10]);
    // Outward normals give a positive volume: (100 - 16) mm² over 10 mm.
    const volume = triangles.reduce((sum, [a, b, c]) => {
      const cross = [
        b[1] * c[2] - b[2] * c[1],
        b[2] * c[0] - b[0] * c[2],
        b[0] * c[1] - b[1] * c[0],
      ];
      return sum + (a[0] * cross[0] + a[1] * cross[1] + a[2] * cross[2]) / 6;
    }, 0);
    expect(volume).toBeCloseTo(840, 3);
  });

  it('keeps the tool an island pinches off inside itself', async () => {
    const triangles = await solid([ISLAND_BAY]);
    const volume = triangles.reduce((sum, [a, b, c]) => {
      const cross = [
        b[1] * c[2] - b[2] * c[1],
        b[2] * c[0] - b[0] * c[2],
        b[0] * c[1] - b[1] * c[0],
      ];
      return sum + (a[0] * cross[0] + a[1] * cross[1] + a[2] * cross[2]) / 6;
    }, 0);
    // (400 - 100 + 6) mm² over 10 mm.
    expect(volume).toBeCloseTo(3060, 0);
  });

  it('refuses an STL with no thickness, which would write an unreadable file', async () => {
    const built = await traceExportBlob([RING], 'stl', {
      clearance: false,
      thicknessMm: Number.NaN,
    });
    expect(built.ok).toBe(false);
  });
});

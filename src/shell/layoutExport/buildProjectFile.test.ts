// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import {
  buildLayoutProjectFile,
  createProjectPartCollector,
  footprintOf,
} from './buildProjectFile';
import { plateOrigin, LOGICAL_PLATE_GAP } from './platePacking';
import type { ThreeMFObject, ThreeMFPrintSettings } from '@/shared/generation/export';

const BED = 256;

const PRINT: ThreeMFPrintSettings = {
  layerHeight: 0.2,
  infillPercent: 15,
  material: 'PLA',
  supportRequired: false,
  estimatedMinutes: 0,
  estimatedGrams: 0,
};

/** Flat square part of `size` mm, sitting at the origin. */
function part(name: string, size: number, extra?: Partial<ThreeMFObject>): ThreeMFObject {
  const v = new Float32Array([
    0,
    0,
    0,
    size,
    0,
    0,
    size,
    size,
    0,
    0,
    0,
    0,
    size,
    size,
    0,
    0,
    size,
    0,
  ]);
  const n = new Float32Array(Array.from({ length: 18 }, (_, i) => (i % 3 === 2 ? 1 : 0)));
  return { vertices: v, normals: n, name, ...extra };
}

/** Minimal binary STL with one triangle, for the collector. */
function binaryStl(): ArrayBuffer {
  const buf = new ArrayBuffer(84 + 50);
  const view = new DataView(buf);
  view.setUint32(80, 1, true);
  const coords = [0, 0, 1, 0, 0, 0, 10, 0, 0, 10, 10, 0];
  coords.forEach((c, i) => view.setFloat32(84 + i * 4, c, true));
  return buf;
}

const opts = { name: 'layout', bedWidthMm: BED, bedDepthMm: BED, printSettings: PRINT };

async function filesOf(parts: readonly ThreeMFObject[]) {
  const result = await buildLayoutProjectFile(parts, opts);
  if (!result) throw new Error('expected a project file');
  const files = unzipSync(new Uint8Array(result.data));
  return {
    result,
    model: strFromU8(files['3D/3dmodel.model']),
    settings: strFromU8(files['Metadata/model_settings.config'] ?? new Uint8Array()),
  };
}

describe('footprintOf', () => {
  it('measures the XY bounding box and ignores Z', () => {
    expect(footprintOf(new Float32Array([0, 0, 0, 30, 10, 99, 5, 4, -7]))).toEqual({
      widthMm: 30,
      depthMm: 10,
    });
  });

  it('returns a zero footprint for an empty mesh', () => {
    expect(footprintOf(new Float32Array([]))).toEqual({ widthMm: 0, depthMm: 0 });
  });
});

describe('createProjectPartCollector', () => {
  it('parses STL parts and keeps their name', () => {
    const c = createProjectPartCollector();
    c.addStl('bin-a', binaryStl());
    expect(c.parts).toHaveLength(1);
    expect(c.parts[0].name).toBe('bin-a');
    expect(c.parts[0].vertices.length).toBe(9);
  });

  it('skips an unparseable payload instead of throwing', () => {
    const c = createProjectPartCollector();
    c.addStl('broken', new ArrayBuffer(4));
    expect(c.parts).toHaveLength(0);
  });

  it('takes pre-coloured objects as they are', () => {
    const c = createProjectPartCollector();
    const coloured = part('lid', 20, {
      colorConfig: { materials: [{ color: '#ff0000' }], triangleMaterialIndices: [0, 0] },
    });
    c.addObjects([coloured]);
    expect(c.parts[0].colorConfig).toBe(coloured.colorConfig);
  });
});

describe('buildLayoutProjectFile', () => {
  it('returns null when there is nothing to place', async () => {
    expect(await buildLayoutProjectFile([], opts)).toBeNull();
  });

  it('returns null when every part is empty geometry', async () => {
    const empty: ThreeMFObject = {
      vertices: new Float32Array([]),
      normals: new Float32Array([]),
      name: 'empty',
    };
    expect(await buildLayoutProjectFile([empty], opts)).toBeNull();
  });

  it('puts a small set on one plate', async () => {
    const { result, settings } = await filesOf([part('a', 40), part('b', 40)]);
    expect(result.plateCount).toBe(1);
    expect(result.partCount).toBe(2);
    expect(settings.match(/<plate>/g) ?? []).toHaveLength(1);
  });

  it('preserves a part colour config through packing', async () => {
    // Packing must not flatten multi-colour designs: the config survives into
    // the per-object extruder assignment in the sidecar.
    const { settings } = await filesOf([
      part('a', 40),
      part('lid', 40, {
        colorConfig: {
          materials: [{ color: '#101010' }, { color: '#ff0000' }],
          triangleMaterialIndices: [1, 1],
        },
      }),
    ]);
    expect(settings).toContain('<metadata key="name" value="lid"/>');
    expect(settings).toContain('<metadata key="extruder" value="2"/>');
  });

  it('agrees between plate assignment and world transform', async () => {
    // THE invariant: a part drawn outside the plate it is assigned to shows up
    // in the slicer floating off its bed. Both come from the same packing, so
    // this pins them together.
    const parts = Array.from({ length: 30 }, (_, i) => part(`p${i}`, 60));
    const { result, model, settings } = await filesOf(parts);
    expect(result.plateCount).toBeGreaterThan(1);

    // object id -> plate index, read back from the sidecar.
    const assigned = new Map<number, number>();
    settings
      .split('<plate>')
      .slice(1)
      .forEach((block) => {
        const plateId = Number(block.match(/plater_id" value="(\d+)"/)?.[1]);
        for (const m of block.matchAll(/object_id" value="(\d+)"/g)) {
          assigned.set(Number(m[1]), plateId - 1);
        }
      });
    expect(assigned.size).toBe(parts.length);

    const items = [
      ...model.matchAll(/<item objectid="(\d+)" transform="[^"]*?([-\d.]+) ([-\d.]+) [-\d.]+"/g),
    ];
    expect(items).toHaveLength(parts.length);

    for (const item of items) {
      const id = Number(item[1]);
      const plate = assigned.get(id);
      expect(plate, `object ${id} has no plate`).toBeDefined();
      const origin = plateOrigin(plate ?? 0, result.plateCount, BED, BED);
      // The transform carries the part's min corner, so its centre is +30mm.
      const cx = Number(item[2]) + 30;
      const cy = Number(item[3]) + 30;
      expect(cx).toBeGreaterThanOrEqual(origin.x);
      expect(cx).toBeLessThanOrEqual(origin.x + BED);
      expect(cy).toBeGreaterThanOrEqual(origin.y);
      expect(cy).toBeLessThanOrEqual(origin.y + BED);
    }
  });

  it('strides plates by the slicer gap so they do not overlap', async () => {
    const parts = Array.from({ length: 30 }, (_, i) => part(`p${i}`, 60));
    const { result, model } = await filesOf(parts);
    const xs = [
      ...model.matchAll(/<item objectid="\d+" transform="[^"]*?([-\d.]+) [-\d.]+ [-\d.]+"/g),
    ].map((m) => Number(m[1]));
    // Something must land beyond the first bed, on the second column.
    expect(Math.max(...xs)).toBeGreaterThan(BED * (1 + LOGICAL_PLATE_GAP) - 1);
    expect(result.plateCount).toBeGreaterThan(1);
  });

  it('reports parts too large for the bed by name', async () => {
    const { result } = await filesOf([part('normal', 40), part('enormous', 400)]);
    expect(result.oversizeNames).toEqual(['enormous']);
  });
});

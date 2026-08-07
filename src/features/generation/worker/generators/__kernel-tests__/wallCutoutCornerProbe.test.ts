// @vitest-environment node
/**
 * Diagnostic (not a CI gate): locate leftover wall material at the ends of a
 * full-width wall cutout — the "pointy artifact in the corner" reported on a
 * 100% cutout.
 *
 * Probes the EXPORT mesh: `verticalSolidSpans` needs the single fused solid,
 * since the preview path concatenates a separately-meshed base socket and the
 * coincident faces break enter/exit pairing.
 */
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { verticalSolidSpans, boundingBox } from './meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';
import type * as BinExporterModule from '../binExporter';

let exportBin: typeof BinExporterModule.exportBin;

const WT = DEFAULT_BIN_PARAMS.wallThickness;

function parseBinaryStl(data: ArrayBuffer | Uint8Array): MeshData {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(80, true);
  const vertices = new Float32Array(count * 9);
  const indices = new Uint32Array(count * 3);
  for (let t = 0; t < count; t++) {
    const base = 84 + t * 50 + 12;
    for (let v = 0; v < 3; v++) {
      const o = base + v * 12;
      vertices[t * 9 + v * 3] = view.getFloat32(o, true);
      vertices[t * 9 + v * 3 + 1] = view.getFloat32(o + 4, true);
      vertices[t * 9 + v * 3 + 2] = view.getFloat32(o + 8, true);
      indices[t * 3 + v] = t * 3 + v;
    }
  }
  return { vertices, indices } as MeshData;
}

function frontWallProfile(mesh: MeshData, label: string): void {
  const verts = mesh.vertices;
  if (!verts) throw new Error('no vertices');
  const bb = boundingBox(verts);
  const y = bb.minY + WT / 2;
  const innerW = bb.maxX - bb.minX - 2 * WT;

  // eslint-disable-next-line no-console
  console.log(
    `\n=== ${label}  Z[${bb.minZ.toFixed(2)},${bb.maxZ.toFixed(2)}] ` +
      `innerW=${innerW.toFixed(2)} probeY=${y.toFixed(2)}`
  );

  const rows: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = -innerW / 2 + (innerW * i) / 40;
    const spans = verticalSolidSpans(mesh, x, y);
    const top = spans.length > 0 ? Math.max(...spans.map(([, to]) => to)) : 0;
    rows.push(`x=${x.toFixed(2).padStart(7)}  top=${top.toFixed(2).padStart(6)}`);
  }
  // eslint-disable-next-line no-console
  console.log(rows.join('\n'));
}

describe('wall cutout corner probe', () => {
  beforeAll(async () => {
    await initBrepjs();
    exportBin = (await import('../binExporter')).exportBin;
  }, 120_000);

  it('reports leftover material across a full-width front cutout', async () => {
    for (const width of [100, 90]) {
      const result = await exportBin(
        buildParams({
          width: 2,
          depth: 2,
          height: 5,
          walls: {
            ...DEFAULT_BIN_PARAMS.walls,
            enabled: true,
            shape: 'u-shape',
            width: 0,
            depth: 0,
            front: { ...DISABLED_WALL_CUTOUT, enabled: true, width, depth: 60 },
            back: DISABLED_WALL_CUTOUT,
            left: DISABLED_WALL_CUTOUT,
            right: DISABLED_WALL_CUTOUT,
            interior: DISABLED_WALL_CUTOUT,
          },
        }),
        'stl'
      );
      frontWallProfile(parseBinaryStl(result.data), `width=${width}% depth=60%`);
    }
  }, 300_000);
});

// @vitest-environment node
/**
 * Diagnostic (not a CI gate): for every kumiko scenario, report the exported
 * STL's boundary/non-manifold edge counts ALONGSIDE the B-Rep's own face mix
 * and validation state, and dump the exported solid as an arena `.bin`.
 *
 * The point is to discriminate the two roots behind an identical
 * export-integrity failure: a genuinely open B-Rep versus a tessellation crack
 * on a B-Rep that is already watertight. Replay the dumped `.bin` with
 * `cargo run --release --example solid_watertight_report -p brepkit-io`.
 *
 * Results go to a FILE — the vitest forks pool swallows console.log.
 */
import { describe, it, beforeAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { isOk } from '@/core/result';
import { initBrepjs } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { getRawBrepkitKernel, getSolidId } from './dualKernelInit';
import { clearAllCaches, setLastSolid, getLastSolid } from '../shapeCache';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { kumiko } from '../scenarios/kumiko';

const OUT_DIR = process.env.DIAG_OUT ?? '/tmp/kumiko-diag';
const ONLY = process.env.ONLY ?? '';

beforeAll(async () => {
  await initBrepjs();
  mkdirSync(OUT_DIR, { recursive: true });
}, 120_000);

interface MeshStats {
  triangleCount: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  boundarySamples: string[];
}

function analyze(stl: ArrayBuffer): MeshStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;
  const Q = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * Q) / Q},${Math.round(y * Q) / Q},${Math.round(z * Q) / Q}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeCount = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const b = t * 9;
    const k = [
      vKey(vertices[b], vertices[b + 1], vertices[b + 2]),
      vKey(vertices[b + 3], vertices[b + 4], vertices[b + 5]),
      vKey(vertices[b + 6], vertices[b + 7], vertices[b + 8]),
    ];
    for (let i = 0; i < 3; i++) {
      const key = eKey(k[i], k[(i + 1) % 3]);
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }
  const boundary = [...edgeCount.entries()].filter(([, c]) => c === 1);
  return {
    triangleCount,
    boundaryEdges: boundary.length,
    nonManifoldEdges: [...edgeCount.values()].filter((c) => c > 2).length,
    boundarySamples: boundary.slice(0, 12).map(([k]) => k),
  };
}

describe('kumiko boundary diagnostic', () => {
  for (const scenario of kumiko) {
    const label = `${scenario.category} › ${scenario.name}`;
    if (ONLY && !label.includes(ONLY)) continue;
    it(
      label,
      async () => {
        clearAllCaches();
        setLastSolid(null);
        const rec: Record<string, unknown> = { label };
        const started = Date.now();
        try {
          const { exportBin } = await import('../binExporter');
          const result = await exportBin(buildParams(scenario.params), 'stl');
          rec.ms = Date.now() - started;
          Object.assign(rec, analyze(result.data));

          const solid = getLastSolid();
          if (solid) {
            const raw = getRawBrepkitKernel() as unknown as {
              getEntityCounts(id: number): number[];
              validateSolid(id: number): number;
              validateSolidRelaxed(id: number): number;
              getSolidFaces(id: number): Iterable<number>;
              getSurfaceType(id: number): string;
              serializeSolid(id: number): Uint8Array;
            };
            const sid = getSolidId(solid);
            const [f, e, v] = raw.getEntityCounts(sid);
            rec.brep = { faces: f, edges: e, vertices: v, euler: v - e + f };
            try {
              rec.validateStrict = raw.validateSolid(sid);
            } catch (err) {
              rec.validateStrict = `threw: ${String(err)}`;
            }
            try {
              rec.validateRelaxed = raw.validateSolidRelaxed(sid);
            } catch (err) {
              rec.validateRelaxed = `threw: ${String(err)}`;
            }
            const mix: Record<string, number> = {};
            for (const fid of raw.getSolidFaces(sid)) {
              try {
                const t = raw.getSurfaceType(fid);
                mix[t] = (mix[t] ?? 0) + 1;
              } catch {
                mix.unknown = (mix.unknown ?? 0) + 1;
              }
            }
            rec.faceMix = mix;
            try {
              const bin = raw.serializeSolid(sid);
              const file = join(OUT_DIR, `${scenario.name.replace(/[^a-z0-9]+/gi, '_')}.bin`);
              writeFileSync(file, Buffer.from(bin));
              rec.bin = file;
            } catch (err) {
              rec.bin = `serialize failed: ${String(err)}`;
            }
          } else {
            rec.brep = 'no lastSolid';
          }
        } catch (err) {
          rec.ms = Date.now() - started;
          rec.error = String(err);
        }
        writeFileSync(
          join(OUT_DIR, `${scenario.name.replace(/[^a-z0-9]+/gi, '_')}.json`),
          JSON.stringify(rec, null, 2)
        );
      },
      600_000
    );
  }
});

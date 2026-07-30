// @vitest-environment node
/**
 * Diagnostic (not a CI gate): capture the goma corner-wedge `cutAll` operands
 * as arena `.bin` files for native replay.
 *
 * Chases the residual GFA rejections in the goma export: ~85% of them read
 * `0 unclosed wires, 0 non-manifold edges, and 3 free boundary edges` on
 * results of 7-10 faces, i.e. tiny per-strut cuts inside a `cutAll`.
 *
 * `cutAll` is wrapped rather than the tool's source being edited, so this stays
 * non-invasive on a repo other sessions modify. Only the CORNER path is
 * captured: its region is the revolve-built wedge and therefore carries
 * cylinder faces, while the flat-wall path's region is an all-planar slab
 * prism. That surface-type test is the discriminator.
 *
 * Existing captures are pre-fix; replaying those is the documented GIGO trap,
 * which is why this re-captures from the current build.
 *
 * Replay:
 *   CAPTURE_DIR=<dir> PREFIX=corner0 RAW=1 TOOL=<i> \
 *     cargo run --release --example replay_cut_capture -p brepkit-io
 */
import { describe, it, beforeAll, vi } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { initBrepjs } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches, setLastSolid } from '../shapeCache';

const OUT_DIR =
  process.env.CAPTURE_DIR ??
  join(process.env.HOME ?? '/tmp', '.cache/brepkit-parity-captures/2026-07-30/kumiko-corner-fresh');
const MAX_CALLS = Number(process.env.MAX_CALLS ?? '6');

interface CallRec {
  call: number;
  regionFaces: number;
  regionMix: Record<string, number>;
  toolCount: number;
  toolFaces: number[];
  captured: boolean;
}
const manifest: { calls: CallRec[]; totalCutAll: number; cornerCutAll: number } = {
  calls: [],
  totalCutAll: 0,
  cornerCutAll: 0,
};

vi.mock('brepjs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const realCutAll = actual.cutAll as (...a: unknown[]) => unknown;
  return {
    ...actual,
    cutAll: (region: unknown, tools: unknown[], opts: unknown): unknown => {
      manifest.totalCutAll += 1;
      try {
        // Take the kernel from brepjs's own export rather than importing
        // dualKernelInit here — that module imports brepjs, so pulling it in
        // from inside brepjs's mock factory would close a cycle.
        const getKernel = actual.getKernel as (n: string) => { oc: unknown };
        const raw = getKernel('brepkit').oc as {
          getSolidFaces(id: number): Iterable<number>;
          getSurfaceType(id: number): string;
          getEntityCounts(id: number): number[];
          serializeSolid(id: number): Uint8Array;
        };
        const solidIdOf = (s: unknown): number => (s as { wrapped: { id: number } }).wrapped.id;
        const rid = solidIdOf(region);
        const mix: Record<string, number> = {};
        for (const fid of raw.getSolidFaces(rid)) {
          try {
            const t = raw.getSurfaceType(fid);
            mix[t] = (mix[t] ?? 0) + 1;
          } catch {
            mix.unknown = (mix.unknown ?? 0) + 1;
          }
        }
        const regionFaces = raw.getEntityCounts(rid)[0];
        // The corner region is the revolve-built wedge (has cylinders); the
        // flat-wall region is an all-planar slab prism.
        const isCorner = (mix.cylinder ?? 0) > 0;
        const rec: CallRec = {
          call: manifest.totalCutAll,
          regionFaces,
          regionMix: mix,
          toolCount: tools.length,
          toolFaces: [],
          captured: false,
        };
        if (isCorner) {
          manifest.cornerCutAll += 1;
          if (manifest.cornerCutAll <= MAX_CALLS) {
            const n = manifest.cornerCutAll - 1;
            mkdirSync(OUT_DIR, { recursive: true });
            writeFileSync(
              join(OUT_DIR, `corner${n}-base.bin`),
              Buffer.from(raw.serializeSolid(rid))
            );
            tools.forEach((t, i) => {
              const tid = solidIdOf(t);
              rec.toolFaces.push(raw.getEntityCounts(tid)[0]);
              writeFileSync(
                join(OUT_DIR, `corner${n}-tool${i}.bin`),
                Buffer.from(raw.serializeSolid(tid))
              );
            });
            rec.captured = true;
          }
        }
        manifest.calls.push(rec);
      } catch (e) {
        manifest.calls.push({
          call: manifest.totalCutAll,
          regionFaces: -1,
          regionMix: { error: 1 },
          toolCount: Array.isArray(tools) ? tools.length : -1,
          toolFaces: [],
          captured: false,
        });

        console.error(`[capture] failed on call ${manifest.totalCutAll}: ${String(e)}`);
      }
      return realCutAll(region, tools, opts);
    },
  };
});

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('kumiko corner capture', () => {
  it('captures corner-wedge cutAll operands', async () => {
    clearAllCaches();
    setLastSolid(null);
    let err = '';
    const started = Date.now();
    try {
      const { exportBin } = await import('../binExporter');
      await exportBin(
        buildParams({
          width: 1,
          depth: 1,
          height: 6,
          wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, pattern: 'goma' },
        }),
        'stl'
      );
    } catch (e) {
      err = String(e);
    }
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      join(OUT_DIR, 'manifest.json'),
      JSON.stringify({ ...manifest, ms: Date.now() - started, err, outDir: OUT_DIR }, null, 2)
    );
  }, 1_800_000);
});

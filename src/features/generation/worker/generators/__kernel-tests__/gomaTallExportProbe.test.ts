// @vitest-environment node
/**
 * Opt-in reproduction of the production export trap: a 4x4x36 goma@0.5 bin
 * with handles on a flat base traps inside occt-wasm ("table index is out of bounds" in production,
 * "memory access out of bounds" under Node) during tessellation. The heap
 * enters the merge stage at ~2.1 GB and hits the 4 GB wasm32 ceiling there,
 * on 4.3.2 and 4.4.0 alike, and the preview-tolerance pass fails the same
 * way: the design needs more memory than a wasm32 kernel can address. Run it
 * against a candidate kernel build (or after a pipeline change that lowers
 * memory) to check whether the export fits:
 *
 *   OCCT_WASM_DIR=/path/to/occt-wasm PROBE_ONLY_TALL=1 \
 *     pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/gomaTallExportProbe
 *
 * Besides the pass/fail it reports heap growth per stage and the C-stack
 * low-water mark (the unused stack is painted with a sentinel before each
 * generation), which ruled stack overflow out: every size peaks at the same
 * ~48 KB of the 64 KB Emscripten default.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import type { BinParams } from '@/shared/types/bin';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_HANDLE_CONFIG,
  DEFAULT_WALL_PATTERN_CONFIG,
} from '@/features/bin-designer/constants/defaults';
import { PerfCollector } from '../pipeline/perfCollector';
import { EXPORT_ANGULAR_TOLERANCE_RAD, EXPORT_TOLERANCE } from '../utils/tolerances';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import type * as BinGeneratorModule from '../binGenerator';
import type * as StlModule from '../utils/stlMeshFallback';
import type * as CacheModule from '../shapeCache';
import type * as OcctWasmModule from 'occt-wasm';

// The Emscripten default STACK_SIZE (64 KB). The stack grows DOWN from the
// module's __stack_pointer initial value, which is read from the binary at
// init so the probe works on any occt-wasm build.
const STACK_SIZE = 65_536;
let SP_INIT = 0;
let STACK_LOW = 0;
let PAINT_TOP = 0;
const SENTINEL = 0xdeadbeef;
const GUARD_BYTES = 8_192;

function readStackPointerInit(wasm: Uint8Array): number {
  let pos = 8;
  const leb = (): number => {
    let r = 0;
    let s = 0;
    for (;;) {
      const b = wasm[pos++];
      r |= (b & 0x7f) << s;
      s += 7;
      if (!(b & 0x80)) return r >>> 0;
    }
  };
  const sleb = (): number => {
    let r = 0;
    let s = 0;
    for (;;) {
      const b = wasm[pos++];
      r |= (b & 0x7f) << s;
      s += 7;
      if (!(b & 0x80)) return b & 0x40 ? r - (1 << s) : r;
    }
  };
  while (pos < wasm.length) {
    const id = wasm[pos++];
    const size = leb();
    const end = pos + size;
    if (id === 6) {
      leb();
      pos += 2;
      if (wasm[pos++] !== 0x41) throw new Error('global 0 is not i32.const');
      return sleb();
    }
    pos = end;
  }
  throw new Error('no global section');
}

let heapU32: () => Uint32Array;
let generateBin: typeof BinGeneratorModule.generateBin;
let exportSolidToStl: typeof StlModule.exportSolidToStl;
let getLastSolid: typeof CacheModule.getLastSolid;
let setLastSolid: typeof CacheModule.setLastSolid;
let clearAllCaches: typeof CacheModule.clearAllCaches;

function log(msg: string): void {
  process.stdout.write(`[probe ${new Date().toISOString()}] ${msg}\n`);
}

function paintStack(): Uint32Array {
  const h = heapU32();
  for (let i = STACK_LOW >>> 2; i < PAINT_TOP >>> 2; i++) h[i] = SENTINEL;
  return h.slice((STACK_LOW - GUARD_BYTES) >>> 2, STACK_LOW >>> 2);
}

function readLowWater(guardBefore: Uint32Array): string {
  const h = heapU32();
  let firstDirty = PAINT_TOP >>> 2;
  for (let i = STACK_LOW >>> 2; i < PAINT_TOP >>> 2; i++) {
    if (h[i] !== SENTINEL) {
      firstDirty = i;
      break;
    }
  }
  const usedBytes = SP_INIT - firstDirty * 4;
  const guardAfter = h.slice((STACK_LOW - GUARD_BYTES) >>> 2, STACK_LOW >>> 2);
  let guardDiff = 0;
  for (let i = 0; i < guardBefore.length; i++) if (guardBefore[i] !== guardAfter[i]) guardDiff++;
  const overflowed = firstDirty === STACK_LOW >>> 2;
  return `stack used ${usedBytes} / ${STACK_SIZE} bytes (${((100 * usedBytes) / STACK_SIZE).toFixed(1)}%)${overflowed ? ' OVERFLOWED (painted region fully consumed)' : ''}; data words changed in 8 KB below stack: ${guardDiff}`;
}

function gomaBin(width: number, depth: number, height: number, handles: boolean): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width,
    depth,
    height,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    handles: { ...DEFAULT_HANDLE_CONFIG, enabled: handles },
    wallPattern: { ...DEFAULT_WALL_PATTERN_CONFIG, enabled: true, pattern: 'goma', scale: 0.5 },
  };
}

function describeError(e: unknown): string {
  const isTrap = e instanceof WebAssembly.RuntimeError;
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const cause =
    e instanceof Error && e.cause instanceof Error ? ` | cause: ${e.cause.message}` : '';
  return `${msg}${cause} | wasmTrap=${isTrap}`;
}

async function runCase(name: string, params: BinParams): Promise<number> {
  clearAllCaches();
  setLastSolid(null);
  const perf = new PerfCollector();
  let lastStage = '';
  const t0 = performance.now();
  const guard = paintStack();
  log(`${name}: generating (forExport)`);
  try {
    const mesh = generateBin(
      params,
      (stage, p) => {
        if (stage !== lastStage) {
          lastStage = stage;
          log(
            `  stage=${stage} p=${p.toFixed(2)} t=${((performance.now() - t0) / 1000).toFixed(1)}s heapMB=${(heapU32().byteLength / 1048576).toFixed(0)}`
          );
        }
      },
      true,
      undefined,
      perf
    );
    const total = performance.now() - t0;
    log(`${name}: generated triangles=${mesh.triangleCount} in ${(total / 1000).toFixed(1)}s`);
    const snap = perf.snapshot(total);
    log(`  stages: ${snap.stages.map((s) => `${s.name}=${(s.ms / 1000).toFixed(1)}s`).join(' ')}`);
    log(`  patternCutToolCount=${snap.patternCutToolCount}`);
    log(
      `  wallPattern: ${snap.wallPatternSubsteps.map((s) => `${s.name}=${(s.ms / 1000).toFixed(1)}s${s.count !== undefined ? `(n=${s.count})` : ''}`).join(' ')}`
    );
  } catch (e) {
    log(
      `${name}: GENERATION FAILED after ${((performance.now() - t0) / 1000).toFixed(1)}s heapMB=${(heapU32().byteLength / 1048576).toFixed(0)}: ${describeError(e)}`
    );
    log(`  ${readLowWater(guard)}`);
    throw e;
  }
  log(`  after generation: ${readLowWater(guard)}`);

  const solid = getLastSolid();
  if (!solid) throw new Error('no cached solid');
  const guard2 = paintStack();
  const t1 = performance.now();
  let stlBytes: number;
  try {
    const buf = await exportSolidToStl(solid, name, 0.01, 0.1);
    stlBytes = buf.byteLength;
    log(`${name}: STL ${buf.byteLength} bytes in ${((performance.now() - t1) / 1000).toFixed(1)}s`);
  } catch (e) {
    log(
      `${name}: STL EXPORT FAILED after ${((performance.now() - t1) / 1000).toFixed(1)}s: ${describeError(e)}`
    );
    log(`  ${readLowWater(guard2)}`);
    throw e;
  }
  log(`  after export: ${readLowWater(guard2)}`);
  return stlBytes;
}

describe('goma tall bin export probe', () => {
  beforeAll(async () => {
    const { registerKernel, OcctWasmAdapter } = await import('brepjs');
    const occtDir = process.env['OCCT_WASM_DIR'];
    const { OcctKernel } = occtDir
      ? ((await import(
          /* @vite-ignore */ pathToFileURL(join(occtDir, 'dist/index.js')).href
        )) as typeof OcctWasmModule)
      : await import('occt-wasm');
    const dir = occtDir ?? join(process.cwd(), 'node_modules/occt-wasm');
    const wasmBinary = readFileSync(join(dir, 'dist/occt-wasm.wasm'));
    SP_INIT = readStackPointerInit(new Uint8Array(wasmBinary));
    STACK_LOW = SP_INIT - STACK_SIZE;
    PAINT_TOP = SP_INIT - 8_192;
    log(`kernel dir=${dir} sp_init=${SP_INIT}`);
    const kernel = await OcctKernel.init({ wasm: wasmBinary });
    const raw = kernel.getRawModule();
    heapU32 = () => raw.HEAPU32;
    registerKernel('occt-wasm', OcctWasmAdapter.fromKernel(kernel));
    const binMod = await import('../binGenerator');
    const stlMod = await import('../utils/stlMeshFallback');
    const cacheMod = await import('../shapeCache');
    generateBin = binMod.generateBin;
    exportSolidToStl = stlMod.exportSolidToStl;
    getLastSolid = cacheMod.getLastSolid;
    setLastSolid = cacheMod.setLastSolid;
    clearAllCaches = cacheMod.clearAllCaches;
    log(`heap bytes=${raw.HEAPU32.byteLength}`);
  }, 120_000);

  const small = process.env['PROBE_ONLY_TALL'] ? it.skip : it;

  small(
    '1x1x6 goma 0.5 (catalog case)',
    async () => {
      expect(await runCase('1x1x6', gomaBin(1, 1, 6, false))).toBeGreaterThan(0);
    },
    600_000
  );

  small(
    '4x4x12 goma 0.5 + handles, flat base',
    async () => {
      expect(await runCase('4x4x12', gomaBin(4, 4, 12, true))).toBeGreaterThan(0);
    },
    1_800_000
  );

  /**
   * Where the export pass's memory goes: build the solid with a PREVIEW pass
   * (same booleans, coarse tessellation), then run the export-stage steps one
   * at a time against the cached solid and log the heap after each.
   */
  (process.env['PROBE_MERGE_BREAKDOWN'] ? it : it.skip)(
    '4x4x36 export-stage memory breakdown',
    async () => {
      const { mesh, meshEdges, getShells } = await import('brepjs');
      const heapMB = (): string => (heapU32().byteLength / 1048576).toFixed(0);
      clearAllCaches();
      setLastSolid(null);
      const t0 = performance.now();
      let preview: ReturnType<typeof generateBin>;
      try {
        preview = generateBin(gomaBin(4, 4, 36, true), undefined, false);
      } catch (e) {
        log(
          `preview pass FAILED after ${((performance.now() - t0) / 1000).toFixed(1)}s heapMB=${heapMB()}: ${describeError(e)}`
        );
        throw e;
      }
      log(
        `preview pass: triangles=${preview.triangleCount} in ${((performance.now() - t0) / 1000).toFixed(1)}s heapMB=${heapMB()}`
      );
      const solid = getLastSolid();
      if (!solid) throw new Error('no cached solid');
      log(`shells=${getShells(solid).length} heapMB=${heapMB()}`);
      const t1 = performance.now();
      const m = mesh(solid, {
        tolerance: EXPORT_TOLERANCE,
        angularTolerance: EXPORT_ANGULAR_TOLERANCE_RAD,
      });
      log(
        `export mesh(): triangles=${m.triangles.length / 3} vertices=${m.vertices.length / 3} in ${((performance.now() - t1) / 1000).toFixed(1)}s heapMB=${heapMB()}`
      );
      const t2 = performance.now();
      const edges = meshEdges(solid, {
        tolerance: EXPORT_TOLERANCE,
        angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD,
      });
      log(
        `export meshEdges(): points=${edges.lines.length / 3} in ${((performance.now() - t2) / 1000).toFixed(1)}s heapMB=${heapMB()}`
      );
      expect(m.triangles.length).toBeGreaterThan(0);
    },
    3_600_000
  );

  it('4x4x36 goma 0.5 + handles, flat base (production repro)', async () => {
    expect(await runCase('4x4x36', gomaBin(4, 4, 36, true))).toBeGreaterThan(0);
  }, 3_600_000);
});

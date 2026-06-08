// @vitest-environment node
/**
 * Split-preview per-stage breakdown (investigation harness, not a CI gate).
 *
 * Isolates where time goes when the split preview regenerates: the full-bin
 * generation (generateBin), the per-piece boolean cutting, and the per-piece
 * tessellation. Then models the CURRENT worker-pool wall-clock (every worker
 * regenerates the full solid AND cuts every piece, tessellates a subset) vs an
 * OPTIMIZED pool (each worker only cuts the pieces it tessellates).
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts splitPerfBreakdown
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';

const OUT = '/tmp/splitperf.txt';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches } from '../shapeCache';
import type { BinParams } from '@/shared/types/bin';
import {
  generateSplitPreview,
  generateSplitPreviewRange,
} from '@/features/generation/worker/generators/binGenerator';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

const SAMPLES = 4; // first discarded (JIT/CPU warm-up)
const POOL = 4; // MAX_POOL_SIZE in WorkerPool.ts

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function timeMedian(fn: () => void): number {
  const runs: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    clearAllCaches();
    const t = performance.now();
    fn();
    runs.push(performance.now() - t);
  }
  return median(runs.slice(1));
}

const GRID = 42;

/**
 * Interior cut planes (mm offsets from center) for `n` pieces across span,
 * nudged mid-cell so they don't coincide with socket-cell walls (which trips
 * the geometry-loss guard) — mirrors real print-bed-derived planes.
 */
function cutPlanes(spanMm: number, n: number): number[] {
  const planes: number[] = [];
  const nudge = 0.27 * GRID;
  for (let i = 1; i < n; i++) planes.push(-spanMm / 2 + (spanMm * i) / n + nudge);
  return planes;
}

interface Scenario {
  label: string;
  params: BinParams;
  colsCut: number;
  rowsCut: number;
}

function makeScenario(
  label: string,
  width: number,
  depth: number,
  height: number,
  colsCut: number,
  rowsCut: number,
  extra: Partial<BinParams> = {}
): Scenario {
  return {
    label,
    colsCut,
    rowsCut,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width,
      depth,
      height,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
      ...extra,
    },
  };
}

const SCENARIOS: Scenario[] = [
  makeScenario('8x2 grid (16 pieces)', 24, 6, 4, 8, 2),
  makeScenario('4x2 grid (8 pieces)', 12, 6, 4, 4, 2),
  makeScenario('2-piece split', 8, 6, 4, 2, 1),
];

describe('split preview per-stage breakdown', () => {
  it('profiles full-gen vs cut vs tessellation and models pool wall-clock', () => {
    writeFileSync(OUT, '');
    for (const sc of SCENARIOS) {
      const { params, colsCut, rowsCut } = sc;
      const spanX = params.width * GRID;
      const spanY = params.depth * GRID;
      const cx = cutPlanes(spanX, colsCut);
      const cy = cutPlanes(spanY, rowsCut);
      const total = colsCut * rowsCut;

      // Body params mirror splitSolidIntoPieces: strip lip (it's split separately).
      const bodyParams: BinParams = { ...params, base: { ...params.base, stackingLip: false } };

      const fullGen = timeMedian(() => {
        getGenerateBin()(bodyParams, undefined, true);
      });

      // Each pool worker's round-robin share (worker 0 gets the most pieces, so
      // it's the bottleneck that gates the pool's wall-clock).
      const workerShare: number[] = [];
      for (let i = 0; i < total; i += POOL) workerShare.push(i);
      const perWorker = workerShare.length;

      // OLD per-worker bottleneck: cut ALL pieces, tessellate its share. We no
      // longer have that code path, but generateSplitPreview (cut all + tess
      // all) is its close upper bound — cut-all dominates and the extra
      // (total-perWorker) tessellations are cheap. Also = the single-worker time.
      const oldBottleneck = timeMedian(() => {
        generateSplitPreview(params, cx, cy);
      });

      // NEW per-worker bottleneck: cut + tessellate only its share.
      const newBottleneck = timeMedian(() => {
        generateSplitPreviewRange(params, cx, cy, workerShare);
      });

      // Per-piece combined cost (cut + tessellate one piece), measured cleanly
      // off the new path so the optimization doesn't distort it.
      const onePiece = timeMedian(() => {
        generateSplitPreviewRange(params, cx, cy, [0]);
      });
      const perPiece = onePiece - fullGen;

      const f = (n: number): string => `${n.toFixed(0)}ms`;
      appendFileSync(
        OUT,
        `\n${sc.label}  (${total} pieces, pool=${POOL}, ${perWorker}/bottleneck-worker)\n` +
          `  full-gen (1×)            ${f(fullGen).padStart(8)}\n` +
          `  per-piece (cut+tess)     ${f(perPiece).padStart(8)}\n` +
          `  ── measured wall-clock (slowest worker gates the pool) ──\n` +
          `  OLD pool ≈ cut-all/wkr   ${f(oldBottleneck).padStart(8)}   (generateSplitPreview, all ${total} cut)\n` +
          `  NEW pool = cut-own-share ${f(newBottleneck).padStart(8)}   (range, ${perWorker} cut+tess)\n` +
          `  speedup                  ${(oldBottleneck / newBottleneck).toFixed(2)}×`
      );
    }
  }, 600_000);
});

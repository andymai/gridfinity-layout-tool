// @vitest-environment node
/**
 * Per-stage preview-generation breakdown (investigation harness, not a CI gate).
 *
 * Answers: when the bin-designer preview feels slow after an edit, where does
 * the worker time actually go — boolean ops, tessellation, feature building, or
 * shell assembly? Splits each generation by pipeline stage via PerfCollector
 * across three representative workloads in cold and warm-edit cache states.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts previewPerfBreakdown
 *
 * Stage name → meaning:
 *   base     shellStage     socket loft + box + lip + fuse
 *   features featuresStage  build cutout/scoop/compartment tool solids
 *   boolean  booleanStage   apply the cuts/fuses  ← Manifold mesh-CSG targets this
 *   merge    translate + tessellate + meshEdges    ← Manifold also re-meshes here
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches } from '../shapeCache';
import { PerfCollector } from '../pipeline/perfCollector';
import type { BinParams } from '@/shared/types/bin';
import type { CutoutArrayConfig } from '@/features/bin-designer/types';

beforeAll(async () => {
  await initBrepjs();
  writeFileSync(process.env['PERF_OUT'] ?? '/tmp/perfbench/results.txt', '');
}, 60_000);

const SAMPLES = 5; // first sample discarded (hot-CPU/JIT warm-up); median of rest

const OUT = process.env['PERF_OUT'] ?? '/tmp/perfbench/results.txt';

interface StageBreakdown {
  total: number;
  base: number;
  features: number;
  boolean: number;
  merge: number;
  triangles: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Sum recorded stage timings by name (translate + tessellate both record 'merge'). */
function foldStages(collector: PerfCollector, total: number): Omit<StageBreakdown, 'triangles'> {
  const snap = collector.snapshot(total);
  const by = (name: string): number =>
    snap.stages.filter((s) => s.name === name).reduce((a, s) => a + s.ms, 0);
  return {
    total,
    base: by('base'),
    features: by('features'),
    boolean: by('boolean'),
    merge: by('merge'),
  };
}

/** One measured generation; caches are left in whatever state the caller set up. */
function measureOnce(params: BinParams): StageBreakdown {
  const generateBin = getGenerateBin();
  const collector = new PerfCollector();
  const start = performance.now();
  const meshData = generateBin(params, undefined, false, undefined, collector);
  const total = performance.now() - start;
  return { ...foldStages(collector, total), triangles: meshData.triangleCount };
}

/** Cold: every sample starts from empty caches (first-open cost). */
function measureCold(params: BinParams): StageBreakdown[] {
  const runs: StageBreakdown[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    clearAllCaches();
    runs.push(measureOnce(params));
  }
  return runs;
}

/** Warm-edit: warm caches with `base`, then repeatedly regenerate the `edited` params. */
function measureWarmEdit(base: BinParams, edited: BinParams): StageBreakdown[] {
  clearAllCaches();
  getGenerateBin()(base, undefined, false); // warm shell/socket/box caches
  const runs: StageBreakdown[] = [];
  for (let i = 0; i < SAMPLES; i++) runs.push(measureOnce(edited));
  return runs;
}

function summarize(runs: StageBreakdown[]): StageBreakdown {
  const measured = runs.slice(1); // drop first (warm-up)
  const med = (pick: (r: StageBreakdown) => number): number => median(measured.map(pick));
  return {
    total: med((r) => r.total),
    base: med((r) => r.base),
    features: med((r) => r.features),
    boolean: med((r) => r.boolean),
    merge: med((r) => r.merge),
    triangles: Math.round(med((r) => r.triangles)),
  };
}

function report(label: string, b: StageBreakdown): void {
  const pct = (ms: number): string => `${((ms / b.total) * 100).toFixed(0)}%`;
  const line =
    `\n  ${label}\n` +
    `    total      ${b.total.toFixed(0).padStart(6)}ms   (${b.triangles.toLocaleString()} tris)\n` +
    `    base       ${b.base.toFixed(0).padStart(6)}ms   ${pct(b.base)}\n` +
    `    features   ${b.features.toFixed(0).padStart(6)}ms   ${pct(b.features)}\n` +
    `    boolean    ${b.boolean.toFixed(0).padStart(6)}ms   ${pct(b.boolean)}   <- Manifold CSG target\n` +
    `    merge≈tess ${b.merge.toFixed(0).padStart(6)}ms   ${pct(b.merge)}   <- Manifold re-meshes`;
  appendFileSync(OUT, line + '\n');
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

/** 1. Worst-case complex: magnet base + lip + scoop + 3×3 compartments. */
const COMPLEX: BinParams = buildParams({
  width: 3,
  depth: 3,
  height: 6,
  base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
  scoop: { enabled: true, radius: 'auto' },
  compartments: { cols: 3, rows: 3, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
});

/** 2. Large footprint: 6×6 socket bin with lip (triangle-count + big-prism boolean). */
const LARGE: BinParams = buildParams({
  width: 6,
  depth: 6,
  height: 4,
  base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
});

/** 3. Cutout/socket array (bit organizer): solid bin carved by a 6×6 hex array (36 cuts). */
const HEX_ARRAY: CutoutArrayConfig = {
  mode: 'grid',
  cols: 6,
  rows: 6,
  pitchX: 16,
  pitchY: 16,
  count: 1,
  radius: 0,
  startAngle: 0,
  rotateToCenter: false,
};
const ARRAY_BIN: BinParams = buildParams({
  width: 4,
  depth: 4,
  height: 4,
  base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: true, solid: true },
  cutouts: [
    {
      id: 'hex-master',
      shape: 'polygon',
      sides: 6,
      x: 6,
      y: 6,
      width: 11,
      depth: 11,
      cutDepth: 20,
      rotation: 0,
      cornerRadius: 0,
      label: '',
      groupId: null,
      clearance: 0.2,
      chamferWidth: 0.6,
      array: HEX_ARRAY,
    },
  ],
});

describe('preview generation per-stage breakdown (OCCT baseline)', () => {
  it('complex 3×3 (magnet+lip+scoop+compartments)', () => {
    report('COLD  complex 3×3', summarize(measureCold(COMPLEX)));
    const featEdit = buildParams({ ...COMPLEX, scoop: { enabled: true, radius: 12 } });
    report('WARM  complex 3×3  (scoop radius edit)', summarize(measureWarmEdit(COMPLEX, featEdit)));
    const dimEdit = buildParams({ ...COMPLEX, height: 7 });
    report('WARM  complex 3×3  (height edit)', summarize(measureWarmEdit(COMPLEX, dimEdit)));
  }, 300_000);

  it('large 6×6 (socket+lip)', () => {
    report('COLD  large 6×6', summarize(measureCold(LARGE)));
    const dimEdit = buildParams({ ...LARGE, height: 6 });
    report('WARM  large 6×6  (height edit)', summarize(measureWarmEdit(LARGE, dimEdit)));
  }, 300_000);

  it('hex array 6×6 (solid bin, 36 polygon cuts)', () => {
    report('COLD  hex array 6×6', summarize(measureCold(ARRAY_BIN)));
    const arrayEdit: BinParams = {
      ...ARRAY_BIN,
      cutouts: [{ ...ARRAY_BIN.cutouts[0], array: { ...HEX_ARRAY, cols: 7, rows: 7 } }],
    };
    report(
      'WARM  hex array  (6×6 → 7×7 count edit)',
      summarize(measureWarmEdit(ARRAY_BIN, arrayEdit))
    );
  }, 300_000);
});

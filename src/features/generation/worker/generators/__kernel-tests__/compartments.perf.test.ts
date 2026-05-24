/**
 * Compartment grid scaling benchmark.
 *
 * Quantifies bin generation time as a function of compartment row/col count,
 * so we can pick a sensible `MAX_COMPARTMENT_GRID` cap (issue #1871). Each
 * grid is generated on the same fixed-size bin (8×8 grid units = 336×336mm)
 * so cell size stays >5mm even at 32×32. Tested both with and without label
 * tabs enabled, since labels add per-cell engraving geometry.
 *
 * Run in isolation via the profile config — excluded from CI:
 *   pnpm exec vitest run --config vitest.profile.config.ts compartments.perf
 *
 * This file lives under `__kernel-tests__/` so the main `vitest.config.ts`
 * exclude pattern for that directory keeps it off the CI critical path.
 */
// @vitest-environment node
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

const OUT_FILE = join(tmpdir(), 'compartments-bench-results.log');

beforeAll(async () => {
  await initBrepjs();
  writeFileSync(OUT_FILE, `compartments bench — ${new Date().toISOString()}\n\n`);
}, 30_000);

function emit(line: string): void {
  appendFileSync(OUT_FILE, line + '\n');
}

interface BenchRow {
  cols: number;
  rows: number;
  cells: number;
  labels: boolean;
  avgMs: number;
  triangleCount: number;
}

// 1 warmup so the shell cache is hot when measurement starts; 2 measured runs
// averaged together so a single transient (GC pause, OS noise) doesn't sway
// the cap decision. Tradeoff: full sweep now takes ~7-10 min instead of ~3.
const WARMUP_RUNS = 1;
const MEASURE_RUNS = 2;

/** Build a uniform N×M compartment grid with each cell its own compartment. */
function makeCells(cols: number, rows: number): number[] {
  return Array.from({ length: cols * rows }, (_, i) => i);
}

function benchOne(cols: number, rows: number, labels: boolean): BenchRow {
  const generateBin = getGenerateBin();
  const params = buildParams({
    width: 8,
    depth: 8,
    height: 4,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
    compartments: {
      cols,
      rows,
      thickness: 1.2,
      cells: makeCells(cols, rows),
    },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: labels },
  });

  // Warm up to fill shell cache
  for (let i = 0; i < WARMUP_RUNS; i++) {
    generateBin(params, undefined, false);
  }

  const times: number[] = [];
  let triangleCount = 0;
  for (let i = 0; i < MEASURE_RUNS; i++) {
    const start = performance.now();
    const result = generateBin(params, undefined, false);
    times.push(performance.now() - start);
    triangleCount = result.triangleCount;
  }

  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
  return { cols, rows, cells: cols * rows, labels, avgMs, triangleCount };
}

function printTable(label: string, rows: BenchRow[]): void {
  emit('');
  emit(`  === ${label} ===`);
  emit('  grid     cells    labels   avg ms    tris');
  emit('  ──────── ──────── ──────── ──────── ────────');
  for (const r of rows) {
    const cells = [
      `${r.cols}×${r.rows}`.padEnd(9),
      String(r.cells).padEnd(9),
      (r.labels ? 'yes' : 'no').padEnd(9),
      r.avgMs.toFixed(0).padEnd(9),
      String(r.triangleCount),
    ];
    emit('  ' + cells.join(''));
  }
  emit('');
}

describe('compartment grid scaling on 8×8 bin', () => {
  // Smaller sweep + per-row streaming so we can pick a cap from partial output
  // if the run gets killed at the very large grids.
  const GRIDS = [4, 8, 12, 16, 20];

  it('uniform-grid bench (no labels)', () => {
    const results: BenchRow[] = [];
    for (const n of GRIDS) {
      const row = benchOne(n, n, false);
      emit(`  [no-labels] ${n}×${n} = ${row.avgMs.toFixed(0)}ms (${row.triangleCount} tris)`);
      results.push(row);
    }
    printTable('no labels', results);
  });

  it('uniform-grid bench (with label tabs)', () => {
    const results: BenchRow[] = [];
    for (const n of GRIDS) {
      const row = benchOne(n, n, true);
      emit(`  [labels]    ${n}×${n} = ${row.avgMs.toFixed(0)}ms (${row.triangleCount} tris)`);
      results.push(row);
    }
    printTable('with label tabs', results);
  });
});

/**
 * Bin height scaling benchmark.
 *
 * Quantifies generation time as a function of `height` so `MAX_HEIGHT` can be
 * picked from measurement rather than guessed, the same way
 * `MAX_COMPARTMENT_GRID` was. The cap has to land under the budget
 * `computeGenerationTimeoutMs` grants at that height, so each row reports the
 * measured time next to the budget it has to fit inside.
 *
 * Honeycomb is swept separately because the pattern cut is the only stage that
 * scales with wall AREA. The timeout module's own note that "a tall 6×6×20 is
 * ~3min" is the case a higher cap would push past the 3-minute preview ceiling.
 *
 * Measured on a 3×3 (height unit / budget in seconds):
 *
 *   height   plain     honeycomb   preview budget
 *   4u       266ms     471ms       45s
 *   20u      271ms     17.1s       165s
 *   30u      273ms     40.0s       180s
 *   40u      265ms     60.9s       180s
 *   50u      256ms     85.0s       180s
 *
 * Two results decided the cap. Plain height is FREE: flat ~260ms and an
 * identical 5,176 triangles at every height, because a taller wall is the same
 * topology extruded further. And honeycomb, the only case that pays, grows
 * roughly linearly past 20u (~21s per 10u) rather than exploding, so the worst
 * case at 50u still sits at half the budget it is granted.
 *
 * Run in isolation via the profile config (excluded from CI):
 *   pnpm exec vitest run --config vitest.profile.config.ts height.perf
 */
// @vitest-environment node
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  computeGenerationTimeoutMs,
  computeExportTimeoutMs,
} from '@/features/generation/bridge/generationTimeout';

const OUT_FILE = join(tmpdir(), 'height-bench-results.log');

beforeAll(async () => {
  await initBrepjs();
  writeFileSync(OUT_FILE, `height bench ${new Date().toISOString()}\n\n`);
}, 60_000);

function emit(line: string): void {
  appendFileSync(OUT_FILE, line + '\n');
}

interface BenchRow {
  height: number;
  honeycomb: boolean;
  ms: number;
  previewBudgetMs: number;
  exportBudgetMs: number;
  triangleCount: number;
}

function benchOne(height: number, honeycomb: boolean): BenchRow {
  const generateBin = getGenerateBin();
  const params = buildParams({
    width: 3,
    depth: 3,
    height,
    base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: true },
    wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: honeycomb },
  });

  const start = performance.now();
  const result = generateBin(params, undefined, false);
  const ms = performance.now() - start;

  return {
    height,
    honeycomb,
    ms,
    previewBudgetMs: computeGenerationTimeoutMs(params),
    exportBudgetMs: computeExportTimeoutMs(params),
    triangleCount: result.triangleCount,
  };
}

function printTable(label: string, rows: BenchRow[]): void {
  emit('');
  emit(`  === ${label} ===`);
  emit('  height   ms        preview   export    tris');
  emit('  ──────── ───────── ───────── ───────── ────────');
  for (const r of rows) {
    emit(
      '  ' +
        [
          `${r.height}u`.padEnd(9),
          r.ms.toFixed(0).padEnd(10),
          `${(r.previewBudgetMs / 1000).toFixed(0)}s`.padEnd(10),
          `${(r.exportBudgetMs / 1000).toFixed(0)}s`.padEnd(10),
          String(r.triangleCount),
        ].join('')
    );
  }
  emit('');
}

describe('bin height scaling on a 3×3 bin', () => {
  const HEIGHTS = [4, 10, 20, 30, 40, 50];

  it('plain bin', () => {
    const results: BenchRow[] = [];
    for (const h of HEIGHTS) {
      const row = benchOne(h, false);
      emit(`  [plain]     ${h}u = ${row.ms.toFixed(0)}ms (${row.triangleCount} tris)`);
      results.push(row);
    }
    printTable('plain', results);
  });

  it('honeycomb walls', () => {
    const results: BenchRow[] = [];
    for (const h of HEIGHTS) {
      const row = benchOne(h, true);
      emit(`  [honeycomb] ${h}u = ${row.ms.toFixed(0)}ms (${row.triangleCount} tris)`);
      results.push(row);
    }
    printTable('honeycomb', results);
  });
});

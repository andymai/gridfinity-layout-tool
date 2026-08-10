// @vitest-environment node
/**
 * Per-tick cost of a slider SCRUB (investigation harness, not a CI gate).
 *
 * Distinct from `previewPerfBreakdown`, whose "warm" case regenerates one
 * identical config repeatedly — every cache holds that exact config by the
 * second sample, so it reports cache REPLAY. A scrub visits a new config on
 * every tick, so nothing replays and only genuinely reusable sub-shapes hit.
 * That is what production p75 measures.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts scrubPerfBreakdown
 */
import { appendFileSync } from 'node:fs';
import { writeReport } from './reportTable';
import { describe, it, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches, getAllShapeCacheStats, resetAllShapeCacheStats } from '../shapeCache';
import { PerfCollector } from '../pipeline/perfCollector';
import type { BinParams } from '@/shared/types/bin';

const OUT = process.env['PERF_OUT'] ?? '/tmp/perfbench/scrub.txt';

beforeAll(async () => {
  await initBrepjs();
  writeReport(OUT, '');
}, 60_000);

interface Tick {
  total: number;
  base: number;
  features: number;
  boolean: number;
  merge: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function measureOnce(params: BinParams): Tick {
  const collector = new PerfCollector();
  const start = performance.now();
  getGenerateBin()(params, undefined, false, undefined, collector);
  const total = performance.now() - start;
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

/** Per-cache hit rate over whatever window the stats were last reset to. */
function cacheLine(): string {
  return getAllShapeCacheStats()
    .filter((s) => s.hits + s.misses > 0)
    .map((s) => `${s.name} ${Math.round((s.hits / (s.hits + s.misses)) * 100)}%`)
    .join('  ');
}

/**
 * Walk a sequence of DISTINCT configs from a cold cache, dropping the first
 * (it pays the one-time cold build every scrub shares). The median of the rest
 * is the marginal cost of one slider tick.
 */
function scrub(label: string, configs: readonly BinParams[]): void {
  clearAllCaches();
  const ticks: Tick[] = [];
  for (const cfg of configs) ticks.push(measureOnce(cfg));
  const freshHits = cacheLine();
  resetAllShapeCacheStats();
  // Second pass over the same sequence — measures what a scrub BACK across
  // already-visited values costs (the caches now hold every config).
  const replay: Tick[] = [];
  for (const cfg of configs) replay.push(measureOnce(cfg));

  const replayHits = cacheLine();

  const first = ticks[0];
  const rest = ticks.slice(1);
  const med = (pick: (t: Tick) => number, xs: Tick[]): number => median(xs.map(pick));
  const line =
    `\n  ${label}  (${configs.length} distinct configs)\n` +
    `    cold first tick   ${first.total.toFixed(0).padStart(6)}ms` +
    `  base ${first.base.toFixed(0)}  feat ${first.features.toFixed(0)}` +
    `  bool ${first.boolean.toFixed(0)}  merge ${first.merge.toFixed(0)}\n` +
    `    median NEW tick   ${med((t) => t.total, rest)
      .toFixed(0)
      .padStart(6)}ms` +
    `  base ${med((t) => t.base, rest).toFixed(0)}  feat ${med((t) => t.features, rest).toFixed(0)}` +
    `  bool ${med((t) => t.boolean, rest).toFixed(0)}  merge ${med((t) => t.merge, rest).toFixed(0)}\n` +
    `    median REPLAY     ${med((t) => t.total, replay)
      .toFixed(0)
      .padStart(6)}ms` +
    `  base ${med((t) => t.base, replay).toFixed(0)}  feat ${med((t) => t.features, replay).toFixed(0)}` +
    `  bool ${med((t) => t.boolean, replay).toFixed(0)}  merge ${med((t) => t.merge, replay).toFixed(0)}\n` +
    `    fresh cache hits  ${freshHits}\n` +
    `    replay cache hits ${replayHits}`;
  appendFileSync(OUT, line + '\n');
}

const BASE_3x3: BinParams = buildParams({
  width: 3,
  depth: 3,
  height: 6,
  base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
  scoop: { enabled: true, radius: 'auto' },
  compartments: { cols: 3, rows: 3, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
});

const range = (n: number, from: number, step = 1): number[] =>
  Array.from({ length: n }, (_, i) => from + i * step);

describe('slider-scrub per-tick cost', () => {
  it('height scrub (changes shellKey every tick)', () => {
    scrub(
      'HEIGHT 3→10  magnet+lip+scoop+3×3 comps',
      range(8, 3).map((height) => buildParams({ ...BASE_3x3, height }))
    );
  }, 600_000);

  it('wall-thickness scrub (changes shellKey every tick)', () => {
    scrub(
      'WALL 0.8→2.2mm  magnet+lip+scoop+3×3 comps',
      range(8, 0.8, 0.2).map((wallThickness) =>
        buildParams({ ...BASE_3x3, wallThickness: Math.round(wallThickness * 10) / 10 })
      )
    );
  }, 600_000);

  it('scoop-radius scrub (shellKey stable)', () => {
    scrub(
      'SCOOP r6→r20  magnet+lip+3×3 comps',
      range(8, 6, 2).map((radius) => buildParams({ ...BASE_3x3, scoop: { enabled: true, radius } }))
    );
  }, 600_000);

  it('magnet-diameter scrub (shellKey changes; interior geometry does not)', () => {
    scrub(
      'MAGNET ⌀5.6→7.0  lip+scoop+3×3 comps',
      range(8, 5.6, 0.2).map((magnetDiameter) =>
        buildParams({
          ...BASE_3x3,
          base: {
            ...BASE_3x3.base,
            magnetDiameter: Math.round(magnetDiameter * 10) / 10,
          },
        })
      )
    );
  }, 600_000);

  it('compartment-cols scrub', () => {
    scrub(
      'COLS 2→7  magnet+lip+scoop',
      range(6, 2).map((cols) =>
        buildParams({
          ...BASE_3x3,
          compartments: {
            cols,
            rows: 3,
            thickness: 1.2,
            cells: Array.from({ length: cols * 3 }, (_, i) => i),
          },
        })
      )
    );
  }, 600_000);

  it('width scrub (footprint changes every tick)', () => {
    scrub(
      'WIDTH 2→7  magnet+lip+scoop',
      range(6, 2).map((width) =>
        buildParams({
          ...BASE_3x3,
          width,
          compartments: {
            cols: 3,
            rows: 3,
            thickness: 1.2,
            cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          },
        })
      )
    );
  }, 600_000);
});

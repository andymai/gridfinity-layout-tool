// @vitest-environment node
/**
 * Per-stage baseplate-generation breakdown (investigation harness, not a CI gate).
 *
 * Answers: when a plate takes 30s on brepkit and 1.5s on occt-wasm, which
 * construction step owns the gap? `previewPerfBreakdown` covers bins only, and
 * plates share none of that pipeline, so there was no way to tell whether the
 * cost sits in the pocket fuse, a later boolean, or tessellation.
 *
 * Splits each generation by BREP milestone using the `BaseplateProbe` hook, then
 * times the two post-build steps `generateBaseplate` runs (`mesh` + `creaseEdges`)
 * with the same tolerances the preview path picks.
 *
 * Run (the table also lands in `PERF_OUT`, default /tmp/perfbench/baseplate.txt,
 * because the console copy only survives under --reporter=verbose):
 *   BREPJS_KERNEL=brepkit   pnpm exec vitest run --config vitest.profile.config.ts baseplatePerfBreakdown
 *   BREPJS_KERNEL=occt-wasm pnpm exec vitest run --config vitest.profile.config.ts baseplatePerfBreakdown
 *
 * Milestone → meaning (labels come from `buildBaseplateSolid`):
 *   slabExtruded         slab profile extruded
 *   pocketsCut           the N-way pocket fuse            <- brepkit#1490 targets this
 *   outlineIntersected   custom-perimeter clip
 *   cornerIntersected    corner rounding clip
 *   magnetHolesCut       magnet hole batch
 *   lightweightFloorCut  underside floor cutters
 *   final                last op before return
 *   mesh                 tessellation
 *   creaseEdges          preview edge overlay
 */
import { appendFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { mesh } from 'brepjs';
import { writeReport } from './reportTable';
import { initBrepjs, getKernelName } from './wasmInit';
import {
  buildBaseplateSolid,
  clearBaseplateCaches,
  type BaseplateProbe,
} from '@/features/generation/worker/generators/baseplateGenerator';
import { creaseEdges } from '@/features/generation/worker/generators/utils';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';

const SAMPLES = 3; // first sample discarded (JIT warm-up); median of the rest

interface Breakdown {
  readonly stages: ReadonlyArray<{ label: string; ms: number }>;
  readonly total: number;
  readonly triangles: number;
}

const reports: string[] = [];
const OUT = process.env['PERF_OUT'] ?? '/tmp/perfbench/baseplate.txt';

beforeAll(async () => {
  await initBrepjs();
  writeReport(OUT, `Baseplate stage breakdown — kernel: ${getKernelName()}\n\n`);
}, 60_000);

afterAll(() => {
  console.log(`\nBaseplate stage breakdown — kernel: ${getKernelName()}\n`);
  for (const r of reports) console.log(r);
});

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Preview-path tessellation tolerances, mirroring `generateBaseplate`. Kept in
 * sync by hand: importing them is not possible, they are computed inline there.
 */
function previewTolerances(p: ResolvedBaseplateParams): {
  tolerance: number;
  angularTolerance: number;
} {
  const totalW = p.width * p.gridUnitMm + p.paddingLeft + p.paddingRight;
  const totalD = p.depth * (p.gridUnitMmY ?? p.gridUnitMm) + p.paddingFront + p.paddingBack;
  const maxDimension = Math.max(totalW, totalD);
  return p.magnetHoles
    ? { tolerance: Math.min(0.1, Math.max(0.05, maxDimension / 2500)), angularTolerance: 10 }
    : { tolerance: Math.min(0.4, Math.max(0.15, maxDimension / 600)), angularTolerance: 12 };
}

/** One cold generation, timed per milestone. */
function measureOnce(params: ResolvedBaseplateParams): Breakdown {
  clearBaseplateCaches();

  const marks: Array<{ label: string; at: number }> = [];
  // The probe's `shape` is borrowed for the call only, so nothing here retains
  // it — reading the clock is safe, keeping the handle would be a use-after-free.
  const probe: BaseplateProbe = (label) => marks.push({ label, at: performance.now() });

  const start = performance.now();
  const solid = buildBaseplateSolid(params, false, undefined, probe, false);
  const builtAt = performance.now();

  try {
    const { tolerance, angularTolerance } = previewTolerances(params);
    const meshStart = performance.now();
    const meshResult = mesh(solid, { tolerance, angularTolerance });
    const meshedAt = performance.now();
    creaseEdges(meshResult);
    const creasedAt = performance.now();

    const stages: Array<{ label: string; ms: number }> = [];
    let prev = start;
    for (const m of marks) {
      stages.push({ label: m.label, ms: m.at - prev });
      prev = m.at;
    }
    // Whatever the last probe did not cover, so the parts always sum to the whole.
    // Pushed unconditionally: `report` medians stage i across samples, so a row
    // that appears in only some of them shifts every later row in those samples.
    stages.push({ label: '(post-final build)', ms: builtAt - prev });
    stages.push({ label: 'mesh', ms: meshedAt - meshStart });
    stages.push({ label: 'creaseEdges', ms: creasedAt - meshedAt });

    return {
      stages,
      total: creasedAt - start,
      triangles: meshResult.triangles.length / 3,
    };
  } finally {
    solid.delete();
  }
}

function report(name: string, runs: readonly Breakdown[]): void {
  const measured = runs.slice(1);
  const labels = measured[0].stages.map((s) => s.label);
  const total = median(measured.map((r) => r.total));
  const lines = [
    `  ${name}`,
    `    total      ${total.toFixed(0).padStart(7)}ms   (${median(
      measured.map((r) => r.triangles)
    ).toLocaleString()} tris)`,
  ];
  for (const [i, label] of labels.entries()) {
    const ms = median(measured.map((r) => r.stages[i].ms));
    const pct = ((ms / total) * 100).toFixed(0);
    lines.push(`    ${label.padEnd(20)} ${ms.toFixed(0).padStart(7)}ms   ${pct.padStart(3)}%`);
  }
  const block = lines.join('\n') + '\n';
  reports.push(block);
  appendFileSync(OUT, block + '\n');
}

function run(name: string, params: ResolvedBaseplateParams): void {
  const runs: Breakdown[] = [];
  for (let i = 0; i < SAMPLES; i++) runs.push(measureOnce(params));
  report(name, runs);
}

const BASE: ResolvedBaseplateParams = {
  width: 2,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  connectorNubs: false,
};

describe(`baseplate stage breakdown (${getKernelName()})`, () => {
  it('2×2 plain', () => {
    run('2×2 plain', BASE);
  }, 300_000);

  it('4×4 plain', () => {
    run('4×4 plain', { ...BASE, width: 4, depth: 4 });
  }, 600_000);

  it('4×4 magnets', () => {
    run('4×4 magnets', { ...BASE, width: 4, depth: 4, magnetHoles: true });
  }, 600_000);

  it('6×4 magnets', () => {
    run('6×4 magnets', { ...BASE, width: 6, depth: 4, magnetHoles: true });
  }, 900_000);
});

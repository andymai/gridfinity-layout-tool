// @vitest-environment node
/**
 * Matrix perf harness — per-stage kernel cost across a representative design
 * matrix. Opt-in and NOT a CI gate: `__kernel-tests__` is excluded from every
 * vitest project, so this runs only when invoked explicitly through the profile
 * config. It exists to attach before/after numbers to generation-pipeline
 * changes.
 *
 * Run (writes a JSONL record per design and prints a summary table):
 *   pnpm run profile:matrix
 *
 * Before/after: capture a baseline, then diff a second run against it:
 *   MATRIX_PROFILE_OUT=/tmp/base.jsonl pnpm run profile:matrix
 *   MATRIX_PROFILE_BASELINE=/tmp/base.jsonl pnpm run profile:matrix
 *
 * Stage name → meaning (see PerfCollector):
 *   base     shellStage     socket loft + box + lip + fuse
 *   features featuresStage  build cutout/scoop/compartment/pattern tool solids
 *   boolean  booleanStage   apply the cuts/fuses (pattern_cut lives here)
 *   merge    translate + tessellate + meshEdges
 *
 * Modes per design:
 *   cold        every sample starts from empty caches (first-open cost)
 *   warmSame    regenerate identical params after warming (cache-hit floor)
 *   warmDimEdit regenerate a distinct height each sample (a real height scrub)
 */
import { appendFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { initBrepjs, getGenerateBin, getGenerateBaseplate } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import { clearAllCaches } from '../shapeCache';
import { PerfCollector } from '../pipeline/perfCollector';
import type { BinParams, ResolvedBaseplateParams } from '@/shared/types/bin';

const OUT = process.env['MATRIX_PROFILE_OUT'] ?? path.join(os.tmpdir(), 'matrixProfile.jsonl');
const BASELINE = process.env['MATRIX_PROFILE_BASELINE'];

interface Stages {
  total: number;
  base: number;
  features: number;
  boolean: number;
  merge: number;
  triangles: number;
  patternCutToolCount: number;
  hexCenterCount: number;
  featureBuilders: { name: string; ms: number }[];
}

interface ProfileRecord {
  key: string;
  kind: 'bin' | 'baseplate';
  cold: Stages;
  warmSame?: Stages;
  warmDimEdit?: Stages;
}

const collected: ProfileRecord[] = [];

beforeAll(async () => {
  await initBrepjs();
  writeFileSync(OUT, '');
}, 120_000);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function measureBin(params: BinParams): Stages {
  const collector = new PerfCollector();
  const start = performance.now();
  const mesh = getGenerateBin()(params, undefined, false, undefined, collector);
  const total = performance.now() - start;
  const snap = collector.snapshot(total);
  const by = (n: string): number =>
    snap.stages.filter((s) => s.name === n).reduce((a, s) => a + s.ms, 0);
  return {
    total,
    base: by('base'),
    features: by('features'),
    boolean: by('boolean'),
    merge: by('merge'),
    triangles: mesh.triangleCount,
    patternCutToolCount: snap.patternCutToolCount,
    hexCenterCount: snap.hexCenterCount,
    featureBuilders: snap.featureBuilders
      .map((f) => ({ name: f.name, ms: +f.ms.toFixed(1) }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 6),
  };
}

function measureBaseplate(params: ResolvedBaseplateParams): Stages {
  const start = performance.now();
  const mesh = getGenerateBaseplate()(params, () => {}, false);
  const total = performance.now() - start;
  return {
    total,
    base: 0,
    features: 0,
    boolean: 0,
    merge: 0,
    triangles: mesh.triangleCount,
    patternCutToolCount: 0,
    hexCenterCount: 0,
    featureBuilders: [],
  };
}

function summarize(runs: Stages[]): Stages {
  const measured = runs.length >= 3 ? runs.slice(1) : runs;
  const med = (pick: (r: Stages) => number): number => median(measured.map(pick));
  return {
    total: +med((r) => r.total).toFixed(1),
    base: +med((r) => r.base).toFixed(1),
    features: +med((r) => r.features).toFixed(1),
    boolean: +med((r) => r.boolean).toFixed(1),
    merge: +med((r) => r.merge).toFixed(1),
    triangles: Math.round(med((r) => r.triangles)),
    patternCutToolCount: Math.round(med((r) => r.patternCutToolCount)),
    hexCenterCount: Math.round(med((r) => r.hexCenterCount)),
    featureBuilders: runs[runs.length - 1].featureBuilders,
  };
}

function emit(rec: ProfileRecord): void {
  collected.push(rec);
  appendFileSync(OUT, JSON.stringify(rec) + '\n');
}

function cold(params: BinParams, samples: number): Stages {
  const runs: Stages[] = [];
  for (let i = 0; i < samples; i++) {
    clearAllCaches();
    runs.push(measureBin(params));
  }
  return summarize(runs);
}

function warmSame(params: BinParams, samples: number): Stages {
  clearAllCaches();
  measureBin(params);
  const runs: Stages[] = [];
  for (let i = 0; i < samples; i++) runs.push(measureBin(params));
  return summarize(runs);
}

function warmDimEdit(base: BinParams, samples: number): Stages {
  clearAllCaches();
  measureBin(base);
  const runs: Stages[] = [];
  for (let i = 0; i < samples; i++) {
    runs.push(measureBin(buildParams({ ...base, height: base.height + 1 + i })));
  }
  return summarize(runs);
}

// ─── The design matrix ─────────────────────────────────────────────────────

const control = buildParams({ width: 2, depth: 2, height: 3 });

const compartments = buildParams({
  width: 6,
  depth: 4,
  height: 6,
  compartments: {
    cols: 12,
    rows: 8,
    thickness: 1.2,
    cells: Array.from({ length: 96 }, (_, i) => i),
  },
  wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
});

const honeycomb = buildParams({
  width: 6,
  depth: 6,
  height: 8,
  wallPattern: { enabled: true, pattern: 'honeycomb' },
  floorPattern: { enabled: true, pattern: 'honeycomb', scale: 0.5 },
});

const kumiko = buildParams({
  width: 2,
  depth: 2,
  height: 6,
  wallPattern: { enabled: true, pattern: 'mitsukude', scale: 0.5 },
});

const featurey = buildParams({
  width: 4,
  depth: 3,
  height: 5,
  walls: {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 40 },
    back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 40 },
    left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 40 },
    right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 60, depth: 40 },
    interior: DISABLED_WALL_CUTOUT,
  },
  label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
  handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true },
  surfaceText: { walls: { back: 'TOOLS' } },
});

const tallTaper = buildParams({
  width: 4,
  depth: 4,
  height: 12,
  base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable', feetPinDiameter: 2.8 },
  compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
  overhang: {
    enabled: true,
    left: 3,
    right: 3,
    front: 3,
    back: 3,
    feet: false,
    taper: {
      enabled: true,
      profile: 'fillet',
      bandHeight: 10,
      left: 3,
      right: 3,
      front: 3,
      back: 3,
    },
  },
});

const hexCutouts = buildParams({
  width: 6,
  depth: 4,
  height: 6,
  wallPattern: { enabled: true, pattern: 'honeycomb' },
  walls: {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    interior: DISABLED_WALL_CUTOUT,
  },
});

const kumikoFill = buildParams({
  width: 3,
  depth: 3,
  height: 6,
  wallPattern: { enabled: true, pattern: 'asanoha', scale: 0.5 },
});

const slotted = buildParams({
  width: 3,
  depth: 2,
  height: 5,
  style: 'slotted',
  slotConfig: {
    x: { enabled: true, pitch: 20 },
    y: { enabled: true, pitch: 20 },
    width: 2.0,
    depth: 1.0,
    crossStyle: 'lap',
    longAxis: 'y',
    partialStyle: 'full',
    layout: 'even',
  },
  dividerPieces: { height: 'auto', thickness: 1.6, clearance: 0.25 },
});

const maxgrid = buildParams({
  width: 6,
  depth: 6,
  height: 10,
  compartments: {
    cols: 12,
    rows: 12,
    thickness: 1.2,
    cells: Array.from({ length: 144 }, (_, i) => i),
  },
});

const directA = buildParams({ width: 2, depth: 2, height: 3 });
const directB = buildParams({
  width: 2,
  depth: 2,
  height: 3,
  scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
});

const worstcase = buildParams({
  width: 6,
  depth: 6,
  height: 20,
  wallPattern: { enabled: true, pattern: 'honeycomb' },
});

const baseplate: ResolvedBaseplateParams = {
  width: 8,
  depth: 6,
  gridUnitMm: 42,
  magnetHoles: true,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: false,
};

interface BinCase {
  key: string;
  params: BinParams;
  coldSamples: number;
  warmSamples: number;
  dimEdit: boolean;
  timeout: number;
}

const BIN_CASES: BinCase[] = [
  {
    key: 'control',
    params: control,
    coldSamples: 4,
    warmSamples: 4,
    dimEdit: true,
    timeout: 60_000,
  },
  {
    key: 'directA-eligible',
    params: directA,
    coldSamples: 4,
    warmSamples: 4,
    dimEdit: true,
    timeout: 60_000,
  },
  {
    key: 'directB-scoop',
    params: directB,
    coldSamples: 4,
    warmSamples: 4,
    dimEdit: true,
    timeout: 60_000,
  },
  {
    key: 'featurey',
    params: featurey,
    coldSamples: 4,
    warmSamples: 4,
    dimEdit: true,
    timeout: 120_000,
  },
  {
    key: 'slotted',
    params: slotted,
    coldSamples: 4,
    warmSamples: 4,
    dimEdit: true,
    timeout: 120_000,
  },
  {
    key: 'tallTaper',
    params: tallTaper,
    coldSamples: 3,
    warmSamples: 3,
    dimEdit: true,
    timeout: 180_000,
  },
  {
    key: 'compartments-12x8-div',
    params: compartments,
    coldSamples: 3,
    warmSamples: 3,
    dimEdit: false,
    timeout: 300_000,
  },
  {
    key: 'maxgrid-12x12',
    params: maxgrid,
    coldSamples: 3,
    warmSamples: 3,
    dimEdit: true,
    timeout: 300_000,
  },
  {
    key: 'kumiko-mitsukude',
    params: kumiko,
    coldSamples: 3,
    warmSamples: 3,
    dimEdit: false,
    timeout: 300_000,
  },
  {
    key: 'kumiko-asanoha-fill',
    params: kumikoFill,
    coldSamples: 3,
    warmSamples: 3,
    dimEdit: false,
    timeout: 300_000,
  },
  {
    key: 'honeycomb-6x6x8-floor',
    params: honeycomb,
    coldSamples: 3,
    warmSamples: 3,
    dimEdit: false,
    timeout: 300_000,
  },
  {
    key: 'hex+cutouts',
    params: hexCutouts,
    coldSamples: 3,
    warmSamples: 3,
    dimEdit: false,
    timeout: 300_000,
  },
  {
    key: 'worstcase-6x6x20-hex',
    params: worstcase,
    coldSamples: 2,
    warmSamples: 2,
    dimEdit: false,
    timeout: 590_000,
  },
];

// ─── Summary table (printed via process.stdout to skip the no-console rule) ──

function loadBaseline(file: string): Map<string, ProfileRecord> {
  const map = new Map<string, ProfileRecord>();
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line) as ProfileRecord;
    map.set(rec.key, rec);
  }
  return map;
}

function pad(s: string | number, w: number): string {
  return String(s).padStart(w);
}
function padEnd(s: string | number, w: number): string {
  return String(s).padEnd(w);
}

function delta(now: number, was: number | undefined): string {
  if (was === undefined || was === 0) return '';
  const pct = ((now - was) / was) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function printSummary(): void {
  const base = BASELINE ? loadBaseline(BASELINE) : null;
  const w = process.stdout.write.bind(process.stdout);
  w('\n=== matrix profile summary (median ms) ===\n');
  w(
    padEnd('design', 24) +
      pad('cold', 8) +
      pad('base%', 7) +
      pad('bool%', 7) +
      pad('warmSame', 10) +
      pad('warmDim', 9) +
      pad('tris', 8) +
      (base ? '   Δcold / ΔwarmSame' : '') +
      '\n'
  );
  for (const r of collected) {
    const c = r.cold;
    const pct = (x: number): number => (c.total ? Math.round((100 * x) / c.total) : 0);
    const b = base?.get(r.key);
    const deltas = base
      ? `   ${delta(c.total, b?.cold.total)} / ${delta(r.warmSame?.total ?? 0, b?.warmSame?.total)}`
      : '';
    w(
      padEnd(r.key, 24) +
        pad(Math.round(c.total), 8) +
        pad(pct(c.base), 7) +
        pad(pct(c.boolean), 7) +
        pad(r.warmSame ? Math.round(r.warmSame.total) : '-', 10) +
        pad(r.warmDimEdit ? Math.round(r.warmDimEdit.total) : '-', 9) +
        pad(c.triangles, 8) +
        deltas +
        '\n'
    );
  }
  w(`\nJSONL: ${OUT}\n`);
}

afterAll(() => {
  printSummary();
});

describe('matrix profile (OCCT kernel stage breakdown)', () => {
  for (const c of BIN_CASES) {
    it(
      c.key,
      () => {
        const rec: ProfileRecord = { key: c.key, kind: 'bin', cold: cold(c.params, c.coldSamples) };
        rec.warmSame = warmSame(c.params, c.warmSamples);
        if (c.dimEdit) rec.warmDimEdit = warmDimEdit(c.params, c.warmSamples);
        emit(rec);
      },
      c.timeout
    );
  }

  it('baseplate-8x6-magnet', () => {
    clearAllCaches();
    const runs: Stages[] = [
      measureBaseplate(baseplate),
      measureBaseplate(baseplate),
      measureBaseplate(baseplate),
    ];
    emit({ key: 'baseplate-8x6-magnet', kind: 'baseplate', cold: summarize(runs) });
  }, 180_000);
});

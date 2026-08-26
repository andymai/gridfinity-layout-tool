// @vitest-environment node
/**
 * Head-to-head kernel parity matrix: geometry AND performance.
 *
 * Emits one JSON row per scenario with the geometric invariants that actually
 * decide parity plus a timing, for whichever kernel `BREPJS_KERNEL` selects.
 * Run once per kernel and diff the two files with `compareKernelParity.ts`.
 *
 * One process per kernel is deliberate: the generators bind to the single
 * kernel registered in the worker, and the kernel is a per-worker singleton
 * whose borrow flag strands permanently after a trap, so a in-process A/B
 * would let the first failing case poison every later one.
 *
 *   BREPJS_KERNEL=occt-wasm PARITY_OUT=/tmp/parity_occt.json \
 *     ./node_modules/.bin/vitest run --config vitest.profile.config.ts kernelParityMatrix
 *   BREPJS_KERNEL=brepkit   PARITY_OUT=/tmp/parity_brepkit.json \
 *     ./node_modules/.bin/vitest run --config vitest.profile.config.ts kernelParityMatrix
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, it, beforeAll, afterAll } from 'vitest';
import { initBrepjs, getGenerateBin, getGenerateBaseplate, getKernelName } from './wasmInit';
import { meshTopologyStats, meshVolume, boundingBox } from './meshAssertions';
import { makeInsert } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { BinParams, ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

const OUT = process.env['PARITY_OUT'] ?? `/tmp/perfbench/parity_${getKernelName()}.json`;

interface Row {
  name: string;
  ok: boolean;
  error?: string;
  ms?: number;
  triangles?: number;
  volume?: number;
  boundaryEdges?: number;
  nonManifoldEdges?: number;
  euler?: number;
  bbox?: [number, number, number, number, number, number];
}

const rows: Row[] = [];

function record(name: string, run: () => MeshData): void {
  try {
    const t0 = performance.now();
    const mesh = run();
    const ms = performance.now() - t0;
    const stats = meshTopologyStats(mesh);
    const bb = boundingBox(mesh.vertices);
    rows.push({
      name,
      ok: true,
      ms: Math.round(ms),
      triangles: mesh.triangleCount,
      volume: Number(meshVolume(mesh).toFixed(3)),
      boundaryEdges: stats.boundaryEdges,
      nonManifoldEdges: stats.nonManifoldEdges,
      euler: stats.eulerCharacteristic,
      bbox: [bb.minX, bb.minY, bb.minZ, bb.maxX, bb.maxY, bb.maxZ].map((v) =>
        Number(v.toFixed(3))
      ) as Row['bbox'],
    });
  } catch (e) {
    rows.push({ name, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

const base = (o: Partial<BinParams['base']> = {}): BinParams['base'] => ({
  ...DEFAULT_BIN_PARAMS.base,
  ...o,
});

const BIN_CASES: ReadonlyArray<readonly [string, Partial<BinParams>]> = [
  ['1x1 std lip', { width: 1, depth: 1 }],
  ['1x1 std no-lip', { width: 1, depth: 1, base: base({ stackingLip: false }) }],
  ['1x1 flat no-lip', { width: 1, depth: 1, base: base({ style: 'flat', stackingLip: false }) }],
  [
    '1x1 mag no-lip',
    { width: 1, depth: 1, base: base({ style: 'magnet_and_screw', stackingLip: false }) },
  ],
  ['2x2 std no-lip', { width: 2, depth: 2, base: base({ stackingLip: false }) }],
  [
    '2x2 mag lip',
    { width: 2, depth: 2, base: base({ style: 'magnet_and_screw', stackingLip: true }) },
  ],
  ['1.5x2 half-bin', { width: 1.5, depth: 2 }],
  ['4x4 std no-lip', { width: 4, depth: 4, base: base({ stackingLip: false }) }],
  ['4x4 std lip', { width: 4, depth: 4 }],
  [
    '4x4 mag no-lip',
    { width: 4, depth: 4, base: base({ style: 'magnet_and_screw', stackingLip: false }) },
  ],
  [
    '2x2 compartments',
    {
      width: 2,
      depth: 2,
      base: base({ stackingLip: false }),
      compartments: {
        cols: 4,
        rows: 4,
        thickness: 1.2,
        cells: Array.from({ length: 16 }, (_, i) => i),
      },
    },
  ],
  [
    '2x2 scoop',
    {
      width: 2,
      depth: 2,
      base: base({ stackingLip: false }),
      scoop: { enabled: true, radius: 'auto' },
    },
  ],
  [
    '2x2 label bracket',
    {
      width: 2,
      depth: 2,
      base: base({ stackingLip: false }),
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
    },
  ],
  [
    '3x3 scoop+label+lip',
    {
      width: 3,
      depth: 3,
      scoop: { enabled: true, radius: 'auto' },
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
      base: base({ stackingLip: true }),
    },
  ],
  [
    '2x2 compartments+scoop',
    {
      width: 2,
      depth: 2,
      base: base({ stackingLip: false }),
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      scoop: { enabled: true, radius: 'auto' },
    },
  ],
  [
    '2x2 wall cutouts',
    {
      width: 2,
      depth: 2,
      base: base({ stackingLip: false }),
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        left: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        right: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        interior: DISABLED_WALL_CUTOUT,
      },
    },
  ],
  [
    '1x1 honeycomb',
    {
      width: 1,
      depth: 1,
      height: 3,
      base: base({ stackingLip: false }),
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
  ],
  [
    '2x2 circle insert',
    {
      width: 2,
      depth: 2,
      base: base({ stackingLip: false }),
      inserts: [
        makeInsert({
          shape: 'circle',
          x: 0,
          y: 0,
          width: 30,
          depth: 30,
          cutDepth: 5,
          cornerRadius: 0,
        }),
      ],
    },
  ],
  [
    '2x2 slotted no-lip',
    { width: 2, depth: 2, style: 'slotted', base: base({ stackingLip: false }) },
  ],
  [
    '2x2 full-featured',
    {
      width: 2,
      depth: 2,
      base: base({ style: 'magnet_and_screw', stackingLip: true }),
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      scoop: { enabled: true, radius: 'auto' },
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
    },
  ],
];

const PLATE: ResolvedBaseplateParams = {
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

const PLATE_CASES: ReadonlyArray<readonly [string, ResolvedBaseplateParams]> = [
  ['bp 2x2 plain', PLATE],
  ['bp 2x2 magnets', { ...PLATE, magnetHoles: true }],
  ['bp 4x4 plain', { ...PLATE, width: 4, depth: 4 }],
  ['bp 4x4 magnets', { ...PLATE, width: 4, depth: 4, magnetHoles: true }],
  ['bp 4x4 mag+conn', { ...PLATE, width: 4, depth: 4, magnetHoles: true, connectorNubs: true }],
  ['bp 6x4 magnets', { ...PLATE, width: 6, depth: 4, magnetHoles: true }],
];

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

afterAll(() => {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ kernel: getKernelName(), rows }, null, 2));
  console.log(`wrote ${rows.length} rows to ${OUT}`);
});

describe(`kernel parity matrix (${getKernelName()})`, () => {
  it('bins', () => {
    const gen = getGenerateBin();
    for (const [name, overrides] of BIN_CASES) {
      record(name, () => gen({ ...DEFAULT_BIN_PARAMS, ...overrides }, undefined, false));
    }
  }, 900_000);

  it('baseplates', () => {
    const gen = getGenerateBaseplate();
    for (const [name, params] of PLATE_CASES) {
      record(name, () => gen(params, () => {}, false));
    }
  }, 900_000);
});

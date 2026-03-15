/**
 * Profiling test — measures where time is spent during bin & baseplate generation
 * by running full generation and timing per config.
 *
 * Run with brepkit:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --reporter=verbose src/features/generation/worker/generators/__dual-kernel__/profileBin.test
 *
 * Run with OCCT (baseline):
 *   pnpm exec vitest run --reporter=verbose src/features/generation/worker/generators/__dual-kernel__/profileBin.test
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initBrepjs, getGenerateBin, getGenerateBaseplate, getKernelName } from './wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, BaseplateParams } from '@/shared/types/bin';

interface ProfileEntry {
  readonly name: string;
  readonly ms: number;
  readonly triangles: number;
}

const entries: ProfileEntry[] = [];

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

afterAll(() => {
  /* eslint-disable no-console */
  console.log(`\n┌──────────────────────────────────────────────────────────────────┐`);
  console.log(`│  Kernel: ${getKernelName().padEnd(55)}│`);
  console.log(`├──────────────────────────────────┬──────────┬──────────────────┤`);
  console.log(`│ Scenario                         │   Time   │    Triangles     │`);
  console.log(`├──────────────────────────────────┼──────────┼──────────────────┤`);
  for (const e of entries) {
    console.log(
      `│ ${e.name.padEnd(32)} │ ${(e.ms.toFixed(0) + 'ms').padStart(8)} │ ${String(e.triangles).padStart(16)} │`
    );
  }
  console.log(`└──────────────────────────────────┴──────────┴──────────────────┘`);
  /* eslint-enable no-console */
});

function runBin(name: string, overrides: Partial<BinParams>, forExport = false): void {
  const gen = getGenerateBin();
  const params = { ...DEFAULT_BIN_PARAMS, ...overrides } as BinParams;
  const start = performance.now();
  const result = gen(params, undefined, forExport);
  entries.push({ name, ms: performance.now() - start, triangles: result.triangleCount });
  expect(result.triangleCount).toBeGreaterThan(0);
}

function runBaseplate(name: string, params: BaseplateParams, forExport = false): void {
  const gen = getGenerateBaseplate();
  const start = performance.now();
  const result = gen(params, () => {}, forExport);
  entries.push({ name, ms: performance.now() - start, triangles: result.triangleCount });
  expect(result.triangleCount).toBeGreaterThan(0);
}

describe(`profile bins (${getKernelName()})`, () => {
  // ── Baseline: geometry primitives ──
  it('1×1 flat no-lip', () => {
    runBin('1×1 flat no-lip', {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    });
  }, 30_000);

  it('1×1 flat with-lip', () => {
    runBin('1×1 flat lip', {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: true },
    });
  }, 30_000);

  it('1×1 standard no-lip', () => {
    runBin('1×1 std no-lip', {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    });
  }, 30_000);

  it('1×1 standard with-lip', () => {
    runBin('1×1 std lip', { width: 1, depth: 1 });
  }, 30_000);

  it('1×1 magnet+screw no-lip', () => {
    runBin('1×1 mag no-lip', {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
    });
  }, 30_000);

  // ── Scaling ──
  it('4×4 standard no-lip', () => {
    runBin('4×4 std no-lip', {
      width: 4,
      depth: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    });
  }, 120_000);

  it('4×4 standard with-lip', () => {
    runBin('4×4 std lip', { width: 4, depth: 4 });
  }, 120_000);

  it('4×4 mag+screw no-lip', () => {
    runBin('4×4 mag no-lip', {
      width: 4,
      depth: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: false },
    });
  }, 120_000);

  // ── Features ──
  it('2×2 4×4 compartments', () => {
    runBin('2×2 4×4 compart', {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      compartments: {
        cols: 4,
        rows: 4,
        thickness: 1.2,
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      },
    });
  }, 30_000);

  it('2×2 scoop', () => {
    runBin('2×2 scoop', {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      scoop: { enabled: true, radius: 'auto' },
    });
  }, 30_000);

  it('2×2 label bracket', () => {
    runBin('2×2 label bracket', {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
    });
  }, 30_000);

  it('2×2 wall cutouts', () => {
    runBin('2×2 wall cutouts', {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 70, depth: 50 },
        back: { enabled: true, width: 70, depth: 50 },
        left: { enabled: true, width: 70, depth: 50 },
        right: { enabled: true, width: 70, depth: 50 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    });
  }, 30_000);

  it('1×1 honeycomb', () => {
    runBin('1×1 honeycomb', {
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    });
  }, 60_000);

  it('2×2 circle insert', () => {
    runBin('2×2 circle insert', {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      inserts: [
        { shape: 'circle', x: 0, y: 0, width: 30, depth: 30, cutDepth: 5, cornerRadius: 0 },
      ],
    });
  }, 30_000);

  it('2×2 full-featured', () => {
    runBin('2×2 full-featured', {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: true },
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      scoop: { enabled: true, radius: 'auto' },
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
    });
  }, 60_000);

  it('2×2 slotted no-lip', () => {
    runBin('2×2 slotted no-lip', {
      width: 2,
      depth: 2,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    });
  }, 30_000);
});

describe(`profile baseplates (${getKernelName()})`, () => {
  const BASE_PLATE: BaseplateParams = {
    width: 2,
    depth: 2,
    gridUnitMm: 42,
    withMagnet: false,
    magnetDiameter: 6.5,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    edgeLeft: 'exterior',
    edgeRight: 'exterior',
    edgeFront: 'exterior',
    edgeBack: 'exterior',
    connectorNubs: false,
    fractionalX: 'none',
    fractionalY: 'none',
  };

  it('2×2 plain', () => {
    runBaseplate('bp 2×2 plain', BASE_PLATE);
  }, 30_000);

  it('2×2 magnets', () => {
    runBaseplate('bp 2×2 magnets', { ...BASE_PLATE, withMagnet: true });
  }, 30_000);

  it('4×4 plain', () => {
    runBaseplate('bp 4×4 plain', { ...BASE_PLATE, width: 4, depth: 4 });
  }, 60_000);

  it('4×4 magnets', () => {
    runBaseplate('bp 4×4 magnets', { ...BASE_PLATE, width: 4, depth: 4, withMagnet: true });
  }, 60_000);

  it('4×4 magnets + connectors', () => {
    runBaseplate('bp 4×4 mag+conn', {
      ...BASE_PLATE,
      width: 4,
      depth: 4,
      withMagnet: true,
      connectorNubs: true,
    });
  }, 60_000);

  it('6×4 magnets', () => {
    runBaseplate('bp 6×4 magnets', { ...BASE_PLATE, width: 6, depth: 4, withMagnet: true });
  }, 120_000);
});

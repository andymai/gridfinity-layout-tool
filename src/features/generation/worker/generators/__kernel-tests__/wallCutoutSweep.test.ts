/**
 * Wall-cutout sweep: builds every combination of a small matrix and fails with
 * the list of bins whose body vanished or whose wall or divider came out solid.
 *
 * Each knob is an env var holding a comma list, so a reported design can be
 * bracketed without editing the file:
 *
 *   SWEEP_SHAPES=scoop SWEEP_SIZES=2x2,2x1 SWEEP_HEIGHTS=3,4,5,6 \
 *   SWEEP_SPANS=60,65,70,75,80 SWEEP_DEPTHS=50,100 SWEEP_COLS=2 SWEEP_ROWS=1 \
 *   SWEEP_EXTRA='{"wallThickness":2}' BREPJS_KERNEL=occt-wasm \
 *   pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/wallCutoutSweep
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin, getKernelName } from './wasmInit';
import { boundingBox, columnCrossings } from './meshAssertions';
import { deriveDimensions } from '../pipeline/context';
import { computeInteriorDividerCutouts, interiorDividerTopZ } from '../wallCutoutBuilder';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import type { BinParams, WallCutout, WallCutoutShape } from '@/shared/types/bin';

const list = (key: string, fallback: string): string[] =>
  (process.env[key] ?? fallback).split(',').filter(Boolean);
const numbers = (key: string, fallback: string): number[] => list(key, fallback).map(Number);

const SHAPES = list('SWEEP_SHAPES', 'scoop,u-shape,funnel') as WallCutoutShape[];
const SIZES = list('SWEEP_SIZES', '2x1,2x2').map((s) => s.split('x').map(Number));
const HEIGHTS = numbers('SWEEP_HEIGHTS', '3,5,6');
const SPANS = numbers('SWEEP_SPANS', '60,65,70,75,80');
const DEPTHS = numbers('SWEEP_DEPTHS', '50,100');
const COLS = Number(process.env['SWEEP_COLS'] ?? 2);
const ROWS = Number(process.env['SWEEP_ROWS'] ?? 1);
const EXTRA = JSON.parse(process.env['SWEEP_EXTRA'] ?? '{}') as Partial<BinParams>;
const FOR_EXPORT = process.env['SWEEP_EXPORT'] === '1';
const MIN_DROP_MM = 2;

function buildSweepParams(
  shape: WallCutoutShape,
  [width, depth]: number[],
  height: number,
  span: number,
  drop: number
): BinParams {
  const side: WallCutout = { ...DISABLED_WALL_CUTOUT, enabled: true, width: span, depth: drop };
  return {
    ...DEFAULT_BIN_PARAMS,
    ...EXTRA,
    width,
    depth,
    height,
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: COLS,
      rows: ROWS,
      cells: Array.from({ length: COLS * ROWS }, (_, i) => i),
    },
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      shape,
      front: side,
      back: side,
      left: side,
      right: side,
      interior: side,
    },
  };
}

function topAt(mesh: MeshData, x: number, y: number): number {
  return columnCrossings(mesh, x, y).at(-1) ?? -Infinity;
}

/**
 * A column through the middle of each outer wall's cut and of every divider
 * window. Each sits just off the cut's centre line, which is full of shared
 * triangle edges, and a divider's sits 1.37mm along it, clear of a crossing
 * divider's half-thickness.
 */
function probeColumns(params: BinParams): Record<string, [number, number]> {
  const dim = deriveDimensions(params, FOR_EXPORT);
  const { innerW, innerD, innerOffsetX: ox, innerOffsetY: oy } = dim;
  const mid = params.wallThickness / 2;
  const columns: Record<string, [number, number]> = {
    front: [ox + 0.37, oy - innerD / 2 - mid],
    back: [ox + 0.37, oy + innerD / 2 + mid],
    left: [ox - innerW / 2 - mid, oy + 0.41],
    right: [ox + innerW / 2 + mid, oy + 0.41],
  };
  const windows = computeInteriorDividerCutouts(
    params,
    innerW,
    innerD,
    interiorDividerTopZ(params, dim)
  );
  windows.forEach((w, i) => {
    const rad = (w.rotateZ * Math.PI) / 180;
    columns[`divider ${i + 1}`] = [
      ox + w.x + 1.37 * Math.cos(rad) - 0.07 * Math.sin(rad),
      oy + w.y + 1.37 * Math.sin(rad) + 0.07 * Math.cos(rad),
    ];
  });
  return columns;
}

function findDefect(mesh: MeshData, plain: MeshData, params: BinParams): string | null {
  if (plain.triangleCount === 0) return 'bin without cutouts came out empty';
  if (mesh.triangleCount === 0) return 'came out empty';
  const bodyTop = boundingBox(mesh.vertices).maxZ;
  if (bodyTop < boundingBox(plain.vertices).maxZ - MIN_DROP_MM) {
    return `body gone (top ${bodyTop.toFixed(2)})`;
  }
  const solid = Object.entries(probeColumns(params))
    .filter(([, [x, y]]) => topAt(mesh, x, y) > topAt(plain, x, y) - MIN_DROP_MM)
    .map(([wall]) => wall);
  return solid.length > 0 ? `solid ${solid.join(', ')}` : null;
}

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

describe(`wall cutout sweep (${getKernelName()})`, () => {
  it('opens every wall and divider it is asked to', () => {
    const generateBin = getGenerateBin();
    const plainCache = new Map<string, MeshData>();
    const failures: string[] = [];
    let built = 0;

    for (const shape of SHAPES)
      for (const size of SIZES)
        for (const height of HEIGHTS)
          for (const span of SPANS)
            for (const drop of DEPTHS) {
              const params = buildSweepParams(shape, size, height, span, drop);
              const plainKey = `${size.join('x')}x${height}`;
              const label = `${shape} ${plainKey} span ${span}% height ${drop}%`;
              let plain = plainCache.get(plainKey);
              if (!plain) {
                plain = generateBin(
                  { ...params, walls: { ...params.walls, enabled: false } },
                  undefined,
                  FOR_EXPORT
                );
                plainCache.set(plainKey, plain);
              }
              try {
                const mesh = generateBin(params, undefined, FOR_EXPORT);
                built++;
                const defect = findDefect(mesh, plain, params);
                if (defect !== null) failures.push(`${label}: ${defect}`);
              } catch (e) {
                failures.push(`${label}: threw ${String(e)}`);
              }
            }

    expect(built).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});

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
 *
 * A wall or divider counts as cut when a column through its middle stands at
 * least `MIN_DROP_MM` below the same column on the bin with cutouts off.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin, getKernelName } from './wasmInit';
import { boundingBox, columnCrossings } from './meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import type { BinParams, WallCutoutShape } from '@/shared/types/bin';

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
  const side = {
    enabled: true,
    width: span,
    depth: drop,
    alignment: 'center' as const,
    offset: 0,
    widthMm: null,
  };
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
 * Columns through the middle of each outer wall and of the first divider.
 * Offset off the axes, which are full of shared triangle edges.
 */
function probeColumns(plain: MeshData, wallThickness: number): Record<string, [number, number]> {
  const bb = boundingBox(plain.vertices);
  const t = wallThickness / 2;
  const innerW = bb.maxX - bb.minX - 2 * wallThickness;
  const innerD = bb.maxY - bb.minY - 2 * wallThickness;
  const columns: Record<string, [number, number]> = {
    front: [0.37, bb.minY + t],
    back: [0.37, bb.maxY - t],
    left: [bb.minX + t, 0.41],
    right: [bb.maxX - t, 0.41],
  };
  if (COLS > 1) columns['divider'] = [-innerW / 2 + innerW / COLS + 0.07, 0.41];
  else if (ROWS > 1) columns['divider'] = [0.41, -innerD / 2 + innerD / ROWS + 0.07];
  return columns;
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
              const label = `${shape} ${size.join('x')}x${height} span ${span}% height ${drop}%`;
              const plainKey = `${size.join('x')}x${height}`;
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
                const solid = Object.entries(probeColumns(plain, params.wallThickness))
                  .filter(([, [x, y]]) => topAt(mesh, x, y) > topAt(plain, x, y) - MIN_DROP_MM)
                  .map(([wall]) => wall);
                const bodyTop = boundingBox(mesh.vertices).maxZ;
                if (bodyTop < boundingBox(plain.vertices).maxZ - MIN_DROP_MM) {
                  failures.push(`${label}: body gone (top ${bodyTop.toFixed(2)})`);
                } else if (solid.length > 0) {
                  failures.push(`${label}: solid ${solid.join(', ')}`);
                }
              } catch (e) {
                failures.push(`${label}: threw ${String(e)}`);
              }
            }

    expect(built).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});

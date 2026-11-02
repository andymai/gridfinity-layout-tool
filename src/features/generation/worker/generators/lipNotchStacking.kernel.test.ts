// @vitest-environment node
/**
 * What lip notches are for, measured on mated meshes (#4783).
 *
 * A smaller bin stacked on a bigger one rides the rim along the long axis,
 * because a plain lip only registers the outer perimeter. Each case drops a
 * real bin onto a real lip with `stackSeat` and reads where it came to rest,
 * so the claims are about the joint, not about the notch's own geometry.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams, LipTipStyle } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { initTestKernel } from '@/test/initTestKernel';
import { stackSeat } from './__kernel-tests__/binStacking';
import { boundingBox, meshVolume, verticalSolidSpans } from './__kernel-tests__/meshAssertions';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { LIP_NOTCH_TOP_DROP_MM } from './boxTopShape';
import type * as BinGenerator from './binGenerator';

let generateBin: (params: BinParams, onProgress: undefined, forExport: boolean) => MeshData;
let generateSplitPreview: typeof BinGenerator.generateSplitPreview;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
  generateSplitPreview = (await import('./binGenerator')).generateSplitPreview;
}, 60000);

/** Full seat, as `binStackSeating.kernel.test` measures it. */
const JUNCTION_MM = 4.75;
const TOLERANCE_MM = 0.05;
const SIZE = GRIDFINITY.GRID_SIZE;
/** Wall top of the height-3 bins built here: only lip and notch material is above it. */
const WALL_TOP_Z = 3 * GRIDFINITY.HEIGHT_UNIT;

function bin(width: number, depth: number, lipNotches: boolean, lipTip?: LipTipStyle): MeshData {
  return generateBin(
    {
      ...DEFAULT_BIN_PARAMS,
      width,
      depth,
      height: 3,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        stackingLip: true,
        ...(lipNotches ? { lipNotches } : {}),
        ...(lipTip ? { lipTip } : {}),
      },
    },
    undefined,
    true
  );
}

describe('lip notches register a stacked bin to the grid', () => {
  // A 1x2 across a 3x2: it spans the depth, so only the notches stop it
  // sliding along the width. Its first cell sits over the 3x2's first column.
  const onGrid = -SIZE;

  it('seats a same-size bin fully, so notching costs no stack height', () => {
    const seat = stackSeat(bin(3, 2, false), bin(3, 2, true));
    expect(seat.junctionMm).toBeCloseTo(JUNCTION_MM, 1);
    expect(Math.abs(seat.junctionMm - JUNCTION_MM)).toBeLessThan(TOLERANCE_MM);
  }, 60000);

  it('seats a smaller bin fully on a grid cell', () => {
    const seat = stackSeat(bin(1, 2, false), bin(3, 2, true), { dx: onGrid, dy: 0 });
    expect(Math.abs(seat.junctionMm - JUNCTION_MM)).toBeLessThan(TOLERANCE_MM);
  }, 60000);

  it.each([
    ['half a cell', SIZE / 2],
    ['10mm', 10],
  ])(
    'holds a smaller bin off the grid by %s, where a plain lip lets it drop',
    (_, off) => {
      const upper = bin(1, 2, false);
      const plain = stackSeat(upper, bin(3, 2, false), { dx: onGrid + off, dy: 0 });
      const notched = stackSeat(upper, bin(3, 2, true), { dx: onGrid + off, dy: 0 });
      expect(Math.abs(plain.junctionMm - JUNCTION_MM)).toBeLessThan(TOLERANCE_MM);
      // It perches on the notch tops instead, the top drop below the peak.
      expect(notched.junctionMm).toBeLessThan(LIP_NOTCH_TOP_DROP_MM + 0.5);
    },
    90000
  );
});

describe('lip notches leave the peak finish alone', () => {
  // The notches stop short of the peak, so each finish takes exactly what it
  // takes from a plain lip. A finish the kernel refused would leave the
  // notched delta at zero while the plain one moved.
  it.each(['round', 'chamfer', 'flat'] as const)(
    '%s takes the same volume either way',
    (tip) => {
      const plainLoss = meshVolume(bin(2, 2, false)) - meshVolume(bin(2, 2, false, tip));
      const notchedLoss = meshVolume(bin(2, 2, true)) - meshVolume(bin(2, 2, true, tip));
      expect(plainLoss).toBeGreaterThan(1);
      expect(Math.abs(notchedLoss - plainLoss)).toBeLessThan(0.5);
    },
    90000
  );
});

describe("a split bin keeps the whole bin's notches", () => {
  // `splitBinBuilder` rebuilds the lip for the pieces, so it has to be handed
  // the notches too. Cut down the middle of a 4x2, each piece is re-centred and
  // the grid lines at x = -42 and +42 land on each piece's own x = 0.
  it('notches each piece at its grid line', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 4,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, lipNotches: true },
    };
    const { pieces } = generateSplitPreview(params, [0], [], DEFAULT_SPLIT_CONNECTOR_CONFIG);
    expect(pieces).toHaveLength(2);
    for (const piece of pieces) {
      const mesh: MeshData = { ...piece, triangleCount: piece.indices.length / 3 };
      const y = boundingBox(mesh.vertices).minY + 3;
      const lipBand = (x: number): (readonly [number, number])[] =>
        verticalSolidSpans(mesh, x, y).filter(([, top]) => top > WALL_TOP_Z);
      expect(lipBand(0), `${piece.label} at its grid line`).toHaveLength(1);
      expect(lipBand(SIZE / 2), `${piece.label} mid-cell`).toHaveLength(0);
    }
  }, 120000);
});

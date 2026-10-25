// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs, getExportSplitBin, getGenerateBin } from './__kernel-tests__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

// Three units on a two-unit bed: the cut at 0 runs through the middle foot,
// whose bottom face is a 35.6mm square.
const ALONG_X: BinParams = { ...DEFAULT_BIN_PARAMS, width: 3, depth: 1, height: 3 };
const ALONG_Y: BinParams = { ...DEFAULT_BIN_PARAMS, width: 1, depth: 3, height: 3 };
const MIDDLE_FOOT_HALF_SPAN = 21;
const NO_CONNECTORS: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };

type Axis = 'x' | 'y';

interface PieceExtent {
  footMin: number;
  footMax: number;
  min: number;
  max: number;
}

function measure(vertices: ArrayLike<number>, axis: Axis): PieceExtent {
  const offset = axis === 'x' ? 0 : 1;
  let zMin = Infinity;
  for (let i = 2; i < vertices.length; i += 3) zMin = Math.min(zMin, vertices[i]);
  const extent: PieceExtent = {
    footMin: Infinity,
    footMax: -Infinity,
    min: Infinity,
    max: -Infinity,
  };
  for (let i = 0; i < vertices.length; i += 3) {
    const v = vertices[i + offset];
    extent.min = Math.min(extent.min, v);
    extent.max = Math.max(extent.max, v);
    const onFootBottom = Math.abs(vertices[i + 2] - zMin) < 1e-4;
    if (onFootBottom && Math.abs(v) <= MIDDLE_FOOT_HALF_SPAN) {
      extent.footMin = Math.min(extent.footMin, v);
      extent.footMax = Math.max(extent.footMax, v);
    }
  }
  return extent;
}

async function splitAtCenter(
  axis: Axis,
  connectors: SplitConnectorConfig
): Promise<[PieceExtent, PieceExtent]> {
  const params = axis === 'x' ? ALONG_X : ALONG_Y;
  const [planesX, planesY] = axis === 'x' ? [[0], []] : [[], [0]];
  const result = await getExportSplitBin()(params, planesX, planesY, 0.01, undefined, connectors);
  const extents = result.pieces.map((piece) => {
    const parsed = parseSTLBinary(piece.data);
    if (!parsed.ok) throw new Error(`Piece ${piece.label} did not parse`);
    return measure(parsed.value.vertices, axis);
  });
  expect(extents).toHaveLength(2);
  const [low, high] = [...extents].sort((a, b) => a.min - b.min);
  return [low, high];
}

describe('split seam gap', () => {
  it('starts from a 35.6mm middle foot on the unsplit bin', () => {
    const whole = measure(getGenerateBin()(ALONG_X).vertices, 'x');
    expect(whole.footMax - whole.footMin).toBeCloseTo(35.6, 3);
  });

  it.each<Axis>(['x', 'y'])(
    'leaves 0.1mm between halves cut along %s, so a cut foot assembles to 35.5mm',
    async (axis) => {
      const [low, high] = await splitAtCenter(axis, NO_CONNECTORS);

      expect(low.max).toBeCloseTo(-0.05, 3);
      expect(high.min).toBeCloseTo(0.05, 3);
      expect(low.footMax - low.footMin).toBeCloseTo(17.75, 3);
      expect(high.footMax - high.footMin).toBeCloseTo(17.75, 3);
    },
    120000
  );

  it('moves the connectors with their faces, so the joint fits as it does flush', async () => {
    const [low, high] = await splitAtCenter('x', DEFAULT_SPLIT_CONNECTOR_CONFIG);

    // The male scarf tongue reaches 1.2mm past its face.
    expect(low.max).toBeCloseTo(-0.05 + 1.2, 3);
    expect(high.min).toBeCloseTo(0.05, 3);
    expect(low.footMax - low.footMin).toBeCloseTo(17.75, 3);
    expect(high.footMax - high.footMin).toBeCloseTo(17.75, 3);
  }, 120000);
});

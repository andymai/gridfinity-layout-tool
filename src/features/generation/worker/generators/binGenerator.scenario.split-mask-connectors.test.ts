// @vitest-environment node
/**
 * Split connectors on a custom-shaped (cellMask) bin.
 *
 * A cut through a narrow part of the shape crosses only the cells filled
 * there, so every connector has to be sized and placed off those cells: the
 * floor scarf across the material the cut actually meets, and the wall keys on
 * the walls that bound it, not on the edges of the mask's bounding rectangle.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
import type { MeshData } from '@/features/generation/bridge/types';
import {
  initBrepjs,
  getExportSplitBin,
  getGenerateSplitPreview,
} from './__kernel-tests__/wasmInit';
import { analyze as analyzeExportedStl } from './__kernel-tests__/exportIntegrityRunner';
import { assertStructurallyValid, isSolidThrough } from './__kernel-tests__/meshAssertions';
import { deriveDimensions } from './pipeline/context';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const KEYS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: true,
  wallConnector: 'key',
};

/** Rows listed top-first for reading; stored bottom-first. */
function maskFromRows(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  return { cols: bottomFirst[0].length, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

const BAR: (0 | 1)[] = [1, 1, 1, 1, 1, 1];
const STEM: (0 | 1)[] = [0, 0, 1, 1, 0, 0];

// 3×7.5: a 3-wide bar two units deep over a 1-wide stem.
const T_MASK = maskFromRows([BAR, BAR, BAR, BAR, ...Array.from({ length: 11 }, () => STEM)]);

const PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 7.5,
  height: 5,
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
  cellMask: T_MASK,
};

// Half-height of a vertical probe.
const PROBE = 0.05;

describe('split connectors on a custom-shaped bin', () => {
  const dim = deriveDimensions(PARAMS, true);
  const pitch = PARAMS.gridUnitMm;
  // The stem's outer wall faces, a tolerance gap in from its cell edges.
  const stemHalfWidth = pitch / 2 - 0.25;
  // A cut through the stem, between the bottom piece (male) and the top one.
  const cutY = -pitch;
  const outerD = PARAMS.depth * pitch - 0.5;
  const maleCenterY = (-outerD / 2 + cutY) / 2;
  const femaleCenterY = (cutY + outerD / 2) / 2;

  type SplitPiece = ReturnType<ReturnType<typeof getGenerateSplitPreview>>['pieces'][number];
  let pieces: readonly SplitPiece[] = [];
  let male: SplitPiece;
  let female: SplitPiece;
  beforeAll(() => {
    pieces = getGenerateSplitPreview()(PARAMS, [], [cutY], KEYS).pieces;
    male = pieces.reduce((a, b) => (b.offsetY < a.offsetY ? b : a));
    female = pieces.reduce((a, b) => (b.offsetY > a.offsetY ? b : a));
  }, 120000);

  const mesh = (piece: SplitPiece): MeshData => ({
    ...piece,
    triangleCount: piece.indices.length / 3,
  });

  it('grows no material outside the stem around the cut', () => {
    expect(pieces).toHaveLength(2);
    let worst = 0;
    const v = male.vertices;
    for (let i = 0; i < v.length; i += 3) {
      const y = v[i + 1] + maleCenterY;
      if (Math.abs(y - cutY) > 10) continue;
      worst = Math.max(worst, Math.abs(v[i]) - stemHalfWidth);
    }
    expect(worst, `material ${worst.toFixed(2)}mm outside the stem wall`).toBeLessThanOrEqual(0.05);
  }, 120000);

  // A millimetre past the cut, measured in from each stem wall's face: the
  // male carries its tongue a key's width in; the female keeps its outer skin,
  // is grooved there, and has the pilaster behind the groove.
  it('keys both stem walls', () => {
    const z = (dim.baseOffsetZ + dim.wallTopZ) / 2;
    for (const side of [-1, 1] as const) {
      const wall = side < 0 ? 'left' : 'right';
      const at = (piece: SplitPiece, centreY: number, inboard: number): boolean =>
        isSolidThrough(
          mesh(piece),
          side * (stemHalfWidth - inboard),
          cutY + 1 - centreY,
          z - PROBE,
          z + PROBE
        );
      expect(at(male, maleCenterY, 1.75), `tongue on the ${wall} stem wall`).toBe(true);
      expect(at(female, femaleCenterY, 0.4), `outer skin on the ${wall} stem wall`).toBe(true);
      expect(at(female, femaleCenterY, 1.75), `groove on the ${wall} stem wall`).toBe(false);
      expect(at(female, femaleCenterY, 2.95), `pilaster on the ${wall} stem wall`).toBe(true);
    }
  }, 120000);

  it('laps the floor across the cut', () => {
    const z = dim.baseOffsetZ + PARAMS.wallThickness * 0.6;
    const at = (piece: SplitPiece, centreY: number): boolean =>
      isSolidThrough(mesh(piece), 0, cutY + 0.3 - centreY, z - PROBE, z + PROBE);
    expect(at(male, maleCenterY)).toBe(true);
    expect(at(female, femaleCenterY)).toBe(false);
  }, 120000);

  it('builds valid pieces that export watertight', async () => {
    for (const [i, piece] of pieces.entries()) {
      assertStructurallyValid(mesh(piece), `preview piece ${i}`);
    }
    const exported = await getExportSplitBin()(PARAMS, [], [cutY], 0.01, 5, KEYS);
    expect(exported.pieces).toHaveLength(2);
    for (const [i, piece] of exported.pieces.entries()) {
      const label = `export piece ${i}`;
      const stats = analyzeExportedStl(piece.data, label);
      expect(stats.minFinite, `${label}: finite coordinates`).toBe(true);
      expect(stats.boundaryEdges, `${label}: boundary edges`).toBe(0);
      expect(stats.nonManifoldEdges, `${label}: non-manifold edges`).toBe(0);
      expect(stats.volume, `${label}: volume`).toBeGreaterThan(0);
    }
  }, 240000);
});

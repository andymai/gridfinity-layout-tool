// @vitest-environment node
/**
 * Cutouts (top-down cavity cutouts and wall cutouts) survive the
 * boolean-intersection split path. Splitting builds the body solid without
 * the stacking lip, which earlier silently swallowed cut() failures and
 * dropped cutouts from the output.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, Cutout, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const NO_CONNECTORS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
};

const SOLID_LIPPED_BIN: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 6,
  depth: 2,
  height: 3,
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: true },
};

function makeRectCutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'cutout-1',
    shape: 'rectangle',
    x: 30,
    y: 20,
    width: 40,
    depth: 40,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

function totalVerts(pieces: readonly { vertices: Float32Array }[]): number {
  return pieces.reduce((s, p) => s + p.vertices.length, 0);
}

describe('split + top-down cutouts', () => {
  it('split pieces preserve cutout (delta matches unsplit baseline)', () => {
    const generateBin = getGenerateBin();
    const generateSplitPreview = getGenerateSplitPreview();
    const cutout = makeRectCutout();

    const unsplitDelta =
      generateBin({ ...SOLID_LIPPED_BIN, cutouts: [cutout] }, undefined, true).vertices.length -
      generateBin({ ...SOLID_LIPPED_BIN, cutouts: [] }, undefined, true).vertices.length;
    const splitDelta =
      totalVerts(
        generateSplitPreview({ ...SOLID_LIPPED_BIN, cutouts: [cutout] }, [0], [], NO_CONNECTORS)
          .pieces
      ) -
      totalVerts(
        generateSplitPreview({ ...SOLID_LIPPED_BIN, cutouts: [] }, [0], [], NO_CONNECTORS).pieces
      );

    expect(unsplitDelta, 'sanity: unsplit cutout adds vertices').toBeGreaterThan(0);
    expect(
      splitDelta,
      `Split-path cutout delta (${splitDelta}) should be on the same order as unsplit (${unsplitDelta}). ` +
        `If splitDelta ≈ 0 the cutout was silently dropped during split.`
    ).toBeGreaterThan(unsplitDelta * 0.5);
  }, 120000);

  it('cutout straddling the split plane appears in both pieces', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    // Interior width ≈ 249.1mm; bin center sits at ~124.55mm in interior coords.
    const straddler = makeRectCutout({ x: 95, width: 60, cutDepth: 12 });

    const without = generateSplitPreview(
      { ...SOLID_LIPPED_BIN, cutouts: [] },
      [0],
      [],
      NO_CONNECTORS
    );
    const withCut = generateSplitPreview(
      { ...SOLID_LIPPED_BIN, cutouts: [straddler] },
      [0],
      [],
      NO_CONNECTORS
    );

    for (let i = 0; i < 2; i++) {
      expect(
        withCut.pieces[i].vertices.length,
        `Piece ${without.pieces[i].label}: straddling cutout should add vertices`
      ).toBeGreaterThan(without.pieces[i].vertices.length);
    }
  }, 120000);
});

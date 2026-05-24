// @vitest-environment node
/**
 * Cutouts on solid bins must survive the boolean-intersection split path.
 * featuresStage hands each cutout shape to booleanStage's cutAllBisect as
 * an independent cutTarget so a single bad tool no longer drops the whole
 * set, and export passes pick up `simplify` topology cleanup.
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

// Buckets the mesh's z values to 0.5mm precision. A carved cavity introduces
// a new internal floor surface at z = rim − cutDepth, so the bucket set
// gains an entry the no-cutout baseline doesn't have.
function zLevels(...meshes: readonly Float32Array[]): Set<number> {
  const levels = new Set<number>();
  for (const verts of meshes) {
    for (let i = 2; i < verts.length; i += 3) {
      levels.add(Math.round(verts[i] * 2) / 2);
    }
  }
  return levels;
}

function pieceZLevels(pieces: readonly { vertices: Float32Array }[]): Set<number> {
  return zLevels(...pieces.map((p) => p.vertices));
}

describe('split + top-down cutouts', () => {
  it('carves a cavity floor that the no-cutout baseline lacks (unsplit and split)', () => {
    const generateBin = getGenerateBin();
    const generateSplitPreview = getGenerateSplitPreview();
    const cutout = makeRectCutout();

    const unsplitBase = zLevels(
      generateBin({ ...SOLID_LIPPED_BIN, cutouts: [] }, undefined, true).vertices
    );
    const unsplitCut = zLevels(
      generateBin({ ...SOLID_LIPPED_BIN, cutouts: [cutout] }, undefined, true).vertices
    );
    expect(
      [...unsplitCut].filter((z) => !unsplitBase.has(z)),
      'unsplit: cavity should introduce a z level the no-cutout baseline lacks'
    ).not.toHaveLength(0);

    const splitBase = pieceZLevels(
      generateSplitPreview({ ...SOLID_LIPPED_BIN, cutouts: [] }, [0], [], NO_CONNECTORS).pieces
    );
    const splitCut = pieceZLevels(
      generateSplitPreview({ ...SOLID_LIPPED_BIN, cutouts: [cutout] }, [0], [], NO_CONNECTORS)
        .pieces
    );
    expect(
      [...splitCut].filter((z) => !splitBase.has(z)),
      'split: cavity should introduce a z level the no-cutout split baseline lacks'
    ).not.toHaveLength(0);
  }, 120000);

  it('straddling cutout leaves a cavity floor in both split pieces', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const straddler = makeRectCutout({ x: 95, width: 60, cutDepth: 12 });

    const baselinePieces = generateSplitPreview(
      { ...SOLID_LIPPED_BIN, cutouts: [] },
      [0],
      [],
      NO_CONNECTORS
    ).pieces;
    const withCutPieces = generateSplitPreview(
      { ...SOLID_LIPPED_BIN, cutouts: [straddler] },
      [0],
      [],
      NO_CONNECTORS
    ).pieces;

    for (let i = 0; i < 2; i++) {
      const base = zLevels(baselinePieces[i].vertices);
      const newLevels = [...zLevels(withCutPieces[i].vertices)].filter((z) => !base.has(z));
      expect(
        newLevels,
        `piece ${withCutPieces[i].label}: straddling cavity should add a z level`
      ).not.toHaveLength(0);
    }
  }, 120000);

  it('a degenerate cutout in the set is skipped without dropping the others', () => {
    // Zero-size cutouts are filtered before they reach the boolean (the
    // shape builder returns null for non-positive dimensions), so this
    // pins the filter behaviour rather than cutAllBisect's bisect path.
    // A real bisect-recovery regression test needs a tool that builds
    // successfully but fails inside cut() — none of our 20+ permutations
    // surface one consistently, so we cover the architecture via this
    // weaker but realistic property.
    const generateBin = getGenerateBin();
    const bad: Cutout = makeRectCutout({ id: 'bad', x: 100, width: 0, depth: 0 });
    const good = makeRectCutout({ id: 'good', x: 20, y: 20, width: 30, depth: 30, cutDepth: 8 });

    const base = zLevels(
      generateBin({ ...SOLID_LIPPED_BIN, cutouts: [] }, undefined, true).vertices
    );
    const mixed = zLevels(
      generateBin({ ...SOLID_LIPPED_BIN, cutouts: [bad, good] }, undefined, true).vertices
    );
    expect(
      [...mixed].filter((z) => !base.has(z)),
      'the good cutout should still carve a cavity alongside a filtered-out degenerate tool'
    ).not.toHaveLength(0);
  }, 120000);
});

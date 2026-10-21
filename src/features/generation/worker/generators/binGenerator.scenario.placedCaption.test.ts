// @vitest-environment node
/**
 * A layout label filling a linked design's blank caption reaches the generated
 * tab as real glyphs, in the preview and in the exported mesh.
 */
import { describe, it, beforeAll, beforeEach, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { loadTestFonts } from '@/test/loadTestFonts';
import { clearAllCaches } from './shapeCache';
import { FeatureTag } from './featureTags';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { withPlacedTabCaption } from '@/shared/utils/placedCaption';
import type { BinParams, CompartmentConfig, LabelTabConfig } from '@/shared/types/bin';
import type { FaceGroupData } from '@/shared/types/generation';

beforeAll(async () => {
  await initBrepjs();
  await loadTestFonts();
}, 60_000);

beforeEach(() => clearAllCaches());

function design(
  compartments: Partial<CompartmentConfig> = {},
  label: Partial<LabelTabConfig> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 1,
    height: 3,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, ...label },
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, ...compartments },
  };
}

function textTriangles(m: { faceGroups?: readonly FaceGroupData[] }): number {
  return (m.faceGroups ?? [])
    .filter((fg) => fg.tag === FeatureTag.TEXT)
    .reduce((sum, fg) => sum + fg.count / 3, 0);
}

describe('layout label in a blank caption', () => {
  it('cuts the label into a single-compartment tab that is otherwise blank', () => {
    const blank = design();
    expect(textTriangles(getGenerateBin()(blank))).toBe(0);

    const placed = withPlacedTabCaption(blank, 'Screws');
    expect(textTriangles(getGenerateBin()(placed))).toBeGreaterThan(0);
  }, 120_000);

  it('keeps the glyphs through the export fuse', () => {
    const placed = withPlacedTabCaption(design(), 'Screws');
    expect(textTriangles(getGenerateBin()(placed, undefined, true))).toBeGreaterThan(0);
  }, 180_000);

  it('cuts the label into the one spanning tab of a single-row design', () => {
    const placed = withPlacedTabCaption(
      design({ cols: 3, rows: 1, cells: [0, 1, 2] }, { span: true }),
      'Cables'
    );
    expect(placed.label.rowTexts).toEqual(['Cables']);
    expect(textTriangles(getGenerateBin()(placed))).toBeGreaterThan(0);
  }, 120_000);
});

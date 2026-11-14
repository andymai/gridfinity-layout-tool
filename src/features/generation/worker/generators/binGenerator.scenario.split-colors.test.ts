// @vitest-environment node
/**
 * A split piece carries the same face tags as the region of the unsplit bin it
 * came from, so a multi-color design keeps its colors after the split.
 *
 * Two places can lose them. The lip is built separately for a split and fused
 * onto each piece, so it carries no LIP tag unless one is stamped on it. The
 * cut faces come from an untagged cutting box, so they must read as body
 * rather than borrow the lip or socket tag of a neighbouring face.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import type { FaceGroupData } from '@/features/generation/bridge/types';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { isOk } from '@/core/result';
import { FeatureTag } from './featureTags';
import {
  initBrepjs,
  getGenerateSplitPreview,
  getExportSplitBin,
} from './__kernel-tests__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

const PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 4,
  height: 3,
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
};

const NO_CONNECTORS: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: false };
const WITH_CONNECTORS: SplitConnectorConfig = { ...DEFAULT_SPLIT_CONNECTOR_CONFIG, enabled: true };

/** Per-triangle tag from index-unit face group ranges. */
function triTags(faceGroups: readonly FaceGroupData[], triangleCount: number): Int32Array {
  const tags = new Int32Array(triangleCount).fill(FeatureTag.UNKNOWN);
  for (const g of faceGroups) {
    for (let t = g.start / 3; t < (g.start + g.count) / 3; t++) tags[t] = g.tag;
  }
  return tags;
}

/** Corner `k` of triangle `t` from an indexed mesh. */
function corner(vertices: Float32Array, indices: Uint32Array, t: number, k: number): number[] {
  const v = indices[t * 3 + k] * 3;
  return [vertices[v], vertices[v + 1], vertices[v + 2]];
}

/**
 * Tags of the triangles that lie flat on a cut face: all three corners on the
 * plane `y = seamY` (within the seam gap), facing along Y.
 */
function seamFaceTags(
  vertices: Float32Array,
  indices: Uint32Array,
  tags: Int32Array,
  seamY: number
): number[] {
  const out: number[] = [];
  for (let t = 0; t < indices.length / 3; t++) {
    const pts = [0, 1, 2].map((k) => corner(vertices, indices, t, k));
    if (pts.every((p) => Math.abs(p[1] - seamY) < 0.2)) out.push(tags[t]);
  }
  return out;
}

describe('split bin keeps its face tags', () => {
  it.each([
    ['without connectors', NO_CONNECTORS],
    ['with connectors', WITH_CONNECTORS],
  ])(
    'preview pieces carry lip and socket tags, and cut faces read as body (%s)',
    (_, cfg) => {
      const preview = getGenerateSplitPreview()(PARAMS, [], [0], cfg);
      expect(preview.pieces).toHaveLength(2);

      for (const piece of preview.pieces) {
        const triangleCount = piece.indices.length / 3;
        expect(piece.faceGroups, `piece ${piece.label} has no face groups`).toBeDefined();
        const tags = triTags(piece.faceGroups ?? [], triangleCount);
        const present = new Set(tags);
        expect(present.has(FeatureTag.LIP), `piece ${piece.label} lost the LIP tag`).toBe(true);
        expect(present.has(FeatureTag.SOCKET), `piece ${piece.label} lost the SOCKET tag`).toBe(
          true
        );

        // Piece meshes are centred on their own footprint, so the seam sits on
        // the piece's front (row 2) or back (row 1) edge.
        const halfD = (piece.depthUnits * PARAMS.gridUnitMm) / 2;
        const seamY = piece.row === 1 ? halfD : -halfD;
        const seam = seamFaceTags(piece.vertices, piece.indices, tags, seamY);
        expect(seam.length, `piece ${piece.label} has no cut-face triangles`).toBeGreaterThan(0);
        const borrowed = seam.filter((t) => t === FeatureTag.LIP || t === FeatureTag.SOCKET);
        expect(
          borrowed.length,
          `piece ${piece.label}: ${borrowed.length}/${seam.length} cut-face triangles took a lip or socket tag`
        ).toBe(0);
      }
    },
    120000
  );

  it('export pieces carry face groups that cover every STL triangle', async () => {
    const exported = await getExportSplitBin()(PARAMS, [], [0], 0.01, 5, NO_CONNECTORS);
    expect(exported.pieces).toHaveLength(2);

    for (const piece of exported.pieces) {
      const parsed = parseSTLBinary(piece.data);
      if (!isOk(parsed)) throw new Error('STL parse failed');
      const triangleCount = parsed.value.vertices.length / 9;
      expect(piece.faceGroups, `piece ${piece.label} has no face groups`).toBeDefined();
      const groups = piece.faceGroups ?? [];
      const covered = groups.reduce((n, g) => n + g.count, 0);
      expect(covered).toBe(triangleCount * 3);
      const present = new Set(groups.map((g) => g.tag));
      expect(present.has(FeatureTag.LIP), `piece ${piece.label} lost the LIP tag`).toBe(true);
      expect(present.has(FeatureTag.SOCKET), `piece ${piece.label} lost the SOCKET tag`).toBe(true);
    }
  }, 120000);
});

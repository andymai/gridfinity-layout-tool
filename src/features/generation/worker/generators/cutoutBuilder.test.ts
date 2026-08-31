// @vitest-environment node
/**
 * Real-kernel tests for `findBottomEdges` — the scoop-fillet edge selector.
 *
 * Regression for GH: the selector must return only edges that lie flat in
 * the bottom plane, never a box's vertical corner edges. Filleting a vertical
 * edge rounds the cutout corner all the way to the top rim and leaves a
 * degenerate single-face sliver there, which exports as a non-manifold STL edge.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { box, getBounds } from 'brepjs';
import { findBottomEdges, buildCutoutCuts } from './cutoutBuilder';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { loadTestFonts } from '@/test/loadTestFonts';
import type { BinParams, Cutout } from '@/shared/types/bin';

beforeAll(async () => {
  const { initBrepjs } = await import('./__kernel-tests__/wasmInit');
  await initBrepjs();
  await loadTestFonts();
}, 60_000);

function meshCutoutParams(over: Partial<Cutout> = {}): BinParams {
  const cutout: Cutout = {
    id: 'm1',
    shape: 'mesh',
    meshId: 'asset-1',
    x: 10,
    y: 10,
    width: 20,
    depth: 12,
    cutDepth: 6,
    rotation: 0,
    cornerRadius: 0,
    label: 'AB',
    engraveLabel: true,
    groupId: null,
    ...over,
  };
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts: [cutout],
  };
}

describe('mesh (STL) cutout labels (#4030)', () => {
  it('engraves a label on a mesh cutout even though its cavity is mesh-domain', () => {
    // The mesh imprint itself is subtracted post-tessellation, so the ONLY BREP
    // tool here is the engraved label, which regressed to nothing for mesh.
    const withLabel = buildCutoutCuts(meshCutoutParams(), 80, 80, 35);
    try {
      expect(withLabel.cutTools.length + withLabel.fuseTools.length).toBeGreaterThan(0);
    } finally {
      for (const t of [...withLabel.cutTools, ...withLabel.fuseTools]) t.delete();
    }
  }, 60_000);

  it('builds nothing for a mesh cutout with no label (cavity stays mesh-domain)', () => {
    const noLabel = buildCutoutCuts(
      meshCutoutParams({ engraveLabel: false, label: '' }),
      80,
      80,
      35
    );
    expect(noLabel.cutTools.length + noLabel.fuseTools.length).toBe(0);
  }, 60_000);
});

describe('findBottomEdges', () => {
  it('selects only the flat bottom edges, excluding vertical corner edges', () => {
    // 20×20×10 box centered so its bottom face sits at z=0.
    const solid = box(20, 20, 10, { at: [0, 0, 5] });
    try {
      const edges = findBottomEdges(solid, 0, { minX: -10, minY: -10, maxX: 10, maxY: 10 });

      // A sharp box has exactly four bottom edges; the four verticals (zMax=10)
      // and four top edges (zMin=10) must be excluded.
      expect(edges.length).toBe(4);
      for (const e of edges) {
        const b = getBounds(e);
        // Every selected edge lies fully in the z≈0 plane — no vertical edge
        // (which spans up to the top) leaks in, in either direction.
        expect(b.zMin).toBeGreaterThanOrEqual(-0.1);
        expect(b.zMax).toBeLessThanOrEqual(0.1);
      }
    } finally {
      solid.delete();
    }
  }, 60_000);
});

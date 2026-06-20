/**
 * Lid generation scenario tests.
 *
 * Runs the actual brepjs build (Node + OpenCascade WASM) and asserts the
 * lid mesh comes out structurally valid: positive triangle count, no NaN,
 * consistent vertex/normal/index counts, sensible bounding box.
 *
 *   pnpm run test:run -- src/features/generation/worker/generators/lidGenerator.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LidConfig } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';

/** Build a cellMask at half-bin resolution from a 2D array (row 0 = top). */
function buildMask(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  const cols = bottomFirst[0]?.length ?? 0;
  return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

/** 3×3 L-shape with the bottom-right 1×1 cell removed (6×6 mask). */
const L_SHAPE_MASK: CellMask = buildMask([
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 0, 0],
]);

/** 3×3 U-shape: open at the top middle (6×6 mask). */
const U_SHAPE_MASK: CellMask = buildMask([
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
]);

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

function makeParams(lid: Partial<LidConfig>, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...extra,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...lid },
  };
}

describe('lid generation and export scenarios', () => {
  it('returns null when lid is disabled', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    expect(generateLid(DEFAULT_BIN_PARAMS)).toBeNull();
  });

  it('returns null when bin has no stacking lip', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams(
      { enabled: true },
      { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }
    );
    expect(generateLid(params)).toBeNull();
  });

  it('produces a valid mesh for a basic 2x2 lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '2x2 lid');
  });

  it('produces a valid mesh for a 3x2 rectangular lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({}, { width: 3, depth: 2, height: 4 }));
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '3x2 lid');
  });

  it('produces a valid mesh for a 1x1 lid (smallest case)', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({}, { width: 1, depth: 1, height: 2 }));
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '1x1 lid');
  });

  it('lid Z extent matches the configured height unit (~1U + extras)', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
    expect(result).not.toBeNull();
    const bb = boundingBox(result!.vertices);
    const heightUnit = DEFAULT_BIN_PARAMS.heightUnitMm; // 7mm
    // Lid lives roughly between Z = -heightUnit (rails extend a bit further)
    // and Z = +LIP_HEIGHT (4.4mm) when stack grid is enabled, or Z=topThickness when not.
    expect(bb.minZ).toBeGreaterThan(-heightUnit - 5); // not absurdly deep
    expect(bb.minZ).toBeLessThan(0); // walls extend below floor
    expect(bb.maxZ).toBeLessThan(heightUnit); // doesn't exceed 1U upward
    // Sanity: lid should be tall enough to engage the lip
    expect(bb.maxZ - bb.minZ).toBeGreaterThan(4); // at least lip-height tall
  });

  it('lid XY footprint is approximately the bin outer footprint', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams({}, { width: 2, depth: 2, height: 3 });
    const result = generateLid(params);
    expect(result).not.toBeNull();
    const bb = boundingBox(result!.vertices);
    const expectedW = params.width * params.gridUnitMm;
    const expectedD = params.depth * params.gridUnitMm;
    const widthMm = bb.maxX - bb.minX;
    const depthMm = bb.maxY - bb.minY;
    // Within 1mm of expected (lid uses tighter clearance than bin)
    expect(Math.abs(widthMm - expectedW)).toBeLessThan(2);
    expect(Math.abs(depthMm - expectedD)).toBeLessThan(2);
  });

  it('mesh changes when stackable top toggle differs', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const withGrid = generateLid(
      makeParams({ stackableTop: true }, { width: 2, depth: 2, height: 3 })
    );
    const withoutGrid = generateLid(
      makeParams({ stackableTop: false }, { width: 2, depth: 2, height: 3 })
    );
    expect(withGrid).not.toBeNull();
    expect(withoutGrid).not.toBeNull();
    // Stack grid adds geometry → more triangles
    expect(withGrid!.triangleCount).toBeGreaterThan(withoutGrid!.triangleCount);
    // And extends Z+ above the lid floor
    const withBB = boundingBox(withGrid!.vertices);
    const withoutBB = boundingBox(withoutGrid!.vertices);
    expect(withBB.maxZ).toBeGreaterThan(withoutBB.maxZ);
  });

  it('stack grid stays inside the lid outer footprint (no protrusion)', async () => {
    // Regression: the lip profile is swept INWARD from the perimeter
    // (negative profile X = inward from path), so the stack grid's outer
    // face must coincide with the lid's outer perimeter — never extend
    // past it. Compare bounding boxes of stack-on vs stack-off lids:
    // adding the stack grid must not widen the X/Y footprint.
    const { generateLid } = await import('./lidOrchestrator');
    const withGrid = generateLid(
      makeParams({ stackableTop: true }, { width: 2, depth: 2, height: 3 })
    );
    const withoutGrid = generateLid(
      makeParams({ stackableTop: false }, { width: 2, depth: 2, height: 3 })
    );
    expect(withGrid).not.toBeNull();
    expect(withoutGrid).not.toBeNull();
    const withBB = boundingBox(withGrid!.vertices);
    const withoutBB = boundingBox(withoutGrid!.vertices);
    // Within tessellation tolerance, the stack grid must sit at or inside
    // the existing footprint — never widen it.
    const tolerance = 0.01;
    expect(withBB.maxX).toBeLessThanOrEqual(withoutBB.maxX + tolerance);
    expect(withBB.minX).toBeGreaterThanOrEqual(withoutBB.minX - tolerance);
    expect(withBB.maxY).toBeLessThanOrEqual(withoutBB.maxY + tolerance);
    expect(withBB.minY).toBeGreaterThanOrEqual(withoutBB.minY - tolerance);
  });

  it('magnet holes add cuts (mesh changes meaningfully)', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const without = generateLid(
      makeParams({ magnetHoles: false }, { width: 2, depth: 2, height: 3 })
    );
    const withMagnets = generateLid(
      makeParams({ magnetHoles: true }, { width: 2, depth: 2, height: 3 })
    );
    expect(without).not.toBeNull();
    expect(withMagnets).not.toBeNull();
    // Mesh should be different (magnets add face groups)
    expect(withMagnets!.triangleCount).not.toBe(without!.triangleCount);
  });

  it('exports STL for stackable lid with magnet holes (regression #1655)', async () => {
    // Stackable top + magnet holes used to fuse the slab BEFORE cutting
    // magnet pockets, leaving each cylinder's coplanar-margin overshoot
    // hanging inside the pocket cavity (a void inside the body's bounding
    // volume). OCCT/WASM builds varied on whether they could trim that
    // configuration cleanly — Firefox succeeded, some Chrome builds failed
    // with STL_EXPORT_FAILED. Now the magnet cut runs against the
    // floor-only body so the overshoot lands in empty space above the
    // body, which is a topologically simpler through-cut.
    const { exportLid } = await import('./lidOrchestrator');
    const result = await exportLid(
      makeParams(
        { stackableTop: true, magnetHoles: true },
        {
          width: 2,
          depth: 1,
          height: 4,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
        }
      ),
      'stl'
    );
    expect(result).not.toBeNull();
    expect(result!.data.byteLength).toBeGreaterThan(0);
  }, 60_000);

  it('builds a valid mesh for half-bin width (2.5×2) with magnets', async () => {
    // Regression: prior to the forEachCell-based magnet iteration, the
    // hole loop ran `for (cx = 0; cx < cellsX; cx++)` over a fractional
    // `cellsX = 2.5`, placing the trailing-cell magnets OUTSIDE the lid
    // footprint. cutAll silently drops cutters that miss the body, so the
    // bug was invisible to a structural check — but the lid's magnet
    // pattern was asymmetric and didn't mate with the bin's base sockets.
    // Today the lid uses `forEachCell` and skips non-1u cells, matching
    // the bin's base-socket convention.
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams({ magnetHoles: true }, { width: 2.5, depth: 2, height: 3 })
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '2.5×2 lid');
  });

  describe('fractional foot edge — magnet hole alignment', () => {
    // A 2.5×1 lid floor is X-symmetric apart from the magnet holes, which only
    // cut the full (1u) cells. So the side the holes cluster on is a proxy for
    // where the bin's half foot sits: 'end' (½ sliver on +X) puts the full
    // cells — and their magnets — on −X; 'start' mirrors that. Counting mesh
    // vertices either side of X=0 gives an integer bias that flips with the
    // edge, proving cutMagnetHoles honours fractionalEdge end-to-end (and thus
    // the lid magnets stay mated with the bin's base sockets, GH #2271).
    const vertexBiasX = (vertices: ArrayLike<number>): number => {
      let left = 0;
      let right = 0;
      for (let i = 0; i < vertices.length; i += 3) {
        if (vertices[i] < -1e-6) left++;
        else if (vertices[i] > 1e-6) right++;
      }
      return left - right;
    };

    it('shifts magnet holes to the opposite side when the edge flips', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const lid = (edge: 'start' | 'end') =>
        generateLid(
          makeParams(
            { magnetHoles: true, stackableTop: true },
            { width: 2.5, depth: 1, height: 3, fractionalEdgeX: edge }
          )
        );
      const end = lid('end');
      const start = lid('start');
      expect(end).not.toBeNull();
      expect(start).not.toBeNull();
      assertStructurallyValid(end!, '2.5×1 lid (edge=end)');
      assertStructurallyValid(start!, '2.5×1 lid (edge=start)');

      // 'end' → full cells (with magnets) on −X ⇒ left-biased; 'start' mirrors.
      expect(vertexBiasX(end!.vertices)).toBeGreaterThan(0);
      expect(vertexBiasX(start!.vertices)).toBeLessThan(0);
    });

    it('leaves whole-unit lids identical regardless of the edge setting', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const lid = (edge: 'start' | 'end') =>
        generateLid(
          makeParams(
            { magnetHoles: true, stackableTop: true },
            { width: 2, depth: 1, height: 3, fractionalEdgeX: edge }
          )
        );
      const end = lid('end');
      const start = lid('start');
      expect(end).not.toBeNull();
      expect(start).not.toBeNull();
      // No fractional cell ⇒ same decomposition ⇒ identical, symmetric mesh.
      expect(start!.triangleCount).toBe(end!.triangleCount);
      expect(vertexBiasX(end!.vertices)).toBe(0);
      expect(vertexBiasX(start!.vertices)).toBe(0);
    });
  });

  it('per-side click rails — disabling sides reduces the rail count monotonically', async () => {
    // Regression for the per-side rail refactor: each disabled side
    // should remove exactly one rail's worth of geometry. We don't need
    // exact triangle counts — just monotonic ordering: all-on > 3-on >
    // 2-on > 1-on > 0-on (friction-fit). At 0-on the rail-fuse step is
    // skipped entirely, so the mesh is the smallest of the set.
    const { generateLid } = await import('./lidOrchestrator');
    const allOn = generateLid(
      makeParams(
        { clickRails: { front: true, back: true, left: true, right: true } },
        { width: 3, depth: 2, height: 3 }
      )
    );
    const threeOn = generateLid(
      makeParams(
        { clickRails: { front: true, back: true, left: true, right: false } },
        { width: 3, depth: 2, height: 3 }
      )
    );
    const oneOn = generateLid(
      makeParams(
        { clickRails: { front: false, back: true, left: false, right: false } },
        { width: 3, depth: 2, height: 3 }
      )
    );
    const noneOn = generateLid(
      makeParams(
        { clickRails: { front: false, back: false, left: false, right: false } },
        { width: 3, depth: 2, height: 3 }
      )
    );
    expect(allOn).not.toBeNull();
    expect(threeOn).not.toBeNull();
    expect(oneOn).not.toBeNull();
    expect(noneOn).not.toBeNull();
    assertStructurallyValid(allOn!, 'all-on rails');
    assertStructurallyValid(threeOn!, '3-on rails');
    assertStructurallyValid(oneOn!, '1-on rails');
    assertStructurallyValid(noneOn!, 'no rails (friction-fit)');
    // Each rail adds geometry; fewer rails ⇒ fewer triangles.
    expect(allOn!.triangleCount).toBeGreaterThan(threeOn!.triangleCount);
    expect(threeOn!.triangleCount).toBeGreaterThan(oneOn!.triangleCount);
    expect(oneOn!.triangleCount).toBeGreaterThan(noneOn!.triangleCount);
  });

  it('label tabs auto-skip only the BACK rail (front + sides keep theirs)', async () => {
    // Regression for the omitFrontBackRails → disabledRails refactor:
    // the previous logic disabled BOTH front and back rails whenever
    // label tabs were enabled. The new behavior only disables back,
    // since label tabs sit on the back wall only.
    const { generateLid } = await import('./lidOrchestrator');
    const noLabel = generateLid(
      makeParams(
        { clickRails: { front: true, back: true, left: true, right: true } },
        { width: 3, depth: 2, height: 3 }
      )
    );
    const withLabel = generateLid(
      makeParams(
        { clickRails: { front: true, back: true, left: true, right: true } },
        {
          width: 3,
          depth: 2,
          height: 3,
          label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
        }
      )
    );
    expect(noLabel).not.toBeNull();
    expect(withLabel).not.toBeNull();
    assertStructurallyValid(noLabel!, 'no label, all rails');
    assertStructurallyValid(withLabel!, 'with label, back rail skipped');
    // Skipping one rail (back) must reduce triangle count vs all-4.
    expect(withLabel!.triangleCount).toBeLessThan(noLabel!.triangleCount);
    // And the rail-skip should be EXACTLY one wall, not two — compare
    // against the previously-tested 3-on configuration which also has
    // three rails. Counts should be in the same ballpark (within 10%).
    const threeOn = generateLid(
      makeParams(
        { clickRails: { front: true, back: true, left: true, right: false } },
        { width: 3, depth: 2, height: 3 }
      )
    );
    expect(threeOn).not.toBeNull();
    const ratio = withLabel!.triangleCount / threeOn!.triangleCount;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  describe('polygon (cellMask) lids', () => {
    it('produces a valid mesh for a 3×3 L-shape lid', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'L-shape lid');
    });

    it('produces a valid mesh for a 3×3 U-shape lid', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: U_SHAPE_MASK })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'U-shape lid');
    });

    it('L-shape lid footprint follows the polygon (not bounding rect)', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const rect = generateLid(makeParams({}, { width: 3, depth: 3, height: 3 }));
      const lShape = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      expect(rect).not.toBeNull();
      expect(lShape).not.toBeNull();
      // L-shape has less material than 3×3 rectangle → fewer triangles or
      // (more likely) a different mesh entirely. Either way, NOT identical.
      expect(lShape!.triangleCount).not.toBe(rect!.triangleCount);
    });

    it('L-shape lid stays within the 3×3 bounding box', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      expect(result).not.toBeNull();
      const bb = boundingBox(result!.vertices);
      const expected = 3 * DEFAULT_BIN_PARAMS.gridUnitMm;
      expect(bb.maxX - bb.minX).toBeLessThanOrEqual(expected + 0.01);
      expect(bb.maxY - bb.minY).toBeLessThanOrEqual(expected + 0.01);
    });

    it('lid mesh exposes face groups for downstream rendering', async () => {
      // We populate face-group provenance via collectOrigins (LID_BODY,
      // LID_RAIL) so consumers have face-level structure even though brepjs
      // currently collapses fresh-shape origins to 0 (last-writer-wins).
      // The hover-glow path renders whole-mesh emissive instead of relying
      // on per-face tags — see LidMesh.tsx.
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
      expect(result).not.toBeNull();
      expect(result!.faceGroups).toBeDefined();
      expect(result!.faceGroups!.length).toBeGreaterThan(0);
    });

    it('polygon lid magnet holes only cut filled cells', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      // Bin with magnets enabled on the lid. L-shape has 8 filled cells
      // (out of 9), so 8 sets of 4 magnets = 32 holes vs 36 for a 3×3.
      const lShape = generateLid(
        makeParams({ magnetHoles: true }, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      const rect = generateLid(
        makeParams({ magnetHoles: true }, { width: 3, depth: 3, height: 3 })
      );
      expect(lShape).not.toBeNull();
      expect(rect).not.toBeNull();
      // Different magnet counts → different mesh
      expect(lShape!.triangleCount).not.toBe(rect!.triangleCount);
    });
  });

  describe('overhang', () => {
    it('grows the lid footprint to match an overhang-expanded bin body', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const base = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
      const expanded = generateLid(
        makeParams(
          {},
          {
            width: 2,
            depth: 2,
            height: 3,
            overhang: { left: 5, right: 5, front: 4, back: 4 },
          }
        )
      );
      expect(base).not.toBeNull();
      expect(expanded).not.toBeNull();
      assertStructurallyValid(expanded!, 'overhang lid');
      const baseBB = boundingBox(base!.vertices);
      const expBB = boundingBox(expanded!.vertices);
      // Footprint grows by left+right (=10mm) in width and front+back (=8mm)
      // in depth, within tessellation tolerance.
      const widthDelta = expBB.maxX - expBB.minX - (baseBB.maxX - baseBB.minX);
      const depthDelta = expBB.maxY - expBB.minY - (baseBB.maxY - baseBB.minY);
      expect(widthDelta).toBeGreaterThan(9);
      expect(widthDelta).toBeLessThan(11);
      expect(depthDelta).toBeGreaterThan(7);
      expect(depthDelta).toBeLessThan(9);
    });

    it('shifts the lid perimeter for asymmetric overhang (heavier side reaches further)', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const base = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
      const rightHeavy = generateLid(
        makeParams(
          {},
          {
            width: 2,
            depth: 2,
            height: 3,
            overhang: { left: 0, right: 8, front: 0, back: 0 },
          }
        )
      );
      expect(base).not.toBeNull();
      expect(rightHeavy).not.toBeNull();
      assertStructurallyValid(rightHeavy!, 'asymmetric overhang lid');
      const baseBB = boundingBox(base!.vertices);
      const rhBB = boundingBox(rightHeavy!.vertices);
      // All 8mm of growth is on +X (right side); the left edge barely moves —
      // the perimeter is grown by 8 and re-centered by +4, so -X is unchanged.
      expect(rhBB.maxX - baseBB.maxX).toBeGreaterThan(7);
      expect(Math.abs(rhBB.minX - baseBB.minX)).toBeLessThan(1);
    });

    it('ignores overhang for polygon (cellMask) lids — matches the box builder', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const noOverhang = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      const withOverhang = generateLid(
        makeParams(
          {},
          {
            width: 3,
            depth: 3,
            height: 3,
            cellMask: L_SHAPE_MASK,
            overhang: { left: 5, right: 5, front: 5, back: 5 },
          }
        )
      );
      expect(noOverhang).not.toBeNull();
      expect(withOverhang).not.toBeNull();
      // Polygon bins suppress overhang in boxBuilder; the lid mirrors that, so
      // the two meshes are identical. triangleCount alone is a coarse proxy
      // (distinct geometry can tessellate to the same count), so also assert
      // the bounding boxes match — a stray overhang shift/scale would move an
      // edge here.
      expect(withOverhang!.triangleCount).toBe(noOverhang!.triangleCount);
      const a = boundingBox(noOverhang!.vertices);
      const b = boundingBox(withOverhang!.vertices);
      expect(Math.abs(b.minX - a.minX)).toBeLessThan(0.01);
      expect(Math.abs(b.maxX - a.maxX)).toBeLessThan(0.01);
      expect(Math.abs(b.minY - a.minY)).toBeLessThan(0.01);
      expect(Math.abs(b.maxY - a.maxY)).toBeLessThan(0.01);
    });
  });

  describe('STEP combined export (lid-only path)', () => {
    // Before the lid PR, the STEP combined-export branch was only reached
    // when dividers existed; a lid-enabled bin with no dividers now also
    // hits it. This test exercises the buildLid → translate → compound →
    // exportSTEP sequence end-to-end so the new branch has scenario
    // coverage and any boolean/compound failure surfaces in CI.
    it('builds a non-empty STEP buffer for bin + lid (no dividers)', async () => {
      const { compound, exportSTEP, translate, unwrap } = await import('brepjs');
      const { buildLid } = await import('./lidBuilder');
      const { lidAnchorZ } = await import('./lidConstants');
      const { generateBin } = await import('./binOrchestrator');
      const { getLastSolid, clearAllCaches } = await import('./shapeCache');
      const { LID_FIT_CLEARANCE } = await import('@/shared/types/bin');

      clearAllCaches();
      const params = makeParams(
        // Standard 2×2 bin, lid enabled, no dividers (default style is
        // 'standard', not 'slotted'). This is the exact configuration that
        // didn't have a STEP path before the lid PR.
        { enabled: true },
        { width: 2, depth: 2, height: 3 }
      );
      generateBin(params, undefined, true);
      const binSolid = getLastSolid();
      expect(binSolid).not.toBeNull();

      const totalHeight = params.height * params.heightUnitMm;
      const fitClearance = LID_FIT_CLEARANCE;
      const lidZ = totalHeight - lidAnchorZ(params.heightUnitMm, fitClearance);

      const lidSolid = buildLid(params);
      try {
        const positioned = translate(lidSolid, [0, 0, lidZ]);
        lidSolid.delete();
        const assembly = compound([binSolid!, positioned]);
        const blob = unwrap(exportSTEP(assembly));
        const buffer = await blob.arrayBuffer();
        // Sanity: a STEP file with a real assembly is at minimum a few KB.
        expect(buffer.byteLength).toBeGreaterThan(1024);
        positioned.delete();
      } catch (err) {
        // Defensive cleanup if anything between buildLid and the final
        // delete throws — mirrors the try/finally in handleExportCombined.
        lidSolid.delete();
        throw err;
      }
    }, 60_000);
  });

  describe('extended lid coverage', () => {
    it('builds a valid lid for a 1.5×1.5 half-bin', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(makeParams({}, { width: 1.5, depth: 1.5, height: 3 }));
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, '1.5x1.5 lid');
    });

    it('builds a valid lid for a tall (height 10) bin', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(makeParams({}, { width: 2, depth: 2, height: 10 }));
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'tall lid');
      // Lid Z thickness is bin-height-independent — the lid mesh is the
      // same vertical extent whether the bin is 3U or 10U.
      const bb = boundingBox(result!.vertices);
      expect(bb.maxZ - bb.minZ).toBeGreaterThan(4);
      expect(bb.maxZ - bb.minZ).toBeLessThan(DEFAULT_BIN_PARAMS.heightUnitMm * 2);
    });

    it('builds a valid lid for a custom heightUnitMm (10mm)', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 2, depth: 2, height: 3, heightUnitMm: 10 })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'custom heightUnitMm lid');
    });

    it('builds a valid lid for an L-shape polygon + magnet holes', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({ magnetHoles: true }, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'L+magnet lid');
    });

    it('builds a valid lid for a U-shape polygon', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: U_SHAPE_MASK })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'U-shape lid');
    });

    it('builds a valid lid for a slotted bin (lid is independent of bin style)', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 2, depth: 2, height: 4, style: 'slotted' })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'slotted-bin lid');
    });

    it('builds a valid lid with thick walls (2.4mm) — lip clearance check', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 2, depth: 2, height: 3, wallThickness: 2.4 })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'thick-wall lid');
    });

    it('builds a valid lid with only-front click rail enabled', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams(
          { clickRails: { front: true, back: false, left: false, right: false } },
          { width: 2, depth: 2, height: 3 }
        )
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'front-only-rail lid');
    });

    it('lid mesh is deterministic: identical inputs produce the same triangle count', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const a = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
      const b = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a!.triangleCount).toBe(b!.triangleCount);
    });
  });
});

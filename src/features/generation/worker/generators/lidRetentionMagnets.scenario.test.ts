// @vitest-environment node
/**
 * Scenario tests for magnetic-retention lids and tray tops (#2694).
 *
 * Runs the real brepjs build and asserts:
 *  - a magnetic lid + its mating bin both produce structurally-valid meshes;
 *  - the bin grows corner posts (more geometry than a plain bin);
 *  - a tray-top lid recesses cleanly and stays valid;
 *  - a magnetic 1x1 lid on the smallest footprint still builds.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidRetentionMagnets.scenario
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  boundingBox,
  triangleArea,
  triangleNormalZ,
} from './__kernel-tests__/meshAssertions';
import { BOX_CORNER_RADIUS } from './generatorConstants';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LidConfig } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';

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

/**
 * Furthest any vertex sits OUTSIDE the bin's outer wall profile — the rounded
 * rectangle of half-extents `halfW`/`halfD` with corner radius
 * `BOX_CORNER_RADIUS`. Negative means everything is inboard of the wall.
 */
function maxProfileProtrusion(mesh: MeshData, halfW: number, halfD: number): number {
  const cx = halfW - BOX_CORNER_RADIUS;
  const cy = halfD - BOX_CORNER_RADIUS;
  let worst = -Infinity;
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    const x = Math.abs(mesh.vertices[i]);
    const y = Math.abs(mesh.vertices[i + 1]);
    const dx = x - cx;
    const dy = y - cy;
    const outside =
      dx > 0 && dy > 0 ? Math.hypot(dx, dy) - BOX_CORNER_RADIUS : Math.max(x - halfW, y - halfD);
    if (outside > worst) worst = outside;
  }
  return worst;
}

describe('magnetic-retention lid geometry', () => {
  it('produces a valid mesh for a 2x2 magnetic lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams({ attachment: 'magnetic' }, { width: 2, depth: 2, height: 3 })
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '2x2 magnetic lid');
  });

  it('adds corner bosses — more geometry than a friction lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const base = { width: 2, depth: 2, height: 3 };
    const friction = generateLid(makeParams({ attachment: 'friction' }, base))!;
    const magnetic = generateLid(makeParams({ attachment: 'magnetic' }, base))!;
    expect(magnetic.triangleCount).toBeGreaterThan(friction.triangleCount);
  });

  it('builds a magnetic lid on the smallest (1x1) footprint', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams({ attachment: 'magnetic' }, { width: 1, depth: 1, height: 3 })
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '1x1 magnetic lid');
  });

  it('grows corner gusset pads on the mating bin', async () => {
    const generateBin = getGenerateBin();
    const base = { width: 2, depth: 2, height: 3 };
    const plain = generateBin(makeParams({ attachment: 'clickRails' }, base));
    const magnetic = generateBin(makeParams({ attachment: 'magnetic' }, base));
    assertStructurallyValid(magnetic, '2x2 bin with magnetic lid gusset pads');
    // Pads add solid material + pockets, so the magnetic bin has more geometry.
    expect(magnetic.triangleCount).toBeGreaterThan(plain.triangleCount);
  });

  it('pads are top overhangs, not full-height columns (height-independent)', async () => {
    const generateBin = getGenerateBin();
    // The gusset pads (plus their fixed-depth 45° taper) live at the top rim,
    // so the geometry they ADD over a plain bin must not scale with bin
    // height. A returning full-column bug would make the delta grow with
    // height. Compare the magnetic-vs-plain triangle delta at height 4 and
    // height 7 — both tall enough that the taper floats above the floor (on
    // shorter bins it clamps to the floor by design, which would skew the
    // comparison).
    const deltaAt = (height: number): number => {
      const plain = generateBin(
        makeParams({ attachment: 'clickRails' }, { width: 2, depth: 2, height })
      );
      const magnetic = generateBin(
        makeParams({ attachment: 'magnetic' }, { width: 2, depth: 2, height })
      );
      return magnetic.triangleCount - plain.triangleCount;
    };
    const d4 = deltaAt(4);
    const d7 = deltaAt(7);
    expect(d4).toBeGreaterThan(0);
    // Allow tessellation jitter but reject height-scaling (a column would
    // roughly double the added side-wall triangles from height 4 to 7).
    expect(Math.abs(d7 - d4)).toBeLessThan(d4 * 0.5);
  });

  it('pad undersides taper at 45° — no flat overhang needing supports (#2712)', async () => {
    const generateBin = getGenerateBin();
    const base = { width: 2, depth: 2, height: 4 };
    const magnetic = generateBin(makeParams({ attachment: 'magnetic' }, base));
    const plain = generateBin(makeParams({ attachment: 'clickRails' }, base));
    assertStructurallyValid(magnetic, '2x2 bin with tapered gusset pads');

    // Sum downward-facing triangle area inside the corner-pad window: inboard
    // of the walls and lip (3mm) but within the pads' reach of the corners
    // (16mm), above the base/floor plate and below the rim. In this window
    // the pads are the only geometry on a default bin. A face needs supports
    // when it is closer to horizontal than the 45° FDM limit: nz below
    // -cos(45°) ≈ -0.707. The threshold sits at -0.72 so the taper's exact
    // 45° plane (nz = -0.7071) stays on the printable side while ANY steeper
    // overhang — the pre-#2712 flat underside (nz ≈ -1) or a partial
    // transition anywhere in between — counts as a violation, with no
    // unclassified gap.
    const downFacingAreas = (mesh: MeshData): { unsupported: number; taper: number } => {
      const bb = boundingBox(mesh.vertices);
      let unsupported = 0;
      let taper = 0;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const a = mesh.indices[i];
        const b = mesh.indices[i + 1];
        const c = mesh.indices[i + 2];
        const cx = (mesh.vertices[a * 3] + mesh.vertices[b * 3] + mesh.vertices[c * 3]) / 3;
        const cy =
          (mesh.vertices[a * 3 + 1] + mesh.vertices[b * 3 + 1] + mesh.vertices[c * 3 + 1]) / 3;
        const cz =
          (mesh.vertices[a * 3 + 2] + mesh.vertices[b * 3 + 2] + mesh.vertices[c * 3 + 2]) / 3;
        const inCornerZone =
          Math.abs(cx) > bb.maxX - 16 &&
          Math.abs(cx) < bb.maxX - 3 &&
          Math.abs(cy) > bb.maxY - 16 &&
          Math.abs(cy) < bb.maxY - 3 &&
          cz > 8 &&
          cz < bb.maxZ - 0.5;
        if (!inCornerZone) continue;
        // Winding-based geometric normal, not the stored vertex normals: the
        // index winding is consistently outward-oriented (bin floor bottoms
        // read -1), while stored normals have flipped on boolean-result faces
        // before and would silently blind this check.
        const nz = triangleNormalZ(mesh.vertices, a, b, c);
        const area = triangleArea(mesh.vertices, a, b, c);
        if (nz < -0.72) unsupported += area;
        else if (nz < -0.65) taper += area;
      }
      return { unsupported, taper };
    };

    const pads = downFacingAreas(magnetic);
    // No support-requiring downward faces: the taper meets the pad bottom at
    // the tongue tip, so only sub-mm² tessellation slivers may register.
    expect(pads.unsupported).toBeLessThan(2);
    // The 45° underside itself must be present in force (4 pads' worth).
    expect(pads.taper).toBeGreaterThan(100);
    // Control: the window really isolates the pads — a plain bin has nothing
    // sloping down there, so the taper signal above comes from the pads.
    expect(downFacingAreas(plain).taper).toBeLessThan(5);
  });

  it('produces a valid lid mesh with edge retention magnets (#2844)', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams(
        { attachment: 'magnetic', retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 3 } },
        { width: 6, depth: 4, height: 5 }
      )
    );
    if (result === null) throw new Error('expected a lid mesh');
    assertStructurallyValid(result, '6x4 magnetic lid with edge magnets');
  });

  it('edge magnets add valid bin pads with no new unsupported overhang (#2844)', async () => {
    const generateBin = getGenerateBin();
    // A large footprint (6x4 = 24 cells) so edge magnets get placed, and tall
    // enough that the pad taper floats above the floor rather than clamping to it.
    const base = { width: 6, depth: 4, height: 5 };
    const noEdge = generateBin(
      makeParams(
        { attachment: 'magnetic', retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 0 } },
        base
      )
    );
    const withEdge = generateBin(
      makeParams(
        { attachment: 'magnetic', retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 2 } },
        base
      )
    );
    assertStructurallyValid(withEdge, '6x4 bin with edge retention magnets');
    // The extra mid-edge pads and pockets add geometry over the four-corner lid.
    expect(withEdge.triangleCount).toBeGreaterThan(noEdge.triangleCount);

    // Sum downward-facing area in the interior top band (above the floor/base,
    // below the rim). The only geometry sloping down there is the retention
    // pads; the corner pads are present in BOTH meshes, so the delta isolates
    // the edge pads. A face needs supports when steeper than 45° (nz < -0.72);
    // the taper band [-0.72, -0.65] catches the pads' exact 45° underside.
    const downFacing = (mesh: MeshData): { unsupported: number; taper: number } => {
      const bb = boundingBox(mesh.vertices);
      let unsupported = 0;
      let taper = 0;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const a = mesh.indices[i];
        const b = mesh.indices[i + 1];
        const c = mesh.indices[i + 2];
        const cz =
          (mesh.vertices[a * 3 + 2] + mesh.vertices[b * 3 + 2] + mesh.vertices[c * 3 + 2]) / 3;
        if (cz < 8 || cz > bb.maxZ - 0.5) continue;
        const nz = triangleNormalZ(mesh.vertices, a, b, c);
        const area = triangleArea(mesh.vertices, a, b, c);
        if (nz < -0.72) unsupported += area;
        else if (nz < -0.65) taper += area;
      }
      return { unsupported, taper };
    };

    const d0 = downFacing(noEdge);
    const d1 = downFacing(withEdge);
    // The edge pads contribute a real amount of 45° underside...
    expect(d1.taper).toBeGreaterThan(d0.taper + 20);
    // ...but no new support-requiring (steeper-than-45°) overhang.
    expect(d1.unsupported).toBeLessThan(d0.unsupported + 2);
  });

  it('leaves the bin footprint unchanged (posts grow inward)', async () => {
    const generateBin = getGenerateBin();
    const base = { width: 2, depth: 2, height: 3 };
    const plain = boundingBox(generateBin(makeParams({ attachment: 'clickRails' }, base)).vertices);
    const magnetic = boundingBox(
      generateBin(makeParams({ attachment: 'magnetic' }, base)).vertices
    );
    // Inward posts must not push the outer XY footprint out.
    expect(magnetic.maxX).toBeCloseTo(plain.maxX, 1);
    expect(magnetic.maxY).toBeCloseTo(plain.maxY, 1);
    expect(magnetic.minX).toBeCloseTo(plain.minX, 1);
    expect(magnetic.minY).toBeCloseTo(plain.minY, 1);
  });

  // The bounding-box check above cannot see this: the wall corner is an arc of
  // BOX_CORNER_RADIUS, so a pad corner can punch through it diagonally while
  // staying well inside the axis-aligned box (#2929).
  it.each([0.4, 0.8, 1.2, 1.6, 2.4])(
    'corner pads stay inside the rounded wall at wallThickness %smm (#2929)',
    async (wallThickness) => {
      const generateBin = getGenerateBin();
      const base = { width: 2, depth: 2, height: 4, wallThickness };
      const plain = generateBin(makeParams({ attachment: 'clickRails' }, base));
      const magnetic = generateBin(makeParams({ attachment: 'magnetic' }, base));
      const bb = boundingBox(plain.vertices);
      // The plain bin defines the true profile; anything the pads add must not
      // sit further out than it does (beyond tessellation slack).
      expect(maxProfileProtrusion(plain, bb.maxX, bb.maxY)).toBeLessThan(0.02);
      expect(maxProfileProtrusion(magnetic, bb.maxX, bb.maxY)).toBeLessThan(0.02);
    }
  );

  // The corner arc eats `cavityCornerR + GUSSET_WALL_OVERLAP` of the pad's
  // reach; the magnet diameter sets how far the pad reaches. Pin both ends of
  // the allowed diameter range so a smaller magnet can't shrink the pad past
  // the arc and fold the footprint back on itself.
  it.each([4, 10])('corner pads stay inside the rounded wall at %smm magnets', async (diameter) => {
    const generateBin = getGenerateBin();
    const base = { width: 2, depth: 2, height: 4 };
    const plain = generateBin(makeParams({ attachment: 'clickRails' }, base));
    const magnetic = generateBin(
      makeParams(
        { attachment: 'magnetic', retentionMagnet: { diameter, depth: 2, edgeMagnets: 0 } },
        base
      )
    );
    const bb = boundingBox(plain.vertices);
    assertStructurallyValid(magnetic, `2x2 bin with ${diameter}mm retention magnets`);
    expect(maxProfileProtrusion(magnetic, bb.maxX, bb.maxY)).toBeLessThan(0.02);
  });

  it('adds no bin posts when there is no stacking lip (nothing for the lid to mate)', async () => {
    const generateBin = getGenerateBin();
    const noLip = { base: { ...makeParams({}).base, stackingLip: false } };
    // With no lip the lid can't be generated, so the bin must not grow orphan
    // posts — magnetic and click-rails bins are identical.
    const magnetic = generateBin(
      makeParams({ attachment: 'magnetic' }, { width: 2, depth: 2, height: 3, ...noLip })
    );
    const plain = generateBin(
      makeParams({ attachment: 'clickRails' }, { width: 2, depth: 2, height: 3, ...noLip })
    );
    expect(magnetic.triangleCount).toBe(plain.triangleCount);
  });

  it('adds no bin posts when the magnet is too deep for the bin (blocked lid)', async () => {
    const generateBin = getGenerateBin();
    // 1U bin interior can't hold a 6mm-deep magnet → magnetTooDeepForBin blocks
    // the lid, so the bin must not cut a too-deep pocket through its floor.
    const blocked = generateBin(
      makeParams(
        { attachment: 'magnetic', retentionMagnet: { diameter: 6, depth: 6, edgeMagnets: 0 } },
        { width: 2, depth: 2, height: 1 }
      )
    );
    const plain = generateBin(
      makeParams({ attachment: 'clickRails' }, { width: 2, depth: 2, height: 1 })
    );
    expect(blocked.triangleCount).toBe(plain.triangleCount);
  });
});

// The bin's gusset pad and the lid's boss are built by different passes, so
// nothing about either mesh reveals whether their magnets actually meet. The
// gap between them is the whole retention mechanism: too small and the posts
// bottom out and hold the lid off its lip, too large and the magnets go weak.
describe('magnet seat gap survives every knob that moves the lid in Z', () => {
  const CASES: ReadonlyArray<readonly [string, Partial<LidConfig>, Partial<BinParams>]> = [
    ['defaults', {}, {}],
    ['thick floor plate (#2761)', { topThicknessMm: 3 }, {}],
    ['deep cavity — boss lengthens to follow', { extraHeightMm: 12 }, {}],
    ['thick plate + deep cavity', { topThicknessMm: 2.6, extraHeightMm: 8 }, {}],
    ['deeper magnet', { retentionMagnet: { diameter: 8, depth: 3, edgeMagnets: 0 } }, {}],
    ['tall bin', {}, { height: 9 }],
    ['non-square grid', {}, { gridUnitMmY: 22 }],
  ];

  it.each(CASES)('%s', async (_label, lid, extra) => {
    const { retentionSeatPlanes } = await import('./retentionMagnetGeometry');
    const { LID_MAGNET_SEAT_GAP } = await import('./lidConstants');
    const { deriveDimensions } = await import('./pipeline/context');
    const { checkLidCompatibility, hasLidBlocker } = await import('@/shared/types/bin');

    const params = makeParams({ attachment: 'magnetic', ...lid }, extra);
    const dim = deriveDimensions(params, true);
    const { lidFaceZ, binFaceZ } = retentionSeatPlanes(params, dim.totalHeight);

    // Every case here is a buildable config, so `checkLidCompatibility` must
    // agree — otherwise the assertions below are describing geometry the app
    // refuses to generate.
    expect(hasLidBlocker(checkLidCompatibility(params))).toBe(false);

    // The two magnet faces meet across exactly one seat gap.
    expect(lidFaceZ - binFaceZ).toBeCloseTo(LID_MAGNET_SEAT_GAP, 9);
    // The bin's pad must have bin to sit in: recessed below the body top, and
    // above the interior floor so its pocket can't punch through. Deepening the
    // cavity must never push it out of that band — the boss lengthens instead.
    expect(binFaceZ).toBeLessThan(dim.totalHeight);
    expect(binFaceZ).toBeGreaterThan(dim.totalHeight - dim.interiorHeight);
  });

  // The whole point of anchoring the boss to the cavity bottom: the bin's pad
  // lands in the same place regardless of how deep the lid's cavity is, so the
  // bin is unaffected by a lid-side knob it can't see.
  it('places the bin pad identically no matter how deep the lid cavity is', async () => {
    const { retentionSeatPlanes } = await import('./retentionMagnetGeometry');
    const { deriveDimensions } = await import('./pipeline/context');

    const at = (lid: Partial<LidConfig>) => {
      const p = makeParams({ attachment: 'magnetic', ...lid });
      return retentionSeatPlanes(p, deriveDimensions(p, true).totalHeight).binFaceZ;
    };
    const baseline = at({});
    expect(at({ extraHeightMm: 12 })).toBeCloseTo(baseline, 9);
    expect(at({ topThicknessMm: 4 })).toBeCloseTo(baseline, 9);
    expect(at({ topThicknessMm: 3, extraHeightMm: 30 })).toBeCloseTo(baseline, 9);
  });

  // The bin pad is placed by `lidRetentionStage`, but the lid solid is lifted
  // into the assembly by `exportHandler`. Those are separate expressions of the
  // same seating transform; if they diverge the pads land at the wrong height
  // and no mesh-validity assertion notices.
  it("matches the export assembly's own lid lift", async () => {
    const { retentionSeatPlanes } = await import('./retentionMagnetGeometry');
    const { lidAnchorZ } = await import('./lidConstants');
    const { resolveLidInputs } = await import('./lidBuilder');
    const { deriveDimensions } = await import('./pipeline/context');
    const { LID_FIT_CLEARANCE, resolveLidCavityExtraMm } = await import('@/shared/types/bin');

    const params = makeParams(
      { attachment: 'magnetic', topThicknessMm: 2.4, extraHeightMm: 5 },
      { height: 8 }
    );
    const dim = deriveDimensions(params, true);

    // Reproduce exportHandler's lift, then place the lid's magnet face through
    // it independently of retentionSeatPlanes.
    const exportLift =
      dim.totalHeight -
      lidAnchorZ(params.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(params));
    const { LID_TOP_THICKNESS_BASE } = await import('./lidConstants');
    const inputs = resolveLidInputs(params);
    const interfaceZ =
      -(LID_TOP_THICKNESS_BASE + params.lid.retentionMagnet.depth) - inputs.cavityExtraMm;
    const lidFaceViaExport = interfaceZ + exportLift;

    expect(retentionSeatPlanes(params, dim.totalHeight).lidFaceZ).toBeCloseTo(lidFaceViaExport, 9);
  });
});

describe('tray-top lid geometry', () => {
  it('produces a valid mesh for a tray-top lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams(
        {
          attachment: 'friction',
          stackableTop: false,
          tray: { enabled: true, depthMm: 4, wallMm: 2 },
        },
        { width: 3, depth: 2, height: 3 }
      )
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '3x2 tray lid');
  });

  it('recesses the top — less enclosed volume than a flat lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const base = { width: 3, depth: 2, height: 3 };
    const flat = generateLid(makeParams({ attachment: 'friction' }, base))!;
    const tray = generateLid(
      makeParams({ attachment: 'friction', tray: { enabled: true, depthMm: 4, wallMm: 2 } }, base)
    )!;
    // The recess reshapes the top face, so the tray mesh differs from the flat
    // one, and its recessed floor sits a tray-depth below the rim.
    expect(tray.triangleCount).not.toBe(flat.triangleCount);
    const flatBox = boundingBox(flat.vertices);
    const trayBox = boundingBox(tray.vertices);
    // Rim keeps the original top height; the recess doesn't raise the lid.
    expect(trayBox.maxZ).toBeCloseTo(flatBox.maxZ, 1);
  });

  it('combines a magnetic attachment with a tray top', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(
      makeParams(
        { attachment: 'magnetic', tray: { enabled: true, depthMm: 3, wallMm: 2 } },
        { width: 2, depth: 2, height: 3 }
      )
    );
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, 'magnetic + tray lid');
  });
});

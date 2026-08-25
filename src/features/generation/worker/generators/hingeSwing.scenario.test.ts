/**
 * Does the hinged lid swing, take a pin, and stay a Gridfinity bin?
 *
 * The tests beside `hingeLidPlan.ts` assert the arithmetic. This asserts that
 * the two SOLIDS the arithmetic produced can be assembled and moved — the only
 * check that would have caught any of the lid defects this repo has already
 * shipped, every one of which left both meshes watertight, plausibly
 * triangulated and passing every bounding-box assertion (CLAUDE.md gotchas
 * #10, #15, #18, #19).
 *
 * It has already earned its keep three times over. Written before the geometry,
 * it found: a tangent barrel that broke the column probes' parity; a trim plane
 * tilted the wrong way, leaving 3mm of lid outboard of the axis; and a bore cut
 * before its knuckles were fused, which drilled through air and shipped a hinge
 * no pin would enter. None of the three was visible to a mesh statistic.
 *
 * Results are stated as DELTAS against a named control, never as bare
 * thresholds — the lesson `lipSupportSeating` learned by shipping a probe that
 * passed against the bug it was written for.
 *
 *   pnpm run test:run src/features/generation/worker/generators/hingeSwing.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  firstContactAngle,
  knuckleRootMm3,
  pinObstructionMm3,
  seatedOverlapMm3,
  solidVolumeMm3,
  sweepSwing,
  swingAxis,
} from './__kernel-tests__/hingeSwing';
import { lidZOffset } from './__kernel-tests__/lidSeating';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_LID_HINGE_CONFIG, LID_HINGE_PIN_MM } from '@/features/bin-designer/types/lid';
import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { overhangExpansion, resolveOverhang } from '@/shared/utils/overhang';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import type { BinParams, LidHingeConfig, LidRailSide } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';
import type { Shape3D } from 'brepjs';

/**
 * Shared-volume floor (mm³).
 *
 * A boolean over near-coincident faces returns either nothing or a sliver, and
 * this absorbs the sliver. For scale, one millimetre of real overlap along a
 * 117mm barrel is ~117mm³ — three orders of magnitude above it — and every
 * seating defect in this repo's history has been whole millimetres.
 */
const CONTACT_FLOOR_MM3 = 5;

/**
 * Shared-volume floor (mm³) for deciding the lid has met its stop.
 *
 * Much smaller than {@link CONTACT_FLOOR_MM3}, because the stop is a face
 * meeting a corner edge-on: the volume grows from nothing rather than jumping,
 * and a floor sized for the seat fit would place "first contact" 12° late.
 * Measured 0.0mm³ through 104° and 0.1 at 106, so this sits in the gap.
 */
const STOP_CONTACT_FLOOR_MM3 = 0.3;

function hingeParams(
  over: Partial<BinParams> = {},
  hinge: Partial<LidHingeConfig> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    ...over,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      ...over.lid,
      enabled: true,
      attachment: 'hinge',
      relieveInterior: true,
      hinge: { ...DEFAULT_LID_HINGE_CONFIG, ...hinge },
    },
  };
}

/** The same design with the hinge swapped for a plain friction lid. */
function control(params: BinParams): BinParams {
  return { ...params, lid: { ...params.lid, attachment: 'friction', hinge: undefined } };
}

interface Solids {
  readonly bin: Shape3D;
  readonly lid: Shape3D;
  readonly dz: number;
}

async function buildSolids(params: BinParams): Promise<Solids> {
  const { getLastSolid } = await import('./shapeCache');
  const { buildLid } = await import('./lidBuilder');
  // `generateBin` leaves its solid in the shape cache, which is how the export
  // path reaches the same geometry the preview showed.
  getGenerateBin()(params, undefined, false);
  const bin = getLastSolid();
  if (!bin) throw new Error('expected a cached bin solid');
  return { bin, lid: buildLid(params), dz: lidZOffset(params) };
}

async function meshes(params: BinParams): Promise<{ bin: MeshData; lid: MeshData }> {
  const { generateLid } = await import('./lidOrchestrator');
  const bin = getGenerateBin()(params, undefined, false);
  const lid = generateLid(params);
  if (!bin || !lid) throw new Error('expected a bin and lid to build');
  return { bin, lid };
}

describe('hinged lid', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120_000);

  it.each<LidRailSide>(['back', 'front', 'left', 'right'])(
    'swings clear of the bin on the %s wall',
    async (side) => {
      const params = hingeParams({}, { side, catchMode: 'none' });
      const { bin, lid, dz } = await buildSolids(params);
      const axis = swingAxis(params, 0, 0);
      if (!axis) throw new Error('expected an axis');
      try {
        // All four walls, because the canonical-frame rotation is exactly the
        // kind of mapping that is right in one quadrant and backwards in
        // another — the trap CLAUDE.md gotcha #12 documents.
        const samples = await sweepSwing(bin, lid, axis, dz, [0, 5, 10, 20, 40, 60, 80, 95, 100]);
        const worst = samples.reduce((a, b) => (b.mm3 > a.mm3 ? b : a));
        expect(worst.mm3).toBeLessThan(CONTACT_FLOOR_MM3);
      } finally {
        lid.delete();
      }
    },
    600_000
  );

  it.each<LidRailSide>(['back', 'front', 'left', 'right'])(
    'takes the pin on the %s wall',
    async (side) => {
      const params = hingeParams({}, { side, catchMode: 'none' });
      const { geometry } = planHingeLid(params);
      if (!geometry) throw new Error('expected hinge geometry');
      const { bin, lid, dz } = await buildSolids(params);
      const axis = swingAxis(params, 0, 0);
      if (!axis) throw new Error('expected an axis');
      try {
        // A modelled pin through the finished assembly, not a probe down the
        // bores. This is what caught the bore being cut before its knuckles
        // were fused: the hole was plainly visible from the end of the barrel,
        // and the lid's floor plate lay straight across it.
        const run = geometry.runs[0];
        const blocked = await pinObstructionMm3(
          bin,
          lid,
          axis,
          dz,
          LID_HINGE_PIN_MM / 2,
          run.lo,
          run.hi
        );
        expect(blocked).toBeLessThan(CONTACT_FLOOR_MM3);
      } finally {
        lid.delete();
      }
    },
    600_000
  );

  it.each<LidRailSide>(['back', 'front', 'left', 'right'])(
    'stays coaxial under asymmetric overhang, hinged on the %s wall',
    async (side) => {
      // Overhang moves the OUTER FACE, and the axis is defined as an inset from
      // it — so the bin's barrel and the lid's are each placed from their own
      // frame's face. If those two frames disagreed in sign or magnitude the
      // barrels would sit apart and the pin would not pass, while both parts
      // stayed watertight and the swing stayed clear. Nothing else in the suite
      // asks the question, and the canonical-frame rotation makes it a
      // four-quadrant one.
      //
      // Deliberately asymmetric on BOTH axes: a symmetric overhang leaves the
      // offsets at zero and would pass whatever the sign convention was.
      const params = hingeParams(
        { overhang: { enabled: true, left: 0, right: 2, front: 0, back: 3 } },
        { side, catchMode: 'none' }
      );
      const { geometry } = planHingeLid(params);
      if (!geometry) throw new Error('expected hinge geometry');
      const { bin, lid, dz } = await buildSolids(params);
      // Resolved straight from the overhang rather than read off the
      // pipeline's dimensions, so the probe keeps an opinion of its own about
      // where the faces moved to.
      const shift = overhangExpansion(resolveOverhang(params.overhang));
      const axis = swingAxis(params, shift.offsetX, shift.offsetY);
      if (!axis) throw new Error('expected an axis');
      try {
        const run = geometry.runs[0];
        const blocked = await pinObstructionMm3(
          bin,
          lid,
          axis,
          dz,
          LID_HINGE_PIN_MM / 2,
          run.lo,
          run.hi
        );
        expect(blocked).toBeLessThan(CONTACT_FLOOR_MM3);

        const worst = (await sweepSwing(bin, lid, axis, dz, [0, 20, 60, 95])).reduce((a, b) =>
          b.mm3 > a.mm3 ? b : a
        );
        expect(worst.mm3).toBeLessThan(CONTACT_FLOOR_MM3);
      } finally {
        lid.delete();
      }
    },
    600_000
  );

  it('grows the footprint by the overhang and not by the hinge', async () => {
    // The hinge must add nothing to a footprint the overhang has already
    // widened — the barrel is inset from wherever the face ended up, not hung
    // off the nominal one.
    const over = { enabled: true, left: 0, right: 2, front: 0, back: 3 };
    const params = hingeParams({ overhang: over }, { side: 'back', catchMode: 'none' });
    const hinged = await meshes(params);
    const plain = await meshes(control(params));
    for (const what of ['bin', 'lid'] as const) {
      const a = boundingBox(hinged[what].vertices);
      const b = boundingBox(plain[what].vertices);
      expect({ what, x: +(a.maxX - a.minX).toFixed(3) }).toEqual({
        what,
        x: +(b.maxX - b.minX).toFixed(3),
      });
      expect({ what, y: +(a.maxY - a.minY).toFixed(3) }).toEqual({
        what,
        y: +(b.maxY - b.minY).toFixed(3),
      });
    }
  }, 600_000);

  it('stays inside the Gridfinity footprint on every wall', async () => {
    // The reason the axis is inset rather than hung off the outside, and the
    // check that keeps it honest. A hinge that grew the footprint would still
    // print, still swing, and still take its pin — and would foul the bin
    // behind it and refuse to seat in its own baseplate cell. Nothing else in
    // the suite would notice.
    for (const side of ['back', 'front', 'left', 'right'] as const) {
      const params = hingeParams({}, { side, catchMode: 'none' });
      const hinged = await meshes(params);
      const plain = await meshes(control(params));

      const spec = {
        x: params.width * params.gridUnitMm - GRIDFINITY_SPEC.TOLERANCE,
        y: params.depth * params.gridUnitMm - GRIDFINITY_SPEC.TOLERANCE,
      };
      for (const [what, mesh] of [
        ['bin', hinged.bin],
        ['lid', hinged.lid],
      ] as const) {
        const bb = boundingBox(mesh.vertices);
        // Against the SPEC, not against the control: the control proves the
        // hinge changed nothing, the spec proves what it did not change was
        // already right. Either alone would pass a pair that agreed and were
        // both oversize.
        expect({ side, what, x: +(bb.maxX - bb.minX).toFixed(3) }).toEqual({
          side,
          what,
          x: spec.x,
        });
        expect({ side, what, y: +(bb.maxY - bb.minY).toFixed(3) }).toEqual({
          side,
          what,
          y: spec.y,
        });
      }

      // And no taller than the knuckles need. The barrel does rise above the
      // rim — that is the trade the axis placement makes — so this pins HOW
      // MUCH rather than asserting it does not.
      const grew = boundingBox(hinged.bin.vertices).maxZ - boundingBox(plain.bin.vertices).maxZ;
      expect(grew).toBeGreaterThan(0);
      expect(grew).toBeLessThan(4);
    }
  }, 600_000);

  it('welds the knuckles onto the bin, and exports what it previewed', async () => {
    // The defect this pins shipped. The barrel is inset from the outer face by
    // its own radius plus a relief and raised to the lid plate's underside; the
    // lip's top chamfer recedes inboard as it rises. Those two facts put the
    // nearest lip material `(axisInset + axisAboveLipTop)/√2` from the axis —
    // further than the radius — so knuckles fused on bare touch NOTHING, and
    // the measured bridge was 0.00mm³ on all four walls. Six free-floating
    // cylinders, watertight and plainly visible in the preview.
    //
    // Two claims, because either alone passes the other's bug. The root volume
    // asks whether the joint is ATTACHED, which no bounding box or triangle
    // count can see — a floating knuckle and a welded one bound the same box.
    // The export height asks whether it SURVIVES: the pass that makes a bin
    // watertight discards stray shells, so a hinge that failed to weld left the
    // STL silently and the file a user opened was a plain bin.
    for (const side of ['back', 'front', 'left', 'right'] as const) {
      const params = hingeParams({}, { side, catchMode: 'none' });
      const plain = control(params);

      // Same zone against both solids — the hinge plan defines it, and the
      // control has no plan of its own to ask.
      const rootMm3 = async (p: BinParams): Promise<number> => {
        const { bin, lid } = await buildSolids(p);
        try {
          return await knuckleRootMm3(bin, params);
        } finally {
          lid.delete();
        }
      };
      const bridge = (await rootMm3(params)) - (await rootMm3(plain));
      expect({ side, welded: bridge > 10 }).toEqual({ side, welded: true });

      // Measured on the EXPORT mesh against the export of the same control. The
      // sibling footprint test pins this rise in the preview, and the preview is
      // exactly where a missing hinge still looked right. Not the two meshes
      // against each other: they tessellate at different tolerances, so a
      // barrel's apex lands microns apart between them.
      const top = (p: BinParams): number =>
        boundingBox(getGenerateBin()(p, undefined, true).vertices).maxZ;
      const grew = top(params) - top(plain);
      expect({ side, grew: grew > 3 && grew < 4 }).toEqual({ side, grew: true });
    }
  }, 600_000);

  it('seats shut no worse than the same bin with a friction lid', async () => {
    // Each pair is measured BEFORE the next is built. `getLastSolid` hands back
    // the shape cache's single entry, so generating a second bin disposes the
    // first — holding both and comparing at the end reads a freed handle.
    const measure = async (p: BinParams): Promise<number> => {
      const { bin, lid, dz } = await buildSolids(p);
      try {
        return await seatedOverlapMm3(bin, lid, dz);
      } finally {
        lid.delete();
      }
    };

    const params = hingeParams();
    // Measured on the SOLIDS. `worstSeatInterference` reports ~2.5mm here and
    // is wrong: it pairs column crossings by parity, its own docblock warns
    // that a coincident or tangent face breaks that pairing, and a hinge is
    // cylinders fused into a flat wall. The boolean says the shared volume is
    // zero, and a boolean has no parity to get wrong.
    //
    // Still a DELTA against the friction control, because a capping lid's
    // lip-in-cavity fit is legitimately not zero on every footprint (CLAUDE.md
    // gotcha #18). The question is only whether the hinge made it worse.
    const hinged = await measure(params);
    const plain = await measure(control(params));
    expect(hinged).toBeLessThan(plain + CONTACT_FLOOR_MM3);
  }, 600_000);

  it('builds the detent into the lid as real material', async () => {
    // Volume, NOT interference, and the reason is worth recording so nobody
    // spends another afternoon on it: a click rail — which is what a hinged
    // lid's detent is — has clearance from the lip at every height in the
    // MODEL. Measured across all four attachments, a stock `clickRails` lid
    // shares exactly 0mm³ with its bin at every lift from 0 to 2mm, the same
    // as a friction one. The snap is print tolerance and material flex, not
    // modelled overlap, so no boolean probe can tell a lid with a catch from a
    // lid without one.
    //
    // What a boolean CAN see is whether the rail exists. Paired with the
    // placement test below, that is the whole claim this feature makes: the
    // detent is the click-rail geometry the repo already verifies, routed to
    // one wall.
    const volume = async (catchMode: 'none' | 'detent'): Promise<number> => {
      const { buildLid } = await import('./lidBuilder');
      const lid = buildLid(hingeParams({}, { catchMode }));
      try {
        return await solidVolumeMm3(lid);
      } finally {
        lid.delete();
      }
    };
    const bare = await volume('none');
    const caught = await volume('detent');
    expect(caught).toBeGreaterThan(bare);
  }, 600_000);

  it('is captive — the lid cannot be lifted off', async () => {
    // The property that makes a hinge a hinge, and the one thing here that no
    // other lid in the app does. A friction or click lid comes straight off:
    // its shared volume with the bin is 0mm³ at every lift. A hinged one binds
    // on its own knuckles, and the deeper the lift the worse it binds.
    //
    // Stated as a delta against the same bin with a friction lid, so the figure
    // is the hinge and not the fit around it.
    const atLift = async (params: BinParams, lift: number): Promise<number> => {
      const { bin, lid, dz } = await buildSolids(params);
      try {
        return await seatedOverlapMm3(bin, lid, dz + lift);
      } finally {
        lid.delete();
      }
    };
    const hinged = hingeParams({}, { catchMode: 'none' });
    expect(await atLift(control(hinged), 1)).toBeLessThan(CONTACT_FLOOR_MM3);
    expect(await atLift(hinged, 1)).toBeGreaterThan(20);
  }, 600_000);

  it('puts the detent opposite the hinge, on every wall', async () => {
    // Opposite the AXIS, not on a fixed wall. Hardcoding `front` is the trap
    // CLAUDE.md gotcha #19(b) describes — a side name standing in for a
    // relationship — and it would put the catch on the hinge itself for a
    // front-hinged lid, where it fights the knuckles instead of holding the
    // free edge.
    const { resolveLidInputs } = await import('./lidInputs');
    for (const [side, opposite] of [
      ['back', 'front'],
      ['front', 'back'],
      ['left', 'right'],
      ['right', 'left'],
    ] as const) {
      const inputs = resolveLidInputs(hingeParams({}, { side, catchMode: 'detent' }));
      expect({ side, rails: inputs.clickRails }).toEqual({
        side,
        rails: { front: false, back: false, left: false, right: false, [opposite]: true },
      });
    }
  }, 300_000);

  it('builds the magnets catch, on the free edge only', async () => {
    // The catch is the four-corner boss geometry filtered to ONE wall, so the
    // claim has two halves and both need checking: that bosses exist at all,
    // and that they are only where the lid can actually lift. Magnets on the
    // hinge wall would fight the knuckles for the same millimetres and hold
    // nothing the hinge does not already hold absolutely.
    const { retentionMagnetPositions } = await import('@/shared/utils/retentionMagnetPlacement');
    const { retentionMagnetPlacementsFor, retentionMagnetSide } =
      await import('./retentionMagnetGeometry');
    const params = hingeParams({}, { side: 'back', catchMode: 'magnets' });
    const all = retentionMagnetPositions(params.width, params.depth, 42, 42, 8);
    const kept = retentionMagnetPlacementsFor(retentionMagnetSide(params), all, 0, 0);
    expect(all).toHaveLength(4);
    expect(kept).toHaveLength(2);
    // Hinge on the back, so the catch pins the FRONT pair — negative Y.
    for (const p of kept) expect(p.y).toBeLessThan(0);

    // And it reaches the solids: a magnet catch is real material on both parts.
    const { buildLid } = await import('./lidBuilder');
    const withMagnets = buildLid(params);
    const withNone = buildLid(hingeParams({}, { side: 'back', catchMode: 'none' }));
    try {
      expect(await solidVolumeMm3(withMagnets)).toBeGreaterThan(await solidVolumeMm3(withNone));
    } finally {
      withMagnets.delete();
      withNone.delete();
    }
  }, 600_000);

  it('comes to rest at the designed stop, and is clear below it', async () => {
    // A DELTA, which is the only honest way to state a stop. Asserting an
    // absolute interference AT the stop would be meaningless — two faces
    // butting IS the feature — and any constant chosen for it would be
    // reverse-engineered from this run.
    //
    // The lobe's face meets the bin's corner edge-on, so the shared volume
    // grows from nothing rather than jumping: measured 0.0mm³ through 104°,
    // 0.1 at 106, 1.3 at 110, 7.5 at 120. `STOP_CONTACT_FLOOR_MM3` sits in the
    // gap between the sliver below and the real contact above.
    const params = hingeParams({}, { catchMode: 'none' });
    const { bin, lid, dz } = await buildSolids(params);
    const axis = swingAxis(params, 0, 0);
    if (!axis) throw new Error('expected an axis');
    const { geometry } = planHingeLid(params);
    if (!geometry) throw new Error('expected hinge geometry');
    try {
      const clear = await sweepSwing(bin, lid, axis, dz, [geometry.stopAngleDeg - 5]);
      expect(clear[0].mm3).toBeLessThan(STOP_CONTACT_FLOOR_MM3);

      const contact = await firstContactAngle(
        bin,
        lid,
        axis,
        dz,
        [100, 102, 104, 106, 108, 110, 112, 115, 120, 130],
        STOP_CONTACT_FLOOR_MM3
      );
      expect(contact).not.toBeNull();
      if (contact === null) return;
      expect(contact).toBeGreaterThanOrEqual(geometry.stopAngleDeg);
      expect(contact).toBeLessThan(geometry.stopAngleDeg + 10);
    } finally {
      lid.delete();
    }
  }, 600_000);

  it('stops on every wall, not just the one the frame was written for', async () => {
    // The stop is built from two planes through the axis, and both are rotated
    // onto the chosen wall by the same canonical mapping the barrel uses. A
    // sign error there would leave three walls stopping and one swinging free.
    for (const side of ['back', 'front', 'left', 'right'] as const) {
      const params = hingeParams({}, { side, catchMode: 'none' });
      const { bin, lid, dz } = await buildSolids(params);
      const axis = swingAxis(params, 0, 0);
      if (!axis) throw new Error('expected an axis');
      try {
        const contact = await firstContactAngle(
          bin,
          lid,
          axis,
          dz,
          [100, 105, 110, 115, 120, 130],
          STOP_CONTACT_FLOOR_MM3
        );
        expect({ side, stopped: contact !== null }).toEqual({ side, stopped: true });
      } finally {
        lid.delete();
      }
    }
  }, 900_000);
});

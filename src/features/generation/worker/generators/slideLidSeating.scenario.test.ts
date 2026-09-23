/**
 * Does the sliding lid actually slide, hold, and go in?
 *
 * Three questions, three probes, because none can answer another's. The tests
 * beside `slideLidPlan.ts` assert the arithmetic; this asserts that the two
 * SOLIDS the arithmetic produced can be assembled — the only check that would
 * have caught any of the lid-seating defects this repo has already shipped
 * (CLAUDE.md gotchas #10, #15, #18, #19).
 *
 * Every result is stated as a DELTA or against a specific alternative rather
 * than a bare threshold, for the reason the lip-support work learned the hard
 * way: a threshold chosen so the current code passes is not a measurement.
 *
 *   pnpm run test:run src/features/generation/worker/generators/slideLidSeating.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  binWallTopZ,
  entryLipRemnantMm,
  entryOpeningMm,
  entryCornerMm3,
  newCrossingsAbovePlate,
  seatSlideLid,
  straightSectionObstructionMm3,
  unsupportedRoofAreaMm2,
  slideLidZOffset,
  travelInterferenceMm3,
  type SlidePair,
} from './__kernel-tests__/slideLidSeating';
import { columnCrossings, isSolidThrough } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_LID_SLIDE_CONFIG } from '@/features/bin-designer/types/lid';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { slideLidPlanForParams } from '@/shared/types/bin';
import type { BinParams, LidSlideConfig } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';

/**
 * Shared-volume floor (mm³).
 *
 * The plate rests ON its shelf and its chamfer runs parallel to the retainer,
 * so the nominal model has faces in CONTACT rather than overlapping; a boolean
 * over coincident faces returns either nothing or a sliver, and this absorbs
 * the sliver. For scale, a millimetre of real overlap along one 120mm running
 * edge is ~240mm³, so the defects this has to catch are three orders of
 * magnitude above it.
 */
const CONTACT_FLOOR_MM3 = 5;

/**
 * Nozzle width (mm), for the one place a threshold here is a physical fact
 * rather than a tolerance: whether a ceiling is small enough to be laid down as
 * perimeter instead of bridged.
 */
const NOZZLE_MM = 0.4;

function slideParams(
  over: Partial<BinParams> = {},
  slide: Partial<LidSlideConfig> = {}
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
      attachment: 'slide',
      relieveInterior: true,
      slide: { ...DEFAULT_LID_SLIDE_CONFIG, ...slide },
    },
  };
}

async function build(params: BinParams): Promise<SlidePair> {
  const { generateLid } = await import('./lidOrchestrator');
  const pair = seatSlideLid(
    params,
    getGenerateBin()(params, undefined, false),
    generateLid(params)
  );
  if (!pair) throw new Error('expected a sliding lid to build');
  return pair;
}

/** The same bin with its lid switched off — the control every delta is against. */
function bareBin(params: BinParams): MeshData {
  const bin = getGenerateBin()(
    { ...params, lid: { ...params.lid, enabled: false } },
    undefined,
    false
  );
  if (!bin) throw new Error('expected the lidless bin to build');
  return bin;
}

/** Worst shared volume over the plate's whole travel, using the real solids. */
async function travelOverlap(params: BinParams): Promise<number> {
  const { getLastSolid } = await import('./shapeCache');
  const { buildLid } = await import('./lidBuilder');
  const { slideLidPlanForParams } = await import('@/shared/types/bin');
  const { geometry } = slideLidPlanForParams(params);
  if (!geometry) throw new Error('expected slide geometry');

  // `generateBin` leaves its solid in the shape cache, which is how the export
  // path reaches the same geometry the preview showed.
  getGenerateBin()(params, undefined, false);
  const binSolid = getLastSolid();
  if (!binSolid) throw new Error('expected a cached bin solid');

  const plate = buildLid(params);
  try {
    const worst = await travelInterferenceMm3(
      binSolid,
      plate,
      geometry,
      slideLidZOffset(params, geometry)
    );
    return worst.mm3;
  } finally {
    plate.delete();
  }
}

describe('sliding lid seating', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 120000);

  it('travels its whole path without meeting the bin', async () => {
    // The detent is deliberately off. A bump the plate rides over IS shared
    // volume in the nominal model, and it is legitimate — folding a feature
    // that is supposed to be in the way into this number would let a real
    // clash hide behind it. Its presence is asserted separately below.
    expect(await travelOverlap(slideParams({}, { detent: false }))).toBeLessThan(CONTACT_FLOOR_MM3);
  }, 300000);

  it('the detent is a bump AND a pocket, and they meet', async () => {
    // An absence again, and a subtle one: a bump whose pocket missed it by a
    // millimetre leaves a lid that shuts, does not click, and shows nothing
    // wrong in either solid. So the assertion is that the plate has a void
    // exactly where the shelf has a bump — measured by intersecting the pair at
    // the CLOSED position with the pocket suppressed, which is the only
    // configuration where the two can be told apart.
    const params = slideParams();
    const pair = await build(params);
    expect(pair.geometry.detents).toHaveLength(2);
    expect(pair.geometry.plate.detentPockets).toHaveLength(2);

    // Seated, the pair must still be free: the pocket clears the bump.
    expect(await travelOverlap(params)).toBeLessThan(CONTACT_FLOOR_MM3);

    // And the bump is really on the bin — a delta against the same design
    // without it, at the column the plan puts the peak at.
    const { canonicalToBin } = await import('./__kernel-tests__/slideLidSeating');
    const { columnCrossings } = await import('./__kernel-tests__/meshAssertions');
    const peak = pair.geometry.detents[0];
    const [px, py] = canonicalToBin(pair.geometry, peak.peakX, (peak.yMin + peak.yMax) / 2);
    const flat = await build(slideParams({}, { detent: false }));
    const withBump = columnCrossings(pair.bin, px, py);
    const noBump = columnCrossings(flat.bin, px, py);
    expect(Math.max(...withBump)).toBeGreaterThan(Math.max(...noBump) - 1e-6);
    expect(withBump.length).toBeGreaterThan(noBump.length);
  }, 600000);

  it('is held down by the channel along both running edges', async () => {
    // The question no interference measure can answer: a retainer that was
    // never built removes nothing and collides with nothing. A DELTA against
    // the lidless bin, so the stacking lip's own inward jut — which is over the
    // plate's edge too, and was already there — cannot be counted as retainer.
    const params = slideParams();
    const pair = await build(params);
    const bare = bareBin(params);
    expect(newCrossingsAbovePlate(pair, bare)).toBeGreaterThan(8);
  }, 300000);

  it('can be got in: the entry wall is opened across the plate', async () => {
    // The mirror-image absence. A plate captive in a channel it cannot be
    // inserted into fits perfectly closed, so the travel sweep passes and the
    // capture probe passes.
    const params = slideParams();
    const pair = await build(params);
    expect(entryOpeningMm(pair)).toBeGreaterThan(pair.geometry.plate.thicknessMm - 0.05);
    // And the wall really was solid before the notch, so the probe is measuring
    // the notch rather than a hole that was always there.
    expect(entryOpeningMm({ ...pair, bin: bareBin(params) })).toBeLessThan(0.05);
  }, 300000);

  it('takes the entry wall’s lip away rather than leaving it bridging', async () => {
    // A notch that clears the plate's band and stops there leaves the lip
    // spanning the whole opening with nothing under it — the worst overhang on
    // the part, and a contradiction of what `slideRimInterrupted` tells the
    // user. Every fit check passes on it, which is why this is its own probe.
    //
    // Stated as a DELTA: the same columns on the lidless bin carry the full lip.
    const params = slideParams();
    const pair = await build(params);
    const bare = bareBin(params);
    expect(entryLipRemnantMm(pair)).toBeLessThan(0.2);
    expect(entryLipRemnantMm({ ...pair, bin: bare })).toBeGreaterThan(3);
  }, 300000);

  it('a finger catch fills the rim it took away, and still travels free', async () => {
    const params = slideParams({}, { pull: 'catch', detent: false });
    expect(await travelOverlap(params)).toBeLessThan(CONTACT_FLOOR_MM3);

    const { canonicalToBin } = await import('./__kernel-tests__/slideLidSeating');
    const pair = await build(params);
    const { plate } = pair.geometry;
    const [x, y] = canonicalToBin(pair.geometry, plate.trailingX - plate.pullDepthMm / 2, 0);
    const topOf = (p: SlidePair): number =>
      Math.max(...columnCrossings(p.lid, x, y)) + slideLidZOffset(p.params, p.geometry);
    // Shut, the bar's top lands on the lip's own top plane, so the rim reads
    // continuous across the entry wall.
    const lipTop = binWallTopZ(params) + GRIDFINITY_SPEC.LIP_HEIGHT - GRIDFINITY_SPEC.LIP_OVERLAP;
    expect(topOf(pair)).toBeCloseTo(lipTop, 1);
    // Stated as a delta: the plain plate at the same column stops far lower.
    const plain = await build(slideParams({}, { pull: 'none', detent: false }));
    expect(topOf(pair) - topOf(plain)).toBeGreaterThan(GRIDFINITY_SPEC.LIP_HEIGHT);
  }, 600000);

  it('keeps the lip intact on the walls the notch does not touch', async () => {
    // The travel-envelope cutter stops at the retainer's top plane.
    // Overshooting into the lip's angled support would back-fill the taper a
    // foot seats in — a bin that looks perfect and will not sit in a baseplate
    // (CLAUDE.md gotcha #10), invisible to every mesh check.
    //
    // Asserted as identity against the lidless bin rather than as a threshold:
    // away from the entry wall, the correct amount of lip a RECESSED channel
    // removes is exactly none.
    const params = slideParams({}, { placement: 'recessed' });
    const pair = await build(params);
    const bare = bareBin(params);
    const { sectionHalfWidth } = await import('./__kernel-tests__/meshAssertions');
    // Mid-lip. `sectionHalfWidth` reads the widest |X|, which on a front-entry
    // bin is a channel wall — not the notched one.
    const z = params.height * params.heightUnitMm + 2;
    expect(sectionHalfWidth(pair.bin, z)).toBeCloseTo(sectionHalfWidth(bare, z), 3);
  }, 300000);

  it('works from every entry wall', async () => {
    // The canonical frame plus one rotation is the whole orientation story, so
    // a sign flipped in the rotation breaks exactly one or two sides — which is
    // precisely the bug that a test written per-axis would share.
    const results: Array<{ side: string; travels: boolean; held: boolean }> = [];
    for (const entrySide of ['front', 'back', 'left', 'right'] as const) {
      const params = slideParams({}, { entrySide, detent: false });
      const pair = await build(params);
      results.push({
        side: entrySide,
        travels: (await travelOverlap(params)) < CONTACT_FLOOR_MM3,
        held: newCrossingsAbovePlate(pair, bareBin(params), 4) > 4,
      });
    }
    expect(results).toEqual([
      { side: 'front', travels: true, held: true },
      { side: 'back', travels: true, held: true },
      { side: 'left', travels: true, held: true },
      { side: 'right', travels: true, held: true },
    ]);
  }, 900000);

  it('a rim-height channel leaves the deepest interior', async () => {
    // The reason the placement exists, stated as a comparison between the two
    // placements rather than an absolute depth, so it tracks the lip spec
    // instead of restating it.
    const lipless = { ...DEFAULT_BIN_PARAMS.base, stackingLip: false };
    const flush = await build(slideParams({ base: lipless }, { placement: 'flush' }));
    const recessedLipless = await build(slideParams({ base: lipless }, { placement: 'recessed' }));
    // On a lipless bin the two coincide — the documented degenerate case, since
    // there is nothing above the rim to get out of the way of.
    expect(flush.geometry.plateTopBelowWallTopMm).toBeCloseTo(
      recessedLipless.geometry.plateTopBelowWallTopMm,
      6
    );

    const lipped = await build(slideParams({}, { placement: 'recessed' }));
    expect(lipped.geometry.plateTopBelowWallTopMm).toBeGreaterThan(
      flush.geometry.plateTopBelowWallTopMm + 2
    );
  }, 600000);

  it('leaves the corner wall solid through the relief band', async () => {
    // The cavity's corners are ARCS; a square travel-envelope cutter reaches
    // √2·r from the arc centre and thins the corner wall to ~0.14mm at the
    // default thickness (through it below ~1.1mm). Probed on the EXPORT mesh:
    // the preview mesh concatenates the base socket and its coincident faces
    // flip span parity (see `binStackSeating`'s cache note). Stated against
    // the lidless bin, which must read solid through the same window.
    const params = slideParams();
    const bin = getGenerateBin()(params, undefined, true);
    const bare = getGenerateBin()(
      { ...params, lid: { ...params.lid, enabled: false } },
      undefined,
      true
    );
    const dims = binDimensions(params);
    const wallTop = binWallTopZ(params);
    const r = GRIDFINITY_SPEC.BOX_CORNER_RADIUS;
    const midAnnulus = (r - params.wallThickness / 2) / Math.SQRT2;

    // The two BACK corners — clear of the entry notch on the front wall.
    for (const sx of [-1, 1] as const) {
      const x = sx * (dims.outerW / 2 - r + midAnnulus);
      const y = dims.outerD / 2 - r + midAnnulus;
      expect(isSolidThrough(bare, x, y, 10, wallTop - 0.2), `bare corner sx=${sx}`).toBe(true);
      expect(isSolidThrough(bin, x, y, 10, wallTop - 0.2), `corner sx=${sx}`).toBe(true);
    }
  }, 600000);

  it('cuts divider crowns to the wall top instead of leaving them bridging the plate', async () => {
    // Dividers are built to the interior ceiling, 0.7mm below the wall top;
    // the travel envelope tops out a lip-taper lower. Without the crown cut,
    // each divider keeps a ~2mm slab floating over the plate, welded only to
    // the perimeter — unprintable and pointless. After it, a divider column
    // holds NOTHING between the envelope's top and the wall top.
    const params = slideParams({
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
    });
    const bin = getGenerateBin()(params, undefined, true);
    const { geometry } = slideLidPlanForParams(params);
    if (!geometry) throw new Error('expected slide geometry');
    const wallTop = binWallTopZ(params);
    const envTopZ = wallTop - geometry.plateTopBelowWallTopMm + geometry.travelEnvelope.zMax;
    // This case exists because the gap is real; if the placements ever close
    // it, the probe below would pass vacuously.
    expect(wallTop - envTopZ).toBeGreaterThan(1);

    const dims = binDimensions(params);
    // One column on each divider's centre plane, clear of the cross junction.
    const columns: ReadonlyArray<readonly [number, number]> = [
      [0, dims.innerD / 4],
      [dims.innerW / 4, 0],
    ];
    for (const [x, y] of columns) {
      const inBand = columnCrossings(bin, x, y).filter(
        (z) => z > envTopZ + 0.05 && z < wallTop + 1
      );
      expect(inBand, `column (${x.toFixed(1)}, ${y.toFixed(1)})`).toHaveLength(0);
    }
  }, 600000);
  it('the entry mouth is as wide as the channel, so the plate can be pushed in', async () => {
    // The defect this exists for: the cavity is a ROUNDED rectangle, so each
    // corner arc is tangent to the entry wall's inner face and the mouth is
    // `2·cornerR` narrower than the channel behind it — 4.6mm at the default
    // wall. The plate's running edges are straight for its whole length, so it
    // meets those two arcs `cornerR − c` deep and stops, on every bin size,
    // whatever the notch does.
    //
    // Invisible to every probe already here: the notch really does open the
    // entry WALL full width, the seated plate really does fit, and the travel
    // sweep's shared volume is ~1.4mm³ — a thin wedge, under the coincident-
    // face floor those measures need.
    //
    // Stated as an ABSENCE of material in the plate's own straight-sided
    // section, and compared against the same probe mid-travel: the mouth must
    // be no more obstructed than the middle of the channel, which is zero.
    const params = slideParams({ width: 1, depth: 1, height: 3 });
    const { getLastSolid } = await import('./shapeCache');
    const { geometry } = slideLidPlanForParams(params);
    if (!geometry) throw new Error('expected slide geometry');
    getGenerateBin()(params, undefined, false);
    const bin = getLastSolid();
    if (!bin) throw new Error('expected a cached bin solid');
    const dz = slideLidZOffset(params, geometry);
    // The last `cornerR` before the entry face, which is exactly the run the
    // arcs occupy, against an equal run taken from the middle of the travel.
    const r = geometry.plate.cornerRadiusMm;
    const face = geometry.travelEnvelope.xMax;
    const mouth = await straightSectionObstructionMm3(bin, geometry, dz, face - r, face);
    const middle = await straightSectionObstructionMm3(bin, geometry, dz, -r / 2, r / 2);
    expect(middle).toBeCloseTo(0, 3);
    expect(mouth).toBeCloseTo(middle, 3);
  }, 300000);

  it('opens the mouth on every entry wall', async () => {
    // Same reason the travel check is repeated per side: the relief is built in
    // the canonical frame and rotated, so a sign error breaks one or two walls
    // and a test written for the default entry would share it.
    const { getLastSolid } = await import('./shapeCache');
    const results: Array<{ side: string; clear: boolean }> = [];
    for (const entrySide of ['front', 'back', 'left', 'right'] as const) {
      const params = slideParams({ width: 1, depth: 1, height: 3 }, { entrySide });
      const { geometry } = slideLidPlanForParams(params);
      if (!geometry) throw new Error(`expected geometry for ${entrySide}`);
      getGenerateBin()(params, undefined, false);
      const bin = getLastSolid();
      if (!bin) throw new Error('expected a cached bin solid');
      const r = geometry.plate.cornerRadiusMm;
      const face = geometry.travelEnvelope.xMax;
      const mm3 = await straightSectionObstructionMm3(
        bin,
        geometry,
        slideLidZOffset(params, geometry),
        face - r,
        face
      );
      results.push({ side: entrySide, clear: mm3 < 0.01 });
    }
    expect(results).toEqual([
      { side: 'front', clear: true },
      { side: 'back', clear: true },
      { side: 'left', clear: true },
      { side: 'right', clear: true },
    ]);
  }, 900000);

  it('leaves the rail no roof worth bridging where it meets the wall', async () => {
    // The relief's own failure mode, and it is invisible to every other probe
    // here: cut it as a BOX and it saws the retainer's underside flat over the
    // whole run, leaving a horizontal roof with nothing under it right where
    // the rail meets the wall — about 5mm², and the lid still slides, still
    // holds, still measures watertight. Cutting the channel's own profile
    // instead takes nothing the channel does not own, and cutting it before the
    // bars fuse puts them back across the relieved arc.
    //
    // What survives is the sliver of arc left over the rail's top past the
    // retainer's own reach. It is bounded by ONE EXTRUSION's footprint, which
    // is the physical question — a ceiling smaller than a single bead is laid
    // down as perimeter, not bridged — rather than by a fraction of the damage
    // the box did. Held to zero instead, the only shapes that pass are ones
    // that tip the cut above the rail and carve the corner out to get there.
    const params = slideParams({ width: 1, depth: 1, height: 3 });
    const { geometry } = slideLidPlanForParams(params);
    if (!geometry) throw new Error('expected slide geometry');
    const bin = getGenerateBin()(params, undefined, true);
    if (!bin) throw new Error('expected the bin to build');
    const dz = slideLidZOffset(params, geometry);
    const cornerR = geometry.plate.cornerRadiusMm;
    const face = geometry.travelEnvelope.xMax;
    const roofAt = (from: number, to: number): number =>
      unsupportedRoofAreaMm2(bin, geometry, dz, from, to);

    // The middle of the channel has never had anything to bridge, at all.
    expect(roofAt(-cornerR / 2, cornerR / 2)).toBeCloseTo(0, 6);
    // Both corners together, against one 0.4mm bead's footprint.
    expect(roofAt(face - cornerR, face)).toBeLessThan(NOZZLE_MM * NOZZLE_MM);
  }, 300000);

  it('opens the corner arc without taking the corner away', async () => {
    // The relief's third failure mode, and the one every other measure here
    // rewards. The arc has to be opened so the plate can pass; widen the cut
    // past the channel's profile and the corner goes with the arc, because the
    // body's OUTER radius stays where it is — a squared inner face leaves the
    // wall tapering to 0.2mm over the bin's whole height. The lid still
    // slides, the mesh is still solid and manifold, and nothing else notices.
    //
    // Measured above the channel's own ceiling, as the SURPLUS a corner holds
    // over a plain stretch of the same wall — which is the arc — and compared
    // with the lid off. The surplus cancels every other cut this band sees, so
    // what is left is what the relief took.
    const params = slideParams({ width: 1, depth: 1, height: 3 });
    const { getLastSolid } = await import('./shapeCache');
    const { geometry } = slideLidPlanForParams(params);
    if (!geometry) throw new Error('expected slide geometry');
    const dz = slideLidZOffset(params, geometry);
    const r = geometry.plate.cornerRadiusMm;
    const from = geometry.travelEnvelope.xMax - r;
    // Stopped short of the notch, which removes the entry wall outright and is
    // still present on the lidless control.
    const to = geometry.entryNotch.xMin;
    const arcSurplus = async (solid: Parameters<typeof entryCornerMm3>[0]): Promise<number> =>
      (await entryCornerMm3(solid, geometry, dz, from, to)) -
      (await entryCornerMm3(solid, geometry, dz, -r / 2, -r / 2 + (to - from)));

    getGenerateBin()(params, undefined, true);
    const withChannel = getLastSolid();
    if (!withChannel) throw new Error('expected a cached bin solid');
    const kept = await arcSurplus(withChannel);

    getGenerateBin()({ ...params, lid: { ...params.lid, enabled: false } }, undefined, true);
    const bare = getLastSolid();
    if (!bare) throw new Error('expected the lidless bin solid');
    const whole = await arcSurplus(bare);

    // The comparison needs a corner to be worth measurably more than a wall,
    // or the bound below would hold vacuously.
    expect(whole).toBeGreaterThan(1);
    expect(kept).toBeGreaterThan(whole * 0.9);
  }, 300000);
  it('opens the entry wall on a bin with an overhang on that very side', async () => {
    // Overhang moves the body and the cavity together, so every wall keeps its
    // nominal thickness. Charge the asymmetry to this one wall instead and it
    // reads `front / 2` short, crosses zero at twice the wall thickness, and
    // carries `trailingX` and the entry notch with it: the notch stops short of
    // the outer face, then inverts, and nothing is cut.
    //
    // Asked of the wall itself rather than of the plan's numbers, and swept
    // across a range that straddles the point the thickness would go negative.
    // The probe takes the cavity offset, without which it samples the wrong
    // wall entirely.
    const { getLastSolid } = await import('./shapeCache');
    const results: Array<{ front: number; open: boolean }> = [];
    for (const front of [0, 3, 5, 10]) {
      const params = slideParams({
        width: 1,
        depth: 1,
        height: 3,
        overhang: { left: 0, right: 0, front, back: 0, feet: false },
      });
      const { geometry } = slideLidPlanForParams(params);
      if (!geometry) throw new Error(`expected geometry for front=${front}`);
      const base = binDimensions(params);
      const innerD = base.innerD + front;
      const outerD = base.outerD + front;
      const offsetY = -front / 2;
      getGenerateBin()(params, undefined, true);
      const bin = getLastSolid();
      if (!bin) throw new Error('expected a cached bin solid');
      // The tunnel the plate has to pass through the wall: cavity face to just
      // past the outer face, in the plate's own straight-sided band.
      const cavityFace = innerD / 2;
      const outerFace = outerD / 2;
      const blocked = await straightSectionObstructionMm3(
        bin,
        geometry,
        slideLidZOffset(params, geometry),
        cavityFace,
        outerFace,
        0,
        offsetY
      );
      results.push({ front, open: blocked < 0.01 });
    }
    expect(results).toEqual([
      { front: 0, open: true },
      { front: 3, open: true },
      { front: 5, open: true },
      { front: 10, open: true },
    ]);
  }, 900000);
});

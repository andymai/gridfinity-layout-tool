/**
 * Mate a sliding lid to its bin and measure whether it can actually travel.
 *
 * A capping lid either seats or it does not, so one probe at the seated
 * position answers for it. A sliding lid has a whole path to get wrong: it can
 * sit perfectly closed and bind halfway, it can travel freely and be held by
 * nothing, and it can be captive in a channel it cannot be got INTO. Every one
 * of those leaves two watertight solids with plausible triangle counts and
 * correct bounding boxes, exactly as CLAUDE.md gotchas #10 and #18 describe.
 *
 * Three measurements, and none can answer for another:
 *
 *  - {@link travelInterferenceMm3} intersects the two SOLIDS at each position
 *    along the plate's path and reports the overlapping volume. Answers "does
 *    it move".
 *  - {@link newCrossingsAbovePlate} asks whether the channel put bin material
 *    ABOVE the plate's running edge. Answers "does it hold" — asked separately
 *    because a retainer that was never built collides with nothing, so the
 *    sweep reports clean on a lid that lifts straight out.
 *  - {@link entryOpeningMm} asks whether the entry wall was opened across the
 *    plate's band. Answers "does it go in" — again an ABSENCE.
 *
 * ── WHY A BOOLEAN AND NOT A COLUMN PROBE ────────────────────────────────
 *
 * The travel check intersects real BREP solids rather than pairing mesh
 * crossings, because `verticalSolidSpans` is not sound on this bin: measured on
 * a plain 3x2 with no sliding lid at all, a column through the front wall
 * returns THREE crossings — the socket step at Z=5 is a tangential touch, not
 * an entry — so every interval above it is paired into the void and the wall
 * reads as missing. That weakness is already documented in
 * `lidSeatInterference.matrix`; the boolean sidesteps it entirely and is the
 * exact question anyway.
 *
 * The other two probes read {@link columnCrossings}, which is parity-free, and
 * state their results as DELTAS against the same bin with its lid disabled — so
 * a surface that was always there cannot be mistaken for one the channel added.
 */

import { columnCrossings } from './meshAssertions';
import { slideLidPlanForParams } from '@/shared/types/bin';
import type { SlideLidGeometry } from '@/shared/utils/slideLidPlan';
import type { BinParams } from '@/shared/types/bin';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { MeshData } from '@/features/generation/bridge/types';

/** Z of the bin's wall top in the generated mesh's world frame. */
export function binWallTopZ(p: BinParams): number {
  return p.height * p.heightUnitMm + Math.max(0, p.extraWallHeightMm ?? 0);
}

/**
 * The Z that seats the plate closed.
 *
 * The plate is built with `z = 0` at its top face and already carries its XY
 * placement, so only Z moves. Stated from params rather than read off
 * `deriveDimensions`, so it stays an independent opinion about where the wall
 * top is — the plane the whole joint is measured against.
 */
export function slideLidZOffset(p: BinParams, geometry: SlideLidGeometry): number {
  return binWallTopZ(p) - geometry.plateTopBelowWallTopMm;
}

/**
 * Map a point from the plan's CANONICAL frame (along = +X toward the entry,
 * across = Y) into the bin's XY.
 *
 * One transform, used by every probe. Writing the swap inline per probe is how
 * they ended up sampling a mirrored footprint on two of the four entry sides —
 * which is the same mistake the canonical frame exists to prevent in the
 * builder, and has to be prevented in the test too.
 */
export function canonicalToBin(
  geometry: SlideLidGeometry,
  along: number,
  across: number
): readonly [number, number] {
  switch (geometry.entrySide) {
    case 'right':
      return [along, across];
    case 'back':
      return [-across, along];
    case 'left':
      return [-along, -across];
    case 'front':
      return [across, -along];
  }
}

/** Unit vector the plate withdraws along, in the bin's XY frame. */
export function withdrawDirection(geometry: SlideLidGeometry): readonly [number, number] {
  switch (geometry.entrySide) {
    case 'right':
      return [1, 0];
    case 'left':
      return [-1, 0];
    case 'back':
      return [0, 1];
    case 'front':
      return [0, -1];
  }
}

/** A mated pair plus the plan that placed them. */
export interface SlidePair {
  readonly params: BinParams;
  readonly bin: MeshData;
  readonly lid: MeshData;
  readonly geometry: SlideLidGeometry;
}

/** Build the pair, or null when the design produces no sliding lid. */
export function seatSlideLid(
  params: BinParams,
  bin: MeshData | null,
  lid: MeshData | null
): SlidePair | null {
  const { geometry } = slideLidPlanForParams(params);
  if (!bin || !lid || !geometry) return null;
  return { params, bin, lid, geometry };
}

/**
 * Volume (mm³) the plate and the bin share at each position on the plate's
 * travel, worst first.
 *
 * The direct question, asked of the real solids: translate the plate along its
 * path, intersect, measure. Zero at every position is a joint that moves; any
 * real volume is material in the way, wherever it is and whatever shape.
 *
 * Coincident faces — the plate resting ON its shelf, its chamfer parallel to
 * the retainer — produce either an empty result or a sliver, so a small floor
 * is expected and the caller compares against it rather than against zero.
 *
 * Takes the SOLIDS rather than the meshes; see the note at the top of the file
 * about why a column probe cannot serve here.
 */
export async function travelInterferenceMm3(
  binSolid: Shape3D,
  plateSolid: Shape3D,
  geometry: SlideLidGeometry,
  dz: number,
  steps = 6
): Promise<{ readonly mm3: number; readonly atFraction: number }> {
  const { intersect, translate, mesh } = await import('brepjs');
  const { meshVolume } = await import('./meshAssertions');
  const [ux, uy] = withdrawDirection(geometry);

  let worst = { mm3: 0, atFraction: 0 };
  for (let s = 0; s <= steps; s++) {
    const f = s / steps;
    const moved: Shape3D = translate(plateSolid, [
      ux * geometry.travelMm * f,
      uy * geometry.travelMm * f,
      dz,
    ]);
    let overlap: Shape3D | null = null;
    try {
      const result = intersect(binSolid as ValidSolid, moved as ValidSolid);
      // A boolean over coincident faces can legitimately produce nothing at
      // all, which is the answer this probe wants: no shared volume.
      if (!result.ok) continue;
      overlap = result.value;
      const m = mesh(overlap, { tolerance: 0.05, angularTolerance: 10 });
      const mm3 = Math.abs(
        meshVolume({
          vertices: m.vertices,
          indices: m.triangles,
        } as unknown as MeshData)
      );
      if (mm3 > worst.mm3) worst = { mm3, atFraction: f };
    } finally {
      overlap?.delete();
      moved.delete();
    }
  }
  return worst;
}

/** Crossings the channel ADDED at a column, in ascending Z. */
function addedCrossings(
  withLid: MeshData,
  withoutLid: MeshData,
  x: number,
  y: number,
  tol = 0.02
): number[] {
  const before = columnCrossings(withoutLid, x, y);
  return columnCrossings(withLid, x, y).filter((z) => !before.some((b) => Math.abs(b - z) <= tol));
}

/**
 * How much bin material the channel added directly ABOVE the plate's running
 * edge, summed over samples along both walls.
 *
 * The "does it hold" question, asked positively for the reason `ungrippedRailMm`
 * exists: a retainer that was never built removes nothing and collides with
 * nothing, so an interference measure passes on a lid that falls out.
 *
 * A DELTA against the lidless bin, so the stacking lip's own inward jut — which
 * is over the plate's edge too, and was there before — cannot be mistaken for
 * a retainer.
 */
export function newCrossingsAbovePlate(pair: SlidePair, bareBin: MeshData, samples = 8): number {
  const dz = slideLidZOffset(pair.params, pair.geometry);
  const { plate } = pair.geometry;
  // Just inside the plate's edge, under the wedge the retainer overhangs.
  const inboard = plate.spanMm / 2 - plate.wedgeMm / 2;
  // Clear of both ends: the entry is notched by design and the far end holds
  // the detent pocket.
  const from = plate.leadingX + 6;
  const to = plate.trailingX - 8;
  if (to <= from) return 0;

  let count = 0;
  for (let i = 0; i < samples; i++) {
    const along = from + ((to - from) * i) / Math.max(samples - 1, 1);
    for (const side of [-1, 1] as const) {
      const [x, y] = canonicalToBin(pair.geometry, along, side * inboard);
      count += addedCrossings(pair.bin, bareBin, x, y).filter((z) => z > dz + 0.05).length;
    }
  }
  return count;
}

/**
 * How much of the entry wall survives ABOVE the bin's wall top, across the
 * plate's width — i.e. how much stacking lip is left bridging the opening.
 *
 * The counterpart to {@link entryOpeningMm}, and the reason that probe is not
 * enough: a notch that clears the plate's own band exactly, and stops there,
 * leaves the lip spanning the whole opening with nothing under it. Every check
 * about whether the plate FITS passes — it does — while the part carries the
 * worst overhang on the bin and the panel tells the user the lip was removed.
 *
 * Returns the greatest surviving material found at any sampled column, so a
 * notch that reaches in the middle and pinches at the edges fails.
 */
export function entryLipRemnantMm(pair: SlidePair, samples = 7): number {
  const wallTop = binWallTopZ(pair.params);
  const { plate } = pair.geometry;
  const along = plate.trailingX - 0.5;

  let worst = 0;
  for (let i = 0; i < samples; i++) {
    const t = -0.5 + i / (samples - 1);
    const across = t * (plate.spanMm - plate.pullSpanMm - 4);
    const [x, y] = canonicalToBin(pair.geometry, along, across);
    const crossings = columnCrossings(pair.bin, x, y);
    if (crossings.length === 0) continue;
    // How far the wall's HIGHEST surface reaches past the wall top: on an
    // untouched wall that is the lip, and where the notch has been cut clean
    // through there is nothing above the notch's floor at all. Read off the
    // outermost crossing rather than paired spans, which the bin's coincident
    // socket seam makes unreliable.
    worst = Math.max(worst, Math.max(...crossings) - wallTop);
  }
  return Math.max(worst, 0);
}

/**
 * Height (mm) of the plate's own band that the entry wall leaves clear.
 *
 * Zero means the plate is captive in a channel it cannot be inserted into,
 * which no interference measure would report: at the closed position everything
 * fits perfectly.
 *
 * Asked as "is the wall's topmost surface below the band" rather than by
 * pairing crossings into spans. The notch is cut clean THROUGH the rim, so
 * where it lands there is no upper face to pair with — a probe that looked for
 * one read a correct notch as no notch at all. Parity-free either way, which
 * the bin's coincident socket seam requires.
 *
 * Returns the SMALLEST opening over the sampled width, so a notch that reaches
 * in the middle and pinches at the edges fails rather than averaging out.
 */
export function entryOpeningMm(pair: SlidePair, samples = 7): number {
  const dz = slideLidZOffset(pair.params, pair.geometry);
  const { plate } = pair.geometry;
  // Half a millimetre inside the entry wall's outer face, where the plate's
  // trailing edge finishes.
  const along = plate.trailingX - 0.5;
  const bandLo = dz - plate.thicknessMm;

  let worst = Infinity;
  for (let i = 0; i < samples; i++) {
    const t = -0.5 + i / (samples - 1);
    // Kept inside the pull's own cut-out, which removes plate rather than wall.
    const across = t * (plate.spanMm - plate.pullSpanMm - 4);
    const [x, y] = canonicalToBin(pair.geometry, along, across);
    const crossings = columnCrossings(pair.bin, x, y);
    const top = crossings.length === 0 ? -Infinity : Math.max(...crossings);
    worst = Math.min(worst, Math.max(0, Math.min(dz - bandLo, dz - Math.max(top, bandLo))));
  }
  return worst === Infinity ? 0 : worst;
}

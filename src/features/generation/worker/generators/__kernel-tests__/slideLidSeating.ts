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

import { columnCrossings, triangleArea, triangleNormalZ } from './meshAssertions';
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

/**
 * Volume (mm³) of bin material standing inside the plate's STRAIGHT-SIDED
 * section, over a run of the travel axis measured inward from the entry face.
 *
 * The question `entryOpeningMm` cannot ask. That probe samples columns within
 * the entry WALL, where the notch really does open the full width — while the
 * obstruction that stops the plate sits just behind the wall plane, inside the
 * cavity: its two corner arcs are tangent to the entry face, so the mouth is
 * `2·cornerR` narrower than the channel the plate runs in. A plate whose edges
 * are straight for its whole length cannot pass that, and every measurement
 * taken within the wall reads clear.
 *
 * Measured with a boolean rather than columns for the reason this file's
 * preamble gives, and because a solid pillar filling the probed band has no
 * surface INSIDE it — a column probe reads it as empty.
 *
 * The band is `z ∈ [−t, −wedge]`: the part of the plate that is full width at
 * every `u`. The retainer's underside is the plane `u − wedge` and so never
 * reaches below `−wedge` at any `u`, which is what keeps a legitimate dovetail
 * out of the number. Zero is the only correct answer, at the mouth and
 * anywhere else along the travel.
 */
export async function straightSectionObstructionMm3(
  binSolid: Shape3D,
  geometry: SlideLidGeometry,
  plateTopZ: number,
  fromX: number,
  toX: number,
  innerOffsetX = 0,
  innerOffsetY = 0
): Promise<number> {
  const { draw, intersect, mesh, rotate, translate } = await import('brepjs');
  const { meshVolume } = await import('./meshAssertions');
  const { plate } = geometry;
  const hs = plate.spanMm / 2;
  const section = draw([-hs, -plate.thicknessMm])
    .lineTo([hs, -plate.thicknessMm])
    .lineTo([hs, -plate.wedgeMm])
    .lineTo([-hs, -plate.wedgeMm])
    .close();
  // Canonical (travel along +X), then rotated onto the entry wall and dropped
  // onto the cavity — the same three transforms `buildSlideLidChannel` places
  // with, so the probe cannot disagree with the builder about which wall is the
  // entry or where the cavity's centre is.
  const swept = section.sketchOnPlane('YZ').extrude(toX - fromX);
  const atX = translate(swept, [fromX, 0, 0]);
  const oriented =
    geometry.rotationDeg === 0 ? atX : rotate(atX, geometry.rotationDeg, { axis: [0, 0, 1] });
  const probe = translate(oriented, [innerOffsetX, innerOffsetY, plateTopZ]);
  try {
    const result = intersect(binSolid as ValidSolid, probe as ValidSolid);
    if (!result.ok) return 0;
    const m = mesh(result.value, { tolerance: 0.02, angularTolerance: 8 });
    try {
      if (m.vertices.length === 0) return 0;
      return Math.abs(
        meshVolume({ vertices: m.vertices, indices: m.triangles } as unknown as MeshData)
      );
    } finally {
      result.value.delete();
    }
  } finally {
    probe.delete();
    if (oriented !== atX) oriented.delete();
    atX.delete();
    swept.delete();
  }
}

/**
 * Area (mm²) of unsupported roof in the channel: downward-facing surface
 * steeper than 45° off vertical, within a run of the travel axis.
 *
 * The whole joint is shaped so neither part needs support — the shelf's gusset
 * and the retainer's underside are both 45° planes — so any face here that a
 * printer would have to bridge is a defect, whatever else measures clean. It is
 * also the failure mode that leaves the plate sliding perfectly: a retainer
 * sawn off square still holds the lid and still clears it, and every fit,
 * travel and watertightness check passes on it.
 *
 * Bounded to the channel's own band, up to the retainer's top, so the bin's
 * other features cannot leak into the number. `45°` is the threshold the
 * sections are drawn to, so the comparison is against the design's own rule
 * rather than a number chosen to pass.
 */
export function unsupportedRoofAreaMm2(
  bin: MeshData,
  geometry: SlideLidGeometry,
  plateTopZ: number,
  fromX: number,
  toX: number,
  innerOffsetX = 0,
  innerOffsetY = 0
): number {
  const { vertices, indices } = bin;
  const lo = plateTopZ - geometry.plate.thicknessMm - 0.05;
  const hi = plateTopZ + geometry.travelEnvelope.zMax + 0.05;
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    // Downward-facing and within 45° of horizontal — the faces a printer has
    // nothing to lay the first bead of on.
    if (triangleNormalZ(vertices, a, b, c) > -Math.SQRT1_2) continue;
    let inside = true;
    for (const v of [a, b, c]) {
      const [along] = binToCanonical(
        geometry,
        vertices[v * 3] - innerOffsetX,
        vertices[v * 3 + 1] - innerOffsetY
      );
      const z = vertices[v * 3 + 2];
      if (along < fromX || along > toX || z < lo || z > hi) inside = false;
    }
    if (inside) area += triangleArea(vertices, a, b, c);
  }
  return area;
}

/**
 * Volume (mm³) of bin material at one entry corner, above the channel's own
 * ceiling — how much CORNER the mouth relief left behind.
 *
 * The counterweight to {@link unsupportedRoofAreaMm2}: that one fails if the
 * relief leaves too much, this one if it takes too much. Widen the cut past the
 * channel's profile and the corner goes with the arc, because the body's OUTER
 * radius does not move — a squared inner face leaves the wall tapering to 0.2mm
 * over the bin's whole height. Nothing else in this file can see it: the bin is
 * still solid, still manifold, and the lid still slides.
 *
 * Read as a SURPLUS — this window at the corner minus the same window on a
 * plain stretch of the same wall — and that surplus compared with the lid off.
 * A corner holds more than a wall because of the arc, so the surplus IS the
 * arc; and taking the difference cancels everything else the lid does to this
 * band, which on a recessed placement includes the divider-crown cut above the
 * travel envelope. Comparing the raw volumes instead charges that cut to the
 * relief.
 *
 * The caller also keeps `toX` clear of `entryNotch.xMin`: past that the notch
 * removes the wall outright, and the lidless control still has it.
 */
export async function entryCornerMm3(
  binSolid: Shape3D,
  geometry: SlideLidGeometry,
  plateTopZ: number,
  fromX: number,
  toX: number,
  innerOffsetX = 0,
  innerOffsetY = 0
): Promise<number> {
  const { draw, intersect, mesh, rotate, translate } = await import('brepjs');
  const { meshVolume } = await import('./meshAssertions');
  const r = geometry.plate.cornerRadiusMm;
  const hs = geometry.plate.spanMm / 2 + geometry.clearanceMm;
  const base = geometry.travelEnvelope.zMax;
  const outline = draw([hs - r, fromX])
    .lineTo([hs, fromX])
    .lineTo([hs, toX])
    .lineTo([hs - r, toX])
    .close();
  const prism = outline.sketchOnPlane('XY', base).extrude(geometry.entryNotch.zMax - base);
  const oriented =
    geometry.rotationDeg === 0 ? prism : rotate(prism, geometry.rotationDeg, { axis: [0, 0, 1] });
  const probe = translate(oriented, [innerOffsetX, innerOffsetY, plateTopZ]);
  try {
    const result = intersect(binSolid as ValidSolid, probe as ValidSolid);
    if (!result.ok) return 0;
    const m = mesh(result.value, { tolerance: 0.02, angularTolerance: 8 });
    try {
      if (m.vertices.length === 0) return 0;
      return Math.abs(
        meshVolume({ vertices: m.vertices, indices: m.triangles } as unknown as MeshData)
      );
    } finally {
      result.value.delete();
    }
  } finally {
    probe.delete();
    if (oriented !== prism) oriented.delete();
    prism.delete();
  }
}

/** Inverse of {@link canonicalToBin}, for reading a vertex back into the plan. */
function binToCanonical(
  geometry: SlideLidGeometry,
  x: number,
  y: number
): readonly [number, number] {
  switch (geometry.entrySide) {
    case 'right':
      return [x, y];
    case 'back':
      return [y, -x];
    case 'left':
      return [-x, -y];
    case 'front':
      return [-y, x];
  }
}

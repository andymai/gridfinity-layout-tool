/**
 * Seat a generated lid on its generated bin and measure where they collide.
 *
 * The bin and its lid are separate solids, so nothing about either mesh says
 * they interpenetrate: both are watertight, both have plausible triangle
 * counts, and every bounding-box assertion passes while the lid physically
 * cannot seat (CLAUDE.md gotcha #10). Mating the two and probing inside the
 * assembly is the only way to see it, and the seating math is subtle enough
 * (lid-local anchor, overhang-shifted rails, preview-only nudges) that a second
 * copy would be a second chance to get it wrong.
 */

import { boundingBox, columnCrossings, verticalSolidSpans } from './meshAssertions';
import { LIP_HEIGHT } from '../generatorConstants';
import {
  lidAnchorZ,
  resolveLidCavityExtraMm,
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
} from '@/shared/types/bin';
import {
  retentionBossRadius,
  retentionMagnetInset,
  retentionMagnetPositions,
} from '../retentionMagnetGeometry';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

/**
 * Z shift that seats the lid on the bin.
 *
 * `lidAnchorZ` is where the bin's lip top lands in lid-local Z, so the offset
 * is the bin's real lip top minus that. `PREVIEW_Z_OFFSET` is deliberately
 * absent — that is a preview-only group nudge, and including it would open a
 * 0.1mm gap that hides exactly the interference being measured.
 *
 * Stated from the params rather than read off `deriveDimensions`, so it stays
 * an independent opinion about where the rim is: the seat plane is exactly what
 * these probes exist to check. Covers a socketed, flat or collared bin — a tray
 * bottom's skirt raises the rim further and is not modelled here.
 */
export function lidZOffset(p: BinParams): number {
  return binLipTopZ(p) - lidAnchorZ(p.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(p));
}

/** Z of the bin's lip top in world coords. The plane a seated lid registers on. */
export function binLipTopZ(p: BinParams): number {
  const wallTop = p.height * p.heightUnitMm + Math.max(0, p.extraWallHeightMm ?? 0);
  return wallTop + LIP_HEIGHT;
}

/** Total mm of bin and lid material sharing the same Z at this column. */
export function interferenceAt(
  bin: MeshData,
  lid: MeshData,
  x: number,
  y: number,
  dz: number
): number {
  const binSpans = verticalSolidSpans(bin, x, y);
  const lidSpans = verticalSolidSpans(lid, x, y).map(([lo, hi]) => [lo + dz, hi + dz] as const);
  let total = 0;
  for (const [a0, a1] of binSpans) {
    for (const [b0, b1] of lidSpans) {
      total += Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    }
  }
  return total;
}

/** One mated pair: a bin, its lid, and the offset that seats them. */
export interface SeatedPair {
  readonly bin: MeshData;
  readonly lid: MeshData;
  readonly dz: number;
}

/**
 * Every probe position {@link worstRailInterference} visits, for a given lid.
 *
 * A fixed discrete set derived from the lid's own bounds, which is what lets
 * two lids of the same footprint be compared position by position.
 */
function railProbePositions(lid: MeshData): Array<readonly [number, number]> {
  const bb = boundingBox(lid.vertices);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const spineX = (bb.maxX - bb.minX) / 2 - LID_CORNER_RADIUS;
  const spineY = (bb.maxY - bb.minY) / 2 - LID_CORNER_RADIUS;
  const out: Array<readonly [number, number]> = [];
  for (const off of RAIL_PROBE_OFFSETS) {
    for (let y = cy - spineY; y <= cy + spineY; y += 1) {
      out.push([cx + spineX + off, y], [cx - spineX - off, y]);
    }
    for (let x = cx - spineX; x <= cx + spineX; x += 1) {
      out.push([x, cy + spineY + off], [x, cy - spineY - off]);
    }
  }
  return out;
}

/**
 * Worst EXTRA rail interference `probe` has over `reference`, position by
 * position.
 *
 * {@link worstRailInterference} is not zero on a good bin at every footprint:
 * its outer offsets sample the rail bump inside the lip's undercut, and that
 * overlap is the snap fit engaging, not a defect. Measured at 0.7mm on a plain
 * 1x2 with no interior features whatever, and 0 on a 2x2 — a property of the
 * footprint, which is why an absolute threshold cannot serve a matrix that
 * varies the footprint.
 *
 * Comparing the two maxima would hide a small real clash behind a larger floor,
 * so this walks matching positions instead. Sound here in a way the same trick
 * is NOT for the whole-footprint sweep: these positions are a fixed discrete
 * set from the lid bounds, identical for both lids, rather than a grid laid
 * over a continuous field.
 *
 * A feature that REMOVES a rail scores negative and passes, correctly — no
 * rail, nothing to collide with.
 */
export function worstRailInterferenceDelta(probe: SeatedPair, reference: SeatedPair): number {
  const a = railProbePositions(probe.lid);
  const b = railProbePositions(reference.lid);
  if (a.length !== b.length) {
    throw new Error(`rail delta needs a shared footprint: ${a.length} vs ${b.length} positions`);
  }
  let worst = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const [px, py] = a[i];
    const [rx, ry] = b[i];
    worst = Math.max(
      worst,
      interferenceAt(probe.bin, probe.lid, px, py, probe.dz) -
        interferenceAt(reference.bin, reference.lid, rx, ry, reference.dz)
    );
  }
  return worst;
}

/**
 * Worst interference anywhere along the four rail lines.
 *
 * Sweeps a small band of X/Y offsets around each rail's spine rather than the
 * spine alone: the rail profile is 2.65mm wide and the features it clashes with
 * (a label shelf, a scoop's lip fill) are thin, so a single-column probe can
 * slip between them and report clean.
 */
/** Offsets from a rail's spine the sweep visits; shared with the paired form. */
const RAIL_PROBE_OFFSETS = [-0.6, -0.2, 0, 0.6, 1.4] as const;

export function worstRailInterference(bin: MeshData, lid: MeshData, dz: number): number {
  // Probe positions come from the LID's own bounds rather than a re-derivation
  // of its width: overhang both widens and shifts the lid, and an arithmetic
  // slip there would move every probe off the rails and quietly report clean.
  const bb = boundingBox(lid.vertices);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const spineX = (bb.maxX - bb.minX) / 2 - LID_CORNER_RADIUS;
  const spineY = (bb.maxY - bb.minY) / 2 - LID_CORNER_RADIUS;

  let worst = 0;
  for (const off of RAIL_PROBE_OFFSETS) {
    // Left and right rails: sweep along Y at the rail's X.
    for (let y = cy - spineY; y <= cy + spineY; y += 1) {
      for (const sx of [cx + spineX + off, cx - spineX - off]) {
        worst = Math.max(worst, interferenceAt(bin, lid, sx, y, dz));
      }
    }
    // Front and back rails: sweep along X at the rail's Y.
    for (let x = cx - spineX; x <= cx + spineX; x += 1) {
      for (const sy of [cy + spineY + off, cy - spineY - off]) {
        worst = Math.max(worst, interferenceAt(bin, lid, x, sy, dz));
      }
    }
  }
  return worst;
}

/**
 * Worst interference (mm) anywhere under the seated lid.
 *
 * Deliberately unaimed, unlike {@link worstRailInterference} and
 * {@link magnetSeatGap}: both of those probe a place someone already suspected,
 * and was 2.8mm of solid-on-solid overlap in a place nobody had — the
 * magnet pad's outboard half, where it welds into the wall under the skirt.
 * Aimed probes measured the magnet faces meeting perfectly while the lid could
 * not physically close.
 *
 * Sweeps the lid's own bounds (overhang shifts them) on a `step` grid. 1mm
 * cannot slip past a real clash: the narrowest feature either part has down
 * here is the 1.85mm mating wall, and anything it fouls spans a pad's whole
 * ~10mm reach. Span intersection, not outermost crossings — on a column
 * through the lip ring the bin's top face is legitimately above the lid's
 * lowest, since the cavity swallows the lip.
 */
export function worstSeatInterference(
  bin: MeshData,
  lid: MeshData,
  dz: number,
  step = 1
): { readonly mm: number; readonly x: number; readonly y: number } {
  const bb = boundingBox(lid.vertices);
  let worst = { mm: 0, x: 0, y: 0 };
  for (let x = bb.minX; x <= bb.maxX; x += step) {
    for (let y = bb.minY; y <= bb.maxY; y += step) {
      const mm = interferenceAt(bin, lid, x, y, dz);
      if (mm > worst.mm) worst = { mm, x, y };
    }
  }
  return worst;
}

/**
 * Millimetres of seated click rail with no bin lip above it to hook.
 *
 * The counterpart to {@link worstSeatInterference}, and the reason that probe
 * is not enough on its own: a wall cutout or a handle hole is an ABSENCE, so a
 * rail hanging over one collides with nothing, and every interference sweep
 * reports clean while the lid holds by that stretch not at all. This asks the
 * opposite question — wherever the lid has rail, does the bin still have lip?
 *
 * Both terms are read off the two meshes. The only number derived from params
 * is {@link binLipTopZ}, the seat plane every other probe in this file already
 * depends on, so a slip there fails those too rather than hiding here.
 *
 * Reads outermost crossings, never {@link verticalSolidSpans}, for the reason
 * {@link magnetSeatGap} does: the bin's coincident socket seam leaves an odd
 * crossing count, and pairing it into spans reports the cavity as solid. Both
 * questions here are about a single surface, so the parity-free read is also
 * the direct one.
 *
 * Two columns per sample, each chosen by measuring the real section:
 *
 *  - RAIL, {@link RAIL_PROBE_INBOARD} inside the lid's rail spine. The lid's
 *    lowest surface there is the rail's underside, ~7.5mm below the seat plane;
 *    with no rail on that wall the same column sees only the floor plate, ~1mm
 *    ABOVE it. {@link RAIL_PRESENT_BELOW} splits the two with 2mm to spare.
 *  - LIP, {@link LIP_PROBE_INBOARD} inside the bin's outer face. The lip's
 *    outer chamfer descends 1:1, so an intact rim's top surface lands exactly
 *    that far below the lip top, while a cutout — whose overshoot clears the
 *    lip entirely — drops the column to the cut floor or the cavity.
 */
const RAIL_PROBE_INBOARD = 0.35;
const RAIL_PRESENT_BELOW = 5.5;
const LIP_PROBE_INBOARD = 1;

/**
 * How far in from each end of a wall the sweep starts, measured from the lid's
 * outer face.
 *
 * Not tidiness: a PERPENDICULAR wall's rail occupies the band 1.9mm to 4.55mm
 * from the lid's outer face along this axis (`lidCornerR`, less
 * `LID_CLICK_RAIL_OUT` outward and plus `LID_CLICK_RAIL_INNER` inboard), and a
 * column landing in it reads that rail while checking THIS wall's lip. Sweeping
 * from 5.5mm clears it by ~1mm. The cost is the first 1.75mm of each rail's own
 * run, where `computeCutoutCenter` holds a cutout a `wallThickness` clear of
 * the corner anyway.
 */
const CORNER_SKIP = LID_CORNER_RADIUS + 1.5;

export function ungrippedRailMm(
  bin: MeshData,
  lid: MeshData,
  p: BinParams,
  dz: number,
  step = 1
): number {
  const lipTop = binLipTopZ(p);
  const lidBB = boundingBox(lid.vertices);
  const binBB = boundingBox(bin.vertices);
  const railInset = LID_CORNER_RADIUS - LID_FIT_CLEARANCE + RAIL_PROBE_INBOARD;

  const hasRail = (x: number, y: number): boolean => {
    const lowest = columnCrossings(lid, x, y).at(0);
    return lowest !== undefined && lowest + dz < lipTop - RAIL_PRESENT_BELOW;
  };
  const hasLip = (x: number, y: number): boolean => {
    const top = columnCrossings(bin, x, y).at(-1);
    // 0.2mm absorbs tessellation on the chamfer; the defect is whole
    // millimetres, since a cutout takes the rim down to its own floor.
    return top !== undefined && top >= lipTop - LIP_PROBE_INBOARD - 0.2;
  };

  let ungripped = 0;
  // Both parts move together under overhang, so a world along-axis coordinate
  // addresses the same place on each. The cross-axis lines come from each
  // part's OWN bounds, which is what keeps the two probes on their own feature.
  const sweep = (alongX: boolean, far: boolean): void => {
    const lo = alongX ? lidBB.minX : lidBB.minY;
    const hi = alongX ? lidBB.maxX : lidBB.maxY;
    const railCross = far
      ? (alongX ? lidBB.maxY : lidBB.maxX) - railInset
      : (alongX ? lidBB.minY : lidBB.minX) + railInset;
    const binCross = far
      ? (alongX ? binBB.maxY : binBB.maxX) - LIP_PROBE_INBOARD
      : (alongX ? binBB.minY : binBB.minX) + LIP_PROBE_INBOARD;
    for (let s = lo + CORNER_SKIP; s <= hi - CORNER_SKIP; s += step) {
      if (!hasRail(alongX ? s : railCross, alongX ? railCross : s)) continue;
      if (!hasLip(alongX ? s : binCross, alongX ? binCross : s)) ungripped += step;
    }
  };
  sweep(true, true);
  sweep(true, false);
  sweep(false, true);
  sweep(false, false);
  return ungripped;
}

/**
 * Narrowest gap (mm) between a bin magnet pad's top face and the seated lid
 * boss's magnet face, across every magnet. Negative means they interpenetrate,
 * so the pads prop the lid off its lip.
 *
 * This is the number the design is built around (`LID_MAGNET_SEAT_GAP`), and
 * measuring it on the two real meshes is the only check independent of the
 * seat-plane arithmetic — every helper on both sides derives from that one
 * expression, so a test written in terms of it can only prove self-consistency.
 *
 * Probes the solid ring between the pocket wall and the boss wall: on the magnet
 * axis BOTH parts are hollow, so a centre column measures pocket floors rather
 * than mating faces. The angles stay off the X/Y axes, which are full of
 * fan-triangulation edges. Reads the outermost crossings rather than paired
 * spans — the bin's coincident socket seam leaves an odd crossing count, which
 * pairs the pad's underside up as though it were the top face.
 */
export function magnetSeatGap(bin: MeshData, lid: MeshData, p: BinParams, dz: number): number {
  const { diameter, edgeMagnets } = p.lid.retentionMagnet;
  const bossR = retentionBossRadius(diameter);
  const positions = retentionMagnetPositions(
    p.width,
    p.depth,
    p.gridUnitMm,
    p.gridUnitMmY ?? p.gridUnitMm,
    retentionMagnetInset(diameter),
    edgeMagnets,
    bossR
  );
  const r = (diameter / 2 + bossR) / 2;
  let narrowest = Infinity;
  for (const { x, y } of positions) {
    for (const deg of [30, 120, 210, 300]) {
      const t = (deg * Math.PI) / 180;
      const px = x + r * Math.cos(t);
      const py = y + r * Math.sin(t);
      const padTop = columnCrossings(bin, px, py).at(-1);
      const bossBottom = columnCrossings(lid, px, py).at(0);
      if (padTop === undefined || bossBottom === undefined) {
        throw new Error(`no surface at magnet probe (${px.toFixed(2)}, ${py.toFixed(2)})`);
      }
      narrowest = Math.min(narrowest, bossBottom + dz - padTop);
    }
  }
  return narrowest;
}

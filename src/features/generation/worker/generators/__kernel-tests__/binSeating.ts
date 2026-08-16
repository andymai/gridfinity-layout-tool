/**
 * Drop a generated bin onto a generated baseplate and measure how far it sinks.
 *
 * The bin and the plate are separate solids, so nothing about either mesh says
 * the bin will not sit in it: both are watertight, both have plausible triangle
 * counts, and every bounding-box assertion passes while the feet rest on the
 * ridges between pockets (CLAUDE.md gotcha #15). Mating the two and probing
 * inside the assembly is the only way to see it.
 *
 * The measurement is deliberately free of any seat-plane arithmetic. The foot
 * profile, the pocket profile and the clearance between them are the very
 * things under test, so a probe written in terms of them could only prove
 * self-consistency. Instead the bin is lowered until it lands on
 * something, exactly as it would be in a drawer, and the answer is the depth it
 * reached.
 */

import { boundingBox, verticalSolidSpans } from './meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';

/**
 * Probe column spacing, in mm. The narrowest thing down here is a foot ~20mm
 * across, so this cannot slip past a clash. It does bound the precision of a
 * "rests on the ridge" reading: the ridge is a knife edge at the top face and
 * widens going down, so a column landing `s` mm off the boundary reads a
 * perch roughly `s` deeper than the true one. Half a step of slack is far
 * below the gap between seated (~5mm) and perched (~0.25mm).
 */
const DEFAULT_STEP = 2;

/** Overlap under this is meshing noise on coincident faces, not contact. */
const CONTACT_EPS = 0.02;

/** Bin offset from the plate centre, in mm. */
export interface Placement {
  readonly dx: number;
  readonly dy: number;
}

/**
 * How far the bin can descend at one column before its material meets the
 * plate's, starting from the bin's underside resting on the plate's top face.
 *
 * Span intersection, not outermost crossings: inside a pocket the plate is
 * legitimately absent while the bin is present, and a crossings-based read
 * would pair those up as one solid.
 */
export function descentLimitAt(
  bin: MeshData,
  plate: MeshData,
  x: number,
  y: number,
  place: Placement,
  dzTouching: number
): number {
  const plateSpans = verticalSolidSpans(plate, x, y);
  if (plateSpans.length === 0) return Infinity;
  const binSpans = verticalSolidSpans(bin, x - place.dx, y - place.dy);
  if (binSpans.length === 0) return Infinity;

  let limit = Infinity;
  for (const [a0, a1] of plateSpans) {
    for (const [rawB0, rawB1] of binSpans) {
      const b0 = rawB0 + dzTouching;
      const b1 = rawB1 + dzTouching;
      // Bin material already at or below this plate span: descending moves it
      // further away, so this pair never collides.
      if (b1 - a0 <= CONTACT_EPS) continue;
      limit = Math.min(limit, Math.max(0, b0 - a1));
    }
  }
  return limit;
}

/**
 * How far the bin's underside drops below the plate's top face before it lands,
 * in mm.
 *
 * A bin whose feet drop into their pockets reaches the full pocket depth. One
 * whose feet span a cell boundary stops on the ridge almost immediately and
 * sits visibly proud.
 *
 * Unaimed on purpose: a probe pointed at the feet someone already suspected is
 * how shipped. Sweeps the bin's whole footprint on a `step` grid and
 * takes the tightest column.
 */
export function seatDepth(
  bin: MeshData,
  plate: MeshData,
  place: Placement,
  step = DEFAULT_STEP
): { readonly mm: number; readonly x: number; readonly y: number } {
  const plateTop = boundingBox(plate.vertices).maxZ;
  const bb = boundingBox(bin.vertices);
  // Puts the bin's underside exactly on the plate's top face — the start of the
  // descent, and the only place the two meshes' own numbers are consulted.
  const dzTouching = plateTop - bb.minZ;

  let worst = { mm: Infinity, x: 0, y: 0 };
  for (let x = bb.minX + place.dx; x <= bb.maxX + place.dx; x += step) {
    for (let y = bb.minY + place.dy; y <= bb.maxY + place.dy; y += step) {
      const mm = descentLimitAt(bin, plate, x, y, place, dzTouching);
      if (mm < worst.mm) worst = { mm, x, y };
    }
  }
  return worst.mm === Infinity ? { mm: Infinity, x: 0, y: 0 } : worst;
}

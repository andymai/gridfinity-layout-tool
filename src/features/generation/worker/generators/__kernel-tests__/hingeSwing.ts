/**
 * Swing a generated hinged lid through its arc and measure what it hits.
 *
 * The motion analogue of `lidSeating`'s `worstSeatInterference`, and it exists
 * for a stronger version of the same reason. A seated pair can be checked at
 * one pose; a hinged pair is only correct if it is clear at EVERY pose, and a
 * swing failure is characteristically narrow — a shell corner clipping the lip
 * over three or four degrees and wide open everywhere else. Sampling a handful
 * of angles is the aimed-probe pattern that has already shipped two lids in
 * this repo that could not close (CLAUDE.md gotchas #15 and #18).
 *
 * ── WHY SOLIDS AND NOT A COLUMN PROBE ────────────────────────────────────
 *
 * `verticalSolidSpans` is the natural tool and it is the wrong one here, which
 * cost a full debugging round to learn. It pairs crossings by parity, and its
 * own docblock warns that an odd count — what a coincident or tangent face
 * leaves behind — pairs every interval above it into the VOID instead of the
 * solid, reading a lower surface as an upper one. A hinge is built from
 * cylinders fused into a flat wall, which is exactly the geometry that produces
 * such faces, so the probe reported metres of phantom material inside the
 * cavity while the real parts were fine.
 *
 * Intersecting the two SOLIDS and measuring the shared volume has no parity to
 * get wrong. Zero at every angle is a joint that moves; any real volume is
 * material in the way, wherever it is and whatever shape. Same reason
 * `travelInterferenceMm3` takes solids for the sliding plate.
 */

import { planHingeLid } from '@/shared/utils/hingeLidPlan';
import { binLipTopZ } from './lidSeating';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import type { Shape3D, ValidSolid } from 'brepjs';

/** The hinge axis in the bin's world frame. */
export interface SwingAxis {
  /** True when the axis runs along X — the front and back walls. */
  readonly alongX: boolean;
  /** The axis's position on the CROSS coordinate (y when `alongX`, else x). */
  readonly cross: number;
  readonly z: number;
  /** `+1` for back/right, `-1` for front/left. */
  readonly outboard: 1 | -1;
}

/**
 * Where the plan says the axis is, in world coordinates.
 *
 * `binLipTopZ` is `lidSeating`'s params-only restatement of the rim, so the
 * height arrives from a source independent of the plan's own anchor chain —
 * which is the half of this that most needs a second opinion (CLAUDE.md
 * gotcha #14 is entirely about that chain being restated wrongly).
 */
export function swingAxis(
  params: BinParams,
  innerOffsetX: number,
  innerOffsetY: number
): SwingAxis | null {
  const { geometry } = planHingeLid(params);
  if (!geometry) return null;
  const outboard: 1 | -1 = geometry.side === 'back' || geometry.side === 'right' ? 1 : -1;
  const offset = geometry.alongX ? innerOffsetY : innerOffsetX;
  return {
    alongX: geometry.alongX,
    cross: outboard * geometry.axisCrossMm + offset,
    z: binLipTopZ(params) + geometry.axisAboveLipTopMm,
    outboard,
  };
}

/**
 * Bin material (mm³) bridging one knuckle to the lip, the barrel itself excluded.
 *
 * The question no other probe here can answer. A knuckle that welded and a
 * knuckle hanging half a millimetre over the rim contain the SAME material,
 * bound the same box and displace the same volume; they differ only in whether
 * anything joins the two. This measures that joint and nothing else: a box over
 * one BIN band, from the axis out to the barrel's own outboard limit and from
 * inside the lip up to the axis, with the barrel cut back out of it.
 *
 * Read as a DELTA against the same bin with a friction lid, which cancels the
 * lip the zone unavoidably contains. Zero is six cylinders waiting to fall off
 * the plate — which is what this repo shipped, and what the export then deleted
 * outright, a stray shell being exactly what `keepOuterShell` exists to discard.
 *
 * Deliberately one BIN band and not the whole run: a LID band has no bin
 * knuckle over it, and measuring there would report the lip alone however badly
 * the joint was built.
 */
export async function knuckleRootMm3(binSolid: Shape3D, params: BinParams): Promise<number> {
  const { box, cut, cylinder, rotate, unwrap } = await import('brepjs');
  const { geometry } = planHingeLid(params);
  if (!geometry) throw new Error('expected hinge geometry');
  const band = geometry.runs[0].knuckles.find((k) => k.owner === 'bin');
  if (!band) throw new Error('expected a bin-owned knuckle');

  const r = geometry.barrelRadiusMm;
  const lipTop = binLipTopZ(params);
  const zLo = lipTop - geometry.rootDepthBelowLipTopMm;
  const zHi = lipTop + geometry.axisAboveLipTopMm;
  const len = band.hi - band.lo;
  // Built canonically — band along X, wall at +Y — and rotated onto the chosen
  // wall, which is the builder's own idiom and the reason it has no sign to get
  // backwards. Naming the world cross coordinate instead would mean restating
  // which way the band runs on each of the four walls: the four-quadrant trap
  // CLAUDE.md gotcha #12 documents.
  const zone = box(len, r, zHi - zLo, {
    at: [(band.lo + band.hi) / 2, geometry.axisCrossMm + r / 2, (zLo + zHi) / 2],
  });
  const barrel = cylinder(r, len, {
    at: [band.lo, geometry.axisCrossMm, zHi],
    axis: [1, 0, 0],
  });
  const canonical = unwrap(cut(zone, barrel));
  zone.delete();
  barrel.delete();
  const probe =
    geometry.rotationDeg === 0
      ? canonical
      : rotate(canonical, geometry.rotationDeg, { axis: [0, 0, 1] });
  if (probe !== canonical) canonical.delete();
  try {
    return await sharedVolume(binSolid, probe);
  } finally {
    probe.delete();
  }
}

/**
 * Pose the lid solid: seat it, then open it by `deg` about the axis.
 *
 * Done as translate-to-origin, rotate, translate-back rather than with a
 * centred rotation, so it needs nothing from the kernel beyond the two
 * primitives every other builder here uses.
 *
 * The sign is the part worth stating. Opening lifts the material INBOARD of
 * the axis, and which rotation does that flips with both the axis direction
 * and which side of the bin the wall is on — the four-quadrant trap CLAUDE.md
 * gotcha #12 documents. One expression covers all four, and the four-wall
 * test is what proves it.
 */
export async function poseLid(
  lidSolid: Shape3D,
  axis: SwingAxis,
  dz: number,
  deg: number
): Promise<Shape3D> {
  const { rotate, translate } = await import('brepjs');
  const crossOff = axis.alongX ? [0, -axis.cross] : [-axis.cross, 0];
  const toOrigin = translate(lidSolid, [crossOff[0], crossOff[1], dz - axis.z]);
  try {
    const angle = axis.alongX ? -axis.outboard * deg : axis.outboard * deg;
    const spun = rotate(toOrigin, angle, { axis: axis.alongX ? [1, 0, 0] : [0, 1, 0] });
    try {
      return translate(spun, [-crossOff[0], -crossOff[1], axis.z]);
    } finally {
      spun.delete();
    }
  } finally {
    toOrigin.delete();
  }
}

/** Shared volume (mm³) of two solids. Zero means they do not touch. */
async function sharedVolume(a: Shape3D, b: Shape3D): Promise<number> {
  const { intersect, mesh } = await import('brepjs');
  const { meshVolume } = await import('./meshAssertions');
  const result = intersect(a as ValidSolid, b as ValidSolid);
  // A boolean over coincident faces can legitimately produce nothing at all,
  // which is the answer this probe wants: no shared volume.
  if (!result.ok) return 0;
  const overlap = result.value;
  try {
    const m = mesh(overlap, { tolerance: 0.05, angularTolerance: 10 });
    return Math.abs(
      meshVolume({ vertices: m.vertices, indices: m.triangles } as unknown as MeshData)
    );
  } finally {
    overlap.delete();
  }
}

/**
 * Shared volume (mm³) of a lid seated shut on its bin.
 *
 * The solid-based counterpart to `worstSeatInterference`, and NOT a duplicate
 * of it. That probe walks columns and pairs crossings by parity, which its own
 * docblock warns breaks over a coincident or tangent face — and a hinge is
 * cylinders fused into a flat wall, the geometry that produces them. On a
 * hinged pair it reports millimetres of interference that the boolean says
 * flatly is not there. Use this one for anything with a barrel in it.
 */
export async function seatedOverlapMm3(
  binSolid: Shape3D,
  lidSolid: Shape3D,
  dz: number
): Promise<number> {
  const { translate } = await import('brepjs');
  const seated = translate(lidSolid, [0, 0, dz]);
  try {
    return await sharedVolume(binSolid, seated);
  } finally {
    seated.delete();
  }
}

/**
 * A solid's own volume (mm³).
 *
 * The measure for "was this feature actually built into the part", which is a
 * different question from "does it touch the other part" and needs a different
 * probe. A click rail — and so a hinged lid's detent, which is one — has
 * clearance from the lip at every height in the MODEL: the snap comes from
 * print tolerance and material flex. Every interference probe therefore reports
 * a lid with a catch and one without as identical, which is not a defect in the
 * geometry but a fact about what a boolean can see.
 */
export async function solidVolumeMm3(solid: Shape3D): Promise<number> {
  const { mesh } = await import('brepjs');
  const { meshVolume } = await import('./meshAssertions');
  const m = mesh(solid, { tolerance: 0.05, angularTolerance: 10 });
  return Math.abs(
    meshVolume({ vertices: m.vertices, indices: m.triangles } as unknown as MeshData)
  );
}

export interface SwingSample {
  readonly deg: number;
  readonly mm3: number;
}

/** Shared volume at every sampled angle, in order. */
export async function sweepSwing(
  binSolid: Shape3D,
  lidSolid: Shape3D,
  axis: SwingAxis,
  dz: number,
  degs: readonly number[]
): Promise<readonly SwingSample[]> {
  const out: SwingSample[] = [];
  for (const deg of degs) {
    const posed = await poseLid(lidSolid, axis, dz, deg);
    try {
      out.push({ deg, mm3: await sharedVolume(binSolid, posed) });
    } finally {
      posed.delete();
    }
  }
  return out;
}

/**
 * The first sampled angle whose shared volume exceeds `floorMm3`, or `null`.
 *
 * The floor absorbs the sliver a boolean leaves over near-coincident faces. For
 * scale, a millimetre of real overlap along one 110mm barrel is ~110mm³, so
 * the failures this exists to catch are orders of magnitude above it.
 */
export async function firstContactAngle(
  binSolid: Shape3D,
  lidSolid: Shape3D,
  axis: SwingAxis,
  dz: number,
  degs: readonly number[],
  floorMm3: number
): Promise<number | null> {
  for (const { deg, mm3 } of await sweepSwing(binSolid, lidSolid, axis, dz, degs)) {
    if (mm3 > floorMm3) return deg;
  }
  return null;
}

/**
 * Material (mm³) a pin of `pinRadius` would have to pass through.
 *
 * Builds the pin as a real cylinder on the axis and intersects it with both
 * parts, rather than probing down the bores. Two bores that are each round but
 * not concentric with each other leave the centreline clear, so a probe along
 * the axis line is exactly the "aimed at a place someone already suspected"
 * failure — this asks whether the whole pin fits, which is the question the
 * user asks with a piece of filament in their hand.
 *
 * Measured on the CLOSED assembly, the pose the hinge is assembled in.
 */
export async function pinObstructionMm3(
  binSolid: Shape3D,
  lidSolid: Shape3D,
  axis: SwingAxis,
  dz: number,
  pinRadius: number,
  runLo: number,
  runHi: number
): Promise<number> {
  const { cylinder } = await import('brepjs');
  const at: [number, number, number] = axis.alongX
    ? [runLo, axis.cross, axis.z]
    : [axis.cross, runLo, axis.z];
  const pin = cylinder(pinRadius, runHi - runLo, {
    at,
    axis: axis.alongX ? [1, 0, 0] : [0, 1, 0],
  });
  const posed = await poseLid(lidSolid, axis, dz, 0);
  try {
    return (await sharedVolume(binSolid, pin)) + (await sharedVolume(posed, pin));
  } finally {
    pin.delete();
    posed.delete();
  }
}

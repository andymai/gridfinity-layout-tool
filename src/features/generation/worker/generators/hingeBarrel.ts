/**
 * The hinge barrel: one cylinder, split into knuckles two parts share.
 *
 * Both halves of the joint are cut from the SAME modelled barrel rather than
 * built to the same numbers twice. That is the whole point of this module, and
 * it buys three properties that no amount of care with duplicated arithmetic
 * would:
 *
 *   - the bores are coaxial because there is only one axis;
 *   - the knuckles are exactly complementary because one part's knuckles are
 *     the other part's slots, from one list of bands;
 *   - the running clearance appears in exactly one place, as the amount each
 *     slot cutter is grown by.
 *
 * `@/shared/utils/hingeLidPlan` decides WHERE — the axis, the runs, the bands.
 * This module only turns that into solids, which is why the panel and the
 * preview can read the plan without importing brepjs.
 *
 * ── THE FRAME ────────────────────────────────────────────────────────────
 *
 * Everything is built CANONICALLY: the axis runs along X, the hinge wall is
 * the +Y one, and every section is drawn in YZ and extruded along X — the
 * idiom CLAUDE.md gotcha #12 recommends precisely because it has no origin to
 * get backwards. {@link HingeFrame.rotationDeg} maps that onto the wall the
 * user chose, once, at the end.
 *
 * The one number a caller supplies is its own outer-face position, because the
 * bin and the lid measure from different origins. Both then get the same axis,
 * since the plan states it as an inset from that face rather than as a
 * coordinate — and the two faces are flush anyway (the lid's per-side fit
 * clearance is exactly half the bin's tolerance).
 *
 * The bores are cut LAST, from the assembled part. Boring each knuckle before
 * fusing it leaves whatever the body already had lying across the hole — see
 * {@link BinHingeSolids}.
 */

import { clone, cutAll, cylinder, draw, fuse, rotate, translate, unwrap, withScope } from 'brepjs';
import type { DisposalScope, Shape3D, ValidSolid } from 'brepjs';
import { sketch } from './meshUtils';
import type { HingeGeometry, HingeRun } from '@/shared/utils/hingeLidPlan';

/**
 * Half-extent (mm) of the trim half-space's section. Only has to exceed the
 * largest lid this app can build; it is a cutter, so oversizing costs nothing.
 */
const TRIM_REACH_MM = 400;

/** Overlap (mm) that keeps a cutter's face off a coplanar face of its target. */
const COPLANAR_MARGIN = 0.01;

/** Where the barrel sits in one part's own frame. */
export interface HingeFrame {
  /** Distance from that part's centre to its outer face, across the wall. */
  readonly outerFaceCrossMm: number;
  /** Axis height. Bin builders pass world Z; the lid passes lid-local Z. */
  readonly axisZ: number;
  readonly rotationDeg: number;
}

/**
 * Cross coordinate of the axis: inset from this part's own outer face.
 *
 * The plan states the inset rather than the coordinate, which is what lets the
 * bin measure in its centred interior frame and the lid in its own without
 * either restating the other's origin — and what guarantees the two bores end
 * up on the same line.
 */
function axisCross(g: HingeGeometry, frame: HingeFrame): number {
  return frame.outerFaceCrossMm - g.axisInsetMm;
}

/**
 * A cylinder on the axis, spanning `[x0, x1]`.
 *
 * Every solid this module builds is one of these or a boolean of them, which
 * is what keeps the barrel's geometry a single statement.
 */
function onAxis(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  radius: number,
  x0: number,
  x1: number
): Shape3D {
  return scope.register(
    cylinder(radius, x1 - x0, { at: [x0, axisCross(g, frame), frame.axisZ], axis: [1, 0, 0] })
  );
}

/**
 * The pin bore: a teardrop, not a circle.
 *
 * The bore's axis is horizontal in the print, so the top of a round hole is an
 * unsupported arch — it sags, prints oval and undersized, and the pin then
 * needs a drill through it before the hinge will turn. A 45°-plus peak bridges
 * itself off the two walls below, so the hole leaves the bed the size it was
 * modelled. The peak lands in the barrel's top half where there is material to
 * spare, so it costs nothing structurally.
 *
 * The apex sits at `r·√2`, which puts each flank at 54.7° from horizontal —
 * comfortably inside the 45° an FDM printer will bridge without support, with
 * margin for a machine that is not perfectly tuned.
 */
function boreSolid(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  radius: number,
  x0: number,
  x1: number
): Shape3D {
  const cy = axisCross(g, frame);
  const cz = frame.axisZ;
  const round = onAxis(scope, g, frame, radius, x0, x1);
  const peak = draw([cy - radius, cz])
    .lineTo([cy + radius, cz])
    .lineTo([cy, cz + radius * Math.SQRT2])
    .close();
  const prism = scope.register(sketch(peak, 'YZ').extrude(x1 - x0));
  return scope.register(unwrap(fuse(round, scope.register(translate(prism, [x0, 0, 0])))));
}

/**
 * One knuckle, with its shut lines broken into a reveal.
 *
 * A stepped reveal rather than a 45° bevel, and deliberately: it is three
 * coaxial cylinders with no loft between dissimilar sections, so there is no
 * degenerate case to guard, and on a barrel it reads as a machined groove
 * rather than as a part that did not quite fit — which is the whole reason the
 * seam gets treated at all. The step also breaks the two edges that scuff
 * first and gives the nose's first layer somewhere to spread into.
 */
function knuckleSolid(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  lo: number,
  hi: number
): Shape3D {
  const c = Math.min(g.seamChamferMm, (hi - lo) / 4);
  const body = onAxis(scope, g, frame, g.barrelRadiusMm, lo + c, hi - c);
  const collar = onAxis(scope, g, frame, g.barrelRadiusMm - c, lo, hi);
  return scope.register(unwrap(fuse(body, collar)));
}

/**
 * The knuckle's root: the material that holds it on the bin.
 *
 * Load-bearing, not a fillet. The barrel touches the bin nowhere at all — see
 * {@link HingeGeometry.rootDepthBelowLipTopMm} — so a knuckle fused on without
 * this is a free-floating cylinder, and `keepOuterShell` deletes it from every
 * export as a stray shell.
 *
 * Each bound is a constraint rather than a taste. ABOVE, the trim plane where
 * it comes to rest: the one plane the lid never sweeps past, so no shape below
 * it can foul the swing, and the stop still lands at
 * {@link HingeGeometry.stopAngleDeg} because the root's top face IS that plane
 * rather than a second opinion about it. OUTBOARD, the barrel's own limit, so
 * the footprint does not grow. INBOARD, the axis — the only bound that needs no
 * opinion about the lip's profile.
 */
function knuckleRootSolid(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  lo: number,
  hi: number
): Shape3D {
  const cy = axisCross(g, frame);
  const cz = frame.axisZ;
  const outerY = cy + g.barrelRadiusMm;
  const footZ = cz - g.axisAboveLipTopMm - g.rootDepthBelowLipTopMm;
  const section = draw([cy, footZ])
    .lineTo([cy, cz])
    .lineTo([outerY, cz])
    .lineTo([outerY, footZ])
    .close();
  const prism = scope.register(sketch(section, 'YZ').extrude(hi - lo));
  const block = scope.register(translate(prism, [lo, 0, 0]));
  // `trimTiltDeg - stopAngleDeg + 180` is the trim plane's normal after the
  // full swing: the plan states the tilt at the CLOSED position, and the stop
  // angle is how far it turns before the lid meets the bin.
  const swept = halfSpaceThroughAxis(scope, g, frame, g.trimTiltDeg - g.stopAngleDeg + 180, lo, hi);
  return scope.register(unwrap(cutAll(block as ValidSolid, [swept] as ValidSolid[])));
}

/** Bands one part owns within a run. */
function bandsFor(run: HingeRun, owner: 'bin' | 'lid'): ReadonlyArray<readonly [number, number]> {
  return run.knuckles.filter((k) => k.owner === owner).map((k) => [k.lo, k.hi] as const);
}

/**
 * The volume the OTHER part's knuckles occupy, grown by the running clearance.
 *
 * Cut from a part before its own knuckles are fused on, this is what makes the
 * two interleave. Grown on the radius as well as along the axis: the barrel has
 * to turn inside whatever pocket it sits in, not just fit between its
 * neighbours.
 */
function slotCutters(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  run: HingeRun,
  owner: 'bin' | 'lid'
): Shape3D[] {
  return bandsFor(run, owner).map(([lo, hi]) =>
    onAxis(scope, g, frame, g.barrelRadiusMm + g.fitMm, lo - g.fitMm, hi + g.fitMm)
  );
}

/**
 * The pin's path down one run, as cutters.
 *
 * Cut from the ASSEMBLED part, after its knuckles are fused on — never out of
 * each knuckle beforehand. Boring a knuckle and then fusing it leaves whatever
 * the body already had lying across the bore: on the lid that is the floor
 * plate, which crosses the axis at exactly the height the pin needs, and the
 * pin then does not go in. The defect is invisible to every mesh statistic
 * (both parts stay watertight and the bore is plainly visible from the end)
 * and it took intersecting a modelled pin with the finished solids to see it.
 *
 * Two cutters, not one. The run's FIRST knuckle takes the undersized entry
 * bore so the pin press-fits there and cannot walk out; everything past it is a
 * running fit, and the far end is left open so a second offcut drives the pin
 * back out. That asymmetry is the whole retention scheme, and it only exists
 * because the bores are cut separately.
 */
function boresFor(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  run: HingeRun
): Shape3D[] {
  // A run always has at least LID_HINGE_MIN_KNUCKLES: the plan only emits one
  // when `layKnuckles` returned a layout, and a stretch too short for the
  // minimum is dropped rather than emitted empty.
  const first = run.knuckles[0];
  return [
    boreSolid(scope, g, frame, g.entryBoreMm / 2, run.lo - COPLANAR_MARGIN, first.hi),
    boreSolid(scope, g, frame, g.boreMm / 2, first.hi, run.hi + COPLANAR_MARGIN),
  ];
}

/**
 * The invariant, as one solid.
 *
 * Everything on the outboard side of a plane through the axis. Subtracting it
 * from the lid is the single cut that removes the mating shell on the hinge
 * wall, trims the rear ends of the two side shells, and rounds the nose — and
 * it keeps doing all three for any feature added to the lid later, without
 * that feature's author knowing the hinge exists.
 *
 * The plane is TILTED, and the tilt is aimed at the stop angle — though it does
 * not by itself arrest the lid; see the plan's note on why not.
 */
function trimHalfSpace(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  lo: number,
  hi: number
): Shape3D {
  // `trimTiltDeg`, never `stopAngleDeg - 90`. The trim face butts against the
  // bin's lip-top OUTER CORNER, which sits below the axis and so subtends
  // about -28°, not 0° — deriving the tilt from the stop alone stops the lid
  // ~28° early and leaves material outboard of the axis that swings straight
  // down into the rim. The plan owns that derivation; this only reads it.
  return halfSpaceThroughAxis(scope, g, frame, g.trimTiltDeg, lo, hi);
}

/**
 * Everything on one side of a plane through the axis, as a solid.
 *
 * `normalDeg` names the direction the removed half lies in, measured from
 * outboard toward up — so the surviving half is the 180° arc starting at
 * `normalDeg + 90`. Shared by the swing trim and by the stop lobe's trailing
 * face, which is what guarantees the lobe's leading edge and the trim are the
 * same plane rather than two derivations of it.
 */
function halfSpaceThroughAxis(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  normalDeg: number,
  lo: number,
  hi: number
): Shape3D {
  const cy = axisCross(g, frame);
  const cz = frame.axisZ;
  const tilt = (normalDeg * Math.PI) / 180;
  // Outboard normal of the trim plane, and the in-plane direction.
  const nY = Math.cos(tilt);
  const nZ = Math.sin(tilt);
  const tY = -nZ;
  const tZ = nY;
  const R = TRIM_REACH_MM;
  const corner = (a: number, b: number): [number, number] => [
    cy + a * tY + b * nY,
    cz + a * tZ + b * nZ,
  ];
  const section = draw(corner(-R, 0))
    .lineTo(corner(R, 0))
    .lineTo(corner(R, R))
    .lineTo(corner(-R, R))
    .close();
  const prism = scope.register(sketch(section, 'YZ').extrude(hi - lo + 2 * COPLANAR_MARGIN));
  return scope.register(translate(prism, [lo - COPLANAR_MARGIN, 0, 0]));
}

/** Apply the canonical→chosen-wall rotation, if there is one. */
function orient(scope: DisposalScope, shape: Shape3D, rotationDeg: number): Shape3D {
  if (rotationDeg === 0) return shape;
  return scope.register(rotate(shape, rotationDeg, { axis: [0, 0, 1] }));
}

/**
 * The stop lobe on one lid knuckle: the half-millimetre of reach that turns the
 * trim plane into a stop.
 *
 * A sector of a slightly larger cylinder, bounded on its LEADING side by the
 * trim plane itself and on its trailing side by a second plane through the same
 * axis. Using the trim plane for the leading face rather than a surface of its
 * own is the whole trick: the angle the lid comes to rest at is a property of
 * that one plane, so the lobe cannot stop the lid anywhere the trim does not.
 *
 * Built as a solid in its own right rather than left to the global trim to
 * shape, because the lid's knuckles are fused AFTER that cut — see
 * {@link applyLidHinge}.
 */
function stopLobeSolid(
  scope: DisposalScope,
  g: HingeGeometry,
  frame: HingeFrame,
  lo: number,
  hi: number
): Shape3D {
  const disc = onAxis(scope, g, frame, g.stopRadiusMm, lo, hi);
  const leading = halfSpaceThroughAxis(scope, g, frame, g.trimTiltDeg, lo, hi);
  const trailing = halfSpaceThroughAxis(
    scope,
    g,
    frame,
    g.trimTiltDeg + g.stopSectorDeg + 180,
    lo,
    hi
  );
  return scope.register(unwrap(cutAll(disc as ValidSolid, [leading, trailing] as ValidSolid[])));
}

/**
 * The bin's three phases, in the order they must be applied. The caller owns
 * every solid here.
 *
 * Three arrays rather than an additions/subtractions pair, because the order is
 * not a detail: the pockets have to be cut before the knuckles are fused, or
 * they eat the knuckles; and the bores have to be cut AFTER, or they run
 * through material that does not exist yet and leave the knuckles solid. A
 * two-phase shape cannot express that, and the version of this that had one
 * bored a hole through thin air and shipped a hinge no pin would enter.
 */
export interface BinHingeSolids {
  /** Pockets for the lid's knuckles. Cut FIRST. */
  readonly notches: readonly Shape3D[];
  /** The bin's own knuckles. Fused SECOND. */
  readonly additions: readonly Shape3D[];
  /** The pin's path. Cut LAST, through everything above. */
  readonly bores: readonly Shape3D[];
}

/**
 * The bin's share: knuckles to fuse on, and the pockets the lid's turn in.
 *
 * The pockets are cut ONLY at the lid's bands, never along the whole run. Cut
 * the run and the bin's own knuckles would be left touching the wall along a
 * tangent line — a ring of floating cylinders that is watertight, plausible in
 * every mesh statistic, and snaps off the first time the lid is lifted.
 */
export function buildBinHingeParts(g: HingeGeometry, frame: HingeFrame): BinHingeSolids {
  const notches: Shape3D[] = [];
  const additions: Shape3D[] = [];
  const bores: Shape3D[] = [];

  withScope((scope: DisposalScope) => {
    // Cloned out of the scope: it releases every intermediate when it closes,
    // and these have to outlive it.
    const put = (built: Shape3D, into: Shape3D[]): void => {
      into.push(unwrap(clone(orient(scope, built, frame.rotationDeg))));
    };

    for (const run of g.runs) {
      for (const cutter of slotCutters(scope, g, frame, run, 'lid')) put(cutter, notches);

      for (const [lo, hi] of bandsFor(run, 'bin')) {
        const knuckle = knuckleSolid(scope, g, frame, lo, hi);
        const root = knuckleRootSolid(scope, g, frame, lo, hi);
        put(scope.register(unwrap(fuse(knuckle as ValidSolid, root as ValidSolid))), additions);
      }
      for (const bore of boresFor(scope, g, frame, run)) put(bore, bores);
    }
    return null;
  });

  return { notches, additions, bores };
}

/**
 * The lid's share: the invariant trim, the bin's pockets, and its own knuckles.
 *
 * Order matters and is not interchangeable. The trim runs first because it is
 * what makes the nose; the bin's slots are cut from what survives; and the
 * lid's knuckles are fused LAST so they weld into the plate above the axis
 * rather than being trimmed off with everything else outboard of it.
 */
export function applyLidHinge(
  scope: DisposalScope,
  lid: Shape3D,
  g: HingeGeometry,
  frame: HingeFrame
): Shape3D {
  const cutters: Shape3D[] = [];
  const adds: Shape3D[] = [];
  const bores: Shape3D[] = [];

  for (const run of g.runs) {
    cutters.push(orient(scope, trimHalfSpace(scope, g, frame, run.lo, run.hi), frame.rotationDeg));
    for (const cutter of slotCutters(scope, g, frame, run, 'bin')) {
      cutters.push(orient(scope, cutter, frame.rotationDeg));
    }
    for (const [lo, hi] of bandsFor(run, 'lid')) {
      const knuckle = knuckleSolid(scope, g, frame, lo, hi);
      const lobe = stopLobeSolid(scope, g, frame, lo, hi);
      adds.push(
        orient(
          scope,
          scope.register(unwrap(fuse(knuckle as ValidSolid, lobe as ValidSolid))),
          frame.rotationDeg
        )
      );
    }
    bores.push(...boresFor(scope, g, frame, run).map((b) => orient(scope, b, frame.rotationDeg)));
  }

  // A run's trim only spans that run, so a wall segmented by a cutout keeps
  // its shell across the gap between runs — which is correct: there is no
  // barrel there to swing about, and the material is what the gap needs.
  //
  // The scope owns each body this REPLACES, never the one it returns: a
  // registered result would be freed the moment the scope closes, and the
  // caller would be handed a disposed handle. Same contract `addGripRelief`
  // and `addClickRails` keep.
  let out = lid;
  if (cutters.length > 0) {
    scope.register(out);
    out = unwrap(cutAll(out as ValidSolid, cutters as ValidSolid[]));
  }
  for (const add of adds) {
    scope.register(out);
    out = unwrap(fuse(out as ValidSolid, add as ValidSolid));
  }
  if (bores.length > 0) {
    scope.register(out);
    out = unwrap(cutAll(out as ValidSolid, bores as ValidSolid[]));
  }
  return out;
}

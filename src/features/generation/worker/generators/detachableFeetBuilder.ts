/**
 * Detachable feet: the parts that press onto a flat-bottomed bin.
 *
 * Each foot is a SECTION of the full-size socket profile, never a scaled copy
 * of it. The profile's insets are absolute (2.15mm / 2.95mm), so a foot built
 * from a smaller profile has the wrong taper everywhere and perches on the
 * pocket instead of dropping into it — the same trap the underside relief
 * sidesteps by scaling a copy rather than cutting a prism, arrived at from the
 * other direction. Here the cure is to build the whole foot and intersect away
 * what is not wanted, so every surviving outer face is bit-identical to an
 * integral foot's.
 *
 * Where the feet go is not decided here: `detachableFeetPlan` owns that, and
 * the pin holes this module cuts into the bin floor come from the same
 * placement call, so a foot and its holes cannot disagree.
 *
 * Coordinate system matches the socket: Z=0 is the foot's top (the face the bin
 * floor sits on), Z=-SOCKET_HEIGHT its underside. Pins rise into positive Z.
 */

import {
  drawCircle,
  drawRectangle,
  unwrap,
  fuse,
  fuseAll,
  cut,
  cutAll,
  intersect,
  clone,
  translate,
  cylinder,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, Sketch, DisposalScope } from 'brepjs';
import { CLEARANCE, SOCKET_HEIGHT, COPLANAR_MARGIN, COPLANAR_OVERLAP } from './generatorConstants';
import {
  buildSingleCellSocket,
  buildSimplifiedCellSocket,
  buildSocketRimReliefTool,
} from './socketBuilder';
import {
  footCellCentre,
  footPinPositions,
  type FootPlacement,
} from '@/shared/utils/detachableFeetPlan';
import { DETACHABLE_PIN_LEAD_IN_MM, detachablePinEngagementMm } from '@/shared/types/bin';

/** How far a clip box overshoots the cell it trims, so no face is coplanar. */
const CLIP_MARGIN = 2;

/**
 * How far the mating face is set back from the foot's widest point, in mm.
 *
 * A foot prints bottom-down, so the last thing off the nozzle is a rim that has
 * just finished a 2.15mm run of 45-degree overhang. Those top layers cool
 * unsupported on their outboard side and curl up — and that rim is the surface
 * the bin sits on, so a foot with a lifted edge rocks instead of seating flat.
 *
 * The relief does not stop the curl. It moves the mating plane inboard of the
 * edge that curls, so whatever that edge does happens below the surface that
 * has to be flat. Taken out of the profile's top vertical step, which ends
 * 0.25mm down, so the widest section and every baseplate-facing face are
 * untouched. Sized to clear the two or three layers that lift; larger would
 * eat the contact patch for no more benefit.
 */
export const MATING_RIM_RELIEF_MM = 0.5;

export interface DetachableFeetOptions {
  readonly placements: readonly FootPlacement[];
  /** Foot arm reach, from `footArmMm` — the same value the plan was given. */
  readonly armMm: number;
  /** Press-fit pin diameter (the hole is wider; see `pinHoleDiameterMm`). */
  readonly pinDiameterMm: number;
  readonly pinHoleDiameterMm: number;
  /**
   * Bin floor thickness. The pin reaches {@link detachablePinEngagementMm} into
   * it and no further, so the hole is blind and the interior surface is never
   * broken.
   */
  readonly floorThicknessMm: number;
  /**
   * Screw through-holes, or `undefined` for plain feet. Drilled through the
   * foot AND the bin floor above it, so the screw clamps the two together.
   */
  readonly screw?: {
    readonly diameterMm: number;
    readonly positions: ReadonlyArray<readonly [number, number]>;
  };
  /** Magnet pocket, or `undefined` for plain feet. */
  readonly magnet?: {
    readonly diameterMm: number;
    readonly depthMm: number;
    /** Corner positions in bin-centred mm, from the shared magnet placement. */
    readonly positions: ReadonlyArray<readonly [number, number]>;
  };
  /** Full 5-section profile for export; simplified for preview. */
  readonly forExport: boolean;
}

export interface DetachableFeetGeometry {
  /** One solid per foot, positioned as assembled under the bin. */
  readonly feet: Shape3D[];
  /**
   * Tool opening every pin hole in the UNDERSIDE of the bin floor. The caller
   * cuts it from the body and deletes it; it is deliberately not pre-applied,
   * because the body is cached and the holes are not part of what the cache key
   * describes.
   *
   * `null` when there is nothing to cut: a floor with no room under the
   * membrane gets pinless feet, and a plain base has no screw bores either.
   */
  readonly pinHoles: Shape3D | null;
}

/**
 * The standard corner positions a given foot's footprint actually contains.
 *
 * One under an `L`, two under a `bar`. Shared by the magnet pocket and the
 * screw bore so the two can never disagree about which corners a foot owns.
 */
function coveredCorners(
  positions: ReadonlyArray<readonly [number, number]>,
  p: FootPlacement,
  centre: { x: number; y: number },
  armMm: number
): Array<readonly [number, number]> {
  // Bounds mirror `buildClip`'s footprint per axis, not the cell's: a CENTRED
  // interior filler is only `armMm` wide across its spanned axis, so testing
  // against the CELL would claim all four corners and drill attachment bores
  // through the floor where no foot stands beneath them. The narrow bound
  // applies to the centred fall-through cases ONLY, in `buildClip`'s own
  // order — an edge bar that happens to sit on an interior station of the
  // other axis still spans its full cell there and keeps its corners.
  const centred = p.dirX === 0 && p.dirY === 0;
  const halfX = centred && p.interiorX ? armMm / 2 : p.cellW / 2;
  const halfY = centred && !p.interiorX && p.interiorY ? armMm / 2 : p.cellD / 2;
  return positions.filter(([mx, my]) => {
    const inX = p.dirX === 0 || Math.sign(mx - centre.x) === p.dirX;
    const inY = p.dirY === 0 || Math.sign(my - centre.y) === p.dirY;
    return inX && inY && Math.abs(mx - centre.x) <= halfX && Math.abs(my - centre.y) <= halfY;
  });
}

/**
 * A pin: a plain cylinder at the stated diameter, under a tapered tip.
 *
 * Deliberately featureless. Compliance ridges are the obvious way to tighten a
 * press fit, and at this scale they do not survive slicing: a 0.2mm crest and
 * its valley fall inside one 0.6mm extrusion, so the slicer resolves the shaft
 * as a single thin loop somewhere between the two and the pin prints at 2.0mm
 * against a 2.8mm model. A fit sized off a diameter the printer never produces
 * is a loose one; a cylinder is a diameter it can hold to.
 *
 * {@link DETACHABLE_PIN_DIAMETERS_MM} names the pin's widest point, and with a
 * cylinder that is its only point.
 */
function buildPin(scope: DisposalScope, diameterMm: number, heightMm: number): Shape3D {
  const r = diameterMm / 2;
  const lead = Math.min(DETACHABLE_PIN_LEAD_IN_MM, heightMm / 3);

  // Too short for a lead-in worth lofting: a bare cylinder.
  if (lead < 0.05) {
    return scope.register(
      translate(scope.register(cylinder(r, heightMm + COPLANAR_OVERLAP)), [0, 0, -COPLANAR_OVERLAP])
    );
  }

  const section = (radius: number, z: number): Sketch =>
    drawCircle(radius).sketchOnPlane('XY', z) as Sketch;

  // The pin dips COPLANAR_OVERLAP below the foot's top face so the fuse is a
  // volumetric overlap rather than two coincident planes. Without it OCCT
  // leaves non-manifold junctions all round every pin — the solid stays closed,
  // so only an edge-manifold check sees it, and a slicer would quietly repair
  // it into something else.
  const sections: Array<[number, number]> = [
    [-COPLANAR_OVERLAP, r],
    [heightMm - lead, r],
    [heightMm, r - lead],
  ];

  const start = section(sections[0][1], sections[0][0]);
  try {
    return scope.register(
      start.loftWith(
        sections.slice(1).map(([z, radius]) => section(radius, z)),
        { ruled: true }
      )
    );
  } finally {
    start.delete();
  }
}

/**
 * The region of a cell a foot occupies, as a solid to intersect the foot with.
 *
 * Exactly ONE constraint is applied, and which one follows from the placement:
 *
 *  - both axes at an edge — an `L`, the union of the two edge strips. The union
 *    rather than their intersection (a corner square) is the whole point: the
 *    arms reach along both edges and give the foot a moment arm.
 *  - one axis at an edge — a bar running that cell's full width at that edge.
 *    A mid-run station behaves exactly like a spanning one here: its cell is a
 *    whole cell, and spanning it is what engages the pocket.
 *  - neither axis at an edge — reachable only on a single-cell axis with a
 *    mid-run station on the other, where the foot is a bar of arm width centred
 *    on its cell. Constraining BOTH axes here would leave a 42mm square, i.e.
 *    an entire foot, for a support that only has to bridge a run.
 *
 * Each strip overshoots on the axis it does not bound, so no face of the clip
 * is ever coplanar with a face of the foot.
 */
function buildClip(scope: DisposalScope, p: FootPlacement, armMm: number): Shape3D {
  const zFrom = -SOCKET_HEIGHT - COPLANAR_MARGIN;
  const zHeight = SOCKET_HEIGHT + 2 * COPLANAR_MARGIN;
  const slab = (w: number, d: number, cx: number, cy: number): Shape3D =>
    scope.register(
      translate(
        scope.register((drawRectangle(w, d).sketchOnPlane('XY', zFrom) as Sketch).extrude(zHeight)),
        [cx, cy, 0]
      )
    );

  const hw = p.cellW / 2;
  const hd = p.cellD / 2;
  const edgeX = (): Shape3D => slab(armMm, p.cellD + CLIP_MARGIN, p.dirX * (hw - armMm / 2), 0);
  const edgeY = (): Shape3D => slab(p.cellW + CLIP_MARGIN, armMm, 0, p.dirY * (hd - armMm / 2));

  if (p.dirX !== 0 && p.dirY !== 0) return scope.register(unwrap(fuse(edgeX(), edgeY())));
  if (p.dirX !== 0) return edgeX();
  if (p.dirY !== 0) return edgeY();
  if (p.interiorX) return slab(armMm, p.cellD + CLIP_MARGIN, 0, 0);
  if (p.interiorY) return slab(p.cellW + CLIP_MARGIN, armMm, 0, 0);
  throw new Error('Detachable feet: a placement that spans both axes has no clip');
}

/**
 * Build every foot, plus the tool that pin-holes the bin floor for them.
 *
 * Feet are returned positioned as assembled (sitting under the bin) rather than
 * laid out for printing: that is what the preview and the seating check need,
 * and arranging a print plate is the export layer's job, not the geometry's.
 */
export function buildDetachableFeet(opts: DetachableFeetOptions): DetachableFeetGeometry {
  const { placements, armMm, pinDiameterMm, pinHoleDiameterMm, floorThicknessMm } = opts;
  if (placements.length === 0) {
    throw new Error('Detachable feet: at least one placement required');
  }

  return withScope((scope: DisposalScope): DetachableFeetGeometry => {
    // Never refused, and the MEMBRANE is what holds: engagement is whatever the
    // floor has left over after it, floored at zero. A clamp that reached for a
    // minimum engagement instead would eat into the membrane on a thin floor —
    // opening the interior the blind holes exist to protect — and go negative
    // on a crafted `wallThickness` below the membrane itself.
    //
    // Refusing is not an option either: a throw would have to be mirrored by
    // every caller that asks "does this bin have feet" (the panel, the
    // estimate, two export planners, the preview), and five predicates that
    // must agree is four chances to drift. `detachableFeetFitFloor` greys the
    // toggle; the geometry always builds something valid.
    const engagementMm = Math.max(0, detachablePinEngagementMm(floorThicknessMm));
    const pinTemplate = buildPin(scope, pinDiameterMm, engagementMm);
    const feet: Shape3D[] = [];
    const holes: Shape3D[] = [];

    for (const p of placements) {
      const centre = footCellCentre(p);
      const cellW = p.cellW - CLEARANCE;
      const cellD = p.cellD - CLEARANCE;

      const profile = scope.register(
        opts.forExport
          ? buildSingleCellSocket(cellW, cellD)
          : buildSimplifiedCellSocket(cellW, cellD)
      );
      const rimTool = scope.register(buildSocketRimReliefTool(cellW, cellD, MATING_RIM_RELIEF_MM));
      const full = scope.register(unwrap(intersect(profile, rimTool)));
      // The clip is expressed about the cell centre, so trim before moving the
      // foot into place rather than translating the clip to meet it.
      const clip = buildClip(scope, p, armMm);
      let foot: Shape3D = unwrap(intersect(full, clip));

      // Folded one at a time, NOT through fuseAll. Given a target and several
      // overlapping tools, fuseAll here returns a compound of the inputs rather
      // than one unified solid — 2250 non-manifold edges on a three-pin foot,
      // with `optimisation: 'commonFace'` making no difference. The shell stays
      // closed either way, so only an edge-manifold check catches it, and a
      // slicer would silently reinterpret the result.
      // A floor with nothing left under the membrane gets no pins at all: the
      // feet locate on their own footprint and are glued. Degenerate pin
      // geometry would be the alternative, and a hole would breach the floor.
      const pins = engagementMm > 0 ? footPinPositions(p, armMm, pinDiameterMm) : [];
      for (const pin of pins) {
        const solid = scope.register(
          translate(scope.register(unwrap(clone(pinTemplate))), [
            pin.x - centre.x,
            pin.y - centre.y,
            0,
          ])
        );
        const pinned = unwrap(fuse(foot, solid));
        if (pinned !== foot) foot.delete();
        foot = pinned;
      }

      // Magnet pockets at every standard corner position this foot covers: one
      // under an L, two under a bar. That is corner-only magnets by
      // construction — four on a rectangular bin against four per cell today.
      const magnet = opts.magnet;
      if (magnet) {
        const covered = coveredCorners(magnet.positions, p, centre, armMm);
        // Open at the underside, exactly as an integral foot drills it: the
        // magnet is inserted from below, so a retaining floor under it would
        // seal it out rather than in.
        const drills = covered.map(([mx, my]) =>
          scope.register(
            translate(scope.register(cylinder(magnet.diameterMm / 2, magnet.depthMm)), [
              mx - centre.x,
              my - centre.y,
              -SOCKET_HEIGHT,
            ])
          )
        );
        if (drills.length > 0) {
          const drilled = unwrap(cutAll(foot, drills));
          if (drilled !== foot) foot.delete();
          foot = drilled;
        }
      }

      // Screws go clean through: foot, then floor. Drilled after the magnet
      // pocket so a magnet_and_screw base gets the screw bore inside the
      // pocket, exactly as an integral foot does.
      const screw = opts.screw;
      if (screw) {
        const bores = coveredCorners(screw.positions, p, centre, armMm).map(([mx, my]) =>
          scope.register(
            translate(
              scope.register(
                cylinder(
                  screw.diameterMm / 2,
                  SOCKET_HEIGHT + floorThicknessMm + 2 * COPLANAR_MARGIN
                )
              ),
              [mx - centre.x, my - centre.y, -SOCKET_HEIGHT - COPLANAR_MARGIN]
            )
          )
        );
        if (bores.length > 0) {
          const bored = unwrap(cutAll(foot, bores));
          if (bored !== foot) foot.delete();
          foot = bored;
        }
        for (const [mx, my] of coveredCorners(screw.positions, p, centre, armMm)) {
          holes.push(
            translate(
              scope.register(
                cylinder(screw.diameterMm / 2, floorThicknessMm + 2 * COPLANAR_MARGIN)
              ),
              [mx, my, -COPLANAR_MARGIN]
            )
          );
        }
      }

      // `translate` returns a NEW shape, so the un-positioned intermediate is
      // ours to free — it is not scope-registered (the chain of booleans above
      // hands ownership along by hand) and would otherwise leak per foot.
      const placed = translate(foot, [centre.x, centre.y, 0]);
      if (placed !== foot) foot.delete();
      feet.push(placed);

      // Blind from the underside: the cutter starts below the floor and stops at
      // the engagement depth, leaving the membrane that keeps the interior floor
      // — where the scoop ramp, dividers and floor pattern live — unbroken.
      for (const pin of pins) {
        holes.push(
          translate(
            scope.register(cylinder(pinHoleDiameterMm / 2, engagementMm + COPLANAR_MARGIN)),
            [pin.x, pin.y, -COPLANAR_MARGIN]
          )
        );
      }
    }

    const pinHoles =
      holes.length > 0
        ? unwrap(fuseAll(holes as ValidSolid[], { optimisation: 'commonFace' }))
        : null;
    for (const h of holes) if (h !== pinHoles) h.delete();

    // feet + pinHoles are NOT scope-registered: they outlive the scope.
    return { feet, pinHoles };
  });
}

/** Cut the pin holes from a bin body, disposing the tool. */
export function applyPinHoles(body: Shape3D, pinHoles: Shape3D | null): Shape3D {
  if (!pinHoles) return body;
  try {
    const holed = unwrap(cut(body, pinHoles));
    if (holed !== body) body.delete();
    return holed;
  } finally {
    pinHoles.delete();
  }
}

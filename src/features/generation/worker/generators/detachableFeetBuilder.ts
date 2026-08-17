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
 * the pin holes this module cuts through the bin floor come from the same
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
import { buildSingleCellSocket, buildSimplifiedCellSocket } from './socketBuilder';
import { footPinPositions, type FootPlacement } from '@/shared/utils/detachableFeetPlan';
import { DETACHABLE_PIN_RIDGE_STEP_MM } from '@/shared/types/bin';

/** How far a clip box overshoots the cell it trims, so no face is coplanar. */
const CLIP_MARGIN = 2;

export interface DetachableFeetOptions {
  readonly placements: readonly FootPlacement[];
  /** Foot arm reach, from `footArmMm` — the same value the plan was given. */
  readonly armMm: number;
  /** Press-fit pin diameter (the hole is wider; see `pinHoleDiameterMm`). */
  readonly pinDiameterMm: number;
  readonly pinHoleDiameterMm: number;
  /**
   * Bin floor thickness. The pin is exactly this tall, so it plugs the hole it
   * passes through and stops flush: nothing protrudes into the bin whatever the
   * wall thickness, and nothing can fall through the hole either.
   */
  readonly floorThicknessMm: number;
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
   * Tool punching every pin hole through the bin floor. The caller cuts it from
   * the body and deletes it; it is deliberately not pre-applied, because the
   * body is cached and the holes are not part of what the cache key describes.
   */
  readonly pinHoles: Shape3D;
}

/** Cell centre for a placement — the anchor backed off by its outward offsets. */
function cellCentreOf(p: FootPlacement): { x: number; y: number } {
  return { x: p.x - (p.dirX * p.cellW) / 2, y: p.y - (p.dirY * p.cellD) / 2 };
}

/**
 * A pin, as a stack of alternating radii.
 *
 * The diameter steps up and back down every layer so the pin ratchets home and
 * stays without glue. Sections land every half-ridge, which is what puts a
 * ridge crest in the middle of each printed layer rather than on the boundary
 * between two.
 */
function buildPin(scope: DisposalScope, diameterMm: number, heightMm: number): Shape3D {
  const r = diameterMm / 2;
  const crest = r + DETACHABLE_PIN_RIDGE_STEP_MM / 2;
  const step = DETACHABLE_PIN_RIDGE_STEP_MM / 2;
  const section = (radius: number, z: number): Sketch =>
    drawCircle(radius).sketchOnPlane('XY', z) as Sketch;

  // The pin dips COPLANAR_OVERLAP below the foot's top face so the fuse is a
  // volumetric overlap rather than two coincident planes. Without it OCCT
  // leaves non-manifold junctions all round every pin — the solid stays closed,
  // so only an edge-manifold check sees it, and a slicer would quietly repair
  // it into something else.
  const sections: Array<[number, number]> = [
    [-COPLANAR_OVERLAP, r],
    [0, r],
  ];
  let ridge = 0;
  for (let z = step; z < heightMm - 1e-6; z += step) {
    sections.push([z, ridge % 2 === 0 ? crest : r]);
    ridge++;
  }
  sections.push([heightMm, r]);

  // Too short to carry a ridge: a plain cylinder rather than a degenerate loft.
  if (sections.length < 4) {
    return translate(scope.register(cylinder(r, heightMm + COPLANAR_OVERLAP)), [
      0,
      0,
      -COPLANAR_OVERLAP,
    ]);
  }

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
 * An `L` is the union of two slabs along its two outer faces; a `bar` is the
 * single slab along the one edge it sits against, running the cell's full
 * extent. Each slab overshoots on the axis it does not bound, so no face of the
 * clip is ever coplanar with a face of the foot.
 */
function buildClip(scope: DisposalScope, p: FootPlacement, armMm: number): Shape3D {
  const zFrom = -SOCKET_HEIGHT - COPLANAR_MARGIN;
  const zHeight = SOCKET_HEIGHT + 2 * COPLANAR_MARGIN;
  const slab = (w: number, d: number, cx: number, cy: number): Shape3D =>
    scope.register(
      translate((drawRectangle(w, d).sketchOnPlane('XY', zFrom) as Sketch).extrude(zHeight), [
        cx,
        cy,
        0,
      ])
    );

  const hw = p.cellW / 2;
  const hd = p.cellD / 2;
  const alongX =
    p.dirX === 0 ? null : slab(armMm, p.cellD + CLIP_MARGIN, p.dirX * (hw - armMm / 2), 0);
  const alongY =
    p.dirY === 0 ? null : slab(p.cellW + CLIP_MARGIN, armMm, 0, p.dirY * (hd - armMm / 2));

  if (alongX && alongY) return unwrap(fuse(alongX, alongY));
  return (alongX ?? alongY) as Shape3D;
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
    const pinTemplate = buildPin(scope, pinDiameterMm, floorThicknessMm);
    const feet: Shape3D[] = [];
    const holes: Shape3D[] = [];

    for (const p of placements) {
      const centre = cellCentreOf(p);
      const cellW = p.cellW - CLEARANCE;
      const cellD = p.cellD - CLEARANCE;

      const full = scope.register(
        opts.forExport
          ? buildSingleCellSocket(cellW, cellD)
          : buildSimplifiedCellSocket(cellW, cellD)
      );
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
      const pins = footPinPositions(p, armMm, pinDiameterMm);
      for (const pin of pins) {
        const solid = translate(scope.register(unwrap(clone(pinTemplate))), [
          pin.x - centre.x,
          pin.y - centre.y,
          0,
        ]);
        const pinned = unwrap(fuse(foot, solid));
        if (pinned !== foot) foot.delete();
        foot = pinned;
      }

      // Magnet pockets at every standard corner position this foot covers: one
      // under an L, two under a bar. That is corner-only magnets by
      // construction — four on a rectangular bin against four per cell today.
      const magnet = opts.magnet;
      if (magnet) {
        const covered = magnet.positions.filter(([mx, my]) => {
          const dx = Math.abs(mx - centre.x);
          const dy = Math.abs(my - centre.y);
          const inX = p.dirX === 0 || Math.sign(mx - centre.x) === p.dirX;
          const inY = p.dirY === 0 || Math.sign(my - centre.y) === p.dirY;
          return inX && inY && dx <= p.cellW / 2 && dy <= p.cellD / 2;
        });
        // Open at the underside, exactly as an integral foot drills it: the
        // magnet is inserted from below, so a retaining floor under it would
        // seal it out rather than in.
        const drills = covered.map(([mx, my]) =>
          translate(scope.register(cylinder(magnet.diameterMm / 2, magnet.depthMm)), [
            mx - centre.x,
            my - centre.y,
            -SOCKET_HEIGHT,
          ])
        );
        if (drills.length > 0) {
          const drilled = unwrap(cutAll(foot, drills));
          if (drilled !== foot) foot.delete();
          foot = drilled;
        }
      }

      feet.push(translate(foot, [centre.x, centre.y, 0]));

      for (const pin of pins) {
        holes.push(
          translate(
            scope.register(cylinder(pinHoleDiameterMm / 2, floorThicknessMm + 2 * COPLANAR_MARGIN)),
            [pin.x, pin.y, -COPLANAR_MARGIN]
          )
        );
      }
    }

    const pinHoles = unwrap(fuseAll(holes as ValidSolid[], { optimisation: 'commonFace' }));
    for (const h of holes) if (h !== pinHoles) h.delete();

    // feet + pinHoles are NOT scope-registered: they outlive the scope.
    return { feet, pinHoles };
  });
}

/** Cut the pin holes from a bin body, disposing the tool. */
export function applyPinHoles(body: Shape3D, pinHoles: Shape3D): Shape3D {
  try {
    const holed = unwrap(cut(body, pinHoles));
    if (holed !== body) body.delete();
    return holed;
  } finally {
    pinHoles.delete();
  }
}

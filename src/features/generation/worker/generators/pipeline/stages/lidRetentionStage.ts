/**
 * Lid-retention stage — bin-side magnet gusset pads.
 *
 * When the design's lid uses magnetic retention, each corner of the bin grows a
 * gusset pad: a solid that anchors to the two interior corner walls near the top
 * and cantilevers inward to house a vertical magnet pocket opening UPWARD. The
 * mating lid boss hangs down to meet it — the pad top sits one
 * `LID_MAGNET_SEAT_GAP` below the lid boss's bottom face when the lid is seated,
 * so the two magnets mate across a thin gap.
 *
 * The pad prints support-free: its underside is a single 45°
 * plane rising along the corner diagonal, from the wall corner up to the pad
 * bottom at the tip. Each layer overhangs the one below by at most the layer
 * height, so the slicer never asks for supports inside the bin. On bins too
 * short for the full taper it clamps to the interior floor and welds in. The
 * pad's inward-pointing corner is rounded at the boss radius (a tongue wrapping
 * the pocket) so contents can't snag on it; the outward one follows the cavity
 * wall's own corner arc so it can't punch through the outer shell, and
 * the two between them stay square because they sit buried inside the walls.
 *
 * The mating plane sits BELOW the lid's mating skirt, not at the rim. The pad
 * welds into the walls, so it spans the same band the skirt drops through — a
 * pad top anywhere above the skirt's bottom props the lid open on its own
 * corners no matter how well the magnets line up. `retentionSeatPlanes`
 * owns that bound; this stage only reads it. The physical bin needs the pads
 * whether or not the lid is exported in the same action, so this keys off
 * `usesMagneticLid` (not on the lid being emitted).
 *
 * Runs AFTER translate so the solid is in final world Z (`dimensions.lipTopZ`);
 * XY comes from the shared `retentionMagnetPositions` so the pads line up with
 * the lid's bosses.
 */

import { cylinder, draw, rotate, translate, unwrap, fuse, cut, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import { shouldGenerateLid } from '@/shared/types/bin';
import { checkCancelled } from '../../utils/abort';
import { BOX_CORNER_RADIUS } from '../../generatorConstants';
import {
  LID_COPLANAR_MARGIN,
  LID_MAGNET_POST_FLOOR,
  LID_MIN_CORNER_RADIUS,
} from '../../lidConstants';
import {
  retentionBossRadius,
  retentionMagnetInset,
  retentionMagnetPositions,
  retentionSeatPlanes,
  usesRetentionMagnets,
  retentionMagnetPlacementsFor,
  retentionMagnetSide,
} from '../../retentionMagnetGeometry';
import { hasOverhang, overhangExpansion } from '../../overhang';

/** Volumetric overlap (mm) of the gusset into the interior walls, so the fuse
 *  weld is solid rather than a boolean-hostile coplanar face. */
const GUSSET_WALL_OVERLAP = 0.4;

export const lidRetentionStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.82,

  shouldRun(ctx: PipelineContext): boolean {
    // `usesRetentionMagnets` gates on the structural config (magnetic lid OR a
    // hinged lid's magnet catch, plus lip + rectangular);
    // rectangular); `shouldGenerateLid` additionally rejects blocking
    // compatibility issues (e.g. `magnetTooDeepForBin`). Both are required so a
    // blocked lid — which is never generated/exported — doesn't leave the bin
    // with orphan pads, or cut a too-deep pocket through the floor.
    return ctx.solid !== null && usesRetentionMagnets(ctx.params) && shouldGenerateLid(ctx.params);
  },

  execute(ctx: PipelineContext): PipelineContext {
    if (!ctx.solid) return ctx;
    checkCancelled(ctx.signal);

    const { params, dimensions: dim } = ctx;
    const { diameter, depth } = params.lid.retentionMagnet;
    const magnetRadius = diameter / 2;
    const bossRadius = retentionBossRadius(diameter);
    const inset = retentionMagnetInset(diameter);
    // Overhang moves the stacking lip the pads hug, so the pads move with it —
    // otherwise a one-sided overhang strands the gusset away from the interior
    // wall it welds into. The lid boss applies the same shift.
    const allPositions = retentionMagnetPositions(
      params.width,
      params.depth,
      dim.gridUnitMmX,
      dim.gridUnitMmY,
      inset,
      params.lid.retentionMagnet.edgeMagnets,
      bossRadius,
      hasOverhang(dim.overhang) ? overhangExpansion(dim.overhang) : null
    );
    // A hinged lid's magnet catch pins only the free edge — the hinge already
    // holds the other one, and pads on the hinge wall would fight the knuckles
    // for the same millimetres. Filtered here rather than in the placement
    // helper so the lid's bosses and the bin's pads read the SAME list through
    // the same call and cannot end up on different walls.
    const expansion = hasOverhang(dim.overhang) ? overhangExpansion(dim.overhang) : null;
    const positions = retentionMagnetPlacementsFor(
      retentionMagnetSide(params),
      allPositions,
      expansion?.offsetX ?? 0,
      expansion?.offsetY ?? 0
    );

    // Both magnet faces come from the shared seat-plane helper so the bin pad
    // and the lid boss can't drift apart in Z (the XY equivalent of
    // `retentionMagnetPositions`).
    //
    // `dim.lipTopZ` is the plane a seated lid's `anchorZ` lands on — the helper
    // measures down from it. Read it, never restate the chain: every
    // restatement has been wrong, by less than a millimetre, which is
    // enough to turn the designed 0.2mm seat gap into 0.5mm of solid overlap.
    const { binFaceZ: magnetTopZ } = retentionSeatPlanes(params, dim.lipTopZ);

    // Cap the pocket at what the recessed pad can hold while keeping POST_FLOOR
    // of pad below the magnet. `availableForPocket` is guaranteed positive when
    // this stage runs (the `magnetTooDeepForBin` blocker rejects magnets that
    // don't fit), but clamp to >= 0 defensively so a marginal design never
    // inverts the pocket. The pad bottom is additionally clamped to the interior
    // floor so a deep magnet can never dig a pocket through it.
    //
    // Measured down from the NOMINAL wall top, not `wallTopZ`: a collar raises
    // the outer wall and the lip without touching the interior, so
    // `interiorHeight` is still measured from where the wall would have ended.
    // Subtracting it from `wallTopZ` would put the floor a whole collar too
    // high, truncating the pad's taper above the floor it should weld into.
    const floorTopZ = dim.wallTopZ - dim.collarHeight - dim.interiorHeight;
    const availableForPocket = Math.max(0, magnetTopZ - floorTopZ - LID_MAGNET_POST_FLOOR);
    const pocketDepth = Math.min(depth, availableForPocket);
    const padBottomZ = Math.max(floorTopZ, magnetTopZ - pocketDepth - LID_MAGNET_POST_FLOOR);

    const innerHalfW = dim.innerW / 2;
    const innerHalfD = dim.innerD / 2;
    // The cavity is centred on the overhang-shifted centre, not the origin, so
    // every wall/arc coordinate below is measured from it. Zero without
    // overhang, leaving the un-overhung geometry byte-identical.
    const innerCx = dim.innerOffsetX;
    const innerCy = dim.innerOffsetY;

    // The cavity's corner arc (boxBuilder's inner footprint) is concentric with
    // the outer wall's BOX_CORNER_RADIUS arc, so the wall keeps a uniform
    // thickness around the corner and a pad edge offset outward from this
    // radius stays a uniform depth into it.
    const cavityCornerR = Math.max(BOX_CORNER_RADIUS - params.wallThickness, 0);

    let body: Shape3D = ctx.solid;

    // 1. Fuse a gusset pad into each corner. The pad's footprint spans from the
    //    interior wall corner (with a small overlap for a solid weld) inward
    //    past the magnet; its inward corner is rounded at the boss radius so
    //    the pad ends in a smooth tongue wrapping the pocket. Below
    //    `padBottomZ` the pad continues down as a 45° taper: a single plane
    //    rising along the corner diagonal from the wall corner to the tongue
    //    tip, so the underside prints support-free.
    for (const placement of positions) {
      const { x: px, y: py, anchor } = placement;

      // ── Mid-edge magnets: a single-wall cantilever pad. ──────────
      // Anchors to ONE interior wall and reaches inward to house the magnet,
      // with a support-free 45° underside sloping down toward that wall (the
      // mid-edge analogue of the corner gusset below). `anchor === 'y'` welds
      // to a front/back wall (constant Y, free in X); `anchor === 'x'` welds to
      // a left/right wall (constant X, free in Y).
      if (anchor !== 'corner') {
        const alongY = anchor === 'x'; // free along Y when anchored to an X wall
        const perpSign = alongY ? Math.sign(px - innerCx) : Math.sign(py - innerCy);
        const wallPerp = alongY
          ? innerCx + perpSign * (innerHalfW + GUSSET_WALL_OVERLAP)
          : innerCy + perpSign * (innerHalfD + GUSSET_WALL_OVERLAP);
        const magnetPerp = alongY ? px : py;
        const tipPerp = magnetPerp - perpSign * bossRadius; // inboard pad tip
        const freeCoord = alongY ? py : px;
        const eTaperDepth = Math.abs(wallPerp - tipPerp);
        const eTaperBottomZ = padBottomZ - eTaperDepth;
        const eFlatBottomZ =
          eTaperBottomZ < floorTopZ + LID_COPLANAR_MARGIN
            ? floorTopZ - LID_COPLANAR_MARGIN
            : eTaperBottomZ;

        // Footprint: a rectangle spanning the boss in the free axis and from the
        // wall to the inboard tip in the perpendicular axis. Drawn min→max so
        // the winding stays CCW on every wall (a mirrored template would flip
        // the extruded solid's face orientation — see the corner note below).
        const perpLo = Math.min(wallPerp, tipPerp);
        const perpHi = Math.max(wallPerp, tipPerp);
        const freeLo = freeCoord - bossRadius;
        const freeHi = freeCoord + bossRadius;
        const eFootprint = alongY
          ? draw([perpLo, freeLo])
              .lineTo([perpHi, freeLo])
              .lineTo([perpHi, freeHi])
              .lineTo([perpLo, freeHi])
              .close()
          : draw([freeLo, perpLo])
              .lineTo([freeHi, perpLo])
              .lineTo([freeHi, perpHi])
              .lineTo([freeLo, perpHi])
              .close();
        const ePadExt = eFootprint
          .sketchOnPlane('XY', eFlatBottomZ)
          .extrude(magnetTopZ - eFlatBottomZ);

        // Wedge for the 45° underside — same canonical cross-section as the
        // corner wedge, but the rise runs straight in from the single wall
        // (X_local = 0 at the wall, +X_local pointing inward to the tip).
        const eZLow = Math.min(eFlatBottomZ, eTaperBottomZ) - 2;
        const eSpanFree = 2 * bossRadius + 4;
        const eWedgeRaw = draw([-1, eTaperBottomZ - 1])
          .lineTo([-1, eZLow])
          .lineTo([eTaperDepth + 1, eZLow])
          .lineTo([eTaperDepth + 1, padBottomZ + 1])
          .close()
          .sketchOnPlane('XZ')
          .extrude(eSpanFree);
        const eWedgeCentered = translate(eWedgeRaw, [0, eSpanFree / 2, 0]);
        eWedgeRaw.delete();
        // Rise direction points from the wall inward: -perpSign along the perp
        // axis (X for an X wall, Y for a Y wall).
        const eRiseAngleDeg = alongY
          ? (Math.atan2(0, -perpSign) * 180) / Math.PI
          : (Math.atan2(-perpSign, 0) * 180) / Math.PI;
        const eWedgeRotated = rotate(eWedgeCentered, eRiseAngleDeg, { axis: [0, 0, 1] });
        eWedgeCentered.delete();
        const eOriginX = alongY ? wallPerp : freeCoord;
        const eOriginY = alongY ? freeCoord : wallPerp;
        const eWedge = translate(eWedgeRotated, [eOriginX, eOriginY, 0]);
        eWedgeRotated.delete();

        const ePad = unwrap(cut(ePadExt as ValidSolid, eWedge as ValidSolid));
        ePadExt.delete();
        eWedge.delete();

        const eFused = unwrap(fuse(body as ValidSolid, ePad));
        ePad.delete();
        body.delete();
        body = eFused;
        continue;
      }

      const sx = Math.sign(px - innerCx);
      const sy = Math.sign(py - innerCy);
      const wallX = innerCx + sx * (innerHalfW + GUSSET_WALL_OVERLAP);
      const wallY = innerCy + sy * (innerHalfD + GUSSET_WALL_OVERLAP);
      const innerX = px - sx * bossRadius;
      const innerY = py - sy * bossRadius;
      const sizeX = Math.abs(wallX - innerX);
      const sizeY = Math.abs(wallY - innerY);
      const tongueR = Math.max(
        LID_MIN_CORNER_RADIUS,
        Math.min(bossRadius, sizeX - LID_MIN_CORNER_RADIUS, sizeY - LID_MIN_CORNER_RADIUS)
      );

      // Taper depth along the diagonal: chosen so the 45° plane meets the pad
      // bottom exactly at the rounded tongue's tip — no residual flat overhang.
      // (A sharp corner would need (sizeX+sizeY)/√2; the rounding pulls the
      // tip back by (2−√2)·tongueR of diagonal travel.)
      const taperDepth = (sizeX + sizeY - (2 - Math.SQRT2) * tongueR) / Math.SQRT2;
      const taperBottomZ = padBottomZ - taperDepth;
      // Clamp to the interior floor, welding in by a coplanar margin so a
      // truncated taper never leaves a boolean-hostile face-on-face contact.
      const flatBottomZ =
        taperBottomZ < floorTopZ + LID_COPLANAR_MARGIN
          ? floorTopZ - LID_COPLANAR_MARGIN
          : taperBottomZ;

      // The outward corner follows the cavity wall's arc, offset outward by the
      // same GUSSET_WALL_OVERLAP the flats use. A square corner at
      // (wallX, wallY) would sit √2·(cavityCornerR + GUSSET_WALL_OVERLAP) from
      // the concentric corner centre — more than BOX_CORNER_RADIUS, so it
      // protrudes through the outer wall, for every wall thinner than ~1.5mm
      //. The arc is tangent to both wall lines, so the two remaining
      // square corners stay buried where the flats meet the tongue.
      const padCornerR = cavityCornerR + GUSSET_WALL_OVERLAP;
      const arcCx = innerCx + sx * (innerHalfW - cavityCornerR);
      const arcCy = innerCy + sy * (innerHalfD - cavityCornerR);
      // Bows outward toward the removed corner on all four corners, hence a
      // fixed sign — unlike the tongue, whose traversal direction is the same
      // in both branches.
      const cornerSagitta = -padCornerR * (1 - Math.SQRT1_2);

      // Footprint: two square corners buried in the walls, the wall-following
      // corner arc, and the rounded tongue. Positive sagitta bows left of
      // travel (see sagittaArcConvention.test.ts); the arc must bow toward the
      // removed corner. Every corner is drawn COUNTER-clockwise — mirroring one
      // path template across the corners would flip the winding on half of
      // them, which inverts the extruded solid's face orientation and ships
      // flipped shading normals in the tessellated mesh.
      const sagitta = -sx * sy * tongueR * (1 - Math.SQRT1_2);
      const footprint =
        sx * sy > 0
          ? draw([wallX, arcCy])
              .sagittaArcTo([arcCx, wallY], cornerSagitta)
              .lineTo([innerX, wallY])
              .lineTo([innerX, innerY + sy * tongueR])
              .sagittaArcTo([innerX + sx * tongueR, innerY], sagitta)
              .lineTo([wallX, innerY])
              .close()
          : draw([arcCx, wallY])
              .sagittaArcTo([wallX, arcCy], cornerSagitta)
              .lineTo([wallX, innerY])
              .lineTo([innerX + sx * tongueR, innerY])
              .sagittaArcTo([innerX, innerY + sy * tongueR], -sagitta)
              .lineTo([innerX, wallY])
              .close();
      const padExt = footprint.sketchOnPlane('XY', flatBottomZ).extrude(magnetTopZ - flatBottomZ);

      // Wedge cutter for the 45° underside, built in a canonical frame where
      // +X is the diagonal rise direction (u = distance along the diagonal
      // from the wall corner) and the prism spans Y symmetrically, then
      // rotated onto the corner diagonal and moved to the wall corner. Only
      // the sloped top face matters; the rest sits clear of the pad.
      const zLow = Math.min(flatBottomZ, taperBottomZ) - 2;
      const spanL = sizeX + sizeY + 4;
      // 'XZ' extrudes toward -Y (same convention wallPatternClips relies on),
      // so center the prism with an explicit +spanL/2 shift before rotating.
      // Wound so the cutter solid's faces are outward-oriented — the sloped
      // face it carves into the pad inherits this orientation, and a reversed
      // winding would ship a flipped shading normal on the visible taper.
      const wedgeRaw = draw([-1, taperBottomZ - 1])
        .lineTo([-1, zLow])
        .lineTo([taperDepth + 1, zLow])
        .lineTo([taperDepth + 1, padBottomZ + 1])
        .close()
        .sketchOnPlane('XZ')
        .extrude(spanL);
      const wedgeCentered = translate(wedgeRaw, [0, spanL / 2, 0]);
      wedgeRaw.delete();
      const wedgeRotated = rotate(wedgeCentered, (Math.atan2(-sy, -sx) * 180) / Math.PI, {
        axis: [0, 0, 1],
      });
      wedgeCentered.delete();
      const wedge = translate(wedgeRotated, [wallX, wallY, 0]);
      wedgeRotated.delete();

      const pad = unwrap(cut(padExt as ValidSolid, wedge as ValidSolid));
      padExt.delete();
      wedge.delete();

      const fused = unwrap(fuse(body as ValidSolid, pad));
      pad.delete();
      body.delete();
      body = fused;
    }

    // 2. Cut the upward-opening pockets. Cutter starts `pocketDepth` below the
    //    pad top and rises a hair past it so it bites cleanly through the top
    //    face, leaving POST_FLOOR of pad material below the magnet.
    const cutterZ = magnetTopZ - pocketDepth;
    const cutterHeight = pocketDepth + LID_COPLANAR_MARGIN;
    const cutters: Shape3D[] = [];
    for (const { x: px, y: py } of positions) {
      cutters.push(
        cylinder(magnetRadius, cutterHeight, { at: [px, py, cutterZ], axis: [0, 0, 1] })
      );
    }

    const pocketed = unwrap(cutAll(body as ValidSolid, cutters as ValidSolid[]));
    for (const c of cutters) c.delete();
    body.delete();

    return { ...ctx, solid: pocketed };
  },
};

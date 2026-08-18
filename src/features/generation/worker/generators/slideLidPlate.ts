/**
 * The sliding lid itself: a flat plate that runs in the bin's channel.
 *
 * Built from the SAME `resolveSlideLidPlan` call the channel is, so the plate
 * and the track it runs in cannot disagree about where the bearing surfaces
 * are. Nothing here decides placement; this file turns the plan's numbers into
 * a solid.
 *
 * The plate is returned in the BIN's XY orientation with `z = 0` at its top
 * face — the same lid-local convention `buildLid` uses for a capping lid, so
 * the preview, the export assembly and `applyLidCutouts` all keep working
 * against one rule. Only the Z the caller seats it at differs.
 *
 * ── WHY THESE EDGES ──────────────────────────────────────────────────────
 *
 * Section across a running edge, printed flat on the bed (top face up):
 *
 *      ╱▔▔▔▔▔▔▔▔▔▔▔▔▔▔    ← 45° wedge: the retaining face. Cut into the TOP
 *     ╱                     edge, so on the bed it is a chamfer, not an
 *    │                      overhang.
 *    │
 *     ╲                   ← elephant-foot relief. The first layer squishes
 *      ╲__________          wider than nominal, and this joint is a sliding
 *                           fit measured on exactly that edge.
 *
 * The leading edge gets a lead-in on both faces so the plate finds the channel
 * instead of catching on it, and the two leading corners are rounded to the
 * cavity's own radius so the plate seats to the back wall rather than stopping
 * on a fillet.
 *
 * The whole footprint is finally clipped to the lid's outer perimeter. The
 * plate's trailing edge finishes flush with the bin's face, and its corners
 * would otherwise sit outside the body's rounded silhouette — protruding past a
 * closed bin by a millimetre or so on every design. Clipping states the rule
 * (the plate never reaches past the footprint) instead of restating the arc.
 */

import {
  clone,
  cutAll,
  draw,
  drawRoundedRectangle,
  fuse,
  intersect,
  rotate,
  translate,
  unwrap,
} from 'brepjs';
import type { Shape3D, DisposalScope, Drawing, ValidSolid } from 'brepjs';
import { sketch } from './meshUtils';
import { buildOutlineDrawing } from './lidProfile';
import type { LidInputs } from './lidInputs';
import type { SlideLidGeometry } from '@/shared/utils/slideLidPlan';

/**
 * Lead-in (mm) chamfered onto the leading edge, top and bottom.
 *
 * The plate is pushed in blind: the user cannot see whether its edge is above
 * or below the shelf. A chamfer on both faces means a plate presented a layer
 * or two off still finds the channel and is guided into it, rather than
 * catching on the shelf's tip and feeling jammed.
 */
const LEAD_IN_MM = 0.6;

/**
 * Relief (mm) chamfered onto the running edges' UNDERSIDE.
 *
 * The first layer of an FDM print is squashed against the bed and comes out
 * wider than nominal — a tenth or two per side, which is a large fraction of a
 * 0.25mm sliding clearance. Every other face of this joint is a wall or a
 * chamfer and unaffected; the plate's bottom edge is the one that touches the
 * bed, and it is also the one that runs on the shelf.
 */
const FOOT_RELIEF_MM = 0.4;

/** Overshoot (mm) so a cutter's faces never land coplanar with the plate's. */
const OVERSHOOT_MM = 1;

/**
 * The plate's footprint: a rectangle with its two LEADING corners rounded.
 *
 * Drawn from an edge midpoint so `close()` forms a real edge rather than
 * meeting at a vertex the corner treatment would then have to describe.
 */
function plateOutline(geometry: SlideLidGeometry): Drawing {
  const { plate } = geometry;
  const hs = plate.spanMm / 2;
  const r = Math.max(Math.min(plate.cornerRadiusMm, hs - 0.05, plate.lengthMm / 2 - 0.05), 0);
  const midX = (plate.leadingX + plate.trailingX) / 2;
  const pen = draw([midX, -hs]).lineTo([plate.trailingX, -hs]).lineTo([plate.trailingX, hs]);
  if (r <= 0.1) {
    return pen.lineTo([plate.leadingX, hs]).lineTo([plate.leadingX, -hs]).close();
  }
  return pen
    .lineTo([plate.leadingX, hs])
    .customCorner(r)
    .lineTo([plate.leadingX, -hs])
    .customCorner(r)
    .close();
}

/** A prism swept along X from a YZ section, then moved to `xMin`. */
function sweptX(
  scope: DisposalScope,
  section: readonly (readonly [number, number])[],
  xMin: number,
  xMax: number
): Shape3D {
  const [first, ...rest] = section;
  let pen = draw([first[0], first[1]]);
  for (const [y, z] of rest) pen = pen.lineTo([y, z]);
  const extruded = scope.register(sketch(pen.close(), 'YZ').extrude(xMax - xMin));
  return scope.register(translate(extruded, [xMin, 0, 0]));
}

/** A prism swept along Y from an XZ elevation drawn in XY and stood upright. */
function sweptY(
  scope: DisposalScope,
  elevation: readonly (readonly [number, number])[],
  yMin: number,
  yMax: number
): Shape3D {
  const [first, ...rest] = elevation;
  let pen = draw([first[0], first[1]]);
  for (const [x, z] of rest) pen = pen.lineTo([x, z]);
  const slab = scope.register(sketch(pen.close(), 'XY', 0).extrude(yMax - yMin));
  // `+90` about X maps (x, y, z) → (x, −z, y): the drawing's vertical becomes
  // +Z and the extrusion runs toward −Y. A `-90` would invert the vertical and
  // build every chamfer on the wrong face — invisible on a symmetric profile,
  // and these are not symmetric (CLAUDE.md gotcha #12).
  const upright = scope.register(rotate(slab, 90, { axis: [1, 0, 0] }));
  return scope.register(translate(upright, [0, yMax, 0]));
}

/** Cutters that chamfer the two running edges, top and bottom. */
function edgeCutters(scope: DisposalScope, geometry: SlideLidGeometry): Shape3D[] {
  const { plate } = geometry;
  const hs = plate.spanMm / 2;
  const t = plate.thicknessMm;
  const w = plate.wedgeMm;
  const f = Math.min(FOOT_RELIEF_MM, t - w - 0.2);
  const xMin = plate.leadingX - OVERSHOOT_MM;
  const xMax = plate.trailingX + OVERSHOOT_MM;

  const cutters: Shape3D[] = [];
  for (const sign of [-1, 1] as const) {
    const outer = sign * hs;
    const inner = sign * (hs - w);
    // TOP: the retaining wedge. Removes everything above the 45° plane that the
    // retainer's underside is parallel to.
    cutters.push(
      sweptX(
        scope,
        [
          [outer, -w],
          [inner, 0],
          [outer + sign * OVERSHOOT_MM, 0],
          [outer + sign * OVERSHOOT_MM, -w],
        ],
        xMin,
        xMax
      )
    );
    // BOTTOM: elephant-foot relief. Skipped when the plate is thin enough that
    // it would meet the wedge and leave a knife edge.
    if (f > 0.1) {
      const innerF = sign * (hs - f);
      cutters.push(
        sweptX(
          scope,
          [
            [outer, -t + f],
            [innerF, -t],
            [outer + sign * OVERSHOOT_MM, -t],
            [outer + sign * OVERSHOOT_MM, -t + f],
          ],
          xMin,
          xMax
        )
      );
    }
  }
  return cutters;
}

/**
 * Cutters for the detent pockets — a shallow dimple in the plate's underside
 * over each shelf, ramped at 45° along the travel axis.
 *
 * Ramped rather than square so the plate rides in and out of it instead of
 * catching on a step, and so the dimple is a shape the slicer bridges cleanly
 * on the bed rather than a flat-roofed hole.
 */
function detentPocketCutters(scope: DisposalScope, geometry: SlideLidGeometry): Shape3D[] {
  const { plate } = geometry;
  return plate.detentPockets.map((pocket) => {
    const half = pocket.lengthMm / 2;
    const floor = -plate.thicknessMm + pocket.depthMm;
    return sweptY(
      scope,
      [
        [pocket.centerX - half, -plate.thicknessMm - OVERSHOOT_MM],
        [pocket.centerX + half, -plate.thicknessMm - OVERSHOOT_MM],
        [pocket.centerX, floor],
      ],
      pocket.yMin,
      pocket.yMax
    );
  });
}

/** Cutters that lead the plate's front edge into the channel. */
function leadInCutters(scope: DisposalScope, geometry: SlideLidGeometry): Shape3D[] {
  const { plate } = geometry;
  const hs = plate.spanMm / 2 + OVERSHOOT_MM;
  const t = plate.thicknessMm;
  const x0 = plate.leadingX;
  const lead = Math.min(LEAD_IN_MM, t / 2 - 0.1);
  if (lead <= 0.1) return [];
  return [
    // Top face.
    sweptY(
      scope,
      [
        [x0 - OVERSHOOT_MM, 0],
        [x0 + lead, 0],
        [x0, -lead],
        [x0 - OVERSHOOT_MM, -lead],
      ],
      -hs,
      hs
    ),
    // Underside.
    sweptY(
      scope,
      [
        [x0 - OVERSHOOT_MM, -t],
        [x0 + lead, -t],
        [x0, -t + lead],
        [x0 - OVERSHOOT_MM, -t + lead],
      ],
      -hs,
      hs
    ),
  ];
}

/**
 * The finger notch: a rounded bite out of the trailing edge, through the plate.
 *
 * Through rather than a dish because the plate is only a couple of millimetres
 * thick — a dished pocket would leave a floor too thin to push on, and a hole
 * you can hook a fingertip through is what actually shifts a lid that has
 * clicked past its detent.
 */
function notchCutter(scope: DisposalScope, geometry: SlideLidGeometry): Shape3D | null {
  const { plate } = geometry;
  if (plate.pull !== 'notch' || plate.pullReachMm <= 0) return null;
  const depth = plate.pullReachMm;
  const width = Math.min(plate.pullSpanMm, plate.spanMm - 4);
  if (width <= 2) return null;
  // Centred on the trailing edge and run past it, so the bite is open rather
  // than a slot with a lip left across its mouth.
  const outline = drawRoundedRectangle(2 * depth, width, Math.min(depth, width / 2) - 0.01);
  return scope.register(
    outline
      .translate(plate.trailingX, 0)
      .sketchOnPlane('XY', -plate.thicknessMm - OVERSHOOT_MM)
      .extrude(plate.thicknessMm + 2 * OVERSHOOT_MM)
  );
}

/**
 * The pull tab: a lug in the plate's OWN PLANE reaching past the bin's face.
 *
 * In-plane rather than standing proud of the top: the plate has to print flat
 * and, on the `flush` placement, has to leave the rim clear for whatever stacks
 * on it. Reaching outward instead is also the more useful shape — it is the
 * part you can find with a gloved hand.
 */
function tabSolid(scope: DisposalScope, geometry: SlideLidGeometry): Shape3D | null {
  const { plate } = geometry;
  if (plate.pull !== 'tab' || plate.pullReachMm <= 0) return null;
  const width = Math.min(plate.pullSpanMm, plate.spanMm);
  const reach = plate.pullReachMm;
  // Overlaps back into the plate so the fuse has real volume to merge rather
  // than two solids meeting on a plane.
  const outline = drawRoundedRectangle(2 * reach, width, Math.min(reach, width / 2) - 0.01);
  return scope.register(
    outline
      .translate(plate.trailingX, 0)
      .sketchOnPlane('XY', -plate.thicknessMm)
      .extrude(plate.thicknessMm)
  );
}

/** Rotate a canonical solid onto the entry wall and centre it on the cavity. */
function place(
  scope: DisposalScope,
  shape: Shape3D,
  geometry: SlideLidGeometry,
  offsetX: number,
  offsetY: number
): Shape3D {
  const oriented =
    geometry.rotationDeg === 0
      ? shape
      : scope.register(rotate(shape, geometry.rotationDeg, { axis: [0, 0, 1] }));
  return offsetX === 0 && offsetY === 0
    ? oriented
    : scope.register(translate(oriented, [offsetX, offsetY, 0]));
}

/**
 * Build the sliding plate in lid-local coordinates (bin XY orientation, `z = 0`
 * at the top face). Caller owns the returned solid.
 */
export function buildSlideLidPlate(
  scope: DisposalScope,
  inputs: LidInputs,
  geometry: SlideLidGeometry
): Shape3D {
  const { plate } = geometry;
  // Canonical frame throughout, then one rotation onto the chosen wall.
  const body = scope.register(
    plateOutline(geometry).sketchOnPlane('XY', -plate.thicknessMm).extrude(plate.thicknessMm)
  );

  const cutters = [
    ...edgeCutters(scope, geometry),
    ...leadInCutters(scope, geometry),
    ...detentPocketCutters(scope, geometry),
  ];
  const notch = notchCutter(scope, geometry);
  if (notch) cutters.push(notch);

  let shaped: Shape3D = body;
  if (cutters.length > 0) {
    shaped = scope.register(unwrap(cutAll(shaped as ValidSolid, cutters as ValidSolid[])));
  }

  // The plate travels along the CAVITY's axis, so it is centred on the cavity —
  // which asymmetric overhang moves off the bin's origin.
  const cavityOffsetX = inputs.outerOffsetX;
  const cavityOffsetY = inputs.outerOffsetY;
  let placed = place(scope, shaped, geometry, cavityOffsetX, cavityOffsetY);

  // Clip to the lid's own footprint. See the file header: without it the
  // trailing corners sit outside the bin's rounded silhouette.
  const window = scope.register(
    buildOutlineDrawing(inputs, 0)
      .sketchOnPlane('XY', -plate.thicknessMm - OVERSHOOT_MM)
      .extrude(plate.thicknessMm + 2 * OVERSHOOT_MM)
  );
  placed = scope.register(unwrap(intersect(placed, window)));

  // The tab is added AFTER the clip — reaching past the footprint is the point
  // of it.
  const tab = tabSolid(scope, geometry);
  if (tab) {
    const placedTab = place(scope, tab, geometry, cavityOffsetX, cavityOffsetY);
    placed = scope.register(unwrap(fuse(placed, placedTab)));
  }

  return unwrap(clone(placed));
}

/** Edge treatments the seating tests measure against. */
export const SLIDE_PLATE_LEAD_IN_MM = LEAD_IN_MM;
export const SLIDE_PLATE_FOOT_RELIEF_MM = FOOT_RELIEF_MM;

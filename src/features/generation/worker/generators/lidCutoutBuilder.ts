/**
 * Through-cuts in the lid's plate — a dispensing slot, a vent, a cable pass.
 *
 * Reuses the bin interior's shape builders wholesale (`buildUngroupedCutout`,
 * `buildGroupedCutouts`, `buildArrayUngroupedCutouts`), which is safe because
 * those take their frame entirely in their arguments: give them a top plane and
 * an origin and they return a tool in that frame. So the pen tool, the pathfinder
 * group ops, insertion clearance and the entry chamfer all reach the lid without
 * a second implementation of any of them.
 *
 * Three things are decided HERE rather than by the shape, because all three are
 * properties of the host:
 *
 * 1. Depth. Every cut spans the full plate, so `cutout.cutDepth` is overridden
 *    rather than read. `exportLid` rotates the lid 180° about X to print, which
 *    turns a partial pocket in the top face into a downward-facing ceiling pocket
 *    — the overhang that rotation exists to remove. Through is also the only
 *    depth a slot or a vent wants.
 *
 * 2. The window. Tools are clipped to the mating cavity's footprint, not the
 *    plate's. A hole further out would sit over the mating shell's wall and take
 *    the top off it, and that wall is what grips the bin's lip — a lid that still
 *    measures and tessellates perfectly and no longer stays shut.
 *
 * 3. The bosses. A magnetic lid hangs a boss from the plate at each magnet, and
 *    a hole over one opens its magnet pocket. Each boss is subtracted from the
 *    tool, so a slot drawn across a corner loses the disc rather than the lid
 *    losing its retention. Invisible to any check on the lid alone: the solid
 *    stays watertight, it just stops holding the bin.
 */

import { unwrap, cut, cutAll, intersect, translate, drawRoundedRectangle, cylinder } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import type { Cutout } from '@/shared/types/bin';
import {
  buildArrayUngroupedCutouts,
  buildGroupedCutouts,
  buildUngroupedCutout,
} from './cutoutBuilder';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import type { LidCutoutInputs, LidInputs } from './lidInputs';

/**
 * Vertical overshoot (mm) added above and below the plate so a through-cut
 * bites cleanly instead of leaving coplanar faces at the plate's surfaces. A
 * cutter ending exactly on a face is the classic non-manifold result.
 */
const THROUGH_OVERSHOOT_MM = 0.1;

/** Local Z span of a cut tool: the plate, plus one overshoot at each end. */
function cutSpanMm(thickness: number): number {
  return thickness + 2 * THROUGH_OVERSHOOT_MM;
}

/**
 * Build one tool per logical cutout, in a local frame whose top face is at
 * `z = thickness` and whose origin is the window's front-left corner.
 *
 * Grouping matches the bin's rules: members of a `groupId` build as one fused
 * (or subtracted) tool, and an `array` on an ungrouped cutout expands to its
 * instances. Ordering follows `zIndex` the same way, since `buildGroupedCutouts`
 * reads it to order boolean ops within a group.
 */
function buildTools(cutouts: LidCutoutInputs): Shape3D[] {
  const { shapes, window, thickness } = cutouts;
  // The shape builders extrude DOWN from the plane they are handed, so the
  // overshoot at both ends has to be part of the depth they build rather than
  // something the translate adds — a translate moves both faces together and
  // cannot lengthen the prism. Hence the local span is the plate plus one
  // overshoot above and one below; {@link cutSpanMm} is the single expression of
  // that so the placement below cannot disagree with it.
  //
  // One consequence worth stating: an entry chamfer flares to its full width at
  // the TOOL's top, which is now `THROUGH_OVERSHOOT_MM` above the real face, so a
  // chamfered opening measures that much narrower than nominal at the surface.
  // 0.1mm is under one layer, and the alternative is a coplanar cut face at the
  // plate's top — which is how non-manifold output happens.
  const surfaceZ = cutSpanMm(thickness);
  const originX = -window.spanW / 2;
  const originY = -window.spanD / 2;

  // `cutDepth` is the host's business, not the shape's — see the module note.
  const through = (c: Cutout): Cutout => ({ ...c, cutDepth: surfaceZ });

  const groups = new Map<string, Cutout[]>();
  const singles: Cutout[] = [];
  for (const c of shapes) {
    if (c.hidden === true) continue;
    if (c.groupId === null || c.groupId === undefined) {
      singles.push(c);
      continue;
    }
    const members = groups.get(c.groupId);
    if (members) members.push(c);
    else groups.set(c.groupId, [c]);
  }

  const tools: Shape3D[] = [];
  for (const c of singles) {
    if (c.array) {
      tools.push(...buildArrayUngroupedCutouts(through(c), surfaceZ, originX, originY));
      continue;
    }
    const shape = buildUngroupedCutout(through(c), surfaceZ, originX, originY);
    if (shape) tools.push(shape);
  }
  for (const members of groups.values()) {
    const shape = buildGroupedCutouts(members.map(through), surfaceZ, originX, originY);
    if (shape) tools.push(shape);
  }
  return tools;
}

/**
 * The clip boundary: the window prism, less every boss.
 *
 * Built tall enough to span the plate plus the overshoot at both ends, so
 * intersecting never trims a tool's Z.
 */
function buildClipBoundary(scope: DisposalScope, cutouts: LidCutoutInputs): Shape3D {
  const { window, topZ, thickness } = cutouts;
  // In LID-LOCAL Z, because the tools are clipped after they are placed. Anchored
  // on `topZ` rather than on zero: a tray lid's host face is the recessed floor,
  // well below the plate's top, and a boundary that assumed zero clipped every
  // tool down to a sliver of its own overshoot instead of trimming its footprint.
  const span = cutSpanMm(thickness) + 2 * THROUGH_OVERSHOOT_MM;
  const bottom = topZ - thickness - 2 * THROUGH_OVERSHOOT_MM;
  // Model-space, not window-space: the tools are translated onto the lid's
  // (possibly overhang-shifted) perimeter before they are clipped, so a boundary
  // left at the origin would trim the wrong side of every hole on an
  // asymmetrically overhung lid.
  let boundary: Shape3D = scope.register(
    drawRoundedRectangle(window.spanW, window.spanD, window.cornerRadius)
      .translate(window.offsetX, window.offsetY)
      .sketchOnPlane('XY', bottom)
      .extrude(span)
  );
  // Keep-outs are in the window frame ([0, span]); the window's own centre sits
  // at (offsetX, offsetY) in model space, so rebase each centre onto it.
  const originX = window.offsetX - window.spanW / 2;
  const originY = window.offsetY - window.spanD / 2;
  for (const k of window.keepouts) {
    const post = scope.register(
      cylinder(k.r, span, {
        at: [k.x + originX, k.y + originY, bottom],
        axis: [0, 0, 1],
      })
    );
    scope.register(boundary);
    // Register the RESULT too, not just the input it replaces. Only the initial
    // boundary is registered at construction, so without this the solid the last
    // keepout produced is the one nobody owns — an OCCT handle leaked per
    // generation on every magnetic lid, which is the shape of defect
    // `disposalRegression` exists to catch.
    boundary = scope.register(unwrap(cut(boundary as ValidSolid, post)));
  }
  return boundary;
}

/**
 * Cut the resolved lid cutouts out of the built lid body. Returns the input
 * unchanged when nothing is resolved, and drops an individual tool that fails
 * rather than losing the whole set — the established convention for cutout
 * tools, so one bad path shape can't cost the user their other holes.
 */
export function applyLidCutouts(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const cutouts = inputs.cutouts;
  if (!cutouts) return body;

  const tools = buildTools(cutouts);
  if (tools.length === 0) return body;

  let boundary: Shape3D;
  try {
    boundary = buildClipBoundary(scope, cutouts);
  } catch (e) {
    for (const t of tools) t.delete();
    throw e;
  }

  // Lift the local frame onto the host face. The tool spans [0, cutSpanMm]
  // locally, and its top must land one overshoot ABOVE `topZ`, so the shift puts
  // its bottom one overshoot below the plate's underside. Both ends therefore
  // clear the solid and neither cut face is coplanar with a plate face.
  const dz = cutouts.topZ + THROUGH_OVERSHOOT_MM - cutSpanMm(cutouts.thickness);
  // Asymmetric overhang shifts the lid's perimeter, and the window travels with
  // it. The plate is built at the shifted perimeter, so the tools must be too.
  const dx = cutouts.window.offsetX;
  const dy = cutouts.window.offsetY;

  const holes: Shape3D[] = [];
  for (const tool of tools) {
    let placed: Shape3D | null = null;
    try {
      placed = translate(tool, [dx, dy, dz]);
      const clipped = scope.register(unwrap(intersect(placed, boundary)));
      if (originToTag) {
        collectOrigins(clipped, FeatureTag.CUTOUT, originToTag);
      }
      holes.push(clipped);
    } catch {
      // Individual tool failure: drop this hole, keep the rest. One bad path
      // shape must not cost the user their other holes.
    } finally {
      tool.delete();
      placed?.delete();
    }
  }

  if (holes.length === 0) return body;
  scope.register(body);
  return unwrap(cutAll(body as ValidSolid, holes as ValidSolid[]));
}

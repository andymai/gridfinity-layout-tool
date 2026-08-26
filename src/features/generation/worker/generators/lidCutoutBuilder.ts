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
 * `lidCutoutPlan` owns WHERE a hole may go and HOW DEEP; this builds it. The one
 * rule that lives here, because it is about the tool rather than the plan: a
 * magnetic lid's bosses are subtracted from every tool, so a slot drawn across a
 * corner loses the disc rather than the lid losing its retention. That failure is
 * invisible to any check on the lid alone — the solid stays watertight, it just
 * stops holding the bin.
 */

import {
  unwrap,
  cut,
  cutAll,
  fuse,
  intersect,
  translate,
  drawRoundedRectangle,
  cylinder,
} from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import type { Cutout } from '@/shared/types/bin';
import { resolveTextStyle, ZERO_TEXT_OFFSET } from '@/shared/types/bin';
import { cutoutLabelPlacement, expandBandToInterior } from '@/shared/utils/cutoutLabel';
import { isCutoutEngraveMode } from '@/shared/utils/cutoutLabelSocketPlan';
import { labelledInstances } from '@/shared/utils/cutoutArray';
import {
  buildArrayUngroupedCutouts,
  buildGroupedCutouts,
  buildUngroupedCutout,
} from './cutoutBuilder';
import { buildTextSolid } from './textBuilder';
import { LID_TEXT_ENGRAVE_FLOOR, MIN_ENGRAVE_DEPTH } from './lidTextBuilder';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import type { LidCutoutInputs, LidInputs } from './lidInputs';

/**
 * Vertical overshoot (mm) added above and below the plate so a through-cut
 * bites cleanly instead of leaving coplanar faces at the plate's surfaces. A
 * cutter ending exactly on a face is the classic non-manifold result.
 */
const THROUGH_OVERSHOOT_MM = 0.1;

function cutSpanMm(thickness: number): number {
  return thickness + 2 * THROUGH_OVERSHOOT_MM;
}

/**
 * Build one tool per logical cutout, in a local frame whose origin is the
 * window's front-left corner. The top plane is {@link cutSpanMm}, not the plate
 * thickness — see below.
 *
 * Grouping matches the bin's rules: members of a `groupId` build as one fused
 * (or subtracted) tool, and an `array` on an ungrouped cutout expands to its
 * instances. `combineGroupSolids` sorts a group by `zIndex` for the subtract op,
 * exactly as it does on the bin.
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
  // chamfered opening measures ~0.2mm narrower across than nominal at the surface.
  // That is under one layer per side, and the alternative is a coplanar cut face at the
  // plate's top — which is how non-manifold output happens.
  const surfaceZ = cutSpanMm(thickness);
  const originX = -window.spanW / 2;
  const originY = -window.spanD / 2;

  // `cutDepth` and both scoop radii are the host's business, not the shape's. The
  // radii are stripped rather than passed through because `resolveScoop` caps
  // them against the effective depth, which here is the whole plate: a fillet on
  // a through-cut rounds the tool's BOTTOM edge, so the hole would come out
  // nominal at the top face and pinched at the underside. A scoop rounds a pocket
  // into its floor, and a hole has no floor. Lean is zeroed for the same class
  // of reason: the underside structures and the hole preview assume a vertical
  // bore through the plate.
  const through = (c: Cutout): Cutout => ({
    ...c,
    cutDepth: surfaceZ,
    scoopRadiusW: 0,
    scoopRadiusD: 0,
    leanDeg: 0,
  });

  const groups = new Map<string, Cutout[]>();
  const singles: Cutout[] = [];
  for (const c of shapes) {
    if (c.hidden === true) continue;
    // Text elements cut nothing; their captions are applied by
    // `applyLidTextElements` after the holes.
    if (c.shape === 'text') continue;
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
    tools.push(...buildGroupedCutouts(members.map(through), surfaceZ, originX, originY));
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
    // Each cut allocates a new solid; register it at creation so the scope owns
    // every intermediate rather than only the first. Registering the INPUT here
    // instead would leave the last one unowned — an OCCT handle leaked per
    // generation on every magnetic lid, the shape of defect `disposalRegression`
    // exists to catch.
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
  if (tools.length === 0) return applyLidTextElements(scope, body, cutouts, originToTag);

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

  if (holes.length === 0) return applyLidTextElements(scope, body, cutouts, originToTag);
  scope.register(body);
  const cutBody = unwrap(cutAll(body as ValidSolid, holes as ValidSolid[]));
  // Text AFTER the holes, so a caption engraves into what survives them —
  // the same ordering the bin top and `applyLidText` follow.
  return applyLidTextElements(scope, cutBody, cutouts, originToTag);
}

/**
 * Engrave or emboss the caption of every text-element cutout onto the lid's
 * host face. A text element cuts nothing (`buildTools` skips it); its label IS
 * the feature, centered on the element's footprint at its explicit size, with
 * the element's rotation turning the glyphs. Placement runs in the window
 * frame — the same one the hole tools use — then shifts onto the lid's
 * (possibly overhang-shifted) perimeter. Engrave depth is clamped so a caption
 * can never pierce the plate; a caption that cannot be built is silently
 * skipped, the established convention for undersized features.
 */
function applyLidTextElements(
  scope: DisposalScope,
  body: Shape3D,
  cutouts: LidCutoutInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const texts = cutouts.shapes.filter(
    (c) => c.shape === 'text' && c.hidden !== true && isCutoutEngraveMode(c)
  );
  if (texts.length === 0) return body;

  const { window, topZ, thickness, textDefaults } = cutouts;
  const originX = -window.spanW / 2;
  const originY = -window.spanD / 2;

  let current = body;
  for (const master of texts) {
    for (const instance of labelledInstances(master)) {
      const label = instance.label.trim();
      if (label === '') continue;
      const placement = cutoutLabelPlacement(
        instance,
        window.spanW,
        window.spanD,
        originX,
        originY
      );
      if (!placement) continue;
      // A text element always carries an explicit size, so the band is the
      // room around the caption's center inside the window — never the
      // element's own estimated box.
      const band = expandBandToInterior(placement, window.spanW, window.spanD, originX, originY);
      // Forced onto the fixed path like the bin engraver: a text element's
      // size is explicit by nature, whatever a hand-authored style says.
      const resolved = resolveTextStyle(textDefaults, instance.textStyle);
      const style =
        resolved.sizeMode !== 'fixed' ? { ...resolved, sizeMode: 'fixed' as const } : resolved;
      // Through-cut would stencil the plate; like bin-top captions it degrades
      // to engrave, and the engrave keeps a floor so it cannot pierce.
      const mode = style.mode === 'emboss' ? 'emboss' : 'engrave';
      let depth = style.depth;
      if (mode === 'engrave') {
        depth = Math.min(depth, thickness - LID_TEXT_ENGRAVE_FLOOR);
        if (depth < MIN_ENGRAVE_DEPTH) continue;
      }
      const result = buildTextSolid(scope, {
        text: label,
        style: { ...style, mode, anchor: 'center', offset: ZERO_TEXT_OFFSET },
        availW: band.availW,
        availD: band.availD,
        centerX: placement.centerX + window.offsetX,
        centerY: placement.centerY + window.offsetY,
        topZ,
        depth,
        hostThickness: thickness,
        angleDeg: instance.rotation,
      });
      if (!result) continue;
      if (originToTag) {
        collectOrigins(result.solid, FeatureTag.TEXT, originToTag);
      }
      scope.register(current);
      current =
        result.op === 'fuse'
          ? unwrap(fuse(current as ValidSolid, result.solid as ValidSolid))
          : unwrap(cut(current as ValidSolid, result.solid as ValidSolid));
    }
  }
  return current;
}

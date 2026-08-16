/**
 * Hardware icon silhouettes for swappable label plates (follow-up,
 * gflabel-style). Each icon is a filled 2D drawing imported from the SVG path
 * data in `@/shared/constants/labelIconPaths`, fitted to the plate's readable
 * band by its own silhouette bounds and embossed/debossed exactly like plate
 * text — the caller fuses/cuts the returned solid and tags it for paint_color.
 */

import { cut, isOk, scaleDrawing, translateDrawing } from 'brepjs';
import type { Drawing, Shape3D, ValidSolid } from 'brepjs';
import { LABEL_ICON_PATHS } from '@/shared/constants/labelIconPaths';
import type { LabelIconDef } from '@/shared/constants/labelIconPaths';
import { isLabelPlateIconId } from '@/shared/constants/labelPlates';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import { sketch } from './meshUtils';
import { drawingFromSvgPath } from './svgDrawing';
import { TEXT_BOOLEAN_EPSILON } from './textBuilder';

// Map, not a keyed object: the icon id crosses the worker message boundary,
// and a Map lookup can neither reach the prototype chain nor dispatch to an
// unexpected member on a crafted key (CodeQL js/unvalidated-dynamic-method-call).
// Built on first use, not at module init — traced a boot crash to reading
// an imported constant binding while a chunk cycle still had it undefined.
let iconDefs: ReadonlyMap<LabelPlateIconId, LabelIconDef> | null = null;

function iconDef(icon: LabelPlateIconId): LabelIconDef | null {
  if (!isLabelPlateIconId(icon)) return null;
  iconDefs ??= new Map(Object.entries(LABEL_ICON_PATHS) as [LabelPlateIconId, LabelIconDef][]);
  return iconDefs.get(icon) ?? null;
}

/**
 * Outline only — holes are strictly interior, so they never move the bounding
 * box that sizing and placement are derived from.
 */
function iconOutline(icon: LabelPlateIconId): Drawing | null {
  const def = iconDef(icon);
  return def === null ? null : drawingFromSvgPath(def.outline);
}

export interface IconBox {
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Rendered size of an icon fitted to `heightMm`, width-capped at `maxWidthMm`.
 *
 * Sized from the silhouette's own bounding box, NOT the ±5 design frame: the
 * side-view fasteners only ink 52–68% of that frame vertically (a wood screw
 * spans ±2.6) while a washer fills it, so a shared frame-relative box rendered
 * them at wildly different visual weights. Returns null for an unknown id.
 */
export function measureIconBox(
  icon: LabelPlateIconId,
  heightMm: number,
  maxWidthMm: number
): IconBox | null {
  const outline = iconOutline(icon);
  if (!outline) return null;
  const fit = fitIcon(outline, heightMm, maxWidthMm);
  return fit && { widthMm: fit.width * fit.scale, heightMm: fit.height * fit.scale };
}

interface IconFit {
  readonly scale: number;
  readonly width: number;
  readonly height: number;
  readonly center: readonly [number, number];
}

function fitIcon(raw: Drawing, heightMm: number, maxWidthMm: number): IconFit | null {
  const { width, height, center } = raw.boundingBox;
  if (!(width > 0) || !(height > 0)) return null;
  return { scale: Math.min(heightMm / height, maxWidthMm / width), width, height, center };
}

export interface IconSolidOptions {
  readonly icon: LabelPlateIconId;
  /** Target silhouette height in mm; width follows the icon's own aspect. */
  readonly heightMm: number;
  /** Width ceiling in mm — a wide fastener shrinks rather than crowd the text. */
  readonly maxWidthMm: number;
  /** Icon center on the plate (mm). */
  readonly centerX: number;
  readonly centerY: number;
  /** Plate top face Z (mm). */
  readonly topZ: number;
  /** Emboss height / deboss depth in mm (layer-snapped by the caller). */
  readonly depthMm: number;
  readonly mode: 'emboss' | 'deboss';
}

/**
 * Build the icon as a solid ready to fuse (emboss) or cut (deboss) into the
 * plate top, mirroring `buildTextSolid`'s epsilon conventions. Returns null
 * for an id outside the catalog (worker payloads are untrusted).
 *
 * Bores are cut in 3D, after extrusion, rather than from the 2D outline.
 * brepjs's 2D boolean silently returns the subject unchanged when the outline
 * is a single closed curve and the cutter is strictly interior with no
 * intersections — which is how the washer shipped as a solid disc. The 3D
 * boolean has no such gap, and it also keeps this away from the 2D
 * `drawingCut`s that `generation/README.md` records as corrupting the plate.
 */
export function buildIconSolid(
  options: IconSolidOptions
): { solid: Shape3D; op: 'fuse' | 'cut' } | null {
  const def = iconDef(options.icon);
  if (!def) return null;
  const outline = drawingFromSvgPath(def.outline);
  if (!outline) return null;
  const fit = fitIcon(outline, options.heightMm, options.maxWidthMm);
  if (!fit) return null;
  // Scale about the outline's own centroid, then place it — the design frames
  // are not all symmetric, so scaling about the origin would drift. Holes take
  // the IDENTICAL transform so they stay registered with the outline.
  const [cx, cy] = fit.center;
  const place = (drawing: Drawing): Drawing =>
    translateDrawing(scaleDrawing(drawing, fit.scale, [cx, cy]), [
      options.centerX - cx,
      options.centerY - cy,
    ]);

  const emboss = options.mode === 'emboss';
  const sketchZ = emboss
    ? options.topZ - TEXT_BOOLEAN_EPSILON
    : options.topZ + TEXT_BOOLEAN_EPSILON;
  const extrusion = emboss
    ? options.depthMm + TEXT_BOOLEAN_EPSILON
    : -(options.depthMm + TEXT_BOOLEAN_EPSILON);

  // Only the returned solid outlives this function — the caller registers it in
  // its disposal scope. Every intermediate is native WASM memory that nothing
  // else will reclaim, so each cutter and each superseded solid is deleted here,
  // including on the failure paths.
  let solid = sketch(place(outline), 'XY', sketchZ).extrude(extrusion) as ValidSolid;
  for (const hole of def.holes ?? []) {
    const holeDrawing = drawingFromSvgPath(hole);
    if (!holeDrawing) {
      solid.delete();
      return null;
    }
    // Overshoot both ends so the bore is a clean through-cut rather than a
    // pocket left by coincident faces.
    const cutter = sketch(place(holeDrawing), 'XY', sketchZ - extrusion).extrude(
      extrusion * 3
    ) as ValidSolid;
    const result = cut(solid, cutter);
    cutter.delete();
    if (!isOk(result)) {
      solid.delete();
      return null;
    }
    if (result.value !== solid) solid.delete();
    solid = result.value;
  }
  return { solid, op: emboss ? 'fuse' : 'cut' };
}

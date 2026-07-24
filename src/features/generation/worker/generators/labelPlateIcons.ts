/**
 * Hardware icon silhouettes for swappable label plates (#2666 follow-up,
 * gflabel-style). Each icon is a filled 2D drawing in a local frame spanning
 * ±5 units (fasteners point right, face-on parts are origin-centered), fitted
 * to the plate's readable band by its own silhouette bounds and
 * embossed/debossed exactly like plate text — the caller fuses/cuts the
 * returned solid and tags it for paint_color.
 */

import {
  draw,
  drawCircle,
  drawPolysides,
  drawingCut,
  scaleDrawing,
  translateDrawing,
} from 'brepjs';
import type { Drawing, Shape3D } from 'brepjs';
import { isLabelPlateIconId } from '@/shared/constants/labelPlates';
import type { LabelPlateIconId } from '@/shared/constants/labelPlates';
import { sketch } from './meshUtils';
import { TEXT_BOOLEAN_EPSILON } from './textBuilder';

/** Hex-head bolt, side view: head, shaft, chamfered tip. */
function boltDrawing(): Drawing {
  return draw([-5, -3.4])
    .lineTo([-2.8, -3.4])
    .lineTo([-2.8, -1.5])
    .lineTo([4.2, -1.5])
    .lineTo([5, -0.9])
    .lineTo([5, 0.9])
    .lineTo([4.2, 1.5])
    .lineTo([-2.8, 1.5])
    .lineTo([-2.8, 3.4])
    .lineTo([-5, 3.4])
    .close();
}

/** Countersunk machine screw, side view: flared head, pointed tip. */
function screwDrawing(): Drawing {
  return draw([-5, -3.2])
    .lineTo([-3.6, -1.4])
    .lineTo([3.4, -1.4])
    .lineTo([5, 0])
    .lineTo([3.4, 1.4])
    .lineTo([-3.6, 1.4])
    .lineTo([-5, 3.2])
    .close();
}

/** Pan-head wood screw, side view: wide head + long tapered point. */
function woodScrewDrawing(): Drawing {
  return draw([-5, -2.6])
    .lineTo([-3.4, -2.6])
    .lineTo([-3.4, -1.3])
    .lineTo([1, -1.3])
    .lineTo([5, 0])
    .lineTo([1, 1.3])
    .lineTo([-3.4, 1.3])
    .lineTo([-3.4, 2.6])
    .lineTo([-5, 2.6])
    .close();
}

/** Hex nut, face-on, with the thread bore. */
function nutDrawing(): Drawing {
  return drawingCut(drawPolysides(5, 6), drawCircle(2.4));
}

/** Flat washer, face-on. */
function washerDrawing(): Drawing {
  return drawingCut(drawCircle(5), drawCircle(2.6));
}

/** Round-head nail, side view. */
function nailDrawing(): Drawing {
  return draw([-5, -3])
    .lineTo([-4.3, -3])
    .lineTo([-4.3, -0.8])
    .lineTo([4, -0.8])
    .lineTo([5, 0])
    .lineTo([4, 0.8])
    .lineTo([-4.3, 0.8])
    .lineTo([-4.3, 3])
    .lineTo([-5, 3])
    .close();
}

// Map, not a keyed object: the icon id crosses the worker message boundary,
// and a Map lookup can neither reach the prototype chain nor dispatch to an
// unexpected member on a crafted key (CodeQL js/unvalidated-dynamic-method-call).
const ICON_DRAWINGS: ReadonlyMap<LabelPlateIconId, () => Drawing> = new Map([
  ['bolt', boltDrawing],
  ['screw', screwDrawing],
  ['woodScrew', woodScrewDrawing],
  ['nut', nutDrawing],
  ['washer', washerDrawing],
  ['nail', nailDrawing],
]);

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
  const drawIcon = isLabelPlateIconId(icon) ? ICON_DRAWINGS.get(icon) : undefined;
  if (!drawIcon) return null;
  const fit = fitIcon(drawIcon(), heightMm, maxWidthMm);
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
 */
export function buildIconSolid(
  options: IconSolidOptions
): { solid: Shape3D; op: 'fuse' | 'cut' } | null {
  const drawIcon = isLabelPlateIconId(options.icon) ? ICON_DRAWINGS.get(options.icon) : undefined;
  if (!drawIcon) return null;
  const raw = drawIcon();
  const fit = fitIcon(raw, options.heightMm, options.maxWidthMm);
  if (!fit) return null;
  // Scale about the silhouette's own centroid, then place it — the design
  // frames are not all symmetric, so scaling about the origin would drift.
  const [cx, cy] = fit.center;
  const drawing = translateDrawing(scaleDrawing(raw, fit.scale, [cx, cy]), [
    options.centerX - cx,
    options.centerY - cy,
  ]);
  const sketchZ =
    options.mode === 'emboss'
      ? options.topZ - TEXT_BOOLEAN_EPSILON
      : options.topZ + TEXT_BOOLEAN_EPSILON;
  const extrusion =
    options.mode === 'emboss'
      ? options.depthMm + TEXT_BOOLEAN_EPSILON
      : -(options.depthMm + TEXT_BOOLEAN_EPSILON);
  const solid = sketch(drawing, 'XY', sketchZ).extrude(extrusion);
  return { solid, op: options.mode === 'emboss' ? 'fuse' : 'cut' };
}

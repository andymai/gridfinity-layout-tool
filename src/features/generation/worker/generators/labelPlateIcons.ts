/**
 * Hardware icon silhouettes for swappable label plates (#2666 follow-up,
 * gflabel-style). Each icon is a filled 2D drawing in a local frame spanning
 * ±5 units (fasteners point right, face-on parts are origin-centered), scaled
 * to the plate's icon box and embossed/debossed exactly like plate text —
 * the caller fuses/cuts the returned solid and tags it for paint_color.
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

/** Local frame half-extent every icon is designed in. */
const FRAME_HALF = 5;

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

export interface IconSolidOptions {
  readonly icon: LabelPlateIconId;
  /** Icon box edge length in mm (the icon spans this in both axes). */
  readonly sizeMm: number;
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
  const drawing = translateDrawing(
    scaleDrawing(drawIcon(), options.sizeMm / (2 * FRAME_HALF), [0, 0]),
    [options.centerX, options.centerY]
  );
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

/**
 * Cutouts → standalone SVG, measured in millimetres.
 *
 * The inverse of `svgImport`, written against that parser's own conventions so
 * a file can leave for a vector editor and come back at the same real size:
 * an explicit `<width>mm` over a matching viewBox resolves to a 1:1 user unit,
 * and Y is flipped about the viewBox height the way `flipY` un-flips it.
 *
 * Shapes the importer reads back with their semantics intact are written as
 * native elements — an unrotated box as `<rect>`, an unrotated circle as
 * `<ellipse>` — so they stay round and stay editable as shapes in a vector
 * editor instead of arriving as a sampled polygon. Paths keep their bezier
 * handles. Whatever is left falls back to the ring `cutoutToPolygon` samples.
 *
 * Every outline is the nominal one the editor draws: no clearance, which the
 * worker applies at cut time.
 *
 * No React, no store, no side effects.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { slotCornerRadius } from '@/shared/utils/cutoutPolygon';
import { cutoutToPolygon } from '../booleanGeometry';
import { getPathBounds } from '../pathGeometry';
import { rotatePoint } from '../geometryCore';
import { flattenPath, type Point2D } from '../pathGeometryBezier';

/** Emitted coordinate precision. 3 dp is micron-scale — below any print resolution. */
const DECIMALS = 3;

/** Hairline in mm: visible at real scale without implying a cut width. */
const STROKE_MM = 0.25;

/** An anchor plus the absolute control points of the curve arriving at it. */
interface Vertex {
  readonly point: Point2D;
  /** `[cp1, cp2]` of the incoming cubic, or null when that span is straight. */
  readonly curve: readonly [Point2D, Point2D] | null;
}

/**
 * One closed contour in absolute interior mm, Y-up, already rotated.
 * `closing` is the curve running from the last vertex back to the first.
 */
interface Contour {
  readonly vertices: readonly Vertex[];
  readonly closing: readonly [Point2D, Point2D] | null;
}

function handlePoint(anchor: PathPoint, handle: PathPoint['handleIn']): Point2D {
  return handle
    ? { x: anchor.x + handle.dx, y: anchor.y + handle.dy }
    : { x: anchor.x, y: anchor.y };
}

/**
 * Bezier contour for a path cutout, preserving handles.
 *
 * Rotation is about the vertex-bounds centre and negated, matching
 * `getCutoutOutline` and `PathShapeMesh`: stored rotation is clockwise-positive
 * while `rotatePoint` turns counter-clockwise, and the width/depth box the other
 * shapes rotate about can lag the actual points.
 */
function pathContour(cutout: Cutout): Contour | null {
  const points = cutout.path;
  // `MIN_PATH_POINTS` (2) admits a sliver that bounds no area — two anchors
  // enclose something only when a handle bows the span. Judge the flattened
  // curve, the same rule `cutoutToPolygon` applies to the other shapes.
  if (!points || flattenPath(points).length < 3) return null;

  const bounds = getPathBounds(points);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const turn = (p: Point2D): Point2D =>
    cutout.rotation ? rotatePoint(p.x, p.y, cx, cy, -cutout.rotation) : p;

  const span = (from: PathPoint, to: PathPoint): readonly [Point2D, Point2D] | null =>
    from.handleOut || to.handleIn
      ? [turn(handlePoint(from, from.handleOut)), turn(handlePoint(to, to.handleIn))]
      : null;

  const vertices = points.map((p, i) => ({
    point: turn({ x: p.x, y: p.y }),
    curve: i === 0 ? null : span(points[i - 1], p),
  }));

  return { vertices, closing: span(points[points.length - 1], points[0]) };
}

/** Polyline contour for every non-path shape, from its pathfinder ring. */
function ringContour(cutout: Cutout): Contour | null {
  const polygon = cutoutToPolygon(cutout);
  const ring = polygon?.[0];
  if (!ring || ring.length < 3) return null;
  return {
    vertices: ring.map(([x, y]) => ({ point: { x, y }, curve: null })),
    closing: null,
  };
}

/**
 * A shape ready to emit, in absolute interior mm and Y-up.
 *
 * `rect` and `ellipse` exist because the importer's `convertRect` /
 * `convertEllipse` keep their shape class on the way back in, but only under an
 * identity-or-translate transform — so a rotated one has to be sampled instead,
 * exactly as the importer would have rasterized it.
 */
type Emittable =
  | { readonly kind: 'contour'; readonly contour: Contour }
  | {
      readonly kind: 'rect';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly depth: number;
      readonly radius: number;
    }
  | {
      readonly kind: 'ellipse';
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
    };

function toEmittable(cutout: Cutout): Emittable | null {
  if (cutout.shape === 'path') {
    const contour = pathContour(cutout);
    return contour ? { kind: 'contour', contour } : null;
  }

  if (cutout.rotation === 0 && cutout.width > 0 && cutout.depth > 0) {
    if (cutout.shape === 'circle') {
      return {
        kind: 'ellipse',
        cx: cutout.x + cutout.width / 2,
        cy: cutout.y + cutout.depth / 2,
        rx: cutout.width / 2,
        ry: cutout.depth / 2,
      };
    }
    if (cutout.shape === 'rectangle' || cutout.shape === 'slot' || cutout.shape === 'knifeSlot') {
      const radius =
        cutout.shape === 'rectangle'
          ? cutout.cornerRadius
          : slotCornerRadius(cutout.width, cutout.depth);
      return {
        kind: 'rect',
        x: cutout.x,
        y: cutout.y,
        width: cutout.width,
        depth: cutout.depth,
        radius: Math.max(0, Math.min(radius, cutout.width / 2, cutout.depth / 2)),
      };
    }
  }

  const contour = ringContour(cutout);
  return contour ? { kind: 'contour', contour } : null;
}

/**
 * Extent over anchors and control points alike. A curve can bow past its
 * anchors, and a viewBox that clipped it would re-import at the wrong size.
 */
function extent(shapes: readonly Emittable[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (p: Point2D): void => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };

  const box = (x: number, y: number, w: number, h: number): void => {
    visit({ x, y });
    visit({ x: x + w, y: y + h });
  };

  for (const shape of shapes) {
    if (shape.kind === 'rect') {
      box(shape.x, shape.y, shape.width, shape.depth);
      continue;
    }
    if (shape.kind === 'ellipse') {
      box(shape.cx - shape.rx, shape.cy - shape.ry, shape.rx * 2, shape.ry * 2);
      continue;
    }
    for (const v of shape.contour.vertices) {
      visit(v.point);
      if (v.curve) {
        visit(v.curve[0]);
        visit(v.curve[1]);
      }
    }
    if (shape.contour.closing) {
      visit(shape.contour.closing[0]);
      visit(shape.contour.closing[1]);
    }
  }

  return { minX, minY, maxX, maxY };
}

function num(n: number): string {
  return String(Number(n.toFixed(DECIMALS)));
}

function contourPathData(contour: Contour, offsetX: number, top: number): string {
  const at = (p: Point2D): string => `${num(p.x - offsetX)} ${num(top - p.y)}`;
  const curveTo = (curve: readonly [Point2D, Point2D], to: Point2D): string =>
    `C${at(curve[0])} ${at(curve[1])} ${at(to)}`;

  const parts = contour.vertices.map((v, i) =>
    i === 0 ? `M${at(v.point)}` : v.curve ? curveTo(v.curve, v.point) : `L${at(v.point)}`
  );

  // SVG closes a curved shape by restating the start anchor, which the importer
  // folds back onto the first vertex. A straight closing span needs no command:
  // `Z` already draws it.
  if (contour.closing) parts.push(curveTo(contour.closing, contour.vertices[0].point));

  return `${parts.join(' ')} Z`;
}

/** Emit one shape, translating to the viewBox origin and flipping Y. */
function element(shape: Emittable, offsetX: number, top: number): string {
  if (shape.kind === 'rect') {
    // SVG measures a rect from its TOP edge; a cutout's y is its bottom one.
    const attrs =
      `x="${num(shape.x - offsetX)}" y="${num(top - shape.y - shape.depth)}" ` +
      `width="${num(shape.width)}" height="${num(shape.depth)}"`;
    const rounded = shape.radius > 0 ? ` rx="${num(shape.radius)}"` : '';
    return `<rect ${attrs}${rounded}/>`;
  }
  if (shape.kind === 'ellipse') {
    return (
      `<ellipse cx="${num(shape.cx - offsetX)}" cy="${num(top - shape.cy)}" ` +
      `rx="${num(shape.rx)}" ry="${num(shape.ry)}"/>`
    );
  }
  return `<path d="${contourPathData(shape.contour, offsetX, top)}"/>`;
}

/**
 * Serialize cutouts as one SVG document in millimetres.
 *
 * Returns null when nothing in the selection can be outlined — a text caption,
 * a zero-sized box, a path below three points.
 */
export function cutoutsToSvg(cutouts: readonly Cutout[]): string | null {
  const shapes = cutouts.map(toEmittable).filter((s): s is Emittable => s !== null);
  if (shapes.length === 0) return null;

  const { minX, minY, maxX, maxY } = extent(shapes);
  const width = maxX - minX;
  const height = maxY - minY;
  if (!(width > 0) || !(height > 0)) return null;

  const paths = shapes.map((s) => element(s, minX, maxY)).join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}mm" height="${num(height)}mm" ` +
    `viewBox="0 0 ${num(width)} ${num(height)}">` +
    `<g fill="none" stroke="#000000" stroke-width="${STROKE_MM}">${paths}</g>` +
    `</svg>`
  );
}

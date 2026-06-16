/**
 * Trace a photo that may contain a reference card alongside the tool.
 *
 * Detects the card (on the auto threshold, so the tool slider can't lose it),
 * traces the largest *non-card* component as the tool, and — when a card is
 * present — rectifies the outline through the card homography so it comes out
 * square and in true millimetres. With no card, falls back to the raw pixel
 * outline (the desktop then asks for one real dimension).
 */

import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { ImageDataLike, Point, TraceError } from './types';
import { buildMask } from './mask';
import { labelComponents, maskFromLabel } from './components';
import { traceContour } from './contour';
import { simplifyRdp } from './simplify';
import { polygonArea } from './traceImage';
import { findBestCardComponent, cardHomography, type CardDetectOptions } from './cardDetect';
import { rectifyPoints } from './perspective';

export interface SceneCard {
  readonly corners: readonly [Point, Point, Point, Point];
  readonly fitness: number;
}

export interface SceneTrace {
  /** Tool outline in image pixels — for overlaying on the photo. */
  readonly imagePoints: readonly Point[];
  /** Tool outline to emit: millimetres if a card was found, else pixels. */
  readonly outputPoints: readonly Point[];
  readonly units: 'mm' | 'px';
  readonly card: SceneCard | null;
}

export interface SceneTraceOptions extends CardDetectOptions {
  readonly threshold?: number;
  readonly simplifyTolerance?: number;
  readonly minToolAreaPx?: number;
}

function pointInQuad(x: number, y: number, q: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const a = q[i];
    const b = q[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Zero out the card region so it isn't mistaken for the tool. */
function excludeQuad(
  mask: { data: Uint8Array; width: number; height: number },
  q: readonly Point[]
): void {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(mask.width - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(mask.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInQuad(x, y, q)) mask.data[y * mask.width + x] = 0;
    }
  }
}

export function traceScene(
  image: ImageDataLike,
  options: SceneTraceOptions = {}
): Result<SceneTrace, TraceError> {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return err({ code: 'NO_OBJECT', detail: 'Empty image' });

  // Card detection on the auto threshold (independent of the tool slider).
  const autoLabeled = labelComponents(buildMask(image));
  const card = findBestCardComponent(autoLabeled, width, height, options);

  // Tool mask honors the manual threshold; drop the card region.
  const toolMask = buildMask(image, { threshold: options.threshold });
  if (card) excludeQuad(toolMask, card.corners);
  const toolLabeled = labelComponents(toolMask);

  const minArea = options.minToolAreaPx ?? Math.max(16, Math.round(width * height * 0.0008));
  let toolLabel = -1;
  let toolArea = 0;
  let toolStart: Point | null = null;
  for (const comp of toolLabeled.components) {
    if (comp.area >= minArea && comp.area > toolArea) {
      toolArea = comp.area;
      toolLabel = comp.label;
      toolStart = comp.start;
    }
  }
  if (toolLabel === -1 || !toolStart) {
    return err({ code: 'NO_OBJECT', detail: 'No tool found' });
  }

  const contour = traceContour(
    maskFromLabel(toolLabeled.labels, toolLabel, width, height),
    toolStart
  );
  const tolerance = options.simplifyTolerance ?? Math.max(1, Math.hypot(width, height) * 0.004);
  const imagePoints = simplifyRdp(contour, tolerance);
  if (imagePoints.length < 3 || polygonArea(imagePoints) < 1) {
    return err({ code: 'DEGENERATE', detail: 'Outline collapsed to a line' });
  }

  if (card) {
    const h = cardHomography(card.corners, options.widthMm, options.heightMm);
    if (h) {
      return ok({
        imagePoints,
        outputPoints: rectifyPoints(imagePoints, h),
        units: 'mm',
        card: { corners: card.corners, fitness: card.fitness },
      });
    }
  }

  return ok({ imagePoints, outputPoints: imagePoints, units: 'px', card: null });
}

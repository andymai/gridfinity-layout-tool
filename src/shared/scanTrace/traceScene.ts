/**
 * Trace a photo that may contain a reference card alongside the tool.
 *
 * Two front doors share one tail:
 *  - `traceScene` — classical Otsu mask (fallback when the ML segmenter can't
 *    load). The tool is the largest non-card foreground blob.
 *  - `traceSceneSegmented` — the tool mask comes from the tap-prompted ML
 *    segmenter; we trust it (plus the user's tap) to have isolated the object.
 *
 * Both detect the card on the classical auto threshold, then run the shared
 * `buildToolTrace` tail (largest component → contour → simplify → optional card
 * homography). With a card present the outline is rectified to true millimetres;
 * without one it stays in pixels and the desktop asks for a real dimension.
 */

import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { ImageDataLike, Mask, Point, TraceError } from './types';
import { buildMask } from './mask';
import { largestComponent } from './components';
import { traceContour } from './contour';
import { simplifyRdp } from './simplify';
import { polygonArea } from './traceImage';
import { findCardAcrossChannels, cardHomography, type CardDetectOptions } from './cardDetect';
import { rectifyPoints } from './perspective';
import { smoothPreservingCorners } from './smooth';

const DEFAULT_SMOOTH_ITERATIONS = 2;

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
  /**
   * Smooth the faceted outline (default true): corner-preserving corner-cutting
   * that keeps sharp corners crisp while rounding gentle curves. Pass false for
   * the raw RDP polygon (tests use this to assert exact card-scale geometry).
   */
  readonly smooth?: boolean;
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
function excludeQuad(mask: Mask, q: readonly Point[]): void {
  const data = mask.data;
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(mask.width - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(mask.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInQuad(x, y, q)) data[y * mask.width + x] = 0;
    }
  }
}

function defaultMinArea(width: number, height: number): number {
  return Math.max(16, Math.round(width * height * 0.0008));
}

function defaultTolerance(width: number, height: number): number {
  // ~0.3% of the image diagonal. Loose enough to straighten the per-pixel
  // contour's stair-stepping on straight edges, tight enough to keep small
  // features (a tool's notches/tips) rather than rounding them off.
  return Math.max(1, Math.hypot(width, height) * 0.003);
}

/** Detect the reference card on the classical auto threshold (slider-independent). */
export function detectCard(
  image: ImageDataLike,
  options: SceneTraceOptions = {}
): SceneCard | null {
  const card = findCardAcrossChannels(image, options);
  return card ? { corners: card.corners, fitness: card.fitness } : null;
}

/**
 * Shared tail: a binary tool mask + an optional card → a finished SceneTrace.
 * Picks the largest blob, traces and simplifies it, and (when a card was found)
 * rectifies through the card homography into true millimetres.
 */
export function buildToolTrace(
  toolMask: Mask,
  card: SceneCard | null,
  options: SceneTraceOptions = {}
): Result<SceneTrace, TraceError> {
  const { width, height } = toolMask;
  const component = largestComponent(toolMask);
  const minArea = options.minToolAreaPx ?? defaultMinArea(width, height);
  if (component.start === null || component.area < minArea) {
    return err({ code: 'NO_OBJECT', detail: 'No tool found' });
  }

  const contour = traceContour(component.mask, component.start);
  const tolerance = options.simplifyTolerance ?? defaultTolerance(width, height);
  const simplified = simplifyRdp(contour, tolerance);
  const imagePoints =
    options.smooth === false
      ? simplified
      : smoothPreservingCorners(simplified, DEFAULT_SMOOTH_ITERATIONS);
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
        card,
      });
    }
  }

  return ok({ imagePoints, outputPoints: imagePoints, units: 'px', card: null });
}

/** Classical fallback: Otsu tool mask (largest non-card blob), card excluded. */
export function traceScene(
  image: ImageDataLike,
  options: SceneTraceOptions = {}
): Result<SceneTrace, TraceError> {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return err({ code: 'NO_OBJECT', detail: 'Empty image' });

  const card = detectCard(image, options);
  const toolMask = buildMask(image, { threshold: options.threshold });
  if (card) excludeQuad(toolMask, card.corners);
  return buildToolTrace(toolMask, card, options);
}

/**
 * ML path: the tool mask is supplied by the tap-prompted segmenter. We don't
 * exclude the card region — the user's tap already chose the object — but we
 * still detect the card classically to recover scale.
 */
export function traceSceneSegmented(
  image: ImageDataLike,
  toolMask: Mask,
  options: SceneTraceOptions = {}
): Result<SceneTrace, TraceError> {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return err({ code: 'NO_OBJECT', detail: 'Empty image' });
  const card = detectCard(image, options);
  return buildToolTrace(toolMask, card, options);
}

/**
 * A normalized (0–1) seed point for the segmenter's first, no-tap pass: the
 * centroid of the largest non-card foreground blob, falling back to the image
 * center. The user can always tap to override it.
 */
export function computeAutoSeed(
  image: ImageDataLike,
  options: SceneTraceOptions = {}
): { readonly x: number; readonly y: number } {
  const { width, height } = image;
  const center = { x: 0.5, y: 0.5 };
  if (width <= 0 || height <= 0) return center;

  const card = detectCard(image, options);
  const mask = buildMask(image);
  if (card) excludeQuad(mask, card.corners);
  const component = largestComponent(mask);
  if (component.start === null) return center;

  let sx = 0;
  let sy = 0;
  let count = 0;
  const data = component.mask.data;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 1) {
      sx += i % width;
      sy += (i - (i % width)) / width;
      count++;
    }
  }
  if (count === 0) return center;
  return { x: sx / count / width, y: sy / count / height };
}

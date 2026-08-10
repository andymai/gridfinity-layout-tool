/**
 * Trace a photo that may contain a size reference alongside the tool.
 *
 * Two front doors share one tail:
 *  - `traceScene` — classical Otsu mask (fallback when the ML segmenter can't
 *    load). The tool is the largest foreground blob that isn't the reference.
 *  - `traceSceneSegmented` — the tool mask comes from the tap-prompted ML
 *    segmenter; we trust it (plus the user's tap) to have isolated the object.
 *
 * Both resolve the size reference the same way (`detectReference`) and share the
 * `finishTrace` tail (simplify → curve-fit smooth → optional symmetry → optional
 * rectification). They differ in how the tool contour is obtained: `traceScene`
 * traces the largest component of a binary mask (`buildToolTrace`), while
 * `traceSceneSegmented` traces the soft confidence mask sub-pixel via marching
 * squares (`buildToolTraceSoft`).
 *
 * The reference is the printed calibration sheet when one is in frame and a
 * wallet card otherwise — the sheet first, because it solves the same map from
 * ~18 markers spanning the whole scanned area instead of one quad's four
 * corners. With either the outline is rectified to true millimetres; with
 * neither it stays in pixels and the desktop asks for a real dimension.
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
import { fitSmoothPolygon } from './curveFit';
import { traceSoftContour, binarize, type SoftMask } from './softContour';
import { symmetrizeIfRegular } from './symmetry';
import { detectCalibrationGrid, type GridDetectOptions } from './gridDetect';
import { detectBaseplateGrid, type BaseplateDetectOptions } from './baseplateDetect';
import type { LatticeFit } from './latticeFit';
import type { CellQuad } from './latticeBlobs';

export interface SceneCard {
  readonly corners: readonly [Point, Point, Point, Point];
  readonly fitness: number;
}

/** Which lattice sized the scan — they differ in how much you should trust them. */
export type SceneGridKind = 'sheet' | 'baseplate';

export interface SceneGrid {
  readonly kind: SceneGridKind;
  /** Detected cell outlines in image pixels — for overlaying on the photo. */
  readonly cells: readonly CellQuad[];
  /** How well the over-constrained fit agrees with itself, in millimetres. */
  readonly rmsMm: number;
}

/** Whatever pinned the scene to millimetres. At most one applies. */
export type SceneReference =
  | { readonly kind: SceneGridKind; readonly fit: LatticeFit }
  | { readonly kind: 'card'; readonly card: SceneCard };

export interface SceneTrace {
  /** Tool outline in image pixels — for overlaying on the photo. */
  readonly imagePoints: readonly Point[];
  /** Tool outline to emit: millimetres if a reference was found, else pixels. */
  readonly outputPoints: readonly Point[];
  readonly units: 'mm' | 'px';
  readonly card: SceneCard | null;
  readonly grid: SceneGrid | null;
}

export interface SceneTraceOptions
  extends CardDetectOptions, GridDetectOptions, BaseplateDetectOptions {
  readonly threshold?: number;
  readonly simplifyTolerance?: number;
  readonly minToolAreaPx?: number;
  /**
   * Smooth the faceted outline (default true): fit Bézier curves that keep sharp
   * corners crisp while turning curved runs into clean arcs. Pass false for the
   * raw RDP polygon (tests use this to assert exact card-scale geometry).
   */
  readonly smooth?: boolean;
  /**
   * Symmetrize a manufactured tool's outline when it already reads as mirror-
   * symmetric (default true; ignored when `smooth` is false). Gated on a
   * symmetry score so a genuinely asymmetric tool is never forced symmetric.
   */
  readonly symmetrize?: boolean;
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
  options: SceneTraceOptions = {},
  excludeMask?: Mask
): SceneCard | null {
  const card = findCardAcrossChannels(image, options, excludeMask);
  return card ? { corners: card.corners, fitness: card.fitness } : null;
}

/**
 * Resolve what pins this photo to millimetres, best reference first.
 *
 * The order is an accuracy ranking, not a convenience one:
 *
 *  1. **The printed calibration sheet** — many markers over the whole scanned
 *     area, least-squares fitted, and printed at a size you can verify against
 *     its own 100mm bar.
 *  2. **A Gridfinity baseplate** — the same kind of lattice and the same solve,
 *     but its true pitch depends on the printer that made it, so it is a
 *     convenience rather than a standard (see `baseplateDetect`).
 *  3. **A wallet card** — four coplanar points off to one side of the tool,
 *     which is the minimum a homography admits and the reason this feature
 *     needed the other two.
 *
 * Each detector declines cheaply on a photo without its reference, so the
 * cheaper paths cost nothing extra when a better one is present.
 *
 * `excludeMask` (the tool's own pixels) applies only to the card search — a
 * tool cannot masquerade as a lattice-consistent set of cells.
 */
export function detectReference(
  image: ImageDataLike,
  options: SceneTraceOptions = {},
  excludeMask?: Mask
): SceneReference | null {
  const sheet = detectCalibrationGrid(image, options);
  if (sheet) return { kind: 'sheet', fit: sheet };
  const baseplate = detectBaseplateGrid(image, options);
  if (baseplate) return { kind: 'baseplate', fit: baseplate };
  const card = detectCard(image, options, excludeMask);
  return card ? { kind: 'card', card } : null;
}

/** Every image region the reference occupies, so the tool trace can skip them. */
function referenceQuads(reference: SceneReference | null): readonly (readonly Point[])[] {
  if (!reference) return [];
  return reference.kind === 'card'
    ? [reference.card.corners]
    : reference.fit.cells.map((cell) => cell.outline);
}

/**
 * Shared tail: simplify + smooth a raw contour, optionally symmetrize a
 * manufactured tool's outline, and rectify through the reference's homography.
 */
function finishTrace(
  rawContour: readonly Point[],
  width: number,
  height: number,
  reference: SceneReference | null,
  options: SceneTraceOptions
): Result<SceneTrace, TraceError> {
  const tolerance = options.simplifyTolerance ?? defaultTolerance(width, height);
  // The curve fit reads the RAW contour, not the simplified one. Its error
  // metric only samples the points it is given, so fitting the RDP polygon lets
  // a cubic bow far outside a long straight edge while scoring a perfect fit at
  // the two endpoints that edge was reduced to — a silent OUTWARD offset that
  // measured ~4.5mm on a 68mm tool, dwarfing everything the size reference
  // contributes. Against the dense contour the tolerance means what it says.
  let imagePoints =
    options.smooth === false
      ? simplifyRdp(rawContour, tolerance)
      : fitSmoothPolygon(rawContour, (tolerance * 0.5) ** 2);
  // Clean up the slight lopsidedness of a symmetric tool (controller, pliers).
  // Gated internally on a symmetry score, so an asymmetric tool is untouched.
  if (options.smooth !== false && options.symmetrize !== false) {
    imagePoints = symmetrizeIfRegular(imagePoints);
  }
  if (imagePoints.length < 3 || polygonArea(imagePoints) < 1) {
    return err({ code: 'DEGENERATE', detail: 'Outline collapsed to a line' });
  }

  if (reference?.kind === 'sheet' || reference?.kind === 'baseplate') {
    const { fit } = reference;
    return ok({
      imagePoints,
      outputPoints: rectifyPoints(imagePoints, fit.homography),
      units: 'mm',
      card: null,
      grid: {
        kind: reference.kind,
        cells: fit.cells.map((cell) => cell.outline),
        rmsMm: fit.rmsMm,
      },
    });
  }

  if (reference?.kind === 'card') {
    const { card } = reference;
    const h = cardHomography(card.corners, options.widthMm, options.heightMm);
    if (h) {
      return ok({
        imagePoints,
        outputPoints: rectifyPoints(imagePoints, h),
        units: 'mm',
        card,
        grid: null,
      });
    }
  }

  return ok({ imagePoints, outputPoints: imagePoints, units: 'px', card: null, grid: null });
}

/**
 * Re-rectify a finished trace against different reference-card dimensions.
 *
 * The card's image corners are already solved, so only the image→mm map
 * changes: no re-detection and no re-segmentation. Cheap enough to re-run on
 * every keystroke while the user types a caliper-measured card size.
 *
 * A no-op on a scene sized by the calibration sheet: the sheet's dimensions are
 * printed, not measured, so there is nothing for the user to correct.
 */
export function withCardSize(scene: SceneTrace, widthMm: number, heightMm: number): SceneTrace {
  if (!scene.card) return scene;
  const h = cardHomography(scene.card.corners, widthMm, heightMm);
  if (!h) return scene;
  return { ...scene, outputPoints: rectifyPoints(scene.imagePoints, h), units: 'mm' };
}

export function buildToolTrace(
  toolMask: Mask,
  reference: SceneReference | null,
  options: SceneTraceOptions = {}
): Result<SceneTrace, TraceError> {
  const { width, height } = toolMask;
  const component = largestComponent(toolMask);
  const minArea = options.minToolAreaPx ?? defaultMinArea(width, height);
  if (component.start === null || component.area < minArea) {
    return err({ code: 'NO_OBJECT', detail: 'No tool found' });
  }
  return finishTrace(
    traceContour(component.mask, component.start),
    width,
    height,
    reference,
    options
  );
}

/**
 * Soft-mask tool trace: a sub-pixel marching-squares contour of the segmenter's
 * confidence field, instead of boundary-tracing a thresholded binary mask. The
 * 0.5 iso-contour places each vertex where the model's probability actually
 * crosses, removing the ±0.5px staircase the binary trace bakes in.
 */
export function buildToolTraceSoft(
  toolSoft: SoftMask,
  reference: SceneReference | null,
  options: SceneTraceOptions = {}
): Result<SceneTrace, TraceError> {
  const { width, height } = toolSoft;
  const contour = traceSoftContour(toolSoft);
  const minArea = options.minToolAreaPx ?? defaultMinArea(width, height);
  if (contour.length < 3 || polygonArea(contour) < minArea) {
    return err({ code: 'NO_OBJECT', detail: 'No tool found' });
  }
  return finishTrace(contour, width, height, reference, options);
}

/**
 * Classical fallback: Otsu tool mask (largest blob that isn't the reference).
 *
 * The reference's regions are zeroed before the largest blob is picked. With a
 * calibration sheet that is every marker: the sheet's markers are printed black
 * and so are foreground on the same threshold the tool is, and a marker left in
 * would out-mass a small tool or graft itself onto a large one.
 *
 * Known limit, and the reason the sheet asks you to lay the tool INSIDE its
 * marker frame: only DETECTED cells can be excluded, and a cell the tool
 * half-covers never gets detected — it merges with the tool. Its uncovered
 * sliver then reads as part of the silhouette and the tool measures oversize.
 * This bites hardest on a baseplate, where the tool necessarily sits on top of
 * the sockets. The cells cannot simply be excluded wholesale either: on a
 * baseplate the tool occupies the same image region, so blanking every expected
 * cell would eat the tool. The ML path (`traceSceneSegmented`) is unaffected —
 * its mask comes from the segmenter, not from a threshold.
 */
export function traceScene(
  image: ImageDataLike,
  options: SceneTraceOptions = {}
): Result<SceneTrace, TraceError> {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return err({ code: 'NO_OBJECT', detail: 'Empty image' });

  const reference = detectReference(image, options);
  const toolMask = buildMask(image, { threshold: options.threshold });
  for (const quad of referenceQuads(reference)) excludeQuad(toolMask, quad);
  return buildToolTrace(toolMask, reference, options);
}

/**
 * ML path: the tool mask is supplied by the tap-prompted segmenter. We exclude
 * the tool's own pixels from card detection so a card-shaped tool can't be
 * mistaken for the reference card — the user already chose the tool, so the card
 * must be a different object. Scale is still recovered classically.
 */
export function traceSceneSegmented(
  image: ImageDataLike,
  toolMask: SoftMask,
  options: SceneTraceOptions = {}
): Result<SceneTrace, TraceError> {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return err({ code: 'NO_OBJECT', detail: 'Empty image' });
  const reference = detectReference(image, options, binarize(toolMask));
  return buildToolTraceSoft(toolMask, reference, options);
}

/**
 * A normalized (0–1) seed point for the segmenter's first, no-tap pass: the
 * centroid of the largest foreground blob that isn't part of the size
 * reference, falling back to the image center. The user can always tap to
 * override it.
 */
export function computeAutoSeed(
  image: ImageDataLike,
  options: SceneTraceOptions = {}
): { readonly x: number; readonly y: number } {
  const { width, height } = image;
  const center = { x: 0.5, y: 0.5 };
  if (width <= 0 || height <= 0) return center;

  const reference = detectReference(image, options);
  const mask = buildMask(image);
  for (const quad of referenceQuads(reference)) excludeQuad(mask, quad);
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

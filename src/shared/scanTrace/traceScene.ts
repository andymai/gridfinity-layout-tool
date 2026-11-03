/**
 * Trace a photo that may contain a size reference alongside the tool.
 *
 * Two front doors share one tail:
 *  - `traceScene` — the colour segmenter (`colorSegment`) finds every tool in
 *    the photo that isn't the reference.
 *  - `traceSceneSegmented` — one tool's mask comes from the tap-prompted ML
 *    segmenter; we trust it (plus the user's tap) to have isolated the object.
 *
 * Both resolve the size reference the same way (`detectReference`) and share the
 * `finishTrace` tail (simplify → curve-fit smooth → optional symmetry → optional
 * rectification). They differ in how the tool contours are obtained:
 * `traceScene` traces every piece of a binary mask (`findToolBlobs`), while
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
import { polygonArea } from './traceImage';
import { findCardAcrossChannels, cardHomography, type CardDetectOptions } from './cardDetect';
import { invertHomography, rectifyPoints, solveHomography, type Homography } from './perspective';
import { smoothRing } from './curveFit';
import { traceSoftContour, binarize, type SoftMask } from './softContour';
import { symmetrizeIfRegular } from './symmetry';
import { detectCalibrationGrid, type GridDetectOptions } from './gridDetect';
import { detectBaseplateGrid, type BaseplateDetectOptions } from './baseplateDetect';
import type { LatticeFit } from './latticeFit';
import type { CellQuad } from './latticeBlobs';
import { segmentTools } from './colorSegment';
import { findToolBlobs, interiorSeed, pointInPolygon } from './toolBlobs';
import { convexHull, minAreaRect } from './minAreaRect';
import {
  bridgeAcrossStrip,
  bridgeSoftAcrossStrip,
  detectMarkerStrip,
  touchesStrip,
  type SceneStrip,
} from './measuringStrip';

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

/** Two points marked on the photo and the real distance between them. */
export interface SceneRuler {
  readonly a: Point;
  readonly b: Point;
  readonly lengthMm: number;
}

/** A sheet of paper's corners as marked, ordered [TL, TR, BR, BL]. */
export interface ScenePaper {
  readonly corners: readonly [Point, Point, Point, Point];
  /** The sheet's real length along TL→TR. */
  readonly widthMm: number;
  /** The sheet's real length along TL→BL. */
  readonly heightMm: number;
}

/** Whatever pinned the scene to millimetres. At most one applies. */
export type SceneReference =
  | { readonly kind: SceneGridKind; readonly fit: LatticeFit }
  | { readonly kind: 'card'; readonly card: SceneCard }
  | { readonly kind: 'ruler'; readonly ruler: SceneRuler }
  | { readonly kind: 'paper'; readonly paper: ScenePaper }
  | {
      readonly kind: 'strip';
      readonly strip: SceneStrip;
      /** A calibration sheet under the tool, which still bounds the search and its markers. */
      readonly sheet?: LatticeFit;
    };

export interface SceneRing {
  /** In image pixels — for overlaying on the photo. */
  readonly imagePoints: readonly Point[];
  /** To emit: millimetres if a reference was found, else pixels. */
  readonly outputPoints: readonly Point[];
}

export interface SceneShape extends SceneRing {
  /** Where the surface shows through the tool, such as inside a ring. */
  readonly holes?: readonly SceneRing[];
  /** Lies in another shape's hole: a tool of its own only while holes are kept. */
  readonly inHole?: boolean;
  /** Reaches the measuring strip, so its edge there was bridged and wants a look. */
  readonly underStrip?: boolean;
}

/** Narrowest hole kept, across its short axis, once the reference gives millimetres. */
const MIN_HOLE_MM = 2.5;
/** The same in pixels, for a photo with no reference. */
const MIN_HOLE_WIDTH_PX = 8;

/**
 * The holes of `shape` wide enough to leave an island standing. A narrower
 * one is no use to a pocket, and a glint on a shiny tool is usually one.
 * Judged where it is used, not where it is traced, so a corrected card size
 * re-judges every hole.
 */
export function wideHoles(shape: SceneShape, units: 'mm' | 'px'): SceneRing[] {
  const least = units === 'mm' ? MIN_HOLE_MM : MIN_HOLE_WIDTH_PX;
  return (shape.holes ?? []).filter(
    (hole) => (minAreaRect(hole.outputPoints)?.height ?? 0) >= least
  );
}

/** A shape still in image pixels, before the reference sizes it. */
interface Outline {
  readonly imagePoints: readonly Point[];
  readonly holes: readonly (readonly Point[])[];
  readonly inHole: boolean;
  /** Bridged under a strip before, so still worth a look once the scale changes. */
  readonly underStrip?: boolean;
}

export interface SceneTrace {
  /** Every tool found, largest first; never empty. */
  readonly shapes: readonly SceneShape[];
  readonly units: 'mm' | 'px';
  readonly card: SceneCard | null;
  readonly grid: SceneGrid | null;
  /** What sized the scene, so a tool traced later lands in the same frame. */
  readonly reference: SceneReference | null;
}

export interface SceneTraceOptions
  extends CardDetectOptions, GridDetectOptions, BaseplateDetectOptions {
  /** The colour segmenter's sensitivity, -127 to 128; 0 is automatic. */
  readonly sensitivity?: number;
  /** Where to look, in image pixels, in place of the reference's own search area. */
  readonly region?: readonly Point[];
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
  // A strip on the tool measures it at its own height, so it wins over a sheet
  // under it, whose rows of markers it would otherwise be read from.
  const strip = detectMarkerStrip(image, sheet ? sheet.cells.map((cell) => cell.outline) : []);
  if (strip) return { kind: 'strip', strip, ...(sheet ? { sheet } : {}) };
  if (sheet) return { kind: 'sheet', fit: sheet };
  const baseplate = detectBaseplateGrid(image, options);
  if (baseplate) return { kind: 'baseplate', fit: baseplate };
  const card = detectCard(image, options, excludeMask);
  return card ? { kind: 'card', card } : null;
}

/**
 * Every image region the reference occupies, so the tool trace can skip them.
 * A ruler marks a distance, not an object, and paper is the surface itself.
 */
function referenceQuads(reference: SceneReference | null): readonly (readonly Point[])[] {
  switch (reference?.kind) {
    case 'card':
      return [reference.card.corners];
    case 'sheet':
    case 'baseplate':
      return reference.fit.cells.map((cell) => cell.outline);
    case 'strip':
      return [reference.strip.paper, ...(reference.sheet?.cells.map((cell) => cell.outline) ?? [])];
    default:
      return [];
  }
}

/** How far marked paper corners are pulled in, as a share of the way to the middle. */
const PAPER_INSET = 0.02;

/**
 * Where the tools can be. A lattice frames them, and its outer hull keeps the
 * table around a sheet out of the surface sample, where it would make the
 * white paper read as one giant tool. Marked paper does the same, pulled in a
 * little so a corner clicked onto the table still samples paper. A card lies
 * beside the tool on the same surface, so the whole frame is the search.
 */
function searchRegion(reference: SceneReference | null): readonly Point[] | undefined {
  switch (reference?.kind) {
    case 'sheet':
    case 'baseplate':
      return convexHull(reference.fit.cells.flatMap((cell) => cell.outline));
    case 'strip':
      return reference.sheet
        ? convexHull(reference.sheet.cells.flatMap((cell) => cell.outline))
        : undefined;
    case 'paper': {
      const { corners } = reference.paper;
      const cx = corners.reduce((sum, p) => sum + p.x, 0) / 4;
      const cy = corners.reduce((sum, p) => sum + p.y, 0) / 4;
      return corners.map((p) => ({
        x: p.x + (cx - p.x) * PAPER_INSET,
        y: p.y + (cy - p.y) * PAPER_INSET,
      }));
    }
    default:
      return undefined;
  }
}

/** The reference's map from image pixels to millimetres, or null when there is none. */
function referenceHomography(
  reference: SceneReference | null,
  options: SceneTraceOptions
): Homography | null {
  switch (reference?.kind) {
    case 'sheet':
    case 'baseplate':
      return reference.fit.homography;
    case 'card':
      return cardHomography(reference.card.corners, options.widthMm, options.heightMm);
    case 'paper': {
      const { corners, widthMm: w, heightMm: h } = reference.paper;
      return solveHomography(corners, [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ]);
    }
    case 'ruler':
    case 'strip': {
      const { a, b, lengthMm } = reference.kind === 'ruler' ? reference.ruler : reference.strip;
      const px = Math.hypot(b.x - a.x, b.y - a.y);
      if (!(px > 0 && lengthMm > 0)) return null;
      const k = lengthMm / px;
      return [k, 0, 0, 0, k, 0, 0, 0, 1];
    }
    default:
      return null;
  }
}

/** Image pixels to millimetres, or null when the scene has no reference. */
function referenceToMm(
  reference: SceneReference | null,
  options: SceneTraceOptions
): ((points: readonly Point[]) => Point[]) | null {
  const h = referenceHomography(reference, options);
  return h ? (points) => rectifyPoints(points, h) : null;
}

/**
 * Millimetres back to image pixels, for drawing an outline worked on in
 * millimetres over the photo it came from. Null with no reference.
 */
export function referenceToImage(
  reference: SceneReference | null,
  options: SceneTraceOptions = {}
): ((points: readonly Point[]) => Point[]) | null {
  const h = referenceHomography(reference, options);
  const back = h ? invertHomography(h) : null;
  return back ? (points) => rectifyPoints(points, back) : null;
}

/**
 * Shared tail: simplify + smooth each raw contour, optionally symmetrize a
 * manufactured tool's outline, and rectify through the reference's homography.
 */
function finishTrace(
  raw: readonly {
    readonly contour: readonly Point[];
    readonly holes?: readonly (readonly Point[])[];
    readonly inHole?: boolean;
  }[],
  width: number,
  height: number,
  reference: SceneReference | null,
  options: SceneTraceOptions
): Result<SceneTrace, TraceError> {
  const tolerance = options.simplifyTolerance ?? defaultTolerance(width, height);
  const smooth = (ring: readonly Point[]): Point[] =>
    smoothRing(ring, tolerance, options.smooth !== false);
  const outlines: Outline[] = [];
  for (const { contour: rawContour, holes = [], inHole = false } of raw) {
    // The curve fit reads the RAW contour, not the simplified one. Its error
    // metric only samples the points it is given, so fitting the RDP polygon lets
    // a cubic bow far outside a long straight edge while scoring a perfect fit at
    // the two endpoints that edge was reduced to — a silent OUTWARD offset that
    // measured ~4.5mm on a 68mm tool, dwarfing everything the size reference
    // contributes. Against the dense contour the tolerance means what it says.
    let imagePoints = smooth(rawContour);
    // Clean up the slight lopsidedness of a symmetric tool (controller, pliers).
    // Gated internally on a symmetry score, so an asymmetric tool is untouched.
    if (options.smooth !== false && options.symmetrize !== false) {
      imagePoints = symmetrizeIfRegular(imagePoints);
    }
    const kept = holes.map(smooth).filter((h) => h.length >= 3 && polygonArea(h) >= 1);
    if (imagePoints.length >= 3 && polygonArea(imagePoints) >= 1) {
      outlines.push({ imagePoints, holes: kept, inHole });
    }
  }
  if (outlines.length === 0) {
    return err({ code: 'DEGENERATE', detail: 'Outline collapsed to a line' });
  }

  return ok(sized(outlines, reference, options));
}

/** Outlines in image pixels, framed and sized by `reference`. */
function sized(
  outlines: readonly Outline[],
  reference: SceneReference | null,
  options: SceneTraceOptions
): SceneTrace {
  const toMm = referenceToMm(reference, options);
  const ring = (imagePoints: readonly Point[]): SceneRing => ({
    imagePoints,
    outputPoints: toMm ? toMm(imagePoints) : imagePoints,
  });
  const shapes = outlines.map(({ imagePoints, holes, inHole, underStrip }): SceneShape => ({
    ...ring(imagePoints),
    ...(holes.length > 0 ? { holes: holes.map(ring) } : {}),
    ...(inHole ? { inHole: true } : {}),
    ...(underStrip || (reference?.kind === 'strip' && touchesStrip(imagePoints, reference.strip))
      ? { underStrip: true }
      : {}),
  }));
  const lattice = reference?.kind === 'sheet' || reference?.kind === 'baseplate' ? reference : null;
  return {
    shapes,
    units: toMm ? 'mm' : 'px',
    card: reference?.kind === 'card' && toMm ? reference.card : null,
    grid: lattice
      ? {
          kind: lattice.kind,
          cells: lattice.fit.cells.map((cell) => cell.outline),
          rmsMm: lattice.fit.rmsMm,
        }
      : null,
    reference,
  };
}

/**
 * `scene` sized by a different reference, its outlines otherwise kept, so a
 * tool the user removed stays removed. An outline lying on the new reference
 * goes: it was that card, traced as a tool while another object was taken
 * for the card.
 */
export function withReference(
  scene: SceneTrace,
  reference: SceneReference | null,
  options: SceneTraceOptions = {}
): SceneTrace {
  // A strip lies on a tool, so what is under it is no reference object.
  const quads =
    reference?.kind === 'strip'
      ? (reference.sheet?.cells.map((cell) => cell.outline) ?? [])
      : referenceQuads(reference);
  const outlines = scene.shapes
    .filter(({ imagePoints, holes }) => {
      // In pixels: a 1 × 1 frame leaves the seed unnormalised. On the material,
      // so a card lying in a coil's hole does not take the coil with it.
      const seed = interiorSeed(
        imagePoints,
        1,
        1,
        (holes ?? []).map((h) => h.imagePoints)
      );
      return !quads.some((quad) => pointInPolygon(seed, quad));
    })
    .map((shape) => ({
      imagePoints: shape.imagePoints,
      holes: (shape.holes ?? []).map((h) => h.imagePoints),
      inHole: shape.inHole === true,
      underStrip: shape.underStrip === true,
    }));
  return sized(outlines, reference, options);
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
  return {
    ...scene,
    shapes: scene.shapes.map((shape) => ({
      ...shape,
      outputPoints: rectifyPoints(shape.imagePoints, h),
      ...(shape.holes
        ? {
            holes: shape.holes.map((hole) => ({
              ...hole,
              outputPoints: rectifyPoints(hole.imagePoints, h),
            })),
          }
        : {}),
    })),
    units: 'mm',
  };
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
  // The outline comes sub-pixel from the confidence field; its holes from the
  // same field thresholded, as the colour pass finds them. The contour is the
  // loop enclosing most, so the holes come from the piece whose outline does,
  // not the one with most pixels: a thin ring round a solid piece has fewer.
  const blobs = findToolBlobs(binarize(toolSoft), minArea);
  const owner = blobs.reduce<(typeof blobs)[number] | undefined>(
    (best, b) => (!best || polygonArea(b.contour) > polygonArea(best.contour) ? b : best),
    undefined
  );
  const holes = owner?.holes ?? [];
  return finishTrace([{ contour, holes }], width, height, reference, options);
}

/**
 * Classical path: every tool the colour segmenter finds that isn't the
 * reference, largest first.
 *
 * The reference's regions are left out of the segmentation. With a calibration
 * sheet that is every marker: they are printed black, so they score as far
 * from the paper as a tool does, and a marker left in would trace as a tool of
 * its own or graft itself onto a real one.
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
 *
 * `reference` skips detection, for re-tracing against one already solved.
 */
export function traceScene(
  image: ImageDataLike,
  options: SceneTraceOptions = {},
  reference: SceneReference | null = detectReference(image, options)
): Result<SceneTrace, TraceError> {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return err({ code: 'NO_OBJECT', detail: 'Empty image' });

  const toolMask = segmentTools(image, {
    sensitivity: options.sensitivity,
    region: options.region ?? searchRegion(reference),
    exclude: referenceQuads(reference),
  });
  const mask =
    reference?.kind === 'strip' ? bridgeAcrossStrip(toolMask, reference.strip) : toolMask;
  const blobs = findToolBlobs(mask, options.minToolAreaPx ?? defaultMinArea(width, height));
  if (blobs.length === 0) return err({ code: 'NO_OBJECT', detail: 'No tool found' });
  return finishTrace(blobs, width, height, reference, options);
}

/**
 * ML path: the tool mask is supplied by the tap-prompted segmenter. We exclude
 * the tool's own pixels from card detection so a card-shaped tool can't be
 * mistaken for the reference card — the user already chose the tool, so the card
 * must be a different object. Scale is still recovered classically.
 *
 * `reference` skips detection, for adding a tool to a scene already sized.
 */
export function traceSceneSegmented(
  image: ImageDataLike,
  toolMask: SoftMask,
  options: SceneTraceOptions = {},
  reference: SceneReference | null = detectReference(image, options, binarize(toolMask))
): Result<SceneTrace, TraceError> {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return err({ code: 'NO_OBJECT', detail: 'Empty image' });
  const mask =
    reference?.kind === 'strip' ? bridgeSoftAcrossStrip(toolMask, reference.strip) : toolMask;
  return buildToolTraceSoft(mask, reference, options);
}

const samePoints = (a: readonly Point[], b: readonly Point[]): boolean =>
  a.length === b.length && a.every((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y) < 0.5);

/**
 * True when two solved references size the photo the same way. Only the card
 * search reads the tool mask, so a lattice is the same lattice on every pass.
 */
export function sameReference(a: SceneReference | null, b: SceneReference | null): boolean {
  if (a === null || b === null) return a === b;
  switch (a.kind) {
    case 'card':
      return b.kind === 'card' && samePoints(a.card.corners, b.card.corners);
    case 'ruler':
      return (
        b.kind === 'ruler' &&
        a.ruler.lengthMm === b.ruler.lengthMm &&
        samePoints([a.ruler.a, a.ruler.b], [b.ruler.a, b.ruler.b])
      );
    case 'strip':
      return (
        b.kind === 'strip' &&
        a.strip.lengthMm === b.strip.lengthMm &&
        samePoints([a.strip.a, a.strip.b], [b.strip.a, b.strip.b])
      );
    case 'paper':
      return (
        b.kind === 'paper' &&
        a.paper.widthMm === b.paper.widthMm &&
        a.paper.heightMm === b.paper.heightMm &&
        samePoints(a.paper.corners, b.paper.corners)
      );
    default:
      return a.kind === b.kind;
  }
}

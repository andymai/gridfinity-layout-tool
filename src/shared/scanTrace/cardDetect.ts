/**
 * Detect a reference card in a photo and derive the image→mm homography.
 *
 * Reuses the tracer's own pipeline (mask → components → contour) to find every
 * object, then picks whichever component is the cleanest quadrilateral — the
 * card — and maps its corners to the card's true size. The returned homography
 * rectifies the whole plane: apply it to the traced tool outline and you get a
 * square, metric outline with no separate scale step.
 *
 * Lightweight by design — no OpenCV. ISO-7810 card = 85.6 × 53.98 mm.
 */

import type { ImageDataLike, Point } from './types';
import { buildMask, usesAlphaMask } from './mask';
import { labelComponents, maskFromLabel, type LabeledComponents } from './components';
import { traceContour } from './contour';
import { contourToQuad, estimateRectAspect } from './quad';
import { solveHomography, type Homography } from './perspective';

export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 53.98;
const CARD_ASPECT = CARD_WIDTH_MM / CARD_HEIGHT_MM; // ≈ 1.586

export interface CardDetection {
  readonly corners: readonly [Point, Point, Point, Point];
  /** Maps image pixels → millimetres on the card's plane. */
  readonly homography: Homography;
  readonly fitness: number;
}

export interface CardDetectOptions {
  /** Minimum quad fitness (0–1) to accept a component as the card. */
  readonly minFitness?: number;
  /** Ignore components smaller than this fraction of the image. */
  readonly minAreaFraction?: number;
  /** Max deviation of the recovered aspect ratio from the card's (≈1.586). */
  readonly aspectTolerance?: number;
  readonly widthMm?: number;
  readonly heightMm?: number;
}

/**
 * Homography mapping the four detected image corners to the card's real-world
 * rectangle. The card's long edge (85.6mm) is aligned to whichever image edge
 * is longer, so landscape and portrait placements both resolve correctly.
 */
export function cardHomography(
  corners: readonly [Point, Point, Point, Point],
  widthMm: number = CARD_WIDTH_MM,
  heightMm: number = CARD_HEIGHT_MM
): Homography | null {
  const [tl, tr, , bl] = corners;
  const topLen = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const leftLen = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const landscape = topLen >= leftLen;
  const dstW = landscape ? widthMm : heightMm;
  const dstH = landscape ? heightMm : widthMm;

  const dst: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH },
  ];
  return solveHomography(corners, dst);
}

/**
 * Skew above this reads as a steeply-tilted shot — worth warning the user that
 * sizing accuracy suffers. ~0.2 ≈ a 20% opposite-edge-length divergence, well
 * clear of corner-detection noise on a flat shot.
 */
export const STEEP_CARD_SKEW = 0.2;

/**
 * How keystoned the detected card is (0 = shot straight down, higher = steeper
 * tilt). A fronto-parallel rectangle has equal-length opposite edges; out-of-
 * plane tilt makes them diverge, so the largest relative opposite-edge-length
 * difference is a cheap, rotation-invariant proxy for perspective tilt.
 *
 * The homography still rectifies the card plane exactly, but at steep angles
 * corner-detection error and the tool's own thickness (parallax off the card
 * plane) degrade real-world accuracy — worth nudging the user to shoot flatter.
 */
export function cardPerspectiveSkew(corners: readonly [Point, Point, Point, Point]): number {
  const [tl, tr, br, bl] = corners;
  const len = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
  const rel = (a: number, b: number): number => {
    const m = Math.max(a, b);
    return m > 0 ? Math.abs(a - b) / m : 0;
  };
  return Math.max(rel(len(tl, tr), len(bl, br)), rel(len(tl, bl), len(tr, br)));
}

export interface CardComponent {
  readonly label: number;
  readonly corners: readonly [Point, Point, Point, Point];
  readonly fitness: number;
}

/**
 * Pick the labeled component that is the cleanest, largest-enough quadrilateral.
 * Shared by `detectCardQuad` and the scene tracer (which also needs the card's
 * label so it can exclude it when tracing the tool).
 */
export function findBestCardComponent(
  labeled: LabeledComponents,
  width: number,
  height: number,
  options: CardDetectOptions = {}
): CardComponent | null {
  const minFitness = options.minFitness ?? 0.8;
  const minArea = (options.minAreaFraction ?? 0.01) * width * height;
  const aspectTolerance = options.aspectTolerance ?? 0.3;
  const targetAspect =
    options.widthMm && options.heightMm
      ? Math.max(options.widthMm, options.heightMm) / Math.min(options.widthMm, options.heightMm)
      : CARD_ASPECT;
  const cx = width / 2;
  const cy = height / 2;

  let best: CardComponent | null = null;
  for (const comp of labeled.components) {
    if (comp.area < minArea) continue;
    const contour = traceContour(
      maskFromLabel(labeled.labels, comp.label, width, height),
      comp.start
    );
    const quad = contourToQuad(contour);
    if (!quad || quad.fitness < minFitness) continue;

    // Reject quads whose true (perspective-corrected) shape isn't the card's
    // aspect — keeps a rectangular tool from being mistaken for the reference.
    const aspect = estimateRectAspect(quad.corners, cx, cy);
    if (aspect === null || Math.abs(aspect - targetAspect) > aspectTolerance) continue;

    if (!best || quad.fitness > best.fitness) {
      best = { label: comp.label, corners: quad.corners, fitness: quad.fitness };
    }
  }
  return best;
}

/**
 * The card is a clean quad in whichever channel happens to separate it from its
 * background — brightness for a dark card on a pale desk, colorfulness for a
 * neutral metal card on wood. Sweep luma first, then chroma, taking the first
 * channel that yields an accepted card. Luma-first keeps the chroma pass purely
 * additive: any photo a brightness threshold already solved is untouched, so
 * adding chroma can only recover cards luma missed, never regress a working one.
 */
const CARD_CHANNELS = ['luma', 'chroma'] as const;

export function findCardAcrossChannels(
  image: ImageDataLike,
  options: CardDetectOptions = {}
): CardComponent | null {
  // An alpha-driven mask ignores `channel`, so every pass is identical — sweep once.
  const channels = usesAlphaMask(image) ? (['luma'] as const) : CARD_CHANNELS;
  for (const channel of channels) {
    const labeled = labelComponents(buildMask(image, { channel }));
    const card = findBestCardComponent(labeled, image.width, image.height, options);
    if (card) return card;
  }
  return null;
}

export function detectCardQuad(
  image: ImageDataLike,
  options: CardDetectOptions = {}
): CardDetection | null {
  const card = findCardAcrossChannels(image, options);
  if (!card) return null;

  const homography = cardHomography(card.corners, options.widthMm, options.heightMm);
  if (!homography) return null;
  return { corners: card.corners, homography, fitness: card.fitness };
}

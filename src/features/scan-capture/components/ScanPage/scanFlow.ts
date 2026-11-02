/**
 * The phone's trace passes: find every tool, let the model redraw each, and
 * fold a tap into the scene.
 */

import { isOk } from '@/core/result';
import {
  interiorSeed,
  pointsToSvgPath,
  sameReference,
  segmentAt,
  traceScene,
  traceSceneSegmented,
  withRefinedShape,
  type ImageDataLike,
  type Point,
  type SceneShape,
  type SceneTrace,
  type SceneTraceOptions,
  type SoftMask,
} from '@/shared/scanTrace';

/**
 * The model redraws at most this many tools on its own. A busy surface can
 * turn up dozens of pieces, and each pass takes a noticeable moment on a phone.
 */
export const MAX_AUTO_REFINE = 8;

export interface TracedScene {
  readonly scene: SceneTrace;
  /** False when the model could not run, so a tap would do nothing. */
  readonly canRefine: boolean;
}

/**
 * Every tool in the photo. The colour pass finds them and the model redraws
 * each, keeping a redraw only where it agrees; when the colour pass finds
 * nothing, the model tries the middle of the frame.
 */
export async function traceAll(
  canvas: HTMLCanvasElement,
  image: ImageDataLike,
  options: SceneTraceOptions
): Promise<TracedScene | null> {
  const classical = traceScene(image, options);
  if (!isOk(classical)) {
    try {
      const soft = await segmentAt(canvas, { x: 0.5, y: 0.5 });
      const traced = traceSceneSegmented(image, soft, options);
      return isOk(traced) ? { scene: traced.value, canRefine: true } : null;
    } catch {
      return null;
    }
  }
  let scene = classical.value;
  for (const shape of scene.shapes.slice(0, MAX_AUTO_REFINE)) {
    const index = scene.shapes.indexOf(shape);
    // Already folded into an earlier redraw of the same tool.
    if (index === -1) continue;
    let soft: SoftMask;
    try {
      soft = await segmentAt(canvas, interiorSeed(shape.imagePoints, image.width, image.height));
    } catch {
      return { scene, canRefine: false };
    }
    const refined = traceSceneSegmented(image, soft, options, scene.reference);
    if (isOk(refined)) {
      scene = withRefinedShape(scene, refined.value.shapes[0], { kind: 'seeded', index });
    }
  }
  return { scene, canRefine: true };
}

/**
 * `scene` with the tool at `seed` (0 to 1) redrawn by the model, or added if
 * the colour pass missed it. Throws when the model cannot run.
 *
 * The tap re-solves the reference with the tapped tool left out, so a
 * card-shaped tool taken for the card gives way to the real one. When that
 * moves the reference, the other tools are found again against it.
 */
export async function traceTap(
  canvas: HTMLCanvasElement,
  image: ImageDataLike,
  scene: SceneTrace,
  seed: Point,
  options: SceneTraceOptions
): Promise<SceneTrace | null> {
  const soft = await segmentAt(canvas, seed);
  const tapped = traceSceneSegmented(image, soft, options);
  if (!isOk(tapped)) return null;
  let base = scene;
  if (!sameReference(tapped.value.reference, scene.reference)) {
    const again = traceScene(image, options, tapped.value.reference);
    base = isOk(again) ? again.value : { ...tapped.value, shapes: [] };
  }
  return withRefinedShape(base, tapped.value.shapes[0], {
    kind: 'tapped',
    at: { x: seed.x * image.width, y: seed.y * image.height },
  });
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function bounds(points: readonly Point[]): {
  minX: number;
  minY: number;
  w: number;
  h: number;
} {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

/**
 * One path per tool in a shared 0-origin viewBox, so the outlines import at
 * their true size and keep their places relative to each other.
 */
export function svgFromShapes(shapes: readonly SceneShape[], units: 'mm' | 'px'): string {
  const { minX, minY, w, h } = bounds(shapes.flatMap((s) => s.outputPoints));
  const paths = shapes.map(
    (s) =>
      `<path d="${pointsToSvgPath(s.outputPoints.map((p) => ({ x: p.x - minX, y: p.y - minY })))}"/>`
  );
  // Tag mm output so the desktop can skip its scale-confirm step.
  const unitsAttr = units === 'mm' ? ' data-scan-units="mm"' : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(w)} ${round1(h)}"${unitsAttr}>` +
    `${paths.join('')}</svg>`
  );
}

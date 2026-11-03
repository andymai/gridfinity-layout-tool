/**
 * Folding a tap-prompted segmenter's outline into a scene of auto-found tools.
 *
 * The colour segmenter finds the tools; the model, prompted inside one of
 * them, usually draws it better. A pass the app seeded itself is taken only
 * when it agrees with the outline it was seeded in, since a model that
 * grabbed the whole sheet or a neighbour would replace a good outline with a
 * wrong one. A tap is the user's own call and always lands. Either way, any
 * other outline mostly inside the new one was a piece of the same tool, split
 * where the colour segmenter lost a thin joint, and goes with it.
 *
 * Agreement is measured against the redrawn outline, never the model's raw
 * mask: the mask can hold several blobs while the outline traced from it is
 * only the largest, and a blob over a neighbouring tool would otherwise vouch
 * for an outline drawn somewhere else.
 */

import type { Point } from './types';
import type { SceneShape, SceneTrace } from './traceScene';
import { polygonArea } from './traceImage';
import { pointInPolygon } from './toolBlobs';

/** Grid samples per coverage estimate. */
const SAMPLES = 400;
/** A seeded pass must cover this share of the outline it was seeded in. */
const MIN_AGREEMENT = 0.6;
/** And be at most this many times its area. */
const MAX_GROWTH = 2.5;
/** Another outline this far inside the new one is part of the same tool. */
const SAME_TOOL = 0.5;

export type Refinement =
  | { readonly kind: 'seeded'; readonly index: number }
  | { readonly kind: 'tapped'; readonly at: Point };

/**
 * The share of `poly`'s material that lies on `cover`'s, by grid sampling,
 * each without its holes: a tool resting in a ring's hole neither covers the
 * ring nor is covered by it.
 */
export function coverage(
  poly: readonly Point[],
  cover: readonly Point[],
  coverHoles: readonly (readonly Point[])[] = [],
  polyHoles: readonly (readonly Point[])[] = []
): number {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  const step = Math.max(0.5, Math.sqrt(((x1 - x0) * (y1 - y0)) / SAMPLES));
  let inside = 0;
  let hit = 0;
  for (let y = y0 + step / 2; y < y1; y += step) {
    for (let x = x0 + step / 2; x < x1; x += step) {
      if (!pointInPolygon({ x, y }, poly)) continue;
      if (polyHoles.some((h) => pointInPolygon({ x, y }, h))) continue;
      inside++;
      if (pointInPolygon({ x, y }, cover) && !coverHoles.some((h) => pointInPolygon({ x, y }, h))) {
        hit++;
      }
    }
  }
  return inside === 0 ? 0 : hit / inside;
}

/**
 * `scene` with `refined` in place of the outline it redraws. A seeded pass
 * that disagrees returns `scene` itself.
 */
export function withRefinedShape(
  scene: SceneTrace,
  refined: SceneShape,
  how: Refinement
): SceneTrace {
  const outline = refined.imagePoints;
  const holes = (refined.holes ?? []).map((h) => h.imagePoints);
  if (how.kind === 'seeded') {
    if (how.index < 0 || how.index >= scene.shapes.length) return scene;
    const target = scene.shapes[how.index];
    const targetHoles = (target.holes ?? []).map((h) => h.imagePoints);
    const agrees =
      coverage(target.imagePoints, outline, holes, targetHoles) >= MIN_AGREEMENT &&
      polygonArea(outline) <= MAX_GROWTH * polygonArea(target.imagePoints);
    if (!agrees) return scene;
  }
  // A tap in a ring's hole is not a tap on the ring.
  const tappedOn = (shape: SceneShape, at: Point): boolean =>
    pointInPolygon(at, shape.imagePoints) &&
    !(shape.holes ?? []).some((h) => pointInPolygon(at, h.imagePoints));
  const replaced = (shape: SceneShape, i: number): boolean =>
    (how.kind === 'seeded' ? i === how.index : tappedOn(shape, how.at)) ||
    coverage(
      shape.imagePoints,
      outline,
      holes,
      (shape.holes ?? []).map((h) => h.imagePoints)
    ) >= SAME_TOOL;
  const kept = scene.shapes.filter((s, i) => !replaced(s, i));
  // A redraw stays where its outline was found: in a hole when it was seeded
  // in one, or when a tap lands it in the hole of a shape still kept.
  const inHole =
    how.kind === 'seeded'
      ? scene.shapes[how.index].inHole === true
      : kept.some((s) => (s.holes ?? []).some((h) => pointInPolygon(how.at, h.imagePoints)));
  const placed: SceneShape = { ...refined, ...(inHole ? { inHole: true } : {}) };
  const shapes = [...kept, placed].sort(
    (a, b) => polygonArea(b.imagePoints) - polygonArea(a.imagePoints)
  );
  return { ...scene, shapes };
}

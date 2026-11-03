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
import { interiorSeed, pointInPolygon } from './toolBlobs';

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
  // Spaced by the material's area, not the box's, so a thin ring is sampled too.
  const material = polygonArea(poly) - polyHoles.reduce((a, h) => a + polygonArea(h), 0);
  const step = Math.max(0.5, Math.sqrt(Math.max(material, 1) / SAMPLES));
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
  const shapes = nestShapes([...kept, refined]).sort(
    (a, b) => polygonArea(b.imagePoints) - polygonArea(a.imagePoints)
  );
  return { ...scene, shapes };
}

const inSomeHole = (p: Point, shape: SceneShape): boolean =>
  (shape.holes ?? []).some((h) => pointInPolygon(p, h.imagePoints));

/**
 * `shapes` with each marked in a hole exactly when a point on its own
 * material lies in another shape's hole and on no other shape's material.
 * A tool in a slot of a tool that itself lies in a ring's hole sits in the
 * ring's hole too; once the slot is filled in, it sits on material. Re-decided
 * after anything joins or leaves, since a ring added round a tool, or removed
 * from round one, changes what lies where. A shape whose mark already reads
 * right comes back by reference.
 */
export function nestShapes(shapes: readonly SceneShape[]): SceneShape[] {
  return shapes.map((shape) => {
    const own = (shape.holes ?? []).map((h) => h.imagePoints);
    // In pixels: a 1 × 1 frame leaves the seed unnormalised.
    const at = interiorSeed(shape.imagePoints, 1, 1, own);
    const others = shapes.filter((other) => other !== shape);
    const held =
      others.some((other) => inSomeHole(at, other)) &&
      !others.some((other) => pointInPolygon(at, other.imagePoints) && !inSomeHole(at, other));
    if (held === (shape.inHole === true)) return shape;
    if (held) return { ...shape, inHole: true };
    const { inHole: _free, ...rest } = shape;
    return rest;
  });
}

import { err, isOk, ok, type Result } from '@/core/result';
import type { PathPoint } from '@/shared/types/bin';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import type { CardSizeMm } from './cardSize';
import {
  interiorSeed,
  nestShapes,
  pointInPolygon,
  pointsToSvgPath,
  sameReference,
  segmentAt,
  traceScene,
  traceSceneSegmented,
  wideHoles,
  withReference,
  withRefinedShape,
  type ImageDataLike,
  type Point,
  type SceneReference,
  type SceneShape,
  type SceneTrace,
  type SceneTraceOptions,
  type SoftMask,
} from '@/shared/scanTrace';

/**
 * Card size as the tracer's detect options. It steers the aspect ratio the
 * detector looks for as well as the metric map, so a non-standard card is
 * recognised as readily as an ID-1 one.
 */
export function cardOptions(size: CardSizeMm): { widthMm: number; heightMm: number } {
  return { widthMm: size.longMm, heightMm: size.shortMm };
}

/**
 * The model redraws at most this many tools on its own. A busy surface can
 * turn up dozens of pieces, and each pass takes a noticeable moment on a phone.
 */
export const MAX_AUTO_REFINE = 8;

/** Nothing traced; or, for a tap, the model could not run. */
export type TraceFlowError = 'noObject' | 'modelFailed';

export interface TracedScene {
  readonly scene: SceneTrace;
  /** False when the model could not run, so a tap would do nothing. */
  readonly canRefine: boolean;
}

/**
 * Every tool in the photo. The colour pass finds them and the model redraws
 * each, keeping a redraw only where it agrees; when the colour pass finds
 * nothing, the model tries the middle of the region searched, or of the
 * frame, and a tool it finds outside that region is not taken.
 *
 * `reference` sizes the photo when one is already settled, such as a ruler
 * the user drew; left out, the photo's own reference is found.
 */
export async function traceAll(
  canvas: HTMLCanvasElement,
  image: ImageDataLike,
  options: SceneTraceOptions,
  reference?: SceneReference | null
): Promise<Result<TracedScene, 'noObject'>> {
  const classical =
    reference === undefined ? traceScene(image, options) : traceScene(image, options, reference);
  if (!isOk(classical)) {
    const { region } = options;
    const seed = region
      ? {
          x: region.reduce((sum, p) => sum + p.x, 0) / region.length / image.width,
          y: region.reduce((sum, p) => sum + p.y, 0) / region.length / image.height,
        }
      : { x: 0.5, y: 0.5 };
    try {
      const soft = await segmentAt(canvas, seed);
      const traced =
        reference === undefined
          ? traceSceneSegmented(image, soft, options)
          : traceSceneSegmented(image, soft, options, reference);
      if (!isOk(traced)) return err('noObject');
      const [shape] = traced.value.shapes;
      const holes = (shape.holes ?? []).map((h) => h.imagePoints);
      if (region && !pointInPolygon(interiorSeed(shape.imagePoints, 1, 1, holes), region)) {
        return err('noObject');
      }
      return ok({ scene: traced.value, canRefine: true });
    } catch {
      return err('noObject');
    }
  }
  let scene = classical.value;
  for (const shape of scene.shapes.slice(0, MAX_AUTO_REFINE)) {
    const index = scene.shapes.indexOf(shape);
    // Already folded into an earlier redraw of the same tool.
    if (index === -1) continue;
    let soft: SoftMask;
    try {
      const holes = (shape.holes ?? []).map((h) => h.imagePoints);
      soft = await segmentAt(
        canvas,
        interiorSeed(shape.imagePoints, image.width, image.height, holes)
      );
    } catch {
      return ok({ scene, canRefine: false });
    }
    const refined = traceSceneSegmented(image, soft, options, scene.reference);
    if (isOk(refined)) {
      scene = withRefinedShape(scene, refined.value.shapes[0], { kind: 'seeded', index });
    }
  }
  return ok({ scene, canRefine: true });
}

/**
 * `scene` with the tool at `seed` (0 to 1) redrawn by the model, or added if
 * the colour pass missed it.
 *
 * The tap re-solves the reference with the tapped tool left out, so a
 * card-shaped tool taken for the card gives way to the real one. When that
 * moves the reference, the other outlines are re-sized against it, not
 * traced again, so a tool the user removed stays removed. A `locked`
 * reference, one the user set by hand, is kept as it is.
 */
export async function traceTap(
  canvas: HTMLCanvasElement,
  image: ImageDataLike,
  scene: SceneTrace,
  seed: Point,
  options: SceneTraceOptions,
  locked = false
): Promise<Result<SceneTrace, TraceFlowError>> {
  let soft: SoftMask;
  try {
    soft = await segmentAt(canvas, seed);
  } catch {
    return err('modelFailed');
  }
  const tapped = locked
    ? traceSceneSegmented(image, soft, options, scene.reference)
    : traceSceneSegmented(image, soft, options);
  if (!isOk(tapped)) return err('noObject');
  const base = sameReference(tapped.value.reference, scene.reference)
    ? scene
    : withReference(scene, tapped.value.reference, options);
  const next = withRefinedShape(base, tapped.value.shapes[0], {
    kind: 'tapped',
    at: { x: seed.x * image.width, y: seed.y * image.height },
  });
  return ok(next);
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

export interface ShownShape {
  readonly shape: SceneShape;
  /** Where the tool sits in the scene, for acting on the one the list shows. */
  readonly index: number;
}

/**
 * The tools the review shows: all of them while holes are kept, each with
 * only the holes wide enough to keep, otherwise not one lying in another's
 * hole, which would be a pocket inside a pocket.
 */
export function shownShapes(
  shapes: readonly SceneShape[],
  keepHoles: boolean,
  units: 'mm' | 'px'
): ShownShape[] {
  const indexed = shapes.map((shape, index) => ({ shape, index }));
  if (!keepHoles) return indexed.filter(({ shape }) => shape.inHole !== true);
  const trimmed = shapes.map((shape) => {
    if (!shape.holes) return shape;
    const { holes: _all, ...rest } = shape;
    const holes = wideHoles(shape, units);
    return holes.length > 0 ? { ...rest, holes } : rest;
  });
  // A tool whose hole was too narrow to keep now lies on its ring's material,
  // a pocket inside a pocket, so it goes with the hole.
  return nestShapes(trimmed)
    .map((shape, index) => ({ shape, index }))
    .filter(({ shape, index }) => !(shapes[index].inHole === true && shape.inHole !== true));
}

export function visibleShapes(
  shapes: readonly SceneShape[],
  keepHoles: boolean,
  units: 'mm' | 'px'
): SceneShape[] {
  return shownShapes(shapes, keepHoles, units).map(({ shape }) => shape);
}

/** `shapes` without `gone`, each still marked in a hole only while one holds it. */
export function withoutShape(shapes: readonly SceneShape[], gone: SceneShape): SceneShape[] {
  return nestShapes(shapes.filter((s) => s !== gone));
}

/**
 * One path per tool in a shared 0-origin viewBox, so the outlines import at
 * their true size and keep their places relative to each other.
 */
export function svgFromShapes(
  shapes: readonly SceneShape[],
  units: 'mm' | 'px',
  keepHoles = false
): string {
  const { minX, minY, w, h } = bounds(shapes.flatMap((s) => s.outputPoints));
  const local = (points: readonly Point[]) =>
    pointsToSvgPath(points.map((p) => ({ x: p.x - minX, y: p.y - minY })));
  const paths = shapes.map((s) => {
    const holes = keepHoles ? (s.holes ?? []) : [];
    if (holes.length === 0) return `<path d="${local(s.outputPoints)}"/>`;
    // Even-odd, so the desktop reads each hole as an island whichever way it winds.
    const d = [s.outputPoints, ...holes.map((hole) => hole.outputPoints)].map(local).join(' ');
    return `<path d="${d}" fill-rule="evenodd"/>`;
  });
  // Tag mm output so the desktop can skip its scale-confirm step.
  const unitsAttr = units === 'mm' ? ' data-scan-units="mm"' : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(w)} ${round1(h)}"${unitsAttr}>` +
    `${paths.join('')}</svg>`
  );
}

/** A tool's cleaned outline and islands, in millimetres. */
export interface CleanedTool {
  readonly path: readonly PathPoint[];
  readonly holes: readonly (readonly PathPoint[])[];
}

const mm = (n: number): string => String(Math.round(n * 1000) / 1000);

/** One closed ring as path data, curved where either end of a step has a handle. */
function ringData(ring: readonly PathPoint[], dx: number, dy: number): string {
  const at = (x: number, y: number) => `${mm(x - dx)} ${mm(y - dy)}`;
  let d = `M ${at(ring[0].x, ring[0].y)}`;
  for (let i = 1; i <= ring.length; i++) {
    const a = ring[i - 1];
    const b = ring[i % ring.length];
    if (a.handleOut || b.handleIn) {
      const c1 = a.handleOut ? at(a.x + a.handleOut.dx, a.y + a.handleOut.dy) : at(a.x, a.y);
      const c2 = b.handleIn ? at(b.x + b.handleIn.dx, b.y + b.handleIn.dy) : at(b.x, b.y);
      d += ` C ${c1} ${c2} ${at(b.x, b.y)}`;
    } else if (i < ring.length) {
      d += ` L ${at(b.x, b.y)}`;
    }
  }
  return `${d} Z`;
}

/**
 * Cleaned tools as the millimetre SVG a scan uploads, curves kept as cubic
 * steps so they arrive as handles rather than as many short lines.
 */
export function svgFromCleaned(tools: readonly CleanedTool[]): string {
  const { minX, minY, w, h } = bounds(tools.flatMap((tool) => flattenPath(tool.path)));
  const paths = tools.map((tool) => {
    const d = [tool.path, ...tool.holes].map((ring) => ringData(ring, minX, minY)).join(' ');
    return tool.holes.length > 0 ? `<path d="${d}" fill-rule="evenodd"/>` : `<path d="${d}"/>`;
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round1(w)} ${round1(h)}" data-scan-units="mm">` +
    `${paths.join('')}</svg>`
  );
}

import { useCallback, useMemo, useState } from 'react';
import {
  axisIsUpright,
  cleanOutline,
  isNoCleanup,
  mirrorAxis,
  NO_CLEANUP,
  type CleanupSettings,
  type RoundingCache,
} from '@/shared/outlineCleanup';
import type { CleanedTool } from '@/shared/scanReview';
import {
  referenceToImage,
  type Point,
  type SceneRing,
  type SceneShape,
  type SceneTrace,
  type SceneTraceOptions,
} from '@/shared/scanTrace';
import type { PathPoint } from '@/shared/types/bin';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';

/** Flattening step, in mm, for drawing a cleaned outline over the photo. */
const PREVIEW_STEP_MM = 0.2;

export interface TraceCleanup {
  /** The settings as the controls show them. */
  readonly settings: CleanupSettings;
  readonly set: (next: CleanupSettings, done: boolean) => void;
  /** Cleanup needs the photo in millimetres. */
  readonly available: boolean;
  /** Mirroring is one tool's business: with several, it waits for the editor. */
  readonly canMirror: boolean;
  readonly upright: boolean;
  /** The tools as cleaned, in the order given, for drawing and listing. */
  readonly shapes: readonly SceneShape[];
  /** The cleaned outlines to add, or null when there is nothing to clean. */
  readonly tools: readonly CleanedTool[] | null;
}

/** Roundings already made of each tool, kept with the tool and dropped with it. */
const roundings = new WeakMap<SceneShape, RoundingCache>();

function cleanTool(shape: SceneShape, settings: CleanupSettings, keepHoles: boolean) {
  let cache = roundings.get(shape);
  if (!cache) {
    cache = new Map();
    roundings.set(shape, cache);
  }
  const holes = keepHoles ? (shape.holes ?? []).map((h) => h.outputPoints) : [];
  return cleanOutline({ outline: shape.outputPoints, holes }, settings, 0, cache);
}

const corners = (points: readonly Point[]): PathPoint[] =>
  points.map((p) => ({ x: p.x, y: p.y, handleIn: null, handleOut: null, symmetric: false }));

/**
 * One set of cleanup settings for every tool in the photo, each cleaned in
 * millimetres and drawn back over the photo through the reference.
 */
export function useTraceCleanup(
  scene: SceneTrace | null,
  shapes: readonly SceneShape[],
  keepHoles: boolean,
  options: SceneTraceOptions
): TraceCleanup {
  const [settings, setSettings] = useState<CleanupSettings>(NO_CLEANUP);
  // What the outlines are cleaned with. Rounding is slow across many tools, so
  // a rounding drag lands on release; every other change lands as it moves.
  const [applied, setApplied] = useState<CleanupSettings>(NO_CLEANUP);
  const available = scene?.units === 'mm';
  const canMirror = shapes.length === 1;

  const set = useCallback((next: CleanupSettings, done: boolean) => {
    setSettings(next);
    setApplied((prev) => (done || next.roundInside === prev.roundInside ? next : prev));
  }, []);

  const effective = useMemo(
    () => (canMirror ? applied : { ...applied, mirror: null }),
    [applied, canMirror]
  );

  const cleaned = useMemo(() => {
    if (!available || isNoCleanup(effective)) return null;
    return shapes.map((shape) => cleanTool(shape, effective, keepHoles));
  }, [available, effective, shapes, keepHoles]);

  const toImage = useMemo(
    () => (scene ? referenceToImage(scene.reference, options) : null),
    [scene, options]
  );

  const shown = useMemo(() => {
    if (!cleaned || !toImage) return shapes;
    const ring = (path: readonly PathPoint[]): SceneRing => {
      const outputPoints = flattenPath(path, PREVIEW_STEP_MM);
      return { outputPoints, imagePoints: toImage(outputPoints) };
    };
    return shapes.map((shape, i): SceneShape => {
      const tool = cleaned[i];
      if (!tool) return shape;
      return {
        ...ring(tool.path),
        ...(tool.holes.length > 0 ? { holes: tool.holes.map(ring) } : {}),
        ...(shape.inHole ? { inHole: true } : {}),
      };
    });
  }, [cleaned, toImage, shapes]);

  const tools = useMemo(
    () =>
      cleaned?.map(
        (tool, i): CleanedTool =>
          tool ?? {
            path: corners(shapes[i].outputPoints),
            holes: keepHoles ? (shapes[i].holes ?? []).map((h) => corners(h.outputPoints)) : [],
          }
      ) ?? null,
    [cleaned, shapes, keepHoles]
  );

  const upright = useMemo(() => {
    const axis = settings.mirror?.axis;
    if (axis === 'horizontal') return false;
    if (axis !== 'detected' || !canMirror) return true;
    return axisIsUpright(mirrorAxis(shapes[0].outputPoints, 'detected'));
  }, [settings.mirror?.axis, canMirror, shapes]);

  return { settings, set, available, canMirror, upright, shapes: shown, tools };
}

import { draw, rotate, translate } from 'brepjs';
import type { Drawing, Shape3D } from 'brepjs';
import { cradleArc } from '@/shared/utils/cutoutCradle';
import { sketch } from './meshUtils';

/** Straight sides shorter than this are left out of the section (mm). */
const MIN_SIDE_MM = 0.01;

/**
 * A cradle's cross-section in XZ with its lowest point at the origin: the arc
 * through both top edges, then straight sides from where the arc ends up to
 * `topZ`. A side too short to draw is left out, because OCCT rejects a
 * zero-length edge.
 */
function cradleSection(width: number, depth: number, topZ: number): Drawing {
  const half = width / 2;
  const { endZ } = cradleArc(width, depth);
  const arc = draw([-half, endZ]).threePointsArcTo([half, endZ], [0, 0]);
  if (topZ - endZ < MIN_SIDE_MM) return arc.close();
  return arc.lineTo([half, topZ]).lineTo([-half, topZ]).close();
}

/**
 * A cradle pocket's tool in its own frame: `width` across X, `length` along Y
 * centred on the origin, lowest point at z = 0 and the mouth at z = `depth`.
 */
export function buildCradlePrism(width: number, length: number, depth: number): Shape3D | null {
  if (width <= 0 || length <= 0 || depth <= 0) return null;
  const extruded = sketch(cradleSection(width, depth, depth), 'XZ').extrude(length);
  const centred = translate(extruded, [0, length / 2, 0]);
  extruded.delete();
  return centred;
}

export interface CradleRun {
  /** The run lies along X (a left or right wall) rather than Y. */
  readonly alongX: boolean;
  /** Where the run starts and stops along its axis, in the body frame. */
  readonly from: number;
  readonly to: number;
  /** Centre of the section across the run, in the body frame. */
  readonly across: number;
  readonly width: number;
  readonly depth: number;
  /** Height of the run's top above its lowest point. */
  readonly topZ: number;
  /** Body z of the arc's lowest point. */
  readonly baseZ: number;
}

/**
 * A cradle's channel out through a wall: the pocket's own section, carried
 * from `from` to `to`. The caller starts it where the pocket's tool ends, so
 * the two meet on a flat face and never share the arc.
 */
export function buildCradleRun(run: CradleRun): Shape3D | null {
  const length = run.to - run.from;
  if (length <= 0 || run.width <= 0 || run.depth <= 0) return null;
  // Extruded from the XZ plane, the section runs over y = -length..0.
  const prism = sketch(cradleSection(run.width, run.depth, run.topZ), 'XZ').extrude(length);
  if (!run.alongX) {
    const placed = translate(prism, [run.across, run.to, run.baseZ]);
    prism.delete();
    return placed;
  }
  // A quarter turn clockwise takes (x, y) to (y, -x): the run onto
  // x = -length..0, and the symmetric section across y.
  const turned = rotate(prism, -90, { axis: [0, 0, 1] });
  prism.delete();
  const placed = translate(turned, [run.to, run.across, run.baseZ]);
  turned.delete();
  return placed;
}

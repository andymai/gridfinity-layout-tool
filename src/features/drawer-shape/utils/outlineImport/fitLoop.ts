/**
 * Turn an imported loop into a sketch the pen editor can hold: largest loop
 * wins, wound CCW, centred in the drawer at true scale.
 *
 * True scale is the point of importing from CAD — a drawer measured with
 * calipers must land at the size it was measured. So an oversized loop is
 * reported rather than quietly rescaled, and the caller decides between
 * scaling it down and growing the drawer.
 */

import type { OutlineVertex } from '@/core/types';
import { flattenOutline, polylineSignedArea } from '@/shared/utils/drawerOutlineGeometry';
import { isClockwise, reverseWinding } from '../penShape';
import type { ImportedLoop } from './types';

export interface LoopBounds {
  readonly minX: number;
  readonly minY: number;
  readonly widthMm: number;
  readonly depthMm: number;
}

export function loopBounds(vertices: readonly OutlineVertex[]): LoopBounds {
  // Measured on the flattened path, not the vertices: an arc bulges past its
  // own endpoints, and a bounding box that ignored that would let a curved
  // edge sit outside the drawer while the fit check called it inside.
  const pts = flattenOutline({ vertices: [...vertices] });
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, widthMm: maxX - minX, depthMm: maxY - minY };
}

/** The loop enclosing the most area — the perimeter, not the detail inside it. */
export function largestLoop(loops: readonly ImportedLoop[]): ImportedLoop | null {
  let best: ImportedLoop | null = null;
  let bestArea = 0;
  for (const loop of loops) {
    // Two vertices is enough when both segments are arcs (a circle, or a D
    // profile chained from a line and an arc). `ensureMinVertices` raises it to
    // the model's floor later; rejecting it here would lose the shape outright.
    if (loop.vertices.length < 2) continue;
    const area = Math.abs(polylineSignedArea(flattenOutline({ vertices: [...loop.vertices] })));
    if (area > bestArea) {
      bestArea = area;
      best = loop;
    }
  }
  return best;
}

export function transformLoop(
  vertices: readonly OutlineVertex[],
  scale: number,
  dx: number,
  dy: number
): OutlineVertex[] {
  // Uniform scaling preserves every sweep, so bulges ride along untouched.
  return vertices.map((v) =>
    v.bulge === undefined
      ? { x: v.x * scale + dx, y: v.y * scale + dy }
      : { x: v.x * scale + dx, y: v.y * scale + dy, bulge: v.bulge }
  );
}

export interface FittedLoop {
  readonly vertices: OutlineVertex[];
  /** True size of the loop before any scaling, in mm. */
  readonly sourceWidthMm: number;
  readonly sourceDepthMm: number;
  /** Scale applied; 1 when the loop fitted at its measured size. */
  readonly scale: number;
  /** Drawer units the loop would need at true scale, rounded up to a half unit. */
  readonly requiredWidthUnits: number;
  readonly requiredDepthUnits: number;
}

/** Round up to the next half grid unit, the finest drawer dimension allowed. */
function unitsFor(mm: number, pitch: number): number {
  return Math.max(1, Math.ceil((mm / pitch) * 2) / 2);
}

/**
 * Place a loop in the drawer, centred, wound CCW.
 *
 * `scaleToFit` scales it down uniformly when it does not fit; otherwise it is
 * placed at true scale even if that leaves it outside the extent, so the
 * caller can show what it would take to accept it as measured.
 */
export function fitLoop(
  loop: ImportedLoop,
  drawerWidthMm: number,
  drawerDepthMm: number,
  gridUnitMm: number,
  gridUnitMmY: number,
  scaleToFit: boolean
): FittedLoop {
  const wound = isClockwise(loop.vertices) ? reverseWinding(loop.vertices) : [...loop.vertices];
  const b = loopBounds(wound);
  const fitScale =
    b.widthMm > 0 && b.depthMm > 0
      ? Math.min(drawerWidthMm / b.widthMm, drawerDepthMm / b.depthMm)
      : 1;
  const scale = scaleToFit ? Math.min(1, fitScale) : 1;

  // Centre on the drawer, which is the only placement that needs no guess
  // about which edge the user measured from.
  const dx = (drawerWidthMm - b.widthMm * scale) / 2 - b.minX * scale;
  const dy = (drawerDepthMm - b.depthMm * scale) / 2 - b.minY * scale;

  return {
    vertices: transformLoop(wound, scale, dx, dy),
    sourceWidthMm: b.widthMm,
    sourceDepthMm: b.depthMm,
    scale,
    requiredWidthUnits: unitsFor(b.widthMm, gridUnitMm),
    requiredDepthUnits: unitsFor(b.depthMm, gridUnitMmY),
  };
}

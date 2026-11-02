/**
 * SVG `<path>` element → ParsedCutoutSpec[] conversion.
 *
 * Splits the path's command stream into contours (each `M` starts a new
 * sub-path) and converts each contour independently, then nests them by the
 * element's fill rule (see {@link nestContours}): a sub-path the rule leaves
 * unfilled becomes an island in the outline around it. Quadratic beziers are
 * elevated to cubic; arcs are converted via `arcToCubicBeziers`.
 *
 * There is no close-path case: `NORMALIZE_HVZ` rewrites `Z` as an explicit line
 * back to the sub-path start, so a closed shape reaches us as a duplicate
 * anchor. `pathPointsToSpec` is what drops it, and what rescues the closing
 * curve's handle from it.
 */

import { SVGPathData, SVGPathDataTransformer } from 'svg-pathdata';
import type { SVGCommand } from 'svg-pathdata';
import { SVGPathData as SVGPathDataEnum } from 'svg-pathdata';
import type { PathPoint } from '@/features/bin-designer/types';
import type { ParsedCutoutSpec } from './types';
import { transformPoint, type Matrix } from '@/shared/utils/svg';
import type { ViewBox } from './types';
import { makeCornerPoint, pathPointsToSpec } from './svgConvertShapes';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import { arcToCubicBeziers } from './svgArcToBezier';

export function convertPath(
  el: Element,
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec[] | null {
  const d = el.getAttribute('d');
  if (!d) return null;

  const pathData = new SVGPathData(d).transform(SVGPathDataTransformer.NORMALIZE_HVZ()).toAbs();

  // Split into sub-paths (each M starts a new contour)
  const contours = splitContours(pathData.commands);
  const specs: ParsedCutoutSpec[] = [];

  for (const contour of contours) {
    const spec = convertContour(contour, matrix, viewBox);
    if (spec) {
      specs.push(spec);
    }
  }

  const nested = nestContours(specs, fillRuleOf(el));
  return nested.length > 0 ? nested : null;
}

/** The fill rule an element paints with, from itself or the nearest ancestor that sets one. */
function fillRuleOf(el: Element): 'nonzero' | 'evenodd' {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const styled = /(?:^|;)\s*fill-rule\s*:\s*(nonzero|evenodd)/i.exec(
      node.getAttribute('style') ?? ''
    );
    const rule = (styled?.[1] ?? node.getAttribute('fill-rule') ?? '').trim().toLowerCase();
    if (rule === 'evenodd' || rule === 'nonzero') return rule;
  }
  return 'nonzero';
}

function signedArea(ring: readonly { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const b = ring[(i + 1) % ring.length];
    a += ring[i].x * b.y - b.x * ring[i].y;
  }
  return a / 2;
}

function insideRing(
  p: { x: number; y: number },
  ring: readonly { x: number; y: number }[]
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * One element's sub-paths as the fill rule paints them. A sub-path inside a
 * filled one is a hole under `evenodd`, and under `nonzero` when it winds the
 * other way; one winding the same way under `nonzero` is painted over and
 * stays a pocket of its own. Anything inside a hole is a shape again.
 */
function nestContours(
  specs: readonly ParsedCutoutSpec[],
  rule: 'nonzero' | 'evenodd'
): ParsedCutoutSpec[] {
  const rings = specs.map((s) => flattenPath(s.path ?? []));
  const area = rings.map((r) => Math.abs(signedArea(r)));
  const order = specs.map((_, i) => i).sort((a, b) => area[b] - area[a]);
  const parentOf = new Map<number, number>();
  for (const i of order) {
    if (rings[i].length === 0) continue;
    const probe = rings[i][0];
    // The smallest ring around it, since bigger ones come first.
    let parent = -1;
    for (const j of order) {
      if (j === i || area[j] <= area[i]) continue;
      if (insideRing(probe, rings[j])) parent = j;
    }
    if (parent !== -1) parentOf.set(i, parent);
  }
  const isHole = new Map<number, boolean>();
  for (const i of order) {
    const parent = parentOf.get(i);
    if (parent === undefined || isHole.get(parent) === true) {
      isHole.set(i, false);
      continue;
    }
    const opposite = Math.sign(signedArea(rings[i])) !== Math.sign(signedArea(rings[parent]));
    isHole.set(i, rule === 'evenodd' || opposite);
  }
  const holesOf = new Map<number, PathPoint[][]>();
  for (const [i, hole] of isHole) {
    const parent = parentOf.get(i);
    const path = specs[i].path;
    if (!hole || parent === undefined || !path) continue;
    holesOf.set(parent, [...(holesOf.get(parent) ?? []), path]);
  }
  return specs.flatMap((spec, i) => {
    if (isHole.get(i) === true) return [];
    const holes = holesOf.get(i);
    return [holes ? { ...spec, holes } : spec];
  });
}

/** Split path commands into separate contours (each starting with M). */
function splitContours(commands: SVGCommand[]): SVGCommand[][] {
  const contours: SVGCommand[][] = [];
  let current: SVGCommand[] = [];

  for (const cmd of commands) {
    if (cmd.type === SVGPathDataEnum.MOVE_TO && current.length > 0) {
      contours.push(current);
      current = [];
    }
    current.push(cmd);
  }

  if (current.length > 0) {
    contours.push(current);
  }

  return contours;
}

/** Convert a single path contour to a cutout spec. */
function convertContour(
  commands: SVGCommand[],
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec | null {
  if (commands.length < 2) return null;

  const pathPoints: PathPoint[] = [];
  let currentX = 0;
  let currentY = 0;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    switch (cmd.type) {
      case SVGPathDataEnum.MOVE_TO:
      case SVGPathDataEnum.LINE_TO: {
        currentX = cmd.x;
        currentY = cmd.y;
        pathPoints.push(makeCornerPoint(currentX, currentY, matrix, viewBox));
        break;
      }

      case SVGPathDataEnum.CURVE_TO: {
        // Cubic bezier: C x1 y1 x2 y2 x y
        // cp1 = (cmd.x1, cmd.y1) — outgoing handle of PREVIOUS point
        // cp2 = (cmd.x2, cmd.y2) — incoming handle of THIS point
        const cp1 = transformPoint(cmd.x1, cmd.y1, matrix, viewBox);
        const cp2 = transformPoint(cmd.x2, cmd.y2, matrix, viewBox);
        const endPt = transformPoint(cmd.x, cmd.y, matrix, viewBox);

        if (pathPoints.length > 0) {
          const prev = pathPoints[pathPoints.length - 1];
          pathPoints[pathPoints.length - 1] = {
            ...prev,
            handleOut: { dx: cp1.x - prev.x, dy: cp1.y - prev.y },
            symmetric: false,
          };
        }

        pathPoints.push({
          x: endPt.x,
          y: endPt.y,
          handleIn: { dx: cp2.x - endPt.x, dy: cp2.y - endPt.y },
          handleOut: null,
          symmetric: false,
        });

        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }

      case SVGPathDataEnum.QUAD_TO: {
        // Quadratic bezier: Q x1 y1 x y → elevate to cubic
        const qcp = { x: cmd.x1, y: cmd.y1 };
        const qend = { x: cmd.x, y: cmd.y };
        const cp1x = currentX + (2 / 3) * (qcp.x - currentX);
        const cp1y = currentY + (2 / 3) * (qcp.y - currentY);
        const cp2x = qend.x + (2 / 3) * (qcp.x - qend.x);
        const cp2y = qend.y + (2 / 3) * (qcp.y - qend.y);

        const tCp1 = transformPoint(cp1x, cp1y, matrix, viewBox);
        const tCp2 = transformPoint(cp2x, cp2y, matrix, viewBox);
        const tEnd = transformPoint(qend.x, qend.y, matrix, viewBox);

        if (pathPoints.length > 0) {
          const prev = pathPoints[pathPoints.length - 1];
          pathPoints[pathPoints.length - 1] = {
            ...prev,
            handleOut: { dx: tCp1.x - prev.x, dy: tCp1.y - prev.y },
            symmetric: false,
          };
        }

        pathPoints.push({
          x: tEnd.x,
          y: tEnd.y,
          handleIn: { dx: tCp2.x - tEnd.x, dy: tCp2.y - tEnd.y },
          handleOut: null,
          symmetric: false,
        });

        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }

      case SVGPathDataEnum.ARC: {
        const arcBeziers = arcToCubicBeziers(
          currentX,
          currentY,
          cmd.rX,
          cmd.rY,
          cmd.xRot,
          cmd.lArcFlag ? 1 : 0,
          cmd.sweepFlag ? 1 : 0,
          cmd.x,
          cmd.y
        );

        for (const seg of arcBeziers) {
          const tCp1 = transformPoint(seg.cp1x, seg.cp1y, matrix, viewBox);
          const tCp2 = transformPoint(seg.cp2x, seg.cp2y, matrix, viewBox);
          const tEnd = transformPoint(seg.x, seg.y, matrix, viewBox);

          if (pathPoints.length > 0) {
            const prev = pathPoints[pathPoints.length - 1];
            pathPoints[pathPoints.length - 1] = {
              ...prev,
              handleOut: { dx: tCp1.x - prev.x, dy: tCp1.y - prev.y },
              symmetric: false,
            };
          }

          pathPoints.push({
            x: tEnd.x,
            y: tEnd.y,
            handleIn: { dx: tCp2.x - tEnd.x, dy: tCp2.y - tEnd.y },
            handleOut: null,
            symmetric: false,
          });
        }

        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }
    }
  }

  if (pathPoints.length < 2) return null;

  return pathPointsToSpec(pathPoints);
}

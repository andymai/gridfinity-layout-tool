/**
 * SVG `<path>` element → ParsedCutoutSpec[] conversion.
 *
 * Splits the path's command stream into contours (each `M` starts a new
 * sub-path) and converts each contour independently. Quadratic beziers are
 * elevated to cubic; arcs are converted via `arcToCubicBeziers`.
 */

import { SVGPathData, SVGPathDataTransformer } from 'svg-pathdata';
import type { SVGCommand } from 'svg-pathdata';
import { SVGPathData as SVGPathDataEnum } from 'svg-pathdata';
import type { PathPoint } from '@/features/bin-designer/types';
import type { ParsedCutoutSpec } from './types';
import type { Matrix } from './svgTransform';
import { transformPoint } from './svgTransform';
import type { ViewBox } from './types';
import { makeCornerPoint, pathPointsToSpec } from './svgConvertShapes';
import { arcToCubicBeziers } from './svgArcToBezier';

export function convertPath(
  el: Element,
  matrix: Matrix,
  viewBox: ViewBox
): ParsedCutoutSpec[] | null {
  const d = el.getAttribute('d');
  if (!d) return null;

  // Parse and normalize path data
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

  return specs.length > 0 ? specs : null;
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

      case SVGPathDataEnum.CLOSE_PATH: {
        // Remove duplicate endpoint if it matches the first point
        if (pathPoints.length >= 2) {
          const first = pathPoints[0];
          const last = pathPoints[pathPoints.length - 1];
          const dx = Math.abs(first.x - last.x);
          const dy = Math.abs(first.y - last.y);
          if (dx < 0.01 && dy < 0.01) {
            // Transfer handleIn from duplicate endpoint to first point
            const removed = pathPoints.pop();
            if (removed?.handleIn) {
              pathPoints[0] = { ...pathPoints[0], handleIn: removed.handleIn };
            }
          }
        }
        break;
      }
    }
  }

  if (pathPoints.length < 2) return null;

  return pathPointsToSpec(pathPoints);
}

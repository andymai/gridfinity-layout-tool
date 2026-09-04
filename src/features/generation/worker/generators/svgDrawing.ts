/**
 * Bridge from SVG path data to a brepjs `Drawing`.
 *
 * Drawn with the pen rather than `importSVGPathD`, because that importer's arc
 * handling reads neither flag: it always takes the minor-arc sagitta on one
 * fixed side of the chord, which is the right answer only for the
 * (large-arc 0, sweep 0) quarter of the cases. `clip` and `lockWasher` imported
 * as slivers of themselves that way, while their picker previews — the browser
 * rendering the SAME string — looked correct. `ellipseTo`, the pen's own
 * SVG-flavoured arc, is no help: it returns the whole ellipse rather than the
 * arc between the endpoints. So the arc is centre-parameterised here (SVG 1.1
 * F.6.5) and handed to `threePointsArcTo`, which takes three points and no
 * flags at all.
 *
 * Arcs stay exact analytic circles — a full-circle path extrudes to π·r²·h to
 * double precision — so curved silhouettes are never faceted.
 *
 * Paths are authored in SVG convention (Y down) and brepjs is Y up, so every
 * point is flipped on the way to the pen.
 */

import { draw } from 'brepjs';
import type { Drawing, DrawingPen, Point2D } from 'brepjs';

/** Command letter plus its argument run. */
const COMMAND_RE = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
const NUMBER_RE = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

/** Arguments per repeated group, keyed by lowercased command. */
const ARGS_PER_GROUP: Readonly<Record<string, number>> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};

const DEG2RAD = Math.PI / 180;

/** Two points this close are the same point, and the run between them is not a curve. */
const COINCIDENT = 1e-10;

/** One arc, as the three points that pin it down. Both in SVG coordinates. */
interface ArcRun {
  readonly via: Point2D;
  readonly end: Point2D;
}

interface Cursor {
  x: number;
  y: number;
  /** Start of the current subpath, where `Z` returns to. */
  sx: number;
  sy: number;
  /** Last control point, for the reflection `S` and `T` take. */
  px: number;
  py: number;
  lastCmd: string;
}

function parseNumbers(argStr: string): number[] {
  const out: number[] = [];
  NUMBER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMBER_RE.exec(argStr)) !== null) out.push(parseFloat(m[0]));
  return out;
}

/** SVG (Y down) to brepjs (Y up). */
function flip(x: number, y: number): Point2D {
  return [x, -y];
}

/**
 * Split an SVG elliptical arc into runs the three-point constructor can state.
 *
 * Centre parameterisation per SVG 1.1 F.6.5, including the radius up-scaling a
 * chord too long for the given radii calls for. Anything over a half turn is
 * cut in two, since three points on a circle only name one arc unambiguously
 * while that arc is the shorter way round.
 *
 * `null` for the degenerate inputs the spec resolves without an arc: a zero
 * radius (a straight line) and coincident endpoints (nothing at all).
 */
function arcRuns(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  phiDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number
): ArcRun[] | null {
  if (rx === 0 || ry === 0) return null;
  const phi = phiDeg * DEG2RAD;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const hx = (x1 - x2) / 2;
  const hy = (y1 - y2) / 2;
  const x1p = cosPhi * hx + sinPhi * hy;
  const y1p = -sinPhi * hx + cosPhi * hy;
  if (Math.abs(x1p) < COINCIDENT && Math.abs(y1p) < COINCIDENT) return null;

  let ax = Math.abs(rx);
  let ay = Math.abs(ry);
  const lambda = (x1p * x1p) / (ax * ax) + (y1p * y1p) / (ay * ay);
  if (lambda > 1) {
    const grow = Math.sqrt(lambda);
    ax *= grow;
    ay *= grow;
  }

  const num = ax * ax * ay * ay - ax * ax * y1p * y1p - ay * ay * x1p * x1p;
  const den = ax * ax * y1p * y1p + ay * ay * x1p * x1p;
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * (ax * y1p)) / ay;
  const cyp = (-coef * (ay * x1p)) / ax;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const theta1 = Math.atan2((y1p - cyp) / ay, (x1p - cxp) / ax);
  const theta2 = Math.atan2((-y1p - cyp) / ay, (-x1p - cxp) / ax);
  let delta = theta2 - theta1;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  if (!sweep && delta > 0) delta -= 2 * Math.PI;

  const at = (theta: number): Point2D => [
    cx + ax * cosPhi * Math.cos(theta) - ay * sinPhi * Math.sin(theta),
    cy + ax * sinPhi * Math.cos(theta) + ay * cosPhi * Math.sin(theta),
  ];
  const halves = Math.abs(delta) > Math.PI ? 2 : 1;
  const runs: ArcRun[] = [];
  for (let i = 0; i < halves; i++) {
    const step = delta / halves;
    const end = i === halves - 1 ? ([x2, y2] as Point2D) : at(theta1 + step * (i + 1));
    runs.push({ via: at(theta1 + step * (i + 0.5)), end });
  }
  return runs.every((run) => run.via.every(Number.isFinite)) ? runs : null;
}

/**
 * Trace `pathD` onto `pen`, returning how many curves it drew.
 *
 * -1 marks a path the pen cannot express: a second subpath. `movePointerTo`
 * only moves before the first curve, and a Blueprint is one wire, so a
 * compound path has nowhere to land. The icon catalog states holes as their
 * own path strings for exactly this reason.
 */
function tracePath(pen: DrawingPen, pathD: string): number {
  const cur: Cursor = { x: 0, y: 0, sx: 0, sy: 0, px: 0, py: 0, lastCmd: '' };
  let curves = 0;

  const lineTo = (x: number, y: number): void => {
    pen.lineTo(flip(x, y));
    curves++;
  };

  COMMAND_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COMMAND_RE.exec(pathD)) !== null) {
    const cmd = match[1];
    const lower = cmd.toLowerCase();
    const relative = cmd !== cmd.toUpperCase();
    const args = parseNumbers(match[2]);
    const step = ARGS_PER_GROUP[lower] ?? 0;

    if (lower === 'z') {
      if (Math.hypot(cur.x - cur.sx, cur.y - cur.sy) > COINCIDENT) lineTo(cur.sx, cur.sy);
      cur.x = cur.sx;
      cur.y = cur.sy;
      cur.lastCmd = 'Z';
      continue;
    }

    for (let i = 0; i + step <= args.length; i += step) {
      const ox = relative ? cur.x : 0;
      const oy = relative ? cur.y : 0;
      const arg = (n: number): number => args[i + n] ?? 0;

      switch (lower) {
        case 'm': {
          const x = ox + arg(0);
          const y = oy + arg(1);
          // Only the first pair moves; the rest of the run is an implicit line.
          if (i === 0) {
            if (curves > 0) return -1;
            pen.movePointerTo(flip(x, y));
            cur.sx = x;
            cur.sy = y;
          } else {
            lineTo(x, y);
          }
          cur.x = x;
          cur.y = y;
          break;
        }
        case 'l':
          cur.x = ox + arg(0);
          cur.y = oy + arg(1);
          lineTo(cur.x, cur.y);
          break;
        case 'h':
          cur.x = ox + arg(0);
          lineTo(cur.x, cur.y);
          break;
        case 'v':
          cur.y = oy + arg(0);
          lineTo(cur.x, cur.y);
          break;
        case 'c':
        case 's': {
          const smooth = lower === 's';
          const reflect = cur.lastCmd === 'C' || cur.lastCmd === 'S';
          const c1x = smooth ? (reflect ? 2 * cur.x - cur.px : cur.x) : ox + arg(0);
          const c1y = smooth ? (reflect ? 2 * cur.y - cur.py : cur.y) : oy + arg(1);
          const c2x = ox + arg(smooth ? 0 : 2);
          const c2y = oy + arg(smooth ? 1 : 3);
          const x = ox + arg(smooth ? 2 : 4);
          const y = oy + arg(smooth ? 3 : 5);
          pen.bezierCurveTo(flip(x, y), [flip(c1x, c1y), flip(c2x, c2y)]);
          curves++;
          cur.px = c2x;
          cur.py = c2y;
          cur.x = x;
          cur.y = y;
          break;
        }
        case 'q':
        case 't': {
          const smooth = lower === 't';
          const reflect = cur.lastCmd === 'Q' || cur.lastCmd === 'T';
          const cpx = smooth ? (reflect ? 2 * cur.x - cur.px : cur.x) : ox + arg(0);
          const cpy = smooth ? (reflect ? 2 * cur.y - cur.py : cur.y) : oy + arg(1);
          const x = ox + arg(smooth ? 0 : 2);
          const y = oy + arg(smooth ? 1 : 3);
          pen.quadraticBezierCurveTo(flip(x, y), flip(cpx, cpy));
          curves++;
          cur.px = cpx;
          cur.py = cpy;
          cur.x = x;
          cur.y = y;
          break;
        }
        case 'a': {
          const x = ox + arg(5);
          const y = oy + arg(6);
          const runs = arcRuns(
            cur.x,
            cur.y,
            Math.abs(arg(0)),
            Math.abs(arg(1)),
            arg(2),
            arg(3) !== 0,
            arg(4) !== 0,
            x,
            y
          );
          if (runs) {
            for (const run of runs) {
              pen.threePointsArcTo(flip(run.end[0], run.end[1]), flip(run.via[0], run.via[1]));
              curves++;
            }
            cur.x = x;
            cur.y = y;
          } else if (Math.hypot(x - cur.x, y - cur.y) > COINCIDENT) {
            // Zero radius is a straight line; coincident endpoints are nothing
            // at all. Both are what the spec says to draw (F.6.2).
            cur.x = x;
            cur.y = y;
            lineTo(x, y);
          }
          break;
        }
      }
      cur.lastCmd = cmd.toUpperCase();
    }
  }
  return curves;
}

export function drawingFromSvgPath(pathD: string): Drawing | null {
  const pen = draw();
  try {
    return tracePath(pen, pathD) > 0 ? pen.done() : null;
  } catch {
    // The worker has no way to show a broken icon, so an unbuildable path is a
    // missing icon rather than a failed generation.
    return null;
  }
}

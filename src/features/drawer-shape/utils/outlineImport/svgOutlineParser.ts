/**
 * SVG → closed loops in mm, Y-up.
 *
 * Distinct from the cutout importer, which targets bezier paths: a drawer
 * outline is lines and circular arcs, so a circular `A` command is kept as a
 * real arc (a bulge) and only beziers are flattened. Units, transforms and the
 * viewBox frame come from `@/shared/utils/svg`, so both importers agree on
 * where a point lands.
 */

import { SVGPathData, SVGPathDataTransformer } from 'svg-pathdata';
import type { SVGCommand } from 'svg-pathdata';
import { SVGPathData as Cmd } from 'svg-pathdata';
import type { OutlineVertex } from '@/core/types';
import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import {
  parseViewBox,
  resolveTransformChain,
  resolveUserUnitToMm,
  transformPoint,
  type Matrix,
  type ViewBox,
} from '@/shared/utils/svg';
import { ARC_FLATTEN_TOLERANCE } from '@/shared/utils/drawerOutlineGeometry';
import type { ImportedLoop, OutlineImportError } from './types';
import { JOIN_TOLERANCE_MM } from './types';
import { chainEdges } from './chainEdges';

const GEOMETRIC_SELECTOR = ['rect', 'circle', 'ellipse', 'polygon', 'polyline', 'path']
  .map((tag) => `${tag}:not(defs *, clipPath *, mask *, symbol *, pattern *)`)
  .join(', ');

/** An `A` command this close to circular keeps its curvature instead of flattening. */
const CIRCULAR_TOLERANCE = 1e-3;

interface Pt {
  x: number;
  y: number;
}

/** Most points one bezier may flatten to. `simplifyLoop` thins the excess. */
const MAX_BEZIER_STEPS = 256;

/**
 * Subdivisions a cubic bezier needs to stay within the flattening tolerance.
 *
 * Bounded by the control polygon, which is never shorter than the curve, so
 * the estimate is conservative.
 *
 * `toleranceUu` is the mm tolerance expressed in this element's own user units.
 * Curves are flattened before the transform and the unit scale are applied, so
 * comparing a raw user-unit distance against a millimetre tolerance would make
 * accuracy depend on how the file happens to be scaled — a drawing declared at
 * 9mm per user unit would come out nine times coarser than the same drawing
 * declared at 1mm per unit.
 */
function bezierSteps(p0: Pt, c1: Pt, c2: Pt, p1: Pt, toleranceUu: number): number {
  const hull =
    Math.hypot(c1.x - p0.x, c1.y - p0.y) +
    Math.hypot(c2.x - c1.x, c2.y - c1.y) +
    Math.hypot(p1.x - c2.x, p1.y - c2.y);
  return Math.min(MAX_BEZIER_STEPS, Math.max(2, Math.ceil(Math.sqrt(hull / toleranceUu))));
}

/**
 * The mm tolerance in an element's user units.
 *
 * The matrix's isotropic scale is the square root of its determinant — an area
 * ratio, so it averages a non-uniform scale rather than favouring either axis.
 */
function toleranceInUserUnits(m: Matrix, unitToMm: number): number {
  const det = Math.abs(m[0] * m[3] - m[1] * m[2]);
  const scale = Math.sqrt(det) * unitToMm;
  if (!Number.isFinite(scale) || scale <= 1e-9) return ARC_FLATTEN_TOLERANCE;
  return ARC_FLATTEN_TOLERANCE / scale;
}

function cubicAt(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
}

/**
 * Bulges for an SVG elliptical-arc command, or null when it is not circular.
 *
 * SVG gives an arc by its endpoints and radii rather than by a sweep, so the
 * sweep is recovered from the centre parameterisation. Sweeps over 180° split,
 * since the outline model caps `|bulge|` at 1.
 */
function arcBulges(
  from: Pt,
  to: Pt,
  rX: number,
  rY: number,
  xRot: number,
  largeArc: boolean,
  sweepFlag: boolean
): { points: Pt[]; bulges: number[] } | null {
  if (rX <= 0 || rY <= 0) return null;
  if (Math.abs(rX - rY) / Math.max(rX, rY) > CIRCULAR_TOLERANCE) return null;
  if (Math.abs(xRot % 180) > 1e-6) return null;

  const r = (rX + rY) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9 || chord > 2 * r + 1e-6) return null;

  // Half the sweep, from the chord and the radius. The flags then pick which
  // of the four arcs through these endpoints was meant.
  const half = Math.asin(Math.min(1, chord / (2 * r)));
  let sweep = largeArc ? 2 * (Math.PI - half) : 2 * half;
  if (!sweepFlag) sweep = -sweep;

  // Slack on the ratio, not the divisor: 2π/(π−ε) is just over 2, which would
  // split a half-turn arc one more time than it needs.
  const parts = Math.max(1, Math.ceil(Math.abs(sweep) / Math.PI - 1e-9));
  const step = sweep / parts;
  // Centre: perpendicular offset from the chord midpoint, on the side the
  // signed sweep implies.
  const sagittaDir = Math.sign(step);
  const h = Math.sqrt(Math.max(0, r * r - (chord / 2) * (chord / 2)));
  const nx = -dy / chord;
  const ny = dx / chord;
  const side = Math.abs(sweep) > Math.PI ? sagittaDir : -sagittaDir;
  const cx = (from.x + to.x) / 2 + nx * h * side;
  const cy = (from.y + to.y) / 2 + ny * h * side;

  const a0 = Math.atan2(from.y - cy, from.x - cx);
  const points: Pt[] = [];
  for (let i = 1; i < parts; i++) {
    points.push({ x: cx + r * Math.cos(a0 + step * i), y: cy + r * Math.sin(a0 + step * i) });
  }
  return { points, bulges: new Array<number>(parts).fill(Math.tan(step / 4)) };
}

/** Endpoints this close (user units) mean the contour came back to its start. */
const CLOSE_EPS = 1e-6;

interface Contour {
  readonly vertices: OutlineVertex[];
  readonly closed: boolean;
}

/** One `<path>` sub-contour → vertices, in the SVG's own user units. */
function contourVertices(commands: readonly SVGCommand[], toleranceUu: number): Contour | null {
  const verts: { x: number; y: number; bulge: number }[] = [];
  const push = (x: number, y: number, bulge = 0): void => {
    verts.push({ x, y, bulge });
  };
  let cur: Pt = { x: 0, y: 0 };

  for (const c of commands) {
    switch (c.type) {
      case Cmd.MOVE_TO:
        push(c.x, c.y);
        cur = { x: c.x, y: c.y };
        break;
      case Cmd.LINE_TO:
        push(c.x, c.y);
        cur = { x: c.x, y: c.y };
        break;
      case Cmd.CURVE_TO: {
        const p1 = { x: c.x, y: c.y };
        const c1 = { x: c.x1, y: c.y1 };
        const c2 = { x: c.x2, y: c.y2 };
        const steps = bezierSteps(cur, c1, c2, p1, toleranceUu);
        for (let i = 1; i <= steps; i++) {
          const p = cubicAt(cur, c1, c2, p1, i / steps);
          push(p.x, p.y);
        }
        cur = p1;
        break;
      }
      case Cmd.QUAD_TO: {
        const p1 = { x: c.x, y: c.y };
        // Elevate to cubic so one flattener covers both.
        const c1 = { x: cur.x + (2 / 3) * (c.x1 - cur.x), y: cur.y + (2 / 3) * (c.y1 - cur.y) };
        const c2 = { x: p1.x + (2 / 3) * (c.x1 - p1.x), y: p1.y + (2 / 3) * (c.y1 - p1.y) };
        const steps = bezierSteps(cur, c1, c2, p1, toleranceUu);
        for (let i = 1; i <= steps; i++) {
          const p = cubicAt(cur, c1, c2, p1, i / steps);
          push(p.x, p.y);
        }
        cur = p1;
        break;
      }
      case Cmd.ARC: {
        const to = { x: c.x, y: c.y };
        const arc = arcBulges(cur, to, c.rX, c.rY, c.xRot, c.lArcFlag === 1, c.sweepFlag === 1);
        if (arc === null) {
          // Elliptical or degenerate: no bulge can express it, so it lands as
          // a straight hop and the shape stays editable rather than rejected.
          push(to.x, to.y);
        } else {
          // The bulge belongs to the segment LEAVING a vertex, so each split
          // point's bulge is written onto the vertex the sub-arc starts from.
          if (verts.length > 0) verts[verts.length - 1].bulge = arc.bulges[0];
          arc.points.forEach((p, i) => push(p.x, p.y, arc.bulges[i + 1]));
          push(to.x, to.y);
        }
        cur = to;
        break;
      }
    }
  }

  if (verts.length < 2) return null;

  // `NORMALIZE_HVZ` rewrites `Z` as a line back to the start, so no CLOSE_PATH
  // command survives to read a flag from — closure shows up as a duplicated
  // endpoint instead. Testing the geometry also accepts a contour that comes
  // back to its start without ever writing `Z`.
  const first = verts[0];
  const last = verts[verts.length - 1];
  const closed = Math.hypot(first.x - last.x, first.y - last.y) < CLOSE_EPS;
  if (closed) {
    // The duplicate would be a zero-length segment, which the outline validator
    // rejects. Its bulge is not carried over: a bulge describes the segment
    // LEAVING a vertex, and the segment arriving back at the start is already
    // described by the vertex before it.
    verts.pop();
  }

  if (verts.length < (closed ? 3 : 2)) return null;
  return {
    closed,
    vertices: verts.map((v) =>
      v.bulge === 0 ? { x: v.x, y: v.y } : { x: v.x, y: v.y, bulge: v.bulge }
    ),
  };
}

/** Points of a `points`-attribute element, or of a rect/circle/ellipse. */
function shapeVertices(el: Element): { pts: Pt[]; closed: boolean } | null {
  const tag = el.tagName.toLowerCase();
  const attr = (n: string): number => Number(el.getAttribute(n) ?? '0');

  if (tag === 'rect') {
    const x = attr('x');
    const y = attr('y');
    const w = attr('width');
    const h = attr('height');
    if (!(w > 0 && h > 0)) return null;
    return {
      pts: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
      closed: true,
    };
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const cx = attr('cx');
    const cy = attr('cy');
    const rx = tag === 'circle' ? attr('r') : attr('rx');
    const ry = tag === 'circle' ? attr('r') : attr('ry');
    if (!(rx > 0 && ry > 0)) return null;
    // Sampled rather than kept as two half arcs: an ellipse has no bulge form,
    // and a transform can turn even a circle into one.
    const steps = 64;
    const pts: Pt[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return { pts, closed: true };
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const raw = (el.getAttribute('points') ?? '').trim();
    if (raw === '') return null;
    const nums = raw.split(/[\s,]+/).map(Number);
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      if (Number.isFinite(nums[i]) && Number.isFinite(nums[i + 1])) {
        pts.push({ x: nums[i], y: nums[i + 1] });
      }
    }
    if (pts.length < 3) return null;
    return { pts, closed: tag === 'polygon' };
  }
  return null;
}

function mapped(v: OutlineVertex, m: Matrix, vb: ViewBox, s: number): OutlineVertex {
  const p = transformPoint(v.x, v.y, m, vb);
  const x = p.x * s;
  const y = p.y * s;
  // transformPoint flips Y, which reverses the sense of every sweep with it.
  return v.bulge === undefined ? { x, y } : { x, y, bulge: -v.bulge };
}

export function parseSvgOutline(svgString: string): Result<ImportedLoop[], OutlineImportError> {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  if (doc.querySelector('parsererror') !== null) {
    return err({ code: 'PARSE_FAILED', detail: 'malformed SVG' });
  }
  const root = doc.querySelector('svg');
  if (root === null) return err({ code: 'UNSUPPORTED', detail: 'no <svg> root' });

  const { viewBox, hasExplicitViewBox } = parseViewBox(root);
  const scale = hasExplicitViewBox ? resolveUserUnitToMm(root, viewBox) : 1;

  const loops: ImportedLoop[] = [];
  const openRuns: OutlineVertex[][] = [];

  for (const el of root.querySelectorAll(GEOMETRIC_SELECTOR)) {
    const matrix = resolveTransformChain(el, root);
    const toleranceUu = toleranceInUserUnits(matrix, scale);
    const collect = (verts: OutlineVertex[], closed: boolean): void => {
      const out = verts.map((v) => mapped(v, matrix, viewBox, scale));
      if (closed && out.length >= 3) loops.push({ vertices: out });
      else if (out.length >= 2) openRuns.push(out);
    };

    if (el.tagName.toLowerCase() === 'path') {
      const d = el.getAttribute('d');
      if (d === null || d === '') continue;
      let commands: SVGCommand[];
      try {
        commands = new SVGPathData(d)
          .transform(SVGPathDataTransformer.NORMALIZE_HVZ())
          .toAbs().commands;
      } catch {
        continue;
      }
      // Each `M` opens a new sub-contour; a drawer file often holds several.
      let run: SVGCommand[] = [];
      const finish = (): void => {
        if (run.length === 0) return;
        const contour = contourVertices(run, toleranceUu);
        // An unclosed sub-path is not discarded: it joins the chainer, so a
        // perimeter split across several path segments still comes together.
        if (contour !== null) collect(contour.vertices, contour.closed);
        run = [];
      };
      for (const c of commands) {
        if (c.type === Cmd.MOVE_TO && run.length > 0) finish();
        run.push(c);
      }
      finish();
      continue;
    }

    const shape = shapeVertices(el);
    if (shape === null) continue;
    collect(
      shape.pts.map((p) => ({ x: p.x, y: p.y })),
      shape.closed
    );
  }

  // Open runs still get a chance: a perimeter drawn as several polylines is
  // no less a perimeter than one drawn as a single closed path.
  if (openRuns.length > 0) {
    const edges = openRuns.flatMap((run) =>
      run.slice(0, -1).map((v, i) => ({ a: v, b: run[i + 1], bulge: v.bulge ?? 0 }))
    );
    loops.push(...chainEdges(edges, JOIN_TOLERANCE_MM));
  }

  if (loops.length === 0) return err({ code: 'NO_CLOSED_LOOP' });
  return ok(loops);
}

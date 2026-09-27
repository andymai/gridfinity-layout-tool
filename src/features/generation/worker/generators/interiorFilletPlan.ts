/**
 * Per-compartment cavity outlines the interior fillet is built from.
 *
 * Each compartment's air is described as one counter-clockwise polygon at the
 * floor and the same polygon at the top of the fillet's reach. They differ only
 * where a divider leans, and because every face line translates linearly in Z,
 * each vertex does too, so the builder can loft between them or extrapolate a
 * section at any height.
 *
 * The polygons are sharp. The builder rounds them with one OCCT fillet: the
 * floor edges at `radius`, the vertical edges at convex vertices at
 * `cornerRadius`. A reflex vertex is a material corner jutting into the cavity,
 * which the fillet cannot reach; it stays as the body drew it.
 *
 * `bodyRadius` is how the BODY already rounds each corner. The builder grows
 * the outline a little into the surrounding material so the fillet fuses by
 * overlap, and that grown outline has to stay concentric with the body's own
 * arcs: a sharp corner grown past a rounded one pokes out of the bin, and a
 * reflex corner drawn sharp where the body is rounded leaves the grown skin
 * standing in open air.
 */

import { INTERIOR_FILLET_HEADROOM_MM } from '@/shared/utils/interiorFillet';
import type { BinParams, DividerOverride } from '@/shared/types/bin';
import { buildOverrideLookup, dividerFootDrift, overrideKey } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { BOX_CORNER_RADIUS, CLEARANCE, capSectionRadius } from './generatorConstants';
import { cavityCorners } from './compartmentCavities';
import { maskOuterLoopAtInset } from './maskPolygon';

export interface FilletPt {
  readonly x: number;
  readonly y: number;
}

export interface FilletVertex extends FilletPt {
  /** Interior angle under 180°, so the vertical edge here gets `cornerRadius`. */
  readonly convex: boolean;
  /** Radius the body rounds this corner with; 0 when it is sharp. */
  readonly bodyRadius: number;
}

export interface CompartmentFilletPlan {
  readonly id: number;
  readonly zFloor: number;
  readonly zTop: number;
  /** Floor-edge radius. */
  readonly radius: number;
  /** Vertical-edge radius at convex vertices, always above `radius`. */
  readonly cornerRadius: number;
  readonly floor: readonly FilletVertex[];
  readonly top: readonly FilletVertex[];
}

export interface InteriorFilletInput {
  readonly params: BinParams;
  readonly innerW: number;
  readonly innerD: number;
  /** Interior floor top, cavity frame (Z=0 is the box bottom). */
  readonly floorZ: number;
  readonly interiorHeight: number;
  /** Height the divider walls are built to, from Z=0. */
  readonly dividerHeight: number;
  /** The cut path, whose cavity quads are the geometry, not the face lines. */
  readonly bakedCavities: boolean;
  readonly floorRaise: (id: number) => number;
  readonly radius: number;
  /** Grid pitch the shell was built with; a custom shape's outline scales by it. */
  readonly pitch: { readonly x: number; readonly y: number };
}

/** Below this a compartment keeps its sharp junctions. */
export const MIN_BUILT_FILLET_MM = 0.3;

/**
 * How far the corner radius always stays above the floor radius. Equal radii
 * close each corner with a sphere, whose pole tessellates to a zero-area
 * triangle per corner; a torus this much wider looks the same and has none.
 */
const CORNER_OVER_FLOOR_MM = 0.1;

/** Flat left between two fillets that would otherwise meet on one face. */
const FACE_RESERVE_MM = 0.2;

const EPS = 1e-6;

/**
 * Outlines and clamped radii for every compartment the fillet can build, in the
 * cavity-centred frame. Compartments too small for any fillet, or whose outline
 * cannot be traced into one simple polygon, are absent.
 */
export function planInteriorFillets(input: InteriorFilletInput): CompartmentFilletPlan[] {
  const { params } = input;
  if (isPartialMask(params.cellMask)) {
    const plan = planMaskCavity(input);
    return plan ? [plan] : [];
  }
  const out: CompartmentFilletPlan[] = [];
  const lookup = buildOverrideLookup(params.compartments.dividerOverrides);
  for (const id of new Set(params.compartments.cells)) {
    const outline = input.bakedCavities
      ? bakedOutline(input, id, lookup)
      : tracedOutline(input, id, lookup);
    if (!outline) continue;
    const plan = finishPlan(input, id, outline.floor, outline.top, outline.interior);
    if (plan) out.push(plan);
  }
  return out;
}

interface Outline {
  readonly floor: readonly FilletVertex[];
  readonly top: readonly FilletVertex[];
  /** Whether any side is a divider, which caps the top at the divider height. */
  readonly interior: boolean;
}

function zTopFor(input: InteriorFilletInput, interior: boolean): number {
  return interior ? Math.min(input.interiorHeight, input.dividerHeight) : input.interiorHeight;
}

function finishPlan(
  input: InteriorFilletInput,
  id: number,
  floor: readonly FilletVertex[],
  top: readonly FilletVertex[],
  interior: boolean
): CompartmentFilletPlan | null {
  const zFloor = input.floorZ + input.floorRaise(id);
  const zTop = zTopFor(input, interior);
  if (!isSimplePolygon(floor) || !isSimplePolygon(top)) return null;

  const cavityR = Math.max(BOX_CORNER_RADIUS - input.params.wallThickness, 0);
  const cornerLimit = Math.min(cornerRadiusLimit(floor), cornerRadiusLimit(top));
  const cornerRadius = Math.min(Math.max(input.radius, cavityR), cornerLimit);
  const gapLimit = Math.min(minGap(floor), minGap(top)) / 2 - FACE_RESERVE_MM / 2;
  const radius = Math.min(
    input.radius,
    cornerRadius - CORNER_OVER_FLOOR_MM,
    gapLimit,
    zTop - zFloor - INTERIOR_FILLET_HEADROOM_MM
  );
  if (!(radius >= MIN_BUILT_FILLET_MM)) return null;
  return { id, zFloor, zTop, radius, cornerRadius, floor, top };
}

/**
 * How far along each side an arc of unit radius at vertex `i` reaches: 1 at a
 * right angle, more at a sharper one.
 */
export function arcReach(loop: readonly FilletPt[], i: number): number {
  const n = loop.length;
  const prev = loop[(i - 1 + n) % n];
  const v = loop[i];
  const next = loop[(i + 1) % n];
  const ax = v.x - prev.x;
  const ay = v.y - prev.y;
  const bx = next.x - v.x;
  const by = next.y - v.y;
  const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
  return Math.tan(Math.acos(Math.max(-1, Math.min(1, cos))) / 2);
}

/** The largest vertical-edge radius every side can hold at both of its ends. */
function cornerRadiusLimit(loop: readonly FilletVertex[]): number {
  let limit = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const j = (i + 1) % loop.length;
    const a = loop[i];
    const b = loop[j];
    const convexReach = (a.convex ? arcReach(loop, i) : 0) + (b.convex ? arcReach(loop, j) : 0);
    if (convexReach === 0) continue;
    const reflexReach =
      (a.convex ? 0 : a.bodyRadius * arcReach(loop, i)) +
      (b.convex ? 0 : b.bodyRadius * arcReach(loop, j));
    const free = Math.hypot(b.x - a.x, b.y - a.y) - reflexReach - FACE_RESERVE_MM;
    limit = Math.min(limit, free / convexReach);
  }
  return limit;
}

/** Narrowest distance from any vertex to a side it is not on. */
function minGap(loop: readonly FilletVertex[]): number {
  const n = loop.length;
  let gap = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j === i || (j + 1) % n === i) continue;
      gap = Math.min(gap, pointSegmentDistance(loop[i], loop[j], loop[(j + 1) % n]));
    }
  }
  return gap;
}

function pointSegmentDistance(p: FilletPt, a: FilletPt, b: FilletPt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function signedArea(loop: readonly FilletPt[]): number {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function segmentsCross(a: FilletPt, b: FilletPt, c: FilletPt, d: FilletPt): boolean {
  const o = (p: FilletPt, q: FilletPt, r: FilletPt): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < -EPS && d3 * d4 < -EPS;
}

function isSimplePolygon(loop: readonly FilletPt[]): boolean {
  const n = loop.length;
  if (n < 3 || signedArea(loop) <= 1) return false;
  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    if (Math.hypot(b.x - a.x, b.y - a.y) < FACE_RESERVE_MM) return false;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(a, b, loop[j], loop[(j + 1) % n])) return false;
    }
  }
  return true;
}

function withConvexity(
  points: readonly FilletPt[],
  bodyRadius: (i: number, convex: boolean) => number
): FilletVertex[] {
  const n = points.length;
  return points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const cross = (p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x);
    const convex = cross > 0;
    return { x: p.x, y: p.y, convex, bodyRadius: bodyRadius(i, convex) };
  });
}

/** The radius the shell rounds its four inner corners with (`boxBuilder`). */
function shellCornerRadius(input: InteriorFilletInput): number {
  const cavityR = Math.max(BOX_CORNER_RADIUS - input.params.wallThickness, 0);
  return capSectionRadius(input.innerW, input.innerD, cavityR);
}

// --- Cut path: the cavity quads are the cavities ---

function bakedOutline(
  input: InteriorFilletInput,
  id: number,
  lookup: Map<string, DividerOverride>
): Outline | null {
  const corners = cavityCorners(input.params, input.innerW, input.innerD, id, lookup);
  if (!corners) return null;
  const { bl, br, tr, tl, exterior } = corners;
  // The rounding `cavityDrawing` gives a perimeter corner.
  const cavW = Math.min(br[0] - bl[0], tr[0] - tl[0]);
  const cavD = Math.min(tl[1] - bl[1], tr[1] - br[1]);
  const cavityR = Math.max(BOX_CORNER_RADIUS - input.params.wallThickness, 0);
  const r = Math.max(0, Math.min(cavityR, cavW / 2 - 0.05, cavD / 2 - 0.05));
  const rounded = r > 0.1 ? r : 0;
  const onPerimeter = [exterior.bl, exterior.br, exterior.tr, exterior.tl];
  const quad = withConvexity(
    [bl, br, tr, tl].map(([x, y]) => ({ x, y })),
    (i) => (onPerimeter[i] ? rounded : 0)
  );
  const interior = !onPerimeter.every(Boolean);
  return { floor: quad, top: quad, interior };
}

// --- Custom-shape bins: the mask's inner loop ---

function planMaskCavity(input: InteriorFilletInput): CompartmentFilletPlan | null {
  const { params } = input;
  const mask = params.cellMask;
  if (!mask) return null;
  const inset = params.wallThickness;
  // `buildMaskDrawingInset`'s radius, so reflex corners match the body.
  const { vertices, radius } = maskOuterLoopAtInset(
    mask,
    input.pitch,
    CLEARANCE / 2 + inset,
    Math.max(BOX_CORNER_RADIUS - inset, 0)
  );
  const loop = withConvexity(vertices, () => radius);
  const id = params.compartments.cells[0] ?? 0;
  return finishPlan(input, id, loop, loop, false);
}

// --- Additive path: trace the cells, then place each side on its wall ---

interface GridEdge {
  /** Grid vertex the edge leaves, as (column, row). */
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  /** Neighbouring compartment id, or -1 for the bin's own wall. */
  readonly across: number;
}

interface Run {
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly across: number;
}

interface SideLine {
  /** A point on the line at the floor and at the top of the reach. */
  readonly atFloor: FilletPt;
  readonly atTop: FilletPt;
  /** Unit direction of travel, the compartment on its left. */
  readonly dir: FilletPt;
}

function tracedOutline(
  input: InteriorFilletInput,
  id: number,
  lookup: Map<string, DividerOverride>
): Outline | null {
  const loop = outerLoop(input.params, id);
  if (!loop) return null;
  const runs = mergeRuns(loop);
  const interior = runs.some((r) => r.across >= 0);
  const zFloor = input.floorZ + input.floorRaise(id);
  const zTop = zTopFor(input, interior);
  const sides = runs.map((run) => sideLine(input, id, run, lookup, zFloor, zTop));
  const floor = intersectSides(runs, sides, 'atFloor', input);
  const top = intersectSides(runs, sides, 'atTop', input);
  if (!floor || !top || floor.length !== top.length) return null;
  const shellR = shellCornerRadius(input);
  const radiusAt = (i: number, convex: boolean): number =>
    convex && floor[i].betweenWalls ? shellR : 0;
  return {
    floor: withConvexity(floor, radiusAt),
    top: withConvexity(top, radiusAt),
    interior,
  };
}

/** The compartment's boundary as grid edges with it on the left, outer loop only. */
function outerLoop(params: BinParams, id: number): GridEdge[] | null {
  const { cols, rows, cells } = params.compartments;
  const at = (c: number, r: number): number =>
    c < 0 || c >= cols || r < 0 || r >= rows ? -1 : cells[r * cols + c];
  const edges: GridEdge[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (at(c, r) !== id) continue;
      if (at(c, r - 1) !== id) edges.push({ a: [c, r], b: [c + 1, r], across: at(c, r - 1) });
      if (at(c + 1, r) !== id)
        edges.push({ a: [c + 1, r], b: [c + 1, r + 1], across: at(c + 1, r) });
      if (at(c, r + 1) !== id)
        edges.push({ a: [c + 1, r + 1], b: [c, r + 1], across: at(c, r + 1) });
      if (at(c - 1, r) !== id) edges.push({ a: [c, r + 1], b: [c, r], across: at(c - 1, r) });
    }
  }
  const byStart = new Map<string, GridEdge[]>();
  for (const e of edges) {
    const k = `${e.a[0]},${e.a[1]}`;
    const list = byStart.get(k) ?? [];
    list.push(e);
    byStart.set(k, list);
  }
  // Two edges leaving one vertex is a pinch: the traced loop would be ambiguous.
  for (const list of byStart.values()) if (list.length > 1) return null;

  const used = new Set<GridEdge>();
  let best: GridEdge[] | null = null;
  let bestArea = 0;
  for (const start of edges) {
    if (used.has(start)) continue;
    const loop: GridEdge[] = [];
    let e: GridEdge | undefined = start;
    while (e && !used.has(e)) {
      used.add(e);
      loop.push(e);
      e = byStart.get(`${e.b[0]},${e.b[1]}`)?.[0];
    }
    const area = signedArea(loop.map((g) => ({ x: g.a[0], y: g.a[1] })));
    if (area > bestArea) {
      bestArea = area;
      best = loop;
    }
  }
  return best;
}

function edgeDir(e: { a: readonly [number, number]; b: readonly [number, number] }): string {
  return `${Math.sign(e.b[0] - e.a[0])},${Math.sign(e.b[1] - e.a[1])}`;
}

/** Collapse consecutive collinear edges facing the same neighbour into one run. */
function mergeRuns(loop: readonly GridEdge[]): Run[] {
  const n = loop.length;
  const breaks = (i: number): boolean => {
    const p = loop[(i - 1 + n) % n];
    const e = loop[i];
    return edgeDir(p) !== edgeDir(e) || p.across !== e.across;
  };
  let start = 0;
  while (start < n && !breaks(start)) start++;
  if (start === n) start = 0;
  const runs: Run[] = [];
  for (let k = 0; k < n; k++) {
    const e = loop[(start + k) % n];
    if (k > 0 && !breaks((start + k) % n)) {
      const last = runs[runs.length - 1];
      runs[runs.length - 1] = { a: last.a, b: e.b, across: last.across };
    } else {
      runs.push({ a: e.a, b: e.b, across: e.across });
    }
  }
  return runs;
}

function sideLine(
  input: InteriorFilletInput,
  id: number,
  run: Run,
  lookup: Map<string, DividerOverride>,
  zFloor: number,
  zTop: number
): SideLine {
  const { params, innerW, innerD } = input;
  const { cols, rows, thickness } = params.compartments;
  const X = (c: number): number => -innerW / 2 + (c * innerW) / cols;
  const Y = (r: number): number => -innerD / 2 + (r * innerD) / rows;
  const gdx = Math.sign(run.b[0] - run.a[0]);
  const gdy = Math.sign(run.b[1] - run.a[1]);
  const vertical = gdx === 0;
  const a: FilletPt = { x: X(run.a[0]), y: Y(run.a[1]) };

  if (run.across < 0) {
    const onWall = vertical
      ? { x: run.a[0] === 0 ? -innerW / 2 : innerW / 2, y: a.y }
      : { x: a.x, y: run.a[1] === 0 ? -innerD / 2 : innerD / 2 };
    const dir = { x: gdx, y: gdy };
    return { atFloor: onWall, atTop: onWall, dir };
  }

  const override = lookup.get(overrideKey(id, run.across));
  const offS = override?.offsetStart ?? 0;
  const offE = override?.offsetEnd ?? 0;
  // The divider's own run, low coordinate first, exactly as the wall builder draws it.
  const lo = vertical ? Math.min(run.a[1], run.b[1]) : Math.min(run.a[0], run.b[0]);
  const hi = vertical ? Math.max(run.a[1], run.b[1]) : Math.max(run.a[0], run.b[0]);
  const p0: FilletPt = vertical ? { x: a.x + offS, y: Y(lo) } : { x: X(lo), y: a.y + offS };
  const p1: FilletPt = vertical ? { x: a.x + offE, y: Y(hi) } : { x: X(hi), y: a.y + offE };
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  let ux = (p1.x - p0.x) / len;
  let uy = (p1.y - p0.y) / len;

  const H = input.dividerHeight;
  const drift = dividerFootDrift(override, H);
  const driftX = vertical ? drift : 0;
  const driftY = vertical ? 0 : drift;
  // Same half-width `buildLeaningPrism` gives the section.
  const leanAcross = driftX * -uy + driftY * ux;
  const half = H > 0 ? (thickness / 2) * (Math.hypot(leanAcross, H) / H) : thickness / 2;

  if (ux * gdx + uy * gdy < 0) {
    ux = -ux;
    uy = -uy;
  }
  const nx = -uy;
  const ny = ux;
  const at = (z: number): FilletPt => {
    const s = H > 0 ? 1 - z / H : 0;
    return { x: p0.x + driftX * s + nx * half, y: p0.y + driftY * s + ny * half };
  };
  return { atFloor: at(zFloor), atTop: at(zTop), dir: { x: ux, y: uy } };
}

function lineIntersection(p: FilletPt, d: FilletPt, q: FilletPt, e: FilletPt): FilletPt | null {
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den;
  return { x: p.x + t * d.x, y: p.y + t * d.y };
}

function projectOnto(g: FilletPt, p: FilletPt, d: FilletPt): FilletPt {
  const t = (g.x - p.x) * d.x + (g.y - p.y) * d.y;
  return { x: p.x + t * d.x, y: p.y + t * d.y };
}

/**
 * Corners where consecutive sides meet. Two parallel sides are one straight
 * wall when they coincide; when they do not (neighbouring dividers tilted
 * differently along one grid line) the step between them is taken at the grid
 * vertex they share.
 *
 * Two dividers meeting at a corner are separate finite segments that end at
 * their grid vertex. Tilted or leaned far enough that their faces meet more than
 * a divider's thickness from it, the body itself leaves a gap there, and no
 * corner drawn from the lines would match it: the compartment is skipped.
 */
interface Corner extends FilletPt {
  /** Both sides are the bin's own wall, so the shell has rounded it. */
  readonly betweenWalls: boolean;
}

function intersectSides(
  runs: readonly Run[],
  sides: readonly SideLine[],
  at: 'atFloor' | 'atTop',
  input: InteriorFilletInput
): Corner[] | null {
  const { innerW, innerD, params } = input;
  const { cols, rows } = params.compartments;
  const out: Corner[] = [];
  const n = sides.length;
  for (let i = 0; i < n; i++) {
    const s = sides[i];
    const t = sides[(i + 1) % n];
    const gv = runs[i].b;
    const g = {
      x: -innerW / 2 + (gv[0] * innerW) / cols,
      y: -innerD / 2 + (gv[1] * innerD) / rows,
    };
    const hit = lineIntersection(s[at], s.dir, t[at], t.dir);
    if (hit) {
      const bothDividers = runs[i].across >= 0 && runs[(i + 1) % n].across >= 0;
      if (bothDividers && Math.hypot(hit.x - g.x, hit.y - g.y) > params.compartments.thickness) {
        return null;
      }
      const betweenWalls = runs[i].across < 0 && runs[(i + 1) % n].across < 0;
      out.push({ ...hit, betweenWalls });
      continue;
    }
    const u = projectOnto(g, s[at], s.dir);
    const v = projectOnto(g, t[at], t.dir);
    if (Math.hypot(u.x - v.x, u.y - v.y) < EPS) continue;
    out.push({ ...u, betweenWalls: false }, { ...v, betweenWalls: false });
  }
  return out.length >= 3 ? out : null;
}

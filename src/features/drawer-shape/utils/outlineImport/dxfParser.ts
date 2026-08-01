/**
 * ASCII DXF → closed loops in mm.
 *
 * DXF is the faithful format for this model, not the awkward one: group code
 * 42 on a polyline vertex *is* `OutlineVertex.bulge`, same `tan(sweep/4)`
 * convention, so an arc a drawer was measured with imports as an arc instead
 * of a polyline approximating one.
 *
 * Hand-rolled over the group-code format rather than pulling in a DXF library:
 * the entity subset a 2D profile needs is small, and the parsers ship in the
 * eager bundle's reach.
 */

import type { OutlineVertex } from '@/core/types';
import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { ImportedLoop, OutlineImportError } from './types';
import { chainEdges, type Edge, type Pt } from './chainEdges';

/** Marker every binary DXF starts with; we only read the ASCII form. */
const BINARY_SENTINEL = 'AutoCAD Binary DXF';

/**
 * `$INSUNITS` → millimetres. Absent or unitless (0) is treated as mm, which is
 * what CAD aimed at 3D printing overwhelmingly exports.
 */
const INSUNITS_TO_MM: Record<number, number> = {
  1: 25.4, // inches
  2: 304.8, // feet
  4: 1, // millimetres
  5: 10, // centimetres
  6: 1000, // metres
};

interface Pair {
  readonly code: number;
  readonly value: string;
}

/**
 * Split the file into (group code, value) pairs.
 *
 * The format is strictly two lines per pair, so a single stray line shifts
 * every code that follows. A non-numeric code is therefore a hard parse
 * failure rather than something to skip past.
 */
function tokenize(text: string): Pair[] | null {
  const lines = text.split(/\r\n|\r|\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const raw = lines[i].trim();
    if (raw === '') continue;
    const code = Number(raw);
    if (!Number.isInteger(code)) return null;
    pairs.push({ code, value: lines[i + 1].trim() });
  }
  return pairs;
}

/** Value of a group code within one entity's pairs, or undefined. */
function num(pairs: readonly Pair[], code: number): number | undefined {
  const hit = pairs.find((p) => p.code === code);
  if (hit === undefined) return undefined;
  const v = Number(hit.value);
  return Number.isFinite(v) ? v : undefined;
}

function insUnitsScale(pairs: readonly Pair[]): number {
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i].code === 9 && pairs[i].value === '$INSUNITS') {
      const code = Number(pairs[i + 1].value);
      return INSUNITS_TO_MM[code] ?? 1;
    }
  }
  return 1;
}

/** Bulge for an arc sweeping `sweep` radians, halved while it exceeds 180°. */
function arcEdges(center: Pt, r: number, startDeg: number, endDeg: number): Edge[] {
  const TAU = Math.PI * 2;
  const start = (startDeg * Math.PI) / 180;
  let sweep = (((((endDeg - startDeg) * Math.PI) / 180) % TAU) + TAU) % TAU;
  // A DXF arc always runs counter-clockwise, so a zero span means a full turn.
  if (sweep < 1e-12) sweep = TAU;
  // The model caps |bulge| at 1 (a half circle), so anything longer is split
  // into equal sub-arcs rather than rejected. The slack goes on the ratio, not
  // the divisor: 2π/(π−ε) is just over 2, which would split a full circle into
  // three arcs instead of two.
  const parts = Math.max(1, Math.ceil(sweep / Math.PI - 1e-9));
  const step = sweep / parts;
  const at = (t: number): Pt => ({
    x: center.x + r * Math.cos(start + t),
    y: center.y + r * Math.sin(start + t),
  });
  const bulge = Math.tan(step / 4);
  const edges: Edge[] = [];
  for (let i = 0; i < parts; i++) {
    edges.push({ a: at(i * step), b: at((i + 1) * step), bulge });
  }
  return edges;
}

/** Vertices of an LWPOLYLINE / POLYLINE body, in stream order. */
function polylineVertices(pairs: readonly Pair[]): OutlineVertex[] {
  const verts: { x: number; y: number; bulge: number }[] = [];
  for (const p of pairs) {
    if (p.code === 10) verts.push({ x: Number(p.value), y: 0, bulge: 0 });
    else if (p.code === 20 && verts.length > 0) verts[verts.length - 1].y = Number(p.value);
    else if (p.code === 42 && verts.length > 0) verts[verts.length - 1].bulge = Number(p.value);
  }
  return verts
    .filter((v) => Number.isFinite(v.x) && Number.isFinite(v.y))
    .map((v) =>
      Number.isFinite(v.bulge) && v.bulge !== 0
        ? { x: v.x, y: v.y, bulge: v.bulge }
        : { x: v.x, y: v.y }
    );
}

function scaleLoop(loop: ImportedLoop, s: number): ImportedLoop {
  if (s === 1) return loop;
  return {
    vertices: loop.vertices.map((v) =>
      v.bulge === undefined
        ? { x: v.x * s, y: v.y * s }
        : { x: v.x * s, y: v.y * s, bulge: v.bulge }
    ),
  };
}

/**
 * Read every closed loop an ASCII DXF describes.
 *
 * Closed LWPOLYLINE/POLYLINE entities and CIRCLEs become loops directly; loose
 * LINE and ARC entities, and open polylines, are chained by their endpoints.
 */
export function parseDxfString(text: string): Result<ImportedLoop[], OutlineImportError> {
  if (text.startsWith(BINARY_SENTINEL)) {
    return err({ code: 'BINARY_DXF' });
  }
  const pairs = tokenize(text);
  if (pairs === null || pairs.length === 0) {
    return err({ code: 'PARSE_FAILED', detail: 'not a group-code stream' });
  }

  const scale = insUnitsScale(pairs);
  const loops: ImportedLoop[] = [];
  const loose: Edge[] = [];

  // Group codes belong to the entity that most recently opened with code 0.
  let name = '';
  let body: Pair[] = [];
  // A POLYLINE's closed flag lives on its header, but its geometry arrives as
  // the VERTEX entities that follow, so both have to be carried across entities.
  let polyOpen = false;
  let polyClosed = false;
  let polyBody: Pair[] = [];

  const flush = (): void => {
    switch (name) {
      case 'LWPOLYLINE': {
        const verts = polylineVertices(body);
        if (verts.length < 2) break;
        const closed = ((num(body, 70) ?? 0) & 1) === 1;
        if (closed && verts.length >= 3) loops.push({ vertices: verts });
        else loose.push(...verticesToEdges(verts));
        break;
      }
      case 'POLYLINE':
        polyOpen = true;
        polyClosed = ((num(body, 70) ?? 0) & 1) === 1;
        polyBody = [];
        break;
      case 'VERTEX':
        if (polyOpen) polyBody.push(...body);
        break;
      case 'SEQEND': {
        if (!polyOpen) break;
        polyOpen = false;
        const verts = polylineVertices(polyBody);
        if (verts.length < 2) break;
        if (polyClosed && verts.length >= 3) loops.push({ vertices: verts });
        else loose.push(...verticesToEdges(verts));
        break;
      }
      case 'LINE': {
        const x1 = num(body, 10);
        const y1 = num(body, 20);
        const x2 = num(body, 11);
        const y2 = num(body, 21);
        if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) break;
        loose.push({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, bulge: 0 });
        break;
      }
      case 'ARC': {
        const cx = num(body, 10);
        const cy = num(body, 20);
        const r = num(body, 40);
        const a0 = num(body, 50);
        const a1 = num(body, 51);
        if (cx === undefined || cy === undefined || r === undefined || r <= 0) break;
        if (a0 === undefined || a1 === undefined) break;
        loose.push(...arcEdges({ x: cx, y: cy }, r, a0, a1));
        break;
      }
      case 'CIRCLE': {
        const cx = num(body, 10);
        const cy = num(body, 20);
        const r = num(body, 40);
        if (cx === undefined || cy === undefined || r === undefined || r <= 0) break;
        // A full turn is its own closed loop, so it never reaches the chainer.
        const edges = arcEdges({ x: cx, y: cy }, r, 0, 360);
        loops.push({
          vertices: edges.map((e) => ({ x: e.a.x, y: e.a.y, bulge: e.bulge })),
        });
        break;
      }
    }
  };

  for (const p of pairs) {
    if (p.code === 0) {
      flush();
      name = p.value.toUpperCase();
      body = [];
      continue;
    }
    body.push(p);
  }
  flush();

  const scaled = [...loops, ...chainEdges(loose)].map((l) => scaleLoop(l, scale));
  if (scaled.length === 0) return err({ code: 'NO_CLOSED_LOOP' });
  return ok(scaled);
}

/** Open polyline → edges, so it can still join a loop with other entities. */
function verticesToEdges(verts: readonly OutlineVertex[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < verts.length - 1; i++) {
    edges.push({ a: verts[i], b: verts[i + 1], bulge: verts[i].bulge ?? 0 });
  }
  return edges;
}

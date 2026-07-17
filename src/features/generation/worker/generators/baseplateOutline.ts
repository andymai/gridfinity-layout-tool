/**
 * DrawerOutline → brepjs Drawing for the baseplate generator.
 *
 * The outline arrives in plate-local mm (origin bottom-left of the plate's
 * outer extent) and is emitted in the worker's centered frame, matching
 * `buildSlabProfile` — the caller extrudes it and translates by the slab
 * offset exactly like the corner-rounding profile.
 *
 * Straight axis-aligned segments lying on a half-grid line or a plate bbox
 * face are nudged COPLANAR_OVERLAP toward the loop's OUTSIDE (right of CCW
 * travel), so the outline-clip intersect never runs face-on-face against the
 * slab's bbox or a pocket wall — pocket mouths open to the full cell at the
 * slab top (INSET_TOP = 0), putting walls exactly on every cell boundary, and
 * a coplanar boolean there is pathologically slow on brepkit (>30s vs <2s).
 * The nudge cuts through solid material 0.01mm into the excluded region
 * instead. Padding shifts the grid within the plate-local frame, so grid
 * lines sit at padding + k·halfPitch while the bbox faces stay at 0/total.
 */
import { draw } from 'brepjs';
import type { Drawing } from 'brepjs';
import type { DrawerOutline } from '@/core/types';
import {
  arcGeometry,
  arcPointAt,
  BULGE_EPS,
  bulgeForSweep,
} from '@/shared/utils/drawerOutlineGeometry';
import { COPLANAR_OVERLAP } from './generatorConstants';

const COINCIDENT_EPS = 1e-3;

/**
 * Arcs near a semicircle are split in two before pen-building: at exactly
 * |sagitta| = chord/2 the two kernels disagree (brepkit's sagittaArcTo spans
 * both sides of the chord; see sagittaArcConvention kernel test). Splitting a
 * bulge-1 arc yields two tan(π/8) ≈ 0.414 halves, far from the edge case.
 */
const MAX_SAFE_BULGE = 0.75;

export interface OutlineFrame {
  /** Plate outer extent (mm) — the outline's coordinate space spans it. */
  readonly totalW: number;
  readonly totalD: number;
  /** Grid pitch (mm); cell boundaries sit at multiples of half of it,
   * offset by the left/front padding in plate-local coords. */
  readonly gridUnitMm: number;
  readonly paddingLeft?: number;
  readonly paddingFront?: number;
}

/**
 * Pen-build the closed outline Drawing in the centered frame. Throws on
 * degenerate input (fewer than 3 vertices, coincident consecutive points) —
 * a silent fallback here would ship a wrong plate shape.
 */
export function buildOutlineDrawing(outline: DrawerOutline, frame: OutlineFrame): Drawing {
  const verts = outline.vertices;
  if (verts.length < 3) {
    throw new Error(`outline needs at least 3 vertices, got ${verts.length}`);
  }

  const halfW = frame.totalW / 2;
  const halfD = frame.totalD / 2;
  const halfPitch = frame.gridUnitMm / 2;
  const padLeft = frame.paddingLeft ?? 0;
  const padFront = frame.paddingFront ?? 0;
  const points = verts.map((v) => ({
    x: v.x,
    y: v.y,
    bulge: v.bulge ?? 0,
  }));

  // Coplanar candidates per axis: the plate bbox faces (0 and total) plus the
  // grid lines, which padding offsets within the plate-local frame.
  const onCoplanarLine = (value: number, padding: number, total: number): number | null => {
    if (Math.abs(value) <= COPLANAR_OVERLAP) return 0;
    if (Math.abs(value - total) <= COPLANAR_OVERLAP) return total;
    const snapped = padding + Math.round((value - padding) / halfPitch) * halfPitch;
    return Math.abs(value - snapped) <= COPLANAR_OVERLAP ? snapped : null;
  };
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    if (Math.abs(verts[i].bulge ?? 0) >= BULGE_EPS) continue;
    if (Math.abs(a.x - b.x) <= COPLANAR_OVERLAP) {
      const line = onCoplanarLine(a.x, padLeft, frame.totalW);
      if (line !== null && Math.abs(b.y - a.y) > COPLANAR_OVERLAP) {
        // Vertical segment on a cell boundary: right of travel is +x when
        // heading up. Both endpoints move so the segment stays vertical.
        const shifted = line + Math.sign(b.y - a.y) * COPLANAR_OVERLAP;
        a.x = shifted;
        b.x = shifted;
      }
    } else if (Math.abs(a.y - b.y) <= COPLANAR_OVERLAP) {
      const line = onCoplanarLine(a.y, padFront, frame.totalD);
      if (line !== null) {
        // Horizontal segment: right of travel is −y when heading +x.
        const shifted = line - Math.sign(b.x - a.x) * COPLANAR_OVERLAP;
        a.y = shifted;
        b.y = shifted;
      }
    }
  }
  for (const p of points) {
    p.x -= halfW;
    p.y -= halfD;
  }

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < COINCIDENT_EPS) {
      throw new Error(`outline has coincident consecutive vertices at index ${i}`);
    }
  }

  interface Pt {
    readonly x: number;
    readonly y: number;
  }
  let pen = draw([points[0].x, points[0].y]);
  // DXF bulge → sagitta: |s| = |b|·chord/2. DXF positive bulge bows RIGHT of
  // travel; brepjs sagittaArcTo bows LEFT for positive sagitta (pinned by the
  // sagittaArcConvention kernel test), hence the negation.
  const emitArc = (from: Pt, to: Pt, bulge: number): void => {
    if (Math.abs(bulge) > MAX_SAFE_BULGE) {
      const arc = arcGeometry(from, to, bulge);
      if (arc !== null) {
        const mid = arcPointAt(arc, 0.5);
        const half = bulgeForSweep(arc.sweep / 2);
        emitArc(from, mid, half);
        emitArc(mid, to, half);
        return;
      }
    }
    const chord = Math.hypot(to.x - from.x, to.y - from.y);
    pen = pen.sagittaArcTo([to.x, to.y], (-bulge * chord) / 2);
  };
  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = points[(i + 1) % points.length];
    const isClosing = i === points.length - 1;
    if (Math.abs(from.bulge) < BULGE_EPS) {
      if (!isClosing) pen = pen.lineTo([to.x, to.y]);
      continue;
    }
    emitArc(from, to, from.bulge);
  }
  return pen.close();
}

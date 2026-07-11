/**
 * DrawerOutline → brepjs Drawing for the baseplate generator.
 *
 * The outline arrives in plate-local mm (origin bottom-left of the plate's
 * outer extent) and is emitted in the worker's centered frame, matching
 * `buildSlabProfile` — the caller extrudes it and translates by the slab
 * offset exactly like the corner-rounding profile.
 *
 * Vertices lying on the plate's bounding box are nudged outward by
 * COPLANAR_OVERLAP so the outline-clip intersect never runs face-on-face
 * against the cached slab (rectilinear cell-paint outlines put whole edges
 * exactly on the bbox).
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
  const nudge = (value: number, max: number): number => {
    if (Math.abs(value) <= COPLANAR_OVERLAP) return -COPLANAR_OVERLAP;
    if (Math.abs(value - max) <= COPLANAR_OVERLAP) return max + COPLANAR_OVERLAP;
    return value;
  };
  const points = verts.map((v) => ({
    x: nudge(v.x, frame.totalW) - halfW,
    y: nudge(v.y, frame.totalD) - halfD,
    bulge: v.bulge ?? 0,
  }));

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

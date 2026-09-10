/** The profile cutter that carves an assembly part's outline out of its blank. */
import { drawCircle, drawRoundedRectangle, fuseAll, unwrap } from 'brepjs';
import type { Drawing, Shape3D, ValidSolid } from 'brepjs';
import type { CutterParams, CutterProfile } from '@/shared/types/assembly';
import {
  clampPolygonSides,
  regularPolygonPoints,
  slotCornerRadius,
} from '@/shared/utils/cutoutPolygon';
import { dropCoincidentPoints } from '@/shared/utils/polyline';
import { flattenPathToPolyline, pathWire, polylineSelfIntersects } from './cutoutBuilder';
import { offsetClosedPolygon } from './polygonOffset';
import { sketch } from './meshUtils';

/** Cutters overshoot their seat so the cut opens the top face cleanly. */
const CUTTER_TOP_OVERSHOOT = 1;

function centeredOnBounds(pts: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

/**
 * 2D drawing for a cutter profile, grown outward by `grow` mm. Matches the
 * proxy's centering rule: parametric shapes are origin-centered, path and
 * outline profiles are centered on their own bounding box. Null when the
 * profile is degenerate.
 */
export function cutterProfileDrawing(profile: CutterProfile, grow: number): Drawing | null {
  switch (profile.shape) {
    case 'circle': {
      const r = profile.diameter / 2 + grow;
      return r > 0.05 ? drawCircle(r) : null;
    }
    case 'rectangle': {
      const w = profile.width + 2 * grow;
      const d = profile.depth + 2 * grow;
      if (w <= 0.1 || d <= 0.1) return null;
      const r = Math.min(Math.max(profile.cornerRadius + grow, 0), Math.min(w, d) / 2 - 0.01);
      return drawRoundedRectangle(w, d, Math.max(r, 0));
    }
    case 'polygon': {
      const sides = clampPolygonSides(profile.sides);
      const dia = profile.diameter;
      if (dia <= 0.1) return null;
      const pts = regularPolygonPoints(sides, dia, dia);
      const grown = grow !== 0 ? offsetClosedPolygon(pts, grow) : pts;
      if (grown.length < 3) return null;
      return pathWire(grown);
    }
    case 'slot': {
      const length = profile.length + 2 * grow;
      const width = profile.width + 2 * grow;
      if (length <= 0.1 || width <= 0.1) return null;
      return drawRoundedRectangle(length, width, slotCornerRadius(length, width) - 0.01);
    }
    case 'path': {
      const polyline = dropCoincidentPoints(flattenPathToPolyline(profile.points));
      if (polyline.length < 3 || polylineSelfIntersects(polyline)) return null;
      const centered = centeredOnBounds(polyline);
      const grown = grow !== 0 ? offsetClosedPolygon(centered, grow) : centered;
      if (grown.length < 3) return null;
      return pathWire(grown);
    }
    case 'outline': {
      const polyline = dropCoincidentPoints(profile.points.map((p) => ({ x: p.x, y: p.y })));
      if (polyline.length < 3 || polylineSelfIntersects(polyline)) return null;
      const centered = centeredOnBounds(polyline);
      const grown = grow !== 0 ? offsetClosedPolygon(centered, grow) : centered;
      if (grown.length < 3) return null;
      return pathWire(grown);
    }
  }
}

/**
 * A cutter tool solid in the seat frame: occupies z ∈ [-depth, +overshoot]
 * with an optional 45°-ish entry chamfer collar lofted at the seat.
 */
export function buildCutterSolid(params: CutterParams): Shape3D | null {
  const drawing = cutterProfileDrawing(params.profile, params.clearance);
  if (!drawing) return null;
  const body = sketch(drawing, 'XY', -params.depth).extrude(params.depth + CUTTER_TOP_OVERSHOOT);
  if (params.chamfer <= 0) return body;
  const inner = cutterProfileDrawing(params.profile, params.clearance);
  const outer = cutterProfileDrawing(params.profile, params.clearance + params.chamfer);
  if (!inner || !outer) return body;
  try {
    const collar = sketch(inner, 'XY', -params.chamfer).loftWith(
      [sketch(outer, 'XY', CUTTER_TOP_OVERSHOOT)],
      { ruled: true }
    );
    const fused = fuseAll([body, collar] as ValidSolid[], { optimisation: 'commonFace' });
    const result = unwrap(fused);
    if (result !== body) body.delete();
    if (result !== collar) collar.delete();
    return result;
  } catch {
    return body;
  }
}

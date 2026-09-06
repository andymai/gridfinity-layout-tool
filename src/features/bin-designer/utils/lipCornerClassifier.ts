/**
 * Lip color classification: maps a lip triangle to a grid cell
 * (XY corner quadrant × Z height band). Both the 3MF exporter (flat-vertex
 * STL) and the 3D preview (indexed BufferGeometry) supply a `triangleXYZ`
 * callback so this module stays geometry-format-agnostic.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import { GRIDFINITY_SPEC, PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import { collapseLipCell } from '../types/featureColors';
import type { LipCorner, LipBand, LipAxisCount, LipCellZone } from '../types/featureColors';

/**
 * Height the lip solid stands above the wall it is fused onto, so the wall top
 * can be recovered from the lip's own peak without the caller passing the bin's
 * dimensions in.
 */
const LIP_PROTRUSION_MM = GRIDFINITY_SPEC.LIP_HEIGHT;

/**
 * Gap between the wall top and the first colourable lip geometry.
 *
 * The bin's top surface can reach the wall top exactly (a cutout plate, a
 * lowered fill), and a slicer finishes that surface in the layer straddling it.
 * Colour reaching into that layer forces a filament change per top-surface
 * layer. One max-supported layer of clearance keeps the boundary clear of it at
 * every layer height the app allows, so the value need not be plumbed through
 * from print settings.
 */
const LIP_COLOR_FLOOR_CLEARANCE_MM = PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MAX;

/** Lip footprint geometry needed to classify a triangle into a grid cell. */
export interface LipGeom {
  readonly cx: number;
  readonly cy: number;
  readonly minZ: number;
  readonly maxZ: number;
  /**
   * Bottom of the colourable region — bands divide `[floorZ, maxZ]`, and lip
   * geometry below it takes the body colour instead of a lip cell.
   *
   * `buildTopShape` hangs an angled support `LIP_TAPER_WIDTH` under the lip's
   * base plane to blend into the wall, and it carries the LIP tag, so `minZ`
   * sits ~2.7mm BELOW the bin's top surface. Colouring from there paints the
   * wall and the top surface's own layers (#3705).
   */
  readonly floorZ: number;
}

/**
 * Returns the 9 position floats of one triangle, in triangle order.
 * Matches `lipSeamSplitter`'s accessor so a caller builds one for both.
 */
export type TriangleAccessor = (triangleIndex: number) => ArrayLike<number>;

/**
 * Compute the lip footprint's center and Z extent from LIP triangle
 * *centroids* (not vertices). Centroids keep a triangle that straddles an
 * axis from shifting the split, so the quadrants stay symmetric for
 * rectangular bins and the band range hugs the actual lip skirt. Returns
 * null when no lip exists.
 */
export function computeLipGeom(
  faceGroups: readonly FaceGroupData[],
  getTriangle: TriangleAccessor
): LipGeom | null {
  const geom = computeTaggedGeom(faceGroups, getTriangle, FeatureTag.LIP);
  if (!geom) return null;
  // `peakZ`, not the centroid-derived `maxZ`: the wall top is a fixed offset
  // below the lip's actual apex, and centroids sit however far under it the
  // tessellation happens to put them.
  const wallTopZ = geom.peakZ - LIP_PROTRUSION_MM;
  // Clamped into [minZ, maxZ]: a lip whose support was omitted (`lipHasSupport`
  // false on a short wall) already starts at its base plane, and a degenerate
  // extent must not invert the band interval.
  const floorZ = Math.min(Math.max(geom.minZ, wallTopZ + LIP_COLOR_FLOOR_CLEARANCE_MM), geom.maxZ);
  return { ...geom, floorZ };
}

/**
 * The LID's own top lip (`FeatureTag.LID_LIP`), same derivation.
 *
 * Separate entry point rather than a shared default parameter so a caller
 * cannot accidentally classify one object's triangles against the other's
 * footprint — the bin and the lid are different meshes with different extents.
 *
 * No colour floor: the lid's stack grid is a slab extruded UP from the lid's
 * top face, so none of it hides under the surface it sits on.
 */
export function computeLidLipGeom(
  faceGroups: readonly FaceGroupData[],
  getTriangle: TriangleAccessor
): LipGeom | null {
  return computeTaggedGeom(faceGroups, getTriangle, FeatureTag.LID_LIP);
}

function computeTaggedGeom(
  faceGroups: readonly FaceGroupData[],
  getTriangle: TriangleAccessor,
  tag: number
): (LipGeom & { peakZ: number }) | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let peakZ = -Infinity;
  let any = false;

  for (const g of faceGroups) {
    if (g.tag !== tag) continue;
    const triStart = g.start / 3;
    const triEnd = triStart + g.count / 3;
    for (let i = triStart; i < triEnd; i++) {
      const t = getTriangle(i);
      const x = (t[0] + t[3] + t[6]) / 3;
      const y = (t[1] + t[4] + t[7]) / 3;
      const z = (t[2] + t[5] + t[8]) / 3;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      if (t[2] > peakZ) peakZ = t[2];
      if (t[5] > peakZ) peakZ = t[5];
      if (t[8] > peakZ) peakZ = t[8];
      any = true;
    }
  }

  if (!any) return null;
  // `floorZ = minZ` is the no-op default: only the bin lip hangs geometry below
  // the surface it sits on, and `computeLipGeom` narrows it there.
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, minZ, maxZ, floorZ: minZ, peakZ };
}

/**
 * Front = lower Y (camera-facing face in the preview); Right = higher X.
 * Centroids on the exact centerline tie to back/right — deterministic
 * regardless of float drift.
 */
export function classifyLipCorner(
  centroidX: number,
  centroidY: number,
  cx: number,
  cy: number
): LipCorner {
  const right = centroidX >= cx;
  const back = centroidY >= cy;
  if (back) return right ? 'backRight' : 'backLeft';
  return right ? 'frontRight' : 'frontLeft';
}

/**
 * Band index for a centroid Z within [minZ, maxZ], split into `bands` equal
 * slices (0 = bottom). Clamps at the top so a centroid exactly at maxZ lands
 * in the last band rather than overflowing.
 */
export function classifyLipBand(
  centroidZ: number,
  minZ: number,
  maxZ: number,
  bands: LipAxisCount
): LipBand {
  if (bands <= 1 || maxZ <= minZ) return 0;
  const t = (centroidZ - minZ) / (maxZ - minZ);
  const idx = Math.floor(t * bands);
  const clamped = idx < 0 ? 0 : idx > bands - 1 ? bands - 1 : idx;
  return clamped as LipBand;
}

/**
 * True when {@link LipGeom.floorZ} actually carves a slice off the bottom of
 * the lip. False for the lid grid and for any lip that starts at its own base
 * plane, so those keep the historic whole-extent behaviour.
 */
export function lipColorFloorActive(geom: LipGeom): boolean {
  return geom.floorZ > geom.minZ && geom.floorZ < geom.maxZ;
}

/**
 * Classify a lip triangle centroid into the canonical grid cell for the
 * active corner/band counts. The single source of truth shared by the
 * splitter, preview, exporter, and hit-test resolver.
 *
 * Null below {@link LipGeom.floorZ} — the support skirt there belongs to the
 * wall, not to any lip cell, and the caller resolves it to the body colour.
 */
export function classifyLipCell(
  x: number,
  y: number,
  z: number,
  geom: LipGeom,
  counts: { corners: LipAxisCount; bands: LipAxisCount }
): LipCellZone | null {
  if (z <= geom.floorZ && lipColorFloorActive(geom)) return null;
  const corner = classifyLipCorner(x, y, geom.cx, geom.cy);
  const band = classifyLipBand(z, geom.floorZ, geom.maxZ, counts.bands);
  return collapseLipCell(corner, band, counts);
}

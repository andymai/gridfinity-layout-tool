/**
 * Socket cell generation for Gridfinity bin bases.
 *
 * Builds the segmented base socket grid: per-cell tapered frustum sockets
 * (full 42mm + half 21mm cells) with optional magnet/screw holes.
 *
 * Socket coordinate system:
 * - Z=0: top face (mates with bin body)
 * - Z=-SOCKET_HEIGHT: bottom face
 */

import {
  drawRoundedRectangle,
  cylinder,
  unwrap,
  fuseAll,
  cutAll,
  clone,
  translate,
  fuse,
} from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import {
  SIZE,
  CLEARANCE,
  CORNER_RADIUS,
  SOCKET_HEIGHT,
  SOCKET_BIG_TAPER,
  SOCKET_VERTICAL_PART,
  SOCKET_TAPER_WIDTH,
  forEachCell,
} from './generatorTypes';
import { socketCacheKey, getSocketCache, setSocketCache } from './shapeCache';

// ─── Socket Cell Builders ────────────────────────────────────────────────────

/**
 * Build a single socket cell solid at the origin using multi-section loft.
 *
 * The socket is a frustum-like solid whose cross-section shrinks with depth,
 * following the standard Gridfinity tapered profile. Built as a ruled loft
 * through 5 sections corresponding to the profile breakpoints:
 *   Z=0:     outer boundary (top face, mates with bin body)
 *   Z=-0.25: same as top (vertical clearance step)
 *   Z=-2.4:  inset by 2.15mm (end of big taper)
 *   Z=-4.2:  same inset (vertical wall section)
 *   Z=-5.0:  inset by 2.95mm (end of small taper, bottom face)
 *
 * This approach avoids EdgeFinder limitations with non-square cells.
 *
 * @param cellW_mm Physical width of this cell in mm (after clearance)
 * @param cellD_mm Physical depth of this cell in mm (after clearance)
 */
export function buildSingleCellSocket(cellW_mm: number, cellD_mm: number): Shape3D {
  // Clamp corner radius to fit within cell dimensions
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  // Profile insets from outer boundary at each Z breakpoint
  // (derived from socketProfile after translate(CLEARANCE/2, 0))
  const INSET_TOP = 0;
  const INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

  // Z positions of profile breakpoints
  const Z1 = 0;
  const Z2 = -(CLEARANCE / 2); // -0.25
  const Z3 = -SOCKET_BIG_TAPER; // -2.4
  const Z4 = -(SOCKET_BIG_TAPER + SOCKET_VERTICAL_PART); // -4.2
  const Z5 = -SOCKET_HEIGHT; // -5.0

  // Helper to create a rounded rect sketch at a given Z with a given inset
  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  // Build 5 cross-sections matching the socket profile breakpoints
  const s1 = sectionAt(Z1, INSET_TOP);
  const s2 = sectionAt(Z2, INSET_TOP);
  const s3 = sectionAt(Z3, INSET_MID);
  const s4 = sectionAt(Z4, INSET_MID);
  const s5 = sectionAt(Z5, INSET_BOT);

  // Ruled loft through all sections -- straight-line connections between
  // corresponding points, matching the angular profile exactly
  return s1.loftWith([s2, s3, s4, s5], { ruled: true });
}

/**
 * Build a simplified 3-section socket cell for preview rendering.
 *
 * Uses only 3 sections (top, mid, bottom) instead of the full 5-section
 * profile. Visually similar but generates fewer triangles for faster
 * preview updates. Export mode uses buildSingleCellSocket for full fidelity.
 */
export function buildSimplifiedCellSocket(cellW_mm: number, cellD_mm: number): Shape3D {
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  const INSET_TOP = 0;
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2;

  const Z1 = 0;
  const Z3 = -SOCKET_HEIGHT;

  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  const s1 = sectionAt(Z1, INSET_TOP);
  const s3 = sectionAt(Z3, INSET_BOT);

  return s1.loftWith([s3], { ruled: true });
}

// ─── Socket Grid Assembly ────────────────────────────────────────────────────

/**
 * Build the segmented base socket grid for the bin.
 *
 * Decomposes the bin footprint into per-cell sockets (full 42mm or half 21mm cells),
 * each with the standard Gridfinity tapered profile. This ensures proper baseplate
 * interface for any half-bin dimension.
 *
 * Magnet/screw holes are placed at the standard 4-corner positions (±13mm from
 * cell center) using the original cell decomposition, NOT the half-socket sub-cells.
 * This ensures magnets align with the baseplate regardless of socket subdivision.
 * Sub-unit cells (from fractional grid dimensions like 1.5×1) are skipped since
 * the Gridfinity spec doesn't define magnet positions for fractional cells.
 *
 * @param forExport If true, uses full 5-section socket profile. Preview uses 3-section.
 */
export function buildBaseSocket(
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport = false,
  halfSockets = false
): Shape3D {
  // Check socket cache -- skip entire build if params haven't changed
  const key = socketCacheKey(
    gridW,
    gridD,
    withMagnet,
    withScrew,
    magnetRadius,
    magnetDepth,
    screwRadius,
    forExport,
    halfSockets
  );
  const cached = getSocketCache(key);
  if (cached) {
    return cached;
  }

  // Build and position each cell socket
  const cellSockets: Shape3D[] = [];

  forEachCell(
    gridW,
    gridD,
    (cell) => {
      const cellW_mm = cell.widthUnits * SIZE - CLEARANCE;
      const cellD_mm = cell.depthUnits * SIZE - CLEARANCE;
      // Use simplified 3-section socket for preview, full 5-section for export
      const cellSocket = translate(
        forExport
          ? buildSingleCellSocket(cellW_mm, cellD_mm)
          : buildSimplifiedCellSocket(cellW_mm, cellD_mm),
        [cell.centerX, cell.centerY, 0]
      );
      cellSockets.push(cellSocket);
    },
    halfSockets
  );

  if (cellSockets.length === 0) {
    throw new Error('Invalid grid dimensions: at least one cell required');
  }
  let result: Shape3D = unwrap(fuseAll(cellSockets, { optimisation: 'commonFace' }));

  // Cut magnet/screw holes at standard 4-corner positions per full cell.
  // Uses the ORIGINAL cell decomposition (not half-socket sub-cells) so that
  // magnet positions align with the baseplate regardless of socket subdivision.
  // Sub-unit cells (from fractional grid dimensions) are skipped — the Gridfinity
  // spec only defines magnet positions for full-unit cells.
  if (withScrew || withMagnet) {
    const HOLE_OFFSET = 13; // mm from cell center to hole center (Gridfinity spec)
    const magnetCutout = withMagnet ? cylinder(magnetRadius, magnetDepth) : null;
    const screwCutout = withScrew ? cylinder(screwRadius, SOCKET_HEIGHT) : null;

    const cutout: Shape3D =
      magnetCutout && screwCutout
        ? unwrap(fuse(magnetCutout, screwCutout))
        : ((magnetCutout || screwCutout) as Shape3D);

    // 4 holes per full cell at ±HOLE_OFFSET from center
    const holeOffsets: ReadonlyArray<readonly [number, number]> = [
      [-HOLE_OFFSET, -HOLE_OFFSET],
      [-HOLE_OFFSET, HOLE_OFFSET],
      [HOLE_OFFSET, HOLE_OFFSET],
      [HOLE_OFFSET, -HOLE_OFFSET],
    ];

    const holeTools: Shape3D[] = [];
    forEachCell(gridW, gridD, (cell) => {
      // Only cut holes in full-size cells (spec doesn't define positions for fractional)
      if (cell.widthUnits < 1 || cell.depthUnits < 1) return;

      for (const [dx, dy] of holeOffsets) {
        holeTools.push(
          translate(clone(cutout), [cell.centerX + dx, cell.centerY + dy, -SOCKET_HEIGHT])
        );
      }
    });

    if (holeTools.length > 0) {
      result = unwrap(cutAll(result, holeTools));
    }
  }

  return setSocketCache(key, result);
}

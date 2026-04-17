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
  withScope,
  booleanPipeline,
  isOk,
} from 'brepjs';
import type { Shape3D, ValidSolid, Sketch, DisposalScope, BooleanPipelineStep } from 'brepjs';
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
import { hashMask, isPartialMask, isRegionFilled, type CellMask } from '@/shared/utils/cellMask';
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
/** Fuse all cell sockets, then cut all hole tools. Disposes replaced intermediates. */
function batchFuseAndCut(cellSockets: Shape3D[], holeTools: Shape3D[]): Shape3D {
  let result = unwrap(fuseAll(cellSockets as ValidSolid[], { optimisation: 'commonFace' }));
  if (holeTools.length > 0) {
    const preCut = result;
    result = unwrap(cutAll(result, holeTools as ValidSolid[]));
    if (preCut !== result) preCut.delete();
  }
  return result;
}

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
  halfSockets = false,
  gridUnitMm: number = SIZE,
  cellMask?: CellMask
): Shape3D {
  // Treat a fully-filled mask as a rectangle so the cache key and iteration
  // path match the existing rectangular code.
  const usingMask = isPartialMask(cellMask);

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
    halfSockets,
    gridUnitMm,
    usingMask ? hashMask(cellMask) : undefined
  );
  const cached = getSocketCache(key);
  if (cached) {
    return cached;
  }

  /**
   * True when the cell with center `(centerX, centerY)` in bin-centered mm
   * coordinates and size `wUnits × dUnits` lies entirely inside the filled
   * region of the mask. Returns true when no mask is in use.
   */
  const cellInMask = (
    centerX: number,
    centerY: number,
    wUnits: number,
    dUnits: number
  ): boolean => {
    if (!usingMask) return true;
    const totalW_mm = gridW * gridUnitMm;
    const totalD_mm = gridD * gridUnitMm;
    const leftUnit = (centerX + totalW_mm / 2 - (wUnits * gridUnitMm) / 2) / gridUnitMm;
    const bottomUnit = (centerY + totalD_mm / 2 - (dUnits * gridUnitMm) / 2) / gridUnitMm;
    return isRegionFilled(cellMask, leftUnit, bottomUnit, wUnits, dUnits);
  };

  return withScope((scope: DisposalScope) => {
    // Build and position each cell socket
    const cellSockets: Shape3D[] = [];

    forEachCell(
      gridW,
      gridD,
      (cell) => {
        if (!cellInMask(cell.centerX, cell.centerY, cell.widthUnits, cell.depthUnits)) return;
        const cellW_mm = cell.widthUnits * gridUnitMm - CLEARANCE;
        const cellD_mm = cell.depthUnits * gridUnitMm - CLEARANCE;
        // Use simplified 3-section socket for preview, full 5-section for export
        // NOTE: cellSockets are NOT scope-registered because fuseAll may return
        // one of its inputs when given a single element. They're deleted manually.
        const cellSocket = translate(
          scope.register(
            forExport
              ? buildSingleCellSocket(cellW_mm, cellD_mm)
              : buildSimplifiedCellSocket(cellW_mm, cellD_mm)
          ),
          [cell.centerX, cell.centerY, 0]
        );
        cellSockets.push(cellSocket);
      },
      { halfSockets, gridUnitMm }
    );

    if (cellSockets.length === 0) {
      throw new Error('Invalid grid dimensions: at least one cell required');
    }

    // Build hole tools upfront so they can be included in the pipeline
    const holeTools: Shape3D[] = [];
    if (withScrew || withMagnet) {
      const HOLE_OFFSET = 13; // mm from cell center to hole center (Gridfinity spec)
      const magnetCutout = withMagnet ? scope.register(cylinder(magnetRadius, magnetDepth)) : null;
      const screwCutout = withScrew ? scope.register(cylinder(screwRadius, SOCKET_HEIGHT)) : null;

      // When both exist, fuse creates a new shape (register it); when only one exists,
      // it's already registered above — don't double-register
      const cutout: Shape3D =
        magnetCutout && screwCutout
          ? scope.register(unwrap(fuse(magnetCutout, screwCutout)))
          : ((magnetCutout || screwCutout) as Shape3D);

      // 4 holes per full cell at ±HOLE_OFFSET from center
      const holeOffsets: ReadonlyArray<readonly [number, number]> = [
        [-HOLE_OFFSET, -HOLE_OFFSET],
        [-HOLE_OFFSET, HOLE_OFFSET],
        [HOLE_OFFSET, HOLE_OFFSET],
        [HOLE_OFFSET, -HOLE_OFFSET],
      ];

      forEachCell(
        gridW,
        gridD,
        (cell) => {
          if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
          if (!cellInMask(cell.centerX, cell.centerY, cell.widthUnits, cell.depthUnits)) return;
          for (const [dx, dy] of holeOffsets) {
            holeTools.push(
              translate(scope.register(unwrap(clone(cutout))), [
                cell.centerX + dx,
                cell.centerY + dy,
                -SOCKET_HEIGHT,
              ])
            );
          }
        },
        { gridUnitMm }
      );
    }

    // Use booleanPipeline for small sockets (fuse cells → cut holes in one
    // WASM call, skipping intermediate UnifySameDomain). For large grids, fall
    // back to batch fuseAll/cutAll — compound booleans are faster than N
    // sequential pipeline steps when there are many targets.
    const totalSteps = cellSockets.length - 1 + holeTools.length;
    let result: Shape3D;

    if (totalSteps <= 20) {
      const steps: BooleanPipelineStep[] = [
        ...cellSockets.slice(1).map((s): BooleanPipelineStep => ({ op: 'fuse', tool: s })),
        ...holeTools.map((t): BooleanPipelineStep => ({ op: 'cut', tool: t })),
      ];
      const pipelineResult = booleanPipeline(cellSockets[0], steps, {
        optimisation: 'commonFace',
      });

      if (isOk(pipelineResult)) {
        result = pipelineResult.value;
      } else {
        result = batchFuseAndCut(cellSockets, holeTools);
      }
    } else {
      result = batchFuseAndCut(cellSockets, holeTools);
    }

    // Dispose consumed inputs (skip if result reuses a reference)
    for (const s of cellSockets) {
      if (s !== result) s.delete();
    }
    for (const t of holeTools) {
      if (t !== result) t.delete();
    }

    return setSocketCache(key, result); // result NOT registered — survives scope
  });
}

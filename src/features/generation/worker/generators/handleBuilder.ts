/**
 * Handle ledge builder for Gridfinity bins.
 *
 * Generates interior handle ledges -- small shelves with concave fillet supports
 * protruding inward from bin walls. Each handle has two fused pieces:
 *
 * 1. Shelf plate: flat rectangular box at the top of the interior wall
 * 2. Fillet support: concave quarter-circle profile extruded along the shelf width
 */

import { draw, unwrap, fuse, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { BinParams, HandleWallSide } from '@/shared/types/bin';
import { sketch } from './meshUtils';
import { fuseAllOrNull } from './compartmentBuilder';
import { buildFilletProfile } from './filletProfile';

/** Minimum shelf thickness for FDM printability (mm). */
const MIN_SHELF_THICKNESS = 2.0;

interface WallDef {
  readonly side: HandleWallSide;
  readonly wallSpan: number;
  readonly depthSpan: number;
  readonly x: number;
  readonly y: number;
  readonly rotateZ: number;
}

/**
 * Build interior handle ledges for enabled walls.
 *
 * Each ledge is a flat shelf plate with a concave fillet support underneath,
 * positioned at the top of the bin interior wall. Handles are centered on
 * each wall and sized as a percentage of the wall span.
 *
 * @param params - Bin parameters (handles config, label config)
 * @param innerW - Interior width in mm
 * @param innerD - Interior depth in mm
 * @param interiorHeight - Interior wall height in mm (Z extent from floor to wall top)
 * @param wallThickness - Bin wall thickness in mm
 * @param _hasLip - Whether the bin has a stacking lip (reserved for future use)
 * @returns Fused handle geometry, or null if no handles are enabled
 */
export function buildHandles(
  params: BinParams,
  innerW: number,
  innerD: number,
  interiorHeight: number,
  wallThickness: number,
  _hasLip: boolean
): Shape3D | null {
  if (!params.handles.enabled) return null;

  const { depth, width, filletRadius } = params.handles;
  const shelfThickness = Math.max(wallThickness, MIN_SHELF_THICKNESS);

  // Each wall is positioned at its center (x, y) with the other axis at 0.
  // rotateZ maps the local shelf (-Y = depth direction) onto the bin interior.
  // After rotation, the local X extrusion axis aligns with the wall's span.
  const walls: readonly WallDef[] = [
    { side: 'front', wallSpan: innerW, depthSpan: innerD, x: 0, y: -innerD / 2, rotateZ: 180 },
    { side: 'back', wallSpan: innerW, depthSpan: innerD, x: 0, y: innerD / 2, rotateZ: 0 },
    { side: 'left', wallSpan: innerD, depthSpan: innerW, x: -innerW / 2, y: 0, rotateZ: 90 },
    { side: 'right', wallSpan: innerD, depthSpan: innerW, x: innerW / 2, y: 0, rotateZ: 270 },
  ];

  const allHandles: Shape3D[] = [];

  for (const wall of walls) {
    // Skip disabled sides
    if (!params.handles[wall.side].enabled) continue;

    // Back-wall suppression: skip back handle when label tabs are active
    if (wall.side === 'back' && params.label.enabled) continue;

    // Clamp depth so handle doesn't overlap the opposite wall
    const effectiveDepth = Math.min(depth, wall.depthSpan / 2 - wallThickness);
    if (effectiveDepth <= 0) continue;

    // Clamp fillet radius to fit within the effective depth
    const effectiveFilletR = Math.min(filletRadius, effectiveDepth * 0.7);

    // Handle width centered on wall
    const handleWidth = wall.wallSpan * (width / 100);
    if (handleWidth <= 0) continue;

    // -- Shelf plate: flat rectangle extruded by shelfThickness --
    // Drawn in local space: handleWidth along X, effectiveDepth along -Y
    // (toward the interior), then extruded up Z by shelfThickness.
    const shelfDrawing = draw([0, 0])
      .lineTo([handleWidth, 0])
      .lineTo([handleWidth, -effectiveDepth])
      .lineTo([0, -effectiveDepth])
      .close();
    const shelf = sketch(shelfDrawing, 'XY', 0).extrude(shelfThickness);

    // -- Fillet support: concave quarter-circle under the shelf --
    const filletHeight = Math.min(effectiveFilletR, interiorHeight - shelfThickness);

    let handleSolid: Shape3D;

    if (filletHeight > 0) {
      const filletProfile = buildFilletProfile(effectiveFilletR, filletHeight);
      // Profile is in XY plane; sketch on YZ and extrude along X for handleWidth.
      // The fillet profile spans from Z=0 downward, so its top edge already
      // meets the shelf underside (at local Z=0). No Z shift needed.
      const filletShape = sketch(filletProfile, 'YZ', 0).extrude(handleWidth);

      handleSolid = unwrap(fuse(shelf, filletShape));
    } else {
      handleSolid = shelf;
    }

    // Center the handle on the wall: offset X by -handleWidth/2
    handleSolid = translate(handleSolid, [-handleWidth / 2, 0, 0]);

    // Rotate to the wall's orientation
    if (wall.rotateZ !== 0) {
      handleSolid = rotate(handleSolid, wall.rotateZ, { axis: [0, 0, 1] });
    }

    // Translate to wall position; Z places shelf top at interiorHeight
    handleSolid = translate(handleSolid, [wall.x, wall.y, interiorHeight - shelfThickness]);

    allHandles.push(handleSolid);
  }

  return fuseAllOrNull(allHandles);
}

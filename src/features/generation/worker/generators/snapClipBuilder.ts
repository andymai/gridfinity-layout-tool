/**
 * Snap-clip part generator (separately printed).
 *
 * The clip is a U-shape: a rectangular bridge with two prongs that each
 * carry an asymmetric two-frustum barb at the tip.
 *
 * Use orientation (prong points DOWN through baseplate seam):
 *
 *      ┌──────────────┐                    bridge sits on slab top
 *      │  ▓ bridge ▓  │                    spanning the seam
 *   ───┤ │        │   ├───  ← slab top
 *      │ │ shaft  │   │
 *      │ │        │   │
 *   ───┤ │        │   ├───  ← slab bottom
 *      │ ╲╱      ╲╱   │     retention shoulder (steep, ~27°)
 *      │  ▽       ▽   │     lead-in cone        (gentle, ~37°)
 *      └──────────────┘
 *           seam
 *
 * Print orientation (what this builder outputs): clip is flipped — bridge
 * on the build plate, prongs pointing +Z. Slicers take the geometry as-is
 * without auto-rotation; users flip it for insertion.
 */

import { box, cylinder, cone, translate, unwrap, fuseAll, mesh, exportSTL } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { ExportFormat } from '../../bridge/types';
import {
  SNAP_PRONG_DIAMETER,
  SNAP_PRONG_INSET,
  SNAP_PRONG_OVERSHOOT,
  SNAP_BRIDGE_THICKNESS,
  SNAP_BRIDGE_WIDTH,
  SNAP_BRIDGE_LENGTH_MARGIN,
  SNAP_BARB_FLARE,
  SNAP_BARB_RETAIN_HEIGHT,
  SNAP_BARB_LEAD_HEIGHT,
  SNAP_TIP_RADIUS,
} from './generatorConstants';

/**
 * Build one snap clip in print orientation (bridge on Z=0, prongs up).
 *
 * @param slabThickness Baseplate thickness in mm — sets prong shaft length
 *                      so the bridge sits flush on the slab top with the
 *                      barb's widest point just below the slab bottom.
 */
export function buildSnapClip(slabThickness: number): Shape3D {
  const prongRadius = SNAP_PRONG_DIAMETER / 2;
  const barbRadius = prongRadius + SNAP_BARB_FLARE;
  const tipRadius = SNAP_TIP_RADIUS;

  const bridgeLen = 2 * (SNAP_PRONG_INSET + SNAP_BRIDGE_LENGTH_MARGIN);
  const bridgeWidth = SNAP_BRIDGE_WIDTH;
  const bridgeThick = SNAP_BRIDGE_THICKNESS;

  const prongCenterOffset = SNAP_PRONG_INSET; // half of seam-to-seam spacing
  // Shaft is slightly longer than the slab so the barb's wide point seats
  // below the slab bottom rather than flush with it — gives the snap real
  // mechanical engagement instead of a marginal hook.
  const shaftLen = slabThickness + SNAP_PRONG_OVERSHOOT;

  const bridge: Shape3D = box(bridgeLen, bridgeWidth, bridgeThick, {
    at: [0, 0, bridgeThick / 2],
  });

  const buildProng = (prongX: number): Shape3D[] => {
    const baseZ = bridgeThick;
    const shaft = cylinder(prongRadius, shaftLen, { at: [prongX, 0, baseZ] }) as Shape3D;
    const shoulder = cone(prongRadius, barbRadius, SNAP_BARB_RETAIN_HEIGHT, {
      at: [prongX, 0, baseZ + shaftLen],
    }) as Shape3D;
    const leadIn = cone(barbRadius, tipRadius, SNAP_BARB_LEAD_HEIGHT, {
      at: [prongX, 0, baseZ + shaftLen + SNAP_BARB_RETAIN_HEIGHT],
    }) as Shape3D;
    return [shaft, shoulder, leadIn];
  };

  const left = buildProng(-prongCenterOffset);
  const right = buildProng(prongCenterOffset);

  return unwrap(fuseAll([bridge, ...left, ...right] as ValidSolid[]));
}

/**
 * Total prong count across all join edges of one piece's connector layout.
 * Used to compute the clip quantity hint for the export ZIP filename.
 *
 * Each grid-cell boundary on a join edge gets one hole per piece, but a
 * single clip spans the seam between two pieces — so the clip count for
 * the entire baseplate is `holesPerPiece` (one clip per pair of holes,
 * times the number of pieces / 2 ... but each seam has holes counted in
 * both adjacent pieces). The simplest invariant: total holes ÷ 2 = total
 * clips, since each clip consumes two holes.
 */
export function snapClipCountForHoleCount(totalHoleCount: number): number {
  return Math.ceil(totalHoleCount / 2);
}

/**
 * Translate-and-clone a snap clip for laying out an array on the build plate.
 * Used when exporting many clips packed into a single STL.
 */
export function translateClip(clip: Shape3D, dx: number, dy: number): Shape3D {
  return translate(clip, [dx, dy, 0]);
}

/** Export a single snap clip as STL or STEP for inclusion in the baseplate ZIP. */
export async function exportSnapClip(
  slabThickness: number,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const clip = buildSnapClip(slabThickness) as ValidSolid;
  try {
    const name = 'snap-clip';
    if (format === 'step') {
      const { exportSTEP } = await import('brepjs');
      const blob = unwrap(exportSTEP(clip));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    mesh(clip, { tolerance, angularTolerance, cache: false });
    const blob = unwrap(exportSTL(clip, { tolerance, angularTolerance, binary: true }));
    const data = await blob.arrayBuffer();
    return { data, fileName: `${name}.stl` };
  } finally {
    clip.delete();
  }
}

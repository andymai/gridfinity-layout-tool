/**
 * How far the interior fillet reaches, for the features that must stay clear
 * of it: pattern holes cut through a wall or divider would notch the rounding
 * where it climbs the face, and a floor pattern would leave half-holes in it.
 *
 * Upper bounds from the design alone. The worker clamps each compartment's
 * radius further, so a margin read from here never falls short of the solid.
 */

import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

/**
 * The radius the control starts at: the shell's own inner corner, rounded down
 * to the control's step, so the fillet meets the bin's corners without a lip.
 */
export function defaultInteriorFilletMm(wallThickness: number): number {
  const shellCorner = GRIDFINITY.BOX_CORNER_RADIUS - wallThickness;
  const stepped = Math.floor(shellCorner * 10) / 10;
  return Math.min(
    DESIGNER_CONSTRAINTS.MAX_INTERIOR_FILLET,
    Math.max(DESIGNER_CONSTRAINTS.MIN_INTERIOR_FILLET, stepped)
  );
}

/** The radius a design asks for, or 0 when it has no fillet. */
export function interiorFilletRadiusMm(params: Pick<BinParams, 'interiorFilletMm'>): number {
  const r = params.interiorFilletMm;
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 0;
}

/** Height the fillet climbs every wall and divider, above the floor. */
export function interiorFilletRiseMm(params: Pick<BinParams, 'interiorFilletMm'>): number {
  return interiorFilletRadiusMm(params);
}

/**
 * Width a rounded vertical corner takes along each face meeting it: never less
 * than the shell's own corner arc, which the fillet matches.
 */
export function interiorFilletCornerMm(
  params: Pick<BinParams, 'interiorFilletMm' | 'wallThickness'>
): number {
  const r = interiorFilletRadiusMm(params);
  if (r === 0) return 0;
  return Math.max(r, GRIDFINITY.BOX_CORNER_RADIUS - params.wallThickness);
}

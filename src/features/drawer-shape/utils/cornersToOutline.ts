/**
 * Per-corner cuts → drawer outline (issue #2528, corners authoring surface).
 *
 * Cuts apply to the drawer RECTANGLE (composing cuts onto arbitrary shapes is
 * a later nicety — the section confirms before replacing a non-corner
 * outline). The vertex-run geometry lives in `@/shared/utils/cornerCutOutline`
 * so the baseplate resolver can re-inscribe the same cuts on the padded plate
 * rectangle.
 */

import type { CornerCutParams, Drawer, DrawerOutline } from '@/core/types';
import { cornerCutVertices, hasAnyCut } from '@/shared/utils/cornerCutOutline';

export const NO_CUTS: CornerCutParams = {
  tl: { kind: 'none' },
  tr: { kind: 'none' },
  bl: { kind: 'none' },
  br: { kind: 'none' },
};

/** Largest chamfer/radius/notch extent (mm) that keeps cuts from meeting. */
export function maxCutExtentMm(drawer: Drawer, gridUnitMm: number): number {
  const widthMm = (drawer.width as number) * gridUnitMm;
  const depthMm = (drawer.depth as number) * gridUnitMm;
  return Math.floor(Math.min(widthMm, depthMm) / 2 - 1);
}

/**
 * Build the outline for the drawer rectangle with the given corner cuts, or
 * null when every corner is 'none' (the caller clears the outline — the
 * plain rectangle is represented by ITS absence).
 */
export function cornersToOutline(
  drawer: Drawer,
  cuts: CornerCutParams,
  gridUnitMm: number
): DrawerOutline | null {
  if (!hasAnyCut(cuts)) {
    return null;
  }
  const W = (drawer.width as number) * gridUnitMm;
  const D = (drawer.depth as number) * gridUnitMm;

  return {
    vertices: cornerCutVertices(W, D, cuts),
    authoring: { kind: 'corners', corners: cuts },
  };
}

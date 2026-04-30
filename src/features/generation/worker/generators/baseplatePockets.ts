/**
 * Pocket cutter geometry for baseplate cells.
 *
 * Each pocket is a tapered prism that matches the bin socket profile at full
 * grid size (no clearance reduction). The bin socket (which IS reduced by
 * CLEARANCE) fits into this pocket with CLEARANCE/2 gap on each side.
 *
 * Pockets are cached per (cellSize, forExport, throughCut). The full-detail
 * cutter is a 5-section loft; a simplified 2-section variant is used for
 * preview rendering to keep tessellation cheap.
 */

import { drawRoundedRectangle, unwrap, clone } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import {
  SOCKET_HEIGHT,
  SOCKET_BIG_TAPER,
  SOCKET_TAPER_WIDTH,
  CLEARANCE,
  INSET_BOT,
  pocketCornerRadius,
  COPLANAR_MARGIN,
} from './generatorTypes';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { pocketTemplateCache } from './baseplateCaches';

/** Insets at each Z breakpoint — same taper profile as bin socket but at full cell size */
const INSET_TOP = 0;
const INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm

function pocketCacheKey(
  cellW: number,
  cellD: number,
  forExport: boolean,
  throughCut: boolean
): string {
  return buildCacheKey('v1', quantize(cellW), quantize(cellD), forExport, throughCut);
}

function pocketSection(
  cellW_mm: number,
  cellD_mm: number,
  cornerR: number,
  z: number,
  inset: number
): Sketch {
  const w = cellW_mm - 2 * inset;
  const d = cellD_mm - 2 * inset;
  const r = Math.max(cornerR - inset, 0.1);
  return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
}

/**
 * Build a single pocket cutter at the origin using multi-section loft.
 *
 * Profile sections (same Z breakpoints as bin socket):
 *   Z=+ε:    extension above block (avoids coplanar boolean failures)
 *   Z=0:     full cell size (top opening)
 *   Z=-0.25: same as top (vertical clearance step)
 *   Z=-2.4:  inset by taper amount (end of big taper)
 *   Z=-4.2:  same inset (vertical wall section)
 *   Z=-5.0:  max inset (bottom)
 *
 * When throughCut is true (no magnets), the cutter extends below SOCKET_HEIGHT
 * to cut completely through the slab. When false (magnets enabled), the pocket
 * stops at SOCKET_HEIGHT depth, leaving a solid floor for magnet holes.
 */
function buildPocketCutter(cellW_mm: number, cellD_mm: number, throughCut: boolean): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const s = (z: number, inset: number): Sketch =>
    pocketSection(cellW_mm, cellD_mm, cornerR, z, inset);

  const s0 = s(COPLANAR_MARGIN, INSET_TOP);
  const sections = [
    s(0, INSET_TOP),
    s(-(CLEARANCE / 2), INSET_TOP), // -0.25
    s(-SOCKET_BIG_TAPER, INSET_MID), // -2.4
    s(-(SOCKET_BIG_TAPER + (SOCKET_HEIGHT - SOCKET_TAPER_WIDTH)), INSET_MID), // -4.2
    s(-SOCKET_HEIGHT, INSET_BOT), // -5.0
  ];

  if (throughCut) {
    sections.push(s(-SOCKET_HEIGHT - COPLANAR_MARGIN, INSET_BOT));
  }

  return s0.loftWith(sections, { ruled: true });
}

/**
 * Simplified 2-section pocket cutter for preview rendering.
 * Fewer triangles, visually similar to the full 5-section version.
 */
function buildSimplifiedPocketCutter(
  cellW_mm: number,
  cellD_mm: number,
  throughCut: boolean
): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const s = (z: number, inset: number): Sketch =>
    pocketSection(cellW_mm, cellD_mm, cornerR, z, inset);

  const s0 = s(COPLANAR_MARGIN, INSET_TOP);
  const sections = [s(-SOCKET_HEIGHT, INSET_BOT)];
  if (throughCut) {
    sections.push(s(-SOCKET_HEIGHT - COPLANAR_MARGIN, INSET_BOT));
  }

  return s0.loftWith(sections, { ruled: true });
}

/**
 * Get or build a pocket template for the given cell dimensions.
 * Returns a clone of the cached template (safe for translate).
 */
export function getPocketTemplate(
  cellW_mm: number,
  cellD_mm: number,
  forExport: boolean,
  throughCut: boolean
): Shape3D {
  const key = pocketCacheKey(cellW_mm, cellD_mm, forExport, throughCut);
  const cached = pocketTemplateCache.get(key);
  if (cached !== undefined) {
    return unwrap(clone(cached));
  }
  const template = forExport
    ? buildPocketCutter(cellW_mm, cellD_mm, throughCut)
    : buildSimplifiedPocketCutter(cellW_mm, cellD_mm, throughCut);
  pocketTemplateCache.set(key, template);
  return unwrap(clone(template));
}

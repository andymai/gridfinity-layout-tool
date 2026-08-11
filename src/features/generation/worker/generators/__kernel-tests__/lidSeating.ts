/**
 * Seat a generated lid on its generated bin and measure where they collide.
 *
 * The bin and its lid are separate solids, so nothing about either mesh says
 * they interpenetrate: both are watertight, both have plausible triangle
 * counts, and every bounding-box assertion passes while the lid physically
 * cannot seat (CLAUDE.md gotcha #10). Mating the two and probing inside the
 * assembly is the only way to see it, and the seating math is subtle enough
 * (lid-local anchor, overhang-shifted rails, preview-only nudges) that a second
 * copy would be a second chance to get it wrong.
 */

import { boundingBox, verticalSolidSpans } from './meshAssertions';
import { LIP_HEIGHT, LIP_OVERLAP } from '../generatorConstants';
import {
  lidAnchorZ,
  resolveLidCavityExtraMm,
  LID_FIT_CLEARANCE,
  LID_CORNER_RADIUS,
} from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

/**
 * Z shift that seats the lid on the bin.
 *
 * `lidAnchorZ` is where the bin's lip top lands in lid-local Z, so the offset
 * is the bin's real lip top minus that. `PREVIEW_Z_OFFSET` is deliberately
 * absent — that is a preview-only group nudge, and including it would open a
 * 0.1mm gap that hides exactly the interference being measured.
 */
export function lidZOffset(p: BinParams): number {
  const lipTop = p.height * p.heightUnitMm + LIP_HEIGHT - LIP_OVERLAP;
  return lipTop - lidAnchorZ(p.heightUnitMm, LID_FIT_CLEARANCE, resolveLidCavityExtraMm(p));
}

/** Total mm of bin and lid material sharing the same Z at this column. */
export function interferenceAt(
  bin: MeshData,
  lid: MeshData,
  x: number,
  y: number,
  dz: number
): number {
  const binSpans = verticalSolidSpans(bin, x, y);
  const lidSpans = verticalSolidSpans(lid, x, y).map(([lo, hi]) => [lo + dz, hi + dz] as const);
  let total = 0;
  for (const [a0, a1] of binSpans) {
    for (const [b0, b1] of lidSpans) {
      total += Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    }
  }
  return total;
}

/**
 * Worst interference anywhere along the four rail lines.
 *
 * Sweeps a small band of X/Y offsets around each rail's spine rather than the
 * spine alone: the rail profile is 2.65mm wide and the features it clashes with
 * (a label shelf, a scoop's lip fill) are thin, so a single-column probe can
 * slip between them and report clean.
 */
export function worstRailInterference(bin: MeshData, lid: MeshData, dz: number): number {
  // Probe positions come from the LID's own bounds rather than a re-derivation
  // of its width: overhang both widens and shifts the lid, and an arithmetic
  // slip there would move every probe off the rails and quietly report clean.
  const bb = boundingBox(lid.vertices);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const spineX = (bb.maxX - bb.minX) / 2 - LID_CORNER_RADIUS;
  const spineY = (bb.maxY - bb.minY) / 2 - LID_CORNER_RADIUS;

  let worst = 0;
  for (const off of [-0.6, -0.2, 0, 0.6, 1.4]) {
    // Left and right rails: sweep along Y at the rail's X.
    for (let y = cy - spineY; y <= cy + spineY; y += 1) {
      for (const sx of [cx + spineX + off, cx - spineX - off]) {
        worst = Math.max(worst, interferenceAt(bin, lid, sx, y, dz));
      }
    }
    // Front and back rails: sweep along X at the rail's Y.
    for (let x = cx - spineX; x <= cx + spineX; x += 1) {
      for (const sy of [cy + spineY + off, cy - spineY - off]) {
        worst = Math.max(worst, interferenceAt(bin, lid, x, sy, dz));
      }
    }
  }
  return worst;
}

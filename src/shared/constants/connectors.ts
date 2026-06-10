/**
 * Dovetail connector geometry, shared between the generation worker (which cuts
 * the tongues/grooves and builds the standalone dovetail key) and the baseplate
 * feature (split-planner bed budget, print-guide bbox, seated-key preview).
 *
 * Lives in `shared/` because the enforced module-boundary rule forbids the
 * baseplate feature from importing the generation worker's constants directly —
 * this is the single source of truth so the two sides can't drift.
 *
 * The dovetail is a trapezoidal prism, narrow at the wall (BASE_HALF) and wider
 * at the protruding tip (TIP_HALF), reaching PROTRUSION past the wall. The
 * dovetail key (`connectorStyle: 'dovetailKey'`) is two of these mirrored across
 * the waist into one part hammered into the seam.
 */

import {
  NOZZLE_BASELINE,
  scaleFeature,
  scaleClearance,
} from '@/shared/printSettings/connectorScaling';

/** How far the tongue protrudes horizontally from the wall face (mm). */
export const TONGUE_PROTRUSION = 1.5;

/** Half-width at the wall face — narrow end of the dovetail (mm). */
export const TONGUE_BASE_HALF = 1.0;

/** Half-width at the protruding tip — wide end of the dovetail (mm). */
export const TONGUE_TIP_HALF = 1.3;

/** Per-side groove clearance for the slip-fit integral dovetail (mm). */
export const TONGUE_CLEARANCE = 0.15;

/**
 * Per-side groove clearance for the hammered-in dovetail key (mm). Tighter than
 * the slip-fit dovetail so the key holds vertically by friction. 0.075 mm/side
 * lands at the snug "finger-snap" end of FDM dovetail fits for PLA/PETG — and
 * FDM pockets shrink, so the realized fit is tighter still. Drop toward 0.05 for
 * a harder press; the dominant fit factor is first-layer elephant-foot squish,
 * so see the print guide's connector-key tuning notes before changing this.
 */
export const DOVETAIL_KEY_CLEARANCE = 0.075;

/**
 * User-tunable fit offset (mm) added to the per-side groove clearance so people
 * can compensate for printer/filament variation (issue #2024). Signed: a
 * positive value loosens the groove, a negative value tightens it. The same
 * offset rides on top of both style defaults (slip-fit and dovetail key).
 */
export const CONNECTOR_FIT_OFFSET_MIN = -0.3;
export const CONNECTOR_FIT_OFFSET_MAX = 0.3;
export const CONNECTOR_FIT_OFFSET_STEP = 0.05;

/**
 * Floor for the effective per-side groove clearance (mm). A negative clearance
 * would mean the groove is smaller than the tongue — an interference fit that
 * can't seat and can produce degenerate booleans — so the user's fit offset is
 * clamped to never push effective clearance below this.
 */
export const MIN_CONNECTOR_CLEARANCE = 0;

/**
 * Effective per-side groove clearance after growing the base with bead width and
 * applying the user's fit offset, clamped at {@link MIN_CONNECTOR_CLEARANCE} so it
 * can never go negative. Single source of truth shared by the generation worker
 * (which cuts the grooves), the cache keys, and the print guide so the three can't
 * drift.
 *
 * `nozzleSizeMm` defaults to the 0.4mm baseline, where the bead-growth term is
 * zero and the result is exactly `baseClearance + fitOffset` (no regression). On a
 * wider nozzle the fatter extrusion overshoots into the groove, so the base
 * clearance grows (see {@link scaleClearance}) to keep a press-fit from seizing.
 */
export function effectiveClearance(
  baseClearance: number,
  fitOffset: number,
  nozzleSizeMm: number = NOZZLE_BASELINE
): number {
  return Math.max(MIN_CONNECTOR_CLEARANCE, scaleClearance(baseClearance, nozzleSizeMm) + fitOffset);
}

/**
 * Snap-clip ("staple") connector geometry, shared between the generation worker
 * (which cuts the seam pockets and builds the standalone clip) and the baseplate
 * feature (bed budget, print-guide bbox, seated-clip preview).
 *
 * The clip is one X-Z cross-section extruded along the seam: two legs joined by a
 * flush top bridge with a central flex slot, each leg carrying an outward-facing
 * barb (triangular catch + lead-in) near its tip. On insertion the legs pinch
 * inward past the pocket throat, then splay out so the barbs catch the chamber
 * ledge. Mirror grooves on both seam sides form the blind pockets.
 *
 * Validated standalone via brepjs-verify: clip is a valid solid, and the seated
 * clip clears the pockets with zero interference (fuse-volume == tiles + clip).
 * The depths below are clamped to the slab height at build time so the snap
 * still seats on a thin baseplate and deepens automatically on taller bases.
 */
export const SNAP_CLIP = {
  /** Half-width of the central flex slot (inner leg face sits at ±this). */
  GAP_HALF: 0.75,
  /** Leg thickness across the seam (mm). */
  LEG_W: 1.2,
  /** Outward barb protrusion past the leg face = engagement depth (mm). */
  BARB_DEPTH: 0.45,
  /** Top bridge thickness; also the flush-recess depth in the slab top (mm). */
  BRIDGE_THK: 1.2,
  /** Clip length along the seam (mm). */
  LEG_L: 5.0,
  /** Sealed floor left under the blind pocket so it never breaches the bottom (mm). */
  POCKET_FLOOR: 0.6,
  /** Clearance under the leg tips above the pocket floor (mm). */
  FLOOR_GAP: 0.3,
  /** Barb apex height above the leg tip (mm) — a fixed snap feature; only the
   *  leg LENGTH scales with slab height, giving taller bases a longer flex beam. */
  BARB_APEX_FROM_TIP: 0.8,
  /** Catch (back) face rise from barb apex to the ledge (mm); shallow = removable. */
  CATCH_DROP: 0.5,
  /** Lead-in (insertion) face drop from barb apex toward the tip (mm). */
  LEAD_DROP: 0.5,
  /** Minimum leg length below the bridge for the snap to function (mm). Below
   *  this the slab is too thin to flex; the generator skips snap pockets. */
  MIN_LEG: 2.0,
} as const;

/** Per-side pocket-wall clearance for the snap clip (mm), before fit offset. */
export const SNAP_CLIP_CLEARANCE = 0.1;

/** Resolved snap-clip Z-levels and X-positions for a given slab height. */
export interface SnapClipLevels {
  /** Whether the slab is deep enough to flex; false → generator skips pockets. */
  readonly viable: boolean;
  /** Per-side pocket clearance after the fit offset. */
  readonly cl: number;
  /** Blind pocket depth below the top (mm). */
  readonly pocketDepth: number;
  /** Clip leg-tip depth below the top (mm). */
  readonly legBottom: number;
  /** Barb apex Z (negative, below top). */
  readonly apexZ: number;
  /** Catch-ledge Z (negative). */
  readonly catchZ: number;
  /** Lead-in face bottom Z (negative). */
  readonly leadZ: number;
  /** Outer leg face X (= GAP_HALF + LEG_W). */
  readonly legOuter: number;
  /** Barb apex X (= legOuter + BARB_DEPTH). */
  readonly barbTip: number;
  /** Pocket throat outer-wall depth into the piece (mm). */
  readonly throatDepthX: number;
  /** Pocket chamber outer-wall depth into the piece (mm). */
  readonly chamberDepthX: number;
}

/**
 * Resolve the snap-clip geometry levels from the slab height and nozzle. The leg
 * LENGTH scales with `totalHeight`, so a taller base gets a longer flex beam
 * (stronger snap) automatically. The leg WIDTH and barb DEPTH scale with the
 * nozzle so they stay printable on wider nozzles (the barb apex height above the
 * tip stays fixed). Pocket clearance (throat/chamber only — the clip stays
 * nominal) folds in via {@link effectiveClearance}. Single source of truth shared
 * by the generation worker (pockets + clip), the seated-clip preview, and the bed math.
 */
export function snapClipLevels(
  totalHeight: number,
  fitOffset: number,
  nozzleSizeMm: number = NOZZLE_BASELINE
): SnapClipLevels {
  const cl = effectiveClearance(SNAP_CLIP_CLEARANCE, fitOffset, nozzleSizeMm);
  // Scale the leg + barb up on a wider nozzle: the leg stays ≥2 perimeters across
  // the seam, and the outward barb stays ≥1 full bead so the slicer can actually
  // lay it down — a 0.45mm barb vanishes under a 0.6mm nozzle. Both are exactly the
  // legacy value at ≤0.4mm (no regression).
  const legW = scaleFeature(SNAP_CLIP.LEG_W, nozzleSizeMm);
  const barbDepth = scaleFeature(SNAP_CLIP.BARB_DEPTH, nozzleSizeMm, 1);
  const pocketDepth = totalHeight - SNAP_CLIP.POCKET_FLOOR;
  const legBottom = pocketDepth - SNAP_CLIP.FLOOR_GAP;
  const apexZ = -(legBottom - SNAP_CLIP.BARB_APEX_FROM_TIP);
  const catchZ = apexZ + SNAP_CLIP.CATCH_DROP;
  const leadZ = apexZ - SNAP_CLIP.LEAD_DROP;
  const legOuter = SNAP_CLIP.GAP_HALF + legW;
  const barbTip = legOuter + barbDepth;
  const viable =
    legBottom - SNAP_CLIP.BRIDGE_THK >= SNAP_CLIP.MIN_LEG && catchZ < -SNAP_CLIP.BRIDGE_THK;
  return {
    viable,
    cl,
    pocketDepth,
    legBottom,
    apexZ,
    catchZ,
    leadZ,
    legOuter,
    barbTip,
    throatDepthX: legOuter + cl,
    chamberDepthX: barbTip + cl,
  };
}

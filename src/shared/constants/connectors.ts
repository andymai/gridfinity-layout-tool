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
 * seam key (`connectorStyle: 'dovetailKey'`) is two PUZZLE lobes mirrored across
 * the waist into one dogbone part hammered into the seam — it was originally two
 * mirrored dovetails, but that profile's 0.3 mm/side undercut printed away to
 * nothing (#2637), so the key adopted the puzzle profile that already survives
 * FDM on the integral 'puzzle' style. The style id keeps its historical name.
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

/**
 * "Puzzle" connector (`connectorStyle: 'puzzle'`) — a stronger integral connector
 * than the legacy slip-fit `dovetail`, added as its OWN style so it doesn't change
 * the geometry of plates already printed with `dovetail` (issue #2241).
 *
 * The legacy dovetail is a near-flat trapezoid (tapers only 1.0 → 1.3 mm =
 * 0.3 mm undercut/side, which FDM clearance + elephant-foot squish swallow, so it
 * doesn't hold). The puzzle is instead a jigsaw-style tab: a narrow NECK at the
 * wall flaring to a wider, rounded HEAD. Pulling the plates apart drags the wide
 * head against the narrower neck channel in the mating groove, so it locks. The
 * neck→head armpits and the head corners are rounded ({@link PUZZLE_ARMPIT_FILLET},
 * {@link PUZZLE_HEAD_FILLET}) for a clean, designed look and to relieve the FDM
 * stress riser at the neck.
 *
 *      wall │ neck │     head (rounded lobe)
 *      ─────┤ ┌──┐ │   ╭──────────╮
 *           │ │  ╰─┤  (            )   the shoulder ledge (HEAD_HALF − NECK_HALF
 *      ─────┤ │  ╭─┤  (   lobe     )   per side) is the catch that resists pull-out
 *           │ └──┘ │   ╰──────────╯
 *           ├P_NECK┼──── P_HEAD ────┤
 *
 * Full-height like the legacy dovetail, and — being a constant Z cross-section —
 * the protruding tongue prints as a self-supported vertical prism with NO overhang
 * in either orientation, so it also stack-prints (alternate tiles flipped) cleanly.
 * The head stays narrower than the inter-cell wall so a full-depth groove doesn't
 * sever cells, and total reach is kept at {@link TONGUE_PROTRUSION} so the
 * bed-budget / bbox math is shared with the legacy dovetail unchanged.
 */
export const PUZZLE_NECK_HALF = 0.9;
/** Neck reach before the head flares (mm); head reach = PUZZLE_PROTRUSION − this. */
export const PUZZLE_NECK_PROTRUSION = 0.6;
/** Head half-width (the widest point); undercut per side = PUZZLE_HEAD_HALF − PUZZLE_NECK_HALF (mm). */
export const PUZZLE_HEAD_HALF = 1.9;
/** Total reach past the wall (mm). Equals the legacy reach so bed/bbox math is shared. */
export const PUZZLE_PROTRUSION = TONGUE_PROTRUSION;
/** Fillet at the re-entrant neck→head armpit — relieves the stress riser (mm). */
export const PUZZLE_ARMPIT_FILLET = 0.3;
/** Fillet at the head's shoulder + tip corners — rounds the lobe for a designed look (mm). */
export const PUZZLE_HEAD_FILLET = 0.4;

/** Per-side groove clearance for the slip-fit integral dovetail (mm). */
export const TONGUE_CLEARANCE = 0.15;

/**
 * Per-side groove clearance for the hammered-in seam key (mm). Tighter than
 * the slip-fit dovetail so the key holds vertically by friction — pull-apart
 * retention comes from the puzzle lobe's mechanical undercut, but lift-out is
 * friction-only. 0.075 mm/side lands at the snug "finger-snap" end of FDM
 * press fits for PLA/PETG — and FDM pockets shrink, so the realized fit is
 * tighter still. Drop toward 0.05 for a harder press; the dominant fit factor
 * is first-layer elephant-foot squish, so see the print guide's connector-key
 * tuning notes before changing this.
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
 * Pull-apart resistance: the pocket leaves a solid seam-side WALL intact in the
 * upper band, so a leg's inner face bears against it — pulling the plates apart
 * rams that wall into the leg like a real staple. The legs sit `GAP_HALF` off
 * the seam, leaving room for the wall, with `LEG_W` trimmed to keep the original
 * outer footprint (so the clip still clears the bin feet in the cells flanking
 * the seam).
 *
 * INSERTION KINEMATICS (issue #2638 — why the wall must be thinner than the
 * slot): to pass the throat, each barb must deflect inward by
 * `BARB_DEPTH − clearance`. The leg pivots at the bridge root, so with the wall
 * nested between the legs the rotation is capped by `slot gap / contact depth`,
 * and the cap is TIGHTEST early in the stroke, when the wall top first enters
 * near the leg tips (contact depth ≈ the whole leg). The worst-case available
 * barb deflection is therefore
 *   `(GAP_HALF − BEAR_WALL) × (apex depth / tip depth)`   (both below the root)
 * and it must exceed the needed pinch with margin. The original wall filled the
 * slot to `GAP_HALF − clearance` (0.1mm of pinch room vs 0.35 needed) — the
 * clip physically could not be inserted; `snapClipInsertion.test.ts` pins this
 * budget so it cannot regress.
 *
 * The depths below are clamped to the slab height at build time so the snap
 * still seats on a thin baseplate and deepens automatically on taller bases.
 */
export const SNAP_CLIP = {
  /** Half-width of the central flex slot (inner leg face sits at ±this). Also the
   *  nominal seam-side wall thickness: the pocket leaves plate solid out to here. */
  GAP_HALF: 1.0,
  /** Leg thickness across the seam (mm). Trimmed from the original 1.2 so the
   *  wider GAP_HALF keeps the same outer face (`GAP_HALF + LEG_W` = 1.95) at the
   *  0.4mm baseline, preserving bin clearance. On wider nozzles `scaleFeature`
   *  floors leg width to 2× the nozzle, so the outer face grows by the GAP_HALF
   *  increase (~0.25mm) — acceptable on the rarer big-nozzle snap clips. */
  LEG_W: 0.95,
  /** Height of the seam-side retaining wall below the bridge (mm) — the band the
   *  leg's inner face bears against. Clamped above the catch ledge (never eats
   *  the snap). */
  BEAR_DEPTH: 1.2,
  /** Retaining-wall thickness from the seam (mm). Must leave real pinch room in
   *  the flex slot (`GAP_HALF − BEAR_WALL`, see insertion kinematics above) —
   *  the wall originally ran out to `GAP_HALF − clearance`, which blocked
   *  insertion outright (#2638). 0.6 is the thickest wall that clears the
   *  deflection budget on the thinnest viable slab (where the short leg gives
   *  the barb the least travel). The cost is engagement slop: plates can
   *  separate by up to the slot gap before the staple bears. 1.5 beads at the
   *  0.4 baseline — a printable rib for a bearing surface. */
  BEAR_WALL: 0.6,
  /** Outward barb protrusion past the leg face = engagement depth (mm). Reduced
   *  from 0.45: the needed pinch (`BARB_DEPTH − clearance`) must fit the
   *  worst-case deflection budget (#2638), and 0.2mm of ledge engagement is
   *  still a firm, removable snap. */
  BARB_DEPTH: 0.3,
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
  /** Lead-in (insertion) face drop from barb apex toward the tip (mm). Longer
   *  than the catch face so insertion ramps gently (~23° from vertical at the
   *  0.3 barb) while removal stays the steeper, firmer face. Leaves a 0.1mm
   *  vertical land at the tip (`BARB_APEX_FROM_TIP − LEAD_DROP`) so the profile
   *  never degenerates to coincident points. */
  LEAD_DROP: 0.7,
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
  /** Seam-side wall depth into the piece in the bearing band
   *  (= min(BEAR_WALL, GAP_HALF − cl)); the leg's inner face bears against this
   *  for pull-apart resistance. Thinner than the slot on purpose — the slack
   *  (GAP_HALF − this) is the pinch room insertion needs (#2638). */
  readonly bearWallX: number;
  /** Bottom Z of the seam-side bearing band (negative), clamped above the catch
   *  ledge so it never eats the snap. Above this the pocket leaves the wall solid. */
  readonly bearBottomZ: number;
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
  // Retaining wall: plate left solid out to BEAR_WALL from the seam, from the
  // bridge underside down to the bearing-band bottom — clamped above the catch
  // ledge so it never eats the snap chamber, and never thicker than the slot
  // minus clearance (a wide-nozzle clearance can exceed GAP_HALF − BEAR_WALL).
  const bearBottomZ = Math.max(-(SNAP_CLIP.BRIDGE_THK + SNAP_CLIP.BEAR_DEPTH), catchZ);
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
    bearWallX: Math.min(SNAP_CLIP.BEAR_WALL, SNAP_CLIP.GAP_HALF - cl),
    bearBottomZ,
  };
}

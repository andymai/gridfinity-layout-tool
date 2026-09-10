/**
 * Discrete dovetail connectors at grid cell boundary intersections along
 * join edges.
 *
 * Each connector is a small trapezoidal prism — the classic dovetail fan
 * shape visible from the top: narrower at the wall (BASE_HALF), wider at the
 * protruding tip (TIP_HALF).
 *
 *   Top view (X-Y) of one connector on a left edge:
 *
 *     wall
 *      |  A ──── B         Y = bPos + BASE_HALF (wall) / + TIP_HALF (tip)
 *      |  |  dt  |
 *      |  D ──── C         Y = bPos - BASE_HALF (wall) / - TIP_HALF (tip)
 *      |  ← P →
 *
 * The dovetail taper is in the X-Y plane, so pieces drop in from above (Z)
 * without interference. Once seated, the wider tip prevents horizontal pull-out.
 *
 * Convention: left/front = tongue (male, fused), right/back = groove (female,
 * cut). Inverted by `invertDovetails`.
 *
 * Key style (`connectorStyle === 'dovetailKey'`): every join edge is female
 * (groove only, no tongue), and a separate `buildDovetailKey()` part is hammered
 * into the seam. Two opposing PUZZLE grooves across a seam form one dogbone
 * cavity — narrow at the seam, flaring to a rounded lobe inside each piece —
 * that the key locks into (the legacy trapezoid grooves' 0.3 mm/side undercut
 * printed away to nothing,; see {@link buildDovetailKey}). The groove uses
 * the tighter `DOVETAIL_KEY_CLEARANCE` for a press fit. `invertDovetails` and
 * `preferIdenticalPieces` are ignored in this mode (seams are symmetric).
 *
 * All profiles are drawn on the XY plane (normal=+Z) and extruded downward,
 * matching the pre-Z-shift coordinate system (slab top at Z=0, bottom at
 * Z=-totalHeight).
 */

import { draw, rotate, translate, intersect, cutAll, clone } from 'brepjs';
import type { Shape3D, ValidSolid, Drawing } from 'brepjs';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isOk, unwrap } from '@/core/result';
import {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  PUZZLE_NECK_HALF,
  PUZZLE_NECK_PROTRUSION,
  PUZZLE_HEAD_HALF,
  PUZZLE_PROTRUSION,
  PUZZLE_ARMPIT_FILLET,
  PUZZLE_HEAD_FILLET,
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  CLEARANCE,
  SNAP_CLIP,
  snapClipLevels,
  effectiveClearance,
  COPLANAR_MARGIN,
  COPLANAR_OVERLAP,
  sketch,
} from './generatorTypes';
import type { SnapClipLevels } from '@/shared/constants/connectors';
import { buildSingleCellSocket } from './socketBuilder';

/**
 * Dovetail tongue: trapezoidal plan view, wider at tip. The base edge is
 * extended COPLANAR_OVERLAP into the slab so the fuse has shared volume rather
 * than a degenerate coplanar interface at the wall face.
 */
export function makeTongue(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  P: number,
  bW: number,
  tW: number,
  totalHeight: number
): Shape3D {
  const profile = draw(pt(w - d * COPLANAR_OVERLAP, bp + bW))
    .lineTo(pt(w + d * P, bp + tW))
    .lineTo(pt(w + d * P, bp - tW))
    .lineTo(pt(w - d * COPLANAR_OVERLAP, bp - bW))
    .close();
  return sketch(profile, 'XY', 0).extrude(-totalHeight);
}

/** Dovetail groove: matching shape + clearance, extended beyond wall and in Z. */
export function makeGroove(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  P: number,
  bW: number,
  tW: number,
  cl: number,
  ext: number,
  totalHeight: number
): Shape3D {
  const gB = bW + cl;
  const gT = tW + cl;
  const gP = P + cl;
  const profile = draw(pt(w + d * ext, bp + gB))
    .lineTo(pt(w - d * gP, bp + gT))
    .lineTo(pt(w - d * gP, bp - gT))
    .lineTo(pt(w + d * ext, bp - gB))
    .close();
  return sketch(profile, 'XY', COPLANAR_MARGIN).extrude(-(totalHeight + 2 * COPLANAR_MARGIN));
}

/**
 * Groove carved into a detached long rail's seam face to receive one of the
 * body's margin-seam tongues. Uses the same profile/clearance the tongue
 * does so they mate, positioned along the seam by `tongueOffsetMm` (the caller
 * cuts one per cell). Built in the rail's own origin-centered frame (see
 * `baseplateMargin.buildMarginSolid`): the seam face is the rail's inner long
 * edge (+railD/2 front, −railD/2 back, +railW/2 left, −railW/2 right), and the
 * groove cuts inward from it — `d` equals that face's sign.
 *
 * Under `dovetailKey` the body wall is female too, so this groove receives one
 * lobe of the seated key rather than a body tongue: same puzzle profile,
 * but the tighter `DOVETAIL_KEY_CLEARANCE` the key's press fit is sized against.
 */
export function buildMarginSeamGroove(
  side: 'left' | 'right' | 'front' | 'back',
  railW: number,
  railD: number,
  totalHeight: number,
  connectorStyle: ResolvedBaseplateParams['connectorStyle'],
  fitOffset: number,
  nozzleSizeMm?: number,
  tongueOffsetMm: number = 0
): Shape3D {
  const horizontal = side === 'front' || side === 'back';
  const seamSign: -1 | 1 = side === 'front' || side === 'left' ? 1 : -1;
  const seamPos = seamSign * (horizontal ? railD / 2 : railW / 2);
  // Rail seam runs along X for front/back rails (wall coord on Y) and along Y
  // for left/right rails (wall coord on X). `tongueOffsetMm` slides the groove
  // along that axis onto the mating body tongue — nonzero on a corner-owning end
  // segment whose rail center no longer sits on the body wall it joins.
  const pt: (wall: number, bp: number) => [number, number] = horizontal
    ? (wall, bp) => [bp, wall]
    : (wall, bp) => [wall, bp];
  const isKey = connectorStyle === 'dovetailKey';
  const cl = effectiveClearance(
    isKey ? DOVETAIL_KEY_CLEARANCE : TONGUE_CLEARANCE,
    fitOffset,
    nozzleSizeMm
  );
  return connectorStyle === 'puzzle' || isKey
    ? makePuzzleGroove(pt, seamPos, tongueOffsetMm, seamSign, cl, COPLANAR_MARGIN, totalHeight)
    : makeGroove(
        pt,
        seamPos,
        tongueOffsetMm,
        seamSign,
        TONGUE_PROTRUSION,
        TONGUE_BASE_HALF,
        TONGUE_TIP_HALF,
        cl,
        COPLANAR_MARGIN,
        totalHeight
      );
}

/**
 * One half of a puzzle (jigsaw-tab) plan-view outline (`connectorStyle: 'puzzle'`),
 * drawn from the wall outward in the `pd` protrusion direction: a narrow neck
 * (half-width `PUZZLE_NECK_HALF`) flaring to a wider, rounded HEAD lobe
 * (`PUZZLE_HEAD_HALF`). The re-entrant neck→head armpits ({@link PUZZLE_ARMPIT_FILLET})
 * and the head's shoulder + tip corners ({@link PUZZLE_HEAD_FILLET}) are rounded so
 * the tab reads as a clean designed lobe and the neck loses its stress riser.
 *
 * `clear` grows every face away from the solid (0 for the tongue, the groove
 * clearance for the groove); `wallBack` is how far the wall end runs back AGAINST
 * the protrusion (COPLANAR_OVERLAP into the slab for the tongue's fuse; the cut's
 * overhang past the wall for the groove). Total reach is `PUZZLE_PROTRUSION`
 * (= TONGUE_PROTRUSION) so bed-budget/bbox math matches the legacy dovetail.
 */
function puzzleOutline(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  pd: -1 | 1,
  clear: number,
  wallBack: number
): Drawing {
  const nH = PUZZLE_NECK_HALF + clear;
  const hH = PUZZLE_HEAD_HALF + clear;
  // Shoulder moves wall-ward by the clearance so the seated head's underside keeps
  // a per-side gap to the groove ledge it locks against. Clamp at 0: a wide nozzle
  // plus a max positive fit offset can grow `clear` past PUZZLE_NECK_PROTRUSION,
  // which would drive the neck→head transition behind the wall plane and invert the
  // outline — the neck constriction (the lock) collapses, but the geometry stays valid.
  const nP = Math.max(0, PUZZLE_NECK_PROTRUSION - clear);
  const reach = PUZZLE_PROTRUSION + clear;
  const fA = PUZZLE_ARMPIT_FILLET;
  const fH = PUZZLE_HEAD_FILLET;
  return draw(pt(w - pd * wallBack, bp + nH))
    .lineTo(pt(w + pd * nP, bp + nH))
    .customCorner(fA) // +side armpit (re-entrant neck→head notch)
    .lineTo(pt(w + pd * nP, bp + hH))
    .customCorner(fH) // +side shoulder (rounds the lobe)
    .lineTo(pt(w + pd * reach, bp + hH))
    .customCorner(fH) // +side tip
    .lineTo(pt(w + pd * reach, bp - hH))
    .customCorner(fH) // −side tip
    .lineTo(pt(w + pd * nP, bp - hH))
    .customCorner(fH) // −side shoulder
    .lineTo(pt(w + pd * nP, bp - nH))
    .customCorner(fA) // −side armpit
    .lineTo(pt(w - pd * wallBack, bp - nH))
    .close();
}

/**
 * Puzzle tongue (male). Protrudes in `+d`; its head, wider than the neck, is
 * trapped against horizontal pull-out by the neck constriction in the mating
 * groove once the pieces drop together vertically. Full-height and a constant Z
 * cross-section, so the protrusion prints as a self-supported prism with no
 * overhang — in either orientation, so it stack-prints cleanly too.
 */
export function makePuzzleTongue(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  totalHeight: number
): Shape3D {
  const profile = puzzleOutline(pt, w, bp, d, 0, COPLANAR_OVERLAP);
  return sketch(profile, 'XY', 0).extrude(-totalHeight);
}

/** Puzzle groove (female): the tongue outline grown by `cl` on every face, carved
 *  in `−d` (into the piece) and extended beyond the wall and in Z. */
export function makePuzzleGroove(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  cl: number,
  ext: number,
  totalHeight: number
): Shape3D {
  const profile = puzzleOutline(pt, w, bp, -d as -1 | 1, cl, ext);
  return sketch(profile, 'XY', COPLANAR_MARGIN).extrude(-(totalHeight + 2 * COPLANAR_MARGIN));
}

/**
 * Free-standing seam key for `connectorStyle === 'dovetailKey'`: two puzzle
 * lobes mirrored across the waist into one dogbone prism, centered on the
 * origin with its long axis along X. Narrow at the waist (`PUZZLE_NECK_HALF`,
 * sits across the seam), flaring to a rounded head inside each piece
 * (`PUZZLE_HEAD_HALF`), mating the puzzle grooves the key mode cuts.
 *
 * This replaced the original double-dovetail bowtie: its 0.3 mm/side undercut
 * was swallowed whole by FDM corner rounding + first-layer squish, so printed
 * keys came out near-rectangular and wouldn't hold. The puzzle lobe's
 * 1.0 mm/side undercut (`PUZZLE_HEAD_HALF − PUZZLE_NECK_HALF`) is the profile
 * the integral 'puzzle' style already prints reliably. The style id stays
 * `dovetailKey` so saved designs keep working; plates printed with the old
 * trapezoid grooves need a reprint to accept the new key — those keys never
 * held, so there is no working fit to preserve.
 *
 * Built at nominal dimensions — the seam grooves carry
 * `DOVETAIL_KEY_CLEARANCE`, so the per-face gap to the cavity comes from there.
 * The head corners are then relieved against the four bin feet flanking the
 * junction ({@link relieveForNeighborSockets}): the socket mouth opens to the
 * full cell at the slab top, and the wider head (vs the old 1.3 mm half-width
 * tips) reaches into it near the top. Extruded downward for the relief (seated
 * frame, feet carve from the top), then lifted so the bottom sits at Z=0
 * (bed-ready, relief scallops up); full height matches the plate's
 * `totalHeight` so the seated key is flush with the plate top.
 */
export function buildDovetailKey(totalHeight: number, gridUnitMm: number): Shape3D {
  const nH = PUZZLE_NECK_HALF;
  const hH = PUZZLE_HEAD_HALF;
  const nP = PUZZLE_NECK_PROTRUSION;
  const reach = PUZZLE_PROTRUSION;
  const fA = PUZZLE_ARMPIT_FILLET;
  const fH = PUZZLE_HEAD_FILLET;
  // Start mid-neck-top (a straight-edge point, not a corner) so close() needs
  // no corner treatment; every real corner gets the puzzle profile's fillet.
  const profile = draw([0, nH])
    .lineTo([nP, nH])
    .customCorner(fA) // +x armpit (re-entrant neck→head notch)
    .lineTo([nP, hH])
    .customCorner(fH) // +x shoulder
    .lineTo([reach, hH])
    .customCorner(fH) // +x tip
    .lineTo([reach, -hH])
    .customCorner(fH) // +x tip
    .lineTo([nP, -hH])
    .customCorner(fH) // +x shoulder
    .lineTo([nP, -nH])
    .customCorner(fA) // +x armpit
    .lineTo([-nP, -nH])
    .customCorner(fA) // −x armpit
    .lineTo([-nP, -hH])
    .customCorner(fH) // −x shoulder
    .lineTo([-reach, -hH])
    .customCorner(fH) // −x tip
    .lineTo([-reach, hH])
    .customCorner(fH) // −x tip
    .lineTo([-nP, hH])
    .customCorner(fH) // −x shoulder
    .lineTo([-nP, nH])
    .customCorner(fA) // −x armpit
    .close();
  const seated = sketch(profile, 'XY', 0).extrude(-totalHeight);
  const relieved = relieveForNeighborSockets(seated, gridUnitMm);
  if (relieved !== seated) seated.delete();
  const lifted = translate(relieved, [0, 0, totalHeight]);
  relieved.delete();
  return lifted;
}

/**
 * Blind snap-clip pocket on one seam side: a narrow throat (top → ledge) over a
 * wider chamber (ledge → floor). The throat passes the leg but blocks the barb;
 * the barb springs into the chamber and catches the ledge.
 *
 * The throat is cut in three Z-bands so a RETAINING WALL is left solid between
 * the seam and the leg's inner face — the wall the leg bears against to resist
 * pull-apart (the two seam sides' walls meet at the seam, nesting between the
 * clip's prongs):
 *   - bridge recess (top → −BRIDGE_THK): open across the seam so the flush bridge
 *     clears it,
 *   - bearing band (−BRIDGE_THK → bearBottomZ): inner edge stops at `bearWallX`,
 *     leaving the wall solid where the leg root barely flexes,
 *   - lower throat (bearBottomZ → ledge): open to the seam again so the leg tip
 *     can still pinch inward to seat the barb.
 * The chamber below stays open for the sprung barb. Returned as four stacked
 * cutters. Levels come from the shared `snapClipLevels` so pocket, clip, and
 * preview can't drift.
 */
export function makeSnapPocket(
  pt: (wall: number, bp: number) => [number, number],
  w: number,
  bp: number,
  d: -1 | 1,
  lv: SnapClipLevels
): Shape3D[] {
  const ext = COPLANAR_MARGIN;
  const ov = COPLANAR_OVERLAP;
  const br = SNAP_CLIP.BRIDGE_THK;
  const halfL = SNAP_CLIP.LEG_L / 2 + lv.cl;
  // Box from cross-seam depth `innerX`→`outerX` into the piece (innerX = −ext
  // reaches past the seam = open; innerX = bearWallX leaves the retaining wall).
  const rect = (innerX: number, outerX: number) =>
    draw(pt(w - d * innerX, bp + halfL))
      .lineTo(pt(w - d * outerX, bp + halfL))
      .lineTo(pt(w - d * outerX, bp - halfL))
      .lineTo(pt(w - d * innerX, bp - halfL))
      .close();
  // Bridge recess: open across the seam for the flush bridge channel.
  const recess = sketch(rect(-ext, lv.throatDepthX), 'XY', ext).extrude(-(ext + br));
  // Bearing band: inner wall at bearWallX leaves the retaining wall solid.
  const bearing = sketch(rect(lv.bearWallX, lv.throatDepthX), 'XY', -br + ov).extrude(
    lv.bearBottomZ - (-br + ov)
  );
  // Lower throat: open to the seam again so the leg tip can flex inward.
  const lowerThroat = sketch(rect(-ext, lv.throatDepthX), 'XY', lv.bearBottomZ + ov).extrude(
    lv.catchZ - (lv.bearBottomZ + ov)
  );
  // Chamber: ledge → sealed floor, wider outer wall for the sprung barb.
  const chamber = sketch(rect(-ext, lv.chamberDepthX), 'XY', lv.catchZ + ov).extrude(
    -(lv.catchZ + ov + lv.pocketDepth)
  );
  return [recess, bearing, lowerThroat, chamber];
}

/** Per-side gap between a relieved seam part and the nominal seated bin foot (mm). */
const CONNECTOR_SOCKET_RELIEF_GAP = 0.3;

/**
 * Subtract the four bin-foot envelopes flanking a seam junction from a seated
 * connector part (part top at Z=0, junction at the XY origin).
 *
 * The gridfinity socket mouth opens to the FULL cell at the slab top
 * (`INSET_TOP = 0`), so any top-flush part spanning a junction pokes into the
 * open socket corners exactly where a bin foot seats. Each foot envelope is
 * grown by {@link CONNECTOR_SOCKET_RELIEF_GAP}. With `floorZ` set, feet are
 * clipped to the band above it so deeper features (the snap clip's barb/catch
 * zone) are provably untouched; without it the full envelope is subtracted —
 * the socket funnel recedes from the junction with depth, so deeper cuts fall
 * outside a small junction part anyway. Full-cell neighbours are the worst
 * case, so a relieved part clears half-cell, margin, and corner neighbours too.
 * Reuses {@link buildSingleCellSocket} so the relief tracks the real socket
 * profile and can't drift.
 */
function relieveForNeighborSockets(part: Shape3D, gridUnitMm: number, floorZ?: number): Shape3D {
  const footCell = gridUnitMm - CLEARANCE + 2 * CONNECTOR_SOCKET_RELIEF_GAP;
  const half = gridUnitMm / 2;
  // Loft the foot once and clone it to each of the four neighbouring cells.
  const baseFoot = buildSingleCellSocket(footCell, footCell);
  const cutters: ValidSolid[] = [];
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      const cx = sx * half;
      const cy = sy * half;
      const foot = translate(unwrap(clone(baseFoot)), [cx, cy, 0]);
      if (floorZ === undefined) {
        cutters.push(foot as ValidSolid);
        continue;
      }
      const cap = sketch(
        draw([cx - gridUnitMm, cy - gridUnitMm])
          .lineTo([cx + gridUnitMm, cy - gridUnitMm])
          .lineTo([cx + gridUnitMm, cy + gridUnitMm])
          .lineTo([cx - gridUnitMm, cy + gridUnitMm])
          .close(),
        'XY',
        floorZ
      ).extrude(COPLANAR_MARGIN - floorZ);
      const capped = intersect(foot, cap);
      cap.delete();
      if (isOk(capped)) {
        cutters.push(capped.value as ValidSolid);
        foot.delete();
      } else {
        cutters.push(foot as ValidSolid);
      }
    }
  }
  // cutAll keeps its inputs; free the tools (the caller owns `part`).
  const relieved = unwrap(cutAll(part as ValidSolid, cutters));
  for (const c of cutters) c.delete();
  baseFoot.delete();
  return relieved;
}

/**
 * Carve the clip's top-bridge outer corners back so they clear the bin feet of
 * the edge sockets flanking each seam — ~0.7mm³ per adjacent foot un-relieved,
 * all of it in the top `BRIDGE_THK` band (the deep barb/ledge snap features sit
 * inside the foot's 4mm corner radius and don't interfere). Relief is clipped
 * to the band above the catch ledge so the snap engagement is provably
 * untouched.
 */
export function relieveClipForSockets(
  clip: Shape3D,
  totalHeight: number,
  gridUnitMm: number,
  nozzleSizeMm?: number
): Shape3D {
  const lv = snapClipLevels(totalHeight, 0, nozzleSizeMm);
  // Cover the bridge band + margin, but stay clear above the catch ledge so the
  // barb and its catch face are never touched. totalHeight ≥ SOCKET_HEIGHT keeps
  // catchZ ≤ −2.8, so this floor always lands safely above it.
  const floorZ = -(SNAP_CLIP.BRIDGE_THK + 0.8);
  if (floorZ <= lv.catchZ) return clip;
  return relieveForNeighborSockets(clip, gridUnitMm, floorZ);
}

/**
 * Free-standing snap clip ("staple") for `connectorStyle === 'snapClip'`: two
 * legs joined by a flush top bridge with a central flex slot, each leg carrying
 * an outward barb (catch + lead-in) near its tip. Built in SEATED orientation —
 * top face at Z=0, legs hanging to −legBottom — so the preview can place it
 * directly into the seam; the export path rotates it flat for printing.
 *
 * Nominal dimensions (no clearance — the pockets carry it). Cross-section in
 * X-Z, extruded along the seam (Y). The profile carries FDM-balanced edge
 * treatments — flex-slot root fillets (relieve the hinge stress riser), a
 * top-edge chamfer, and slot-mouth fillets — which all sweep into clean vertical
 * walls in the print orientation (no overhang, no print cost); the barb apex,
 * catch face, and leg bearing faces stay crisp. The top-bridge corners are then
 * relieved against the adjacent edge sockets ({@link relieveClipForSockets}) so
 * a seated clip doesn't block bins in the sockets flanking the seam.
 */
export function buildSnapClip(
  totalHeight: number,
  gridUnitMm: number,
  nozzleSizeMm?: number
): Shape3D {
  const lv = snapClipLevels(totalHeight, 0, nozzleSizeMm);
  const g = SNAP_CLIP.GAP_HALF;
  const br = SNAP_CLIP.BRIDGE_THK;
  const { legOuter, barbTip, apexZ, catchZ, leadZ, legBottom } = lv;
  // Profile edge-treatments. The part prints as a constant cross-section prism
  // (silhouette swept along the seam), so every corner here sweeps into a clean
  // vertical wall — no overhang, no FDM print cost. Radii are absolute and the
  // adjacent segments only grow with slab height, so they fit at every height.
  // Kept crisp on purpose: the barb apex + catch face (grip) and the leg outer
  // faces (bearing against the pocket throat).
  const R_TOP = 0.4; // top-edge chamfer — finished push surface, broken edge
  const R_ROOT = 0.4; // flex-slot root fillet — relieves the hinge stress riser
  const R_SLOT = 0.3; // slot-mouth fillet — clean opening, no sharp inner notch
  const profile = draw([-legOuter, 0])
    .lineTo([legOuter, 0])
    .customCorner(R_TOP, 'chamfer')
    .lineTo([legOuter, catchZ])
    .lineTo([barbTip, apexZ])
    .lineTo([legOuter, leadZ])
    .lineTo([legOuter, -legBottom])
    .lineTo([g, -legBottom])
    .customCorner(R_SLOT)
    .lineTo([g, -br])
    .customCorner(R_ROOT)
    .lineTo([-g, -br])
    .customCorner(R_ROOT)
    .lineTo([-g, -legBottom])
    .customCorner(R_SLOT)
    .lineTo([-legOuter, -legBottom])
    .lineTo([-legOuter, leadZ])
    .lineTo([-barbTip, apexZ])
    .lineTo([-legOuter, catchZ])
    .closeWithCustomCorner(R_TOP, 'chamfer');
  const seated = sketch(profile, 'XZ', 0).extrude(SNAP_CLIP.LEG_L);
  const centered = translate(seated, [0, SNAP_CLIP.LEG_L / 2, 0]); // center on the seam axis
  seated.delete(); // translate returns a new shape; free the intermediate
  const relieved = relieveClipForSockets(centered, totalHeight, gridUnitMm, nozzleSizeMm);
  if (relieved !== centered) centered.delete();
  return relieved;
}

/**
 * Snap clip oriented flat on the bed for printing: lay a seam-normal face down
 * so the staple silhouette (barbs + flex slot) prints in-plane with no supports,
 * building up along the clip length. Bottom rests at Z=0.
 */
export function buildSnapClipForPrint(
  totalHeight: number,
  gridUnitMm: number,
  nozzleSizeMm?: number
): Shape3D {
  const seated = buildSnapClip(totalHeight, gridUnitMm, nozzleSizeMm); // top Z=0, legs to −legBottom, length Y∈[−L/2,L/2]
  // Rotate +90° about X (+Y→+Z): a staple-silhouette end face drops onto the
  // bed and the build height becomes the clip length, so barbs/flex print
  // in-plane with no supports. The rotated part centers on Z∈[−L/2,L/2]; lift
  // by L/2 so the bottom rests at Z=0.
  const laid = rotate(seated, 90, { axis: [1, 0, 0] });
  seated.delete();
  const lifted = translate(laid, [0, 0, SNAP_CLIP.LEG_L / 2]);
  laid.delete();
  return lifted;
}

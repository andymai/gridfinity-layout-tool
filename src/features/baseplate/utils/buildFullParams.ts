/**
 * Converts stored baseplate params into fully resolved generation params.
 *
 * With direct per-side padding, the conversion is a straightforward pass-through.
 */

import type {
  CornerCutParams,
  DrawerOutline,
  MagnetAnchor,
  StoredBaseplateParams,
} from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isSeatedConnectorStyle } from '@/shared/types/bin';
import {
  clampCornerCuts,
  cornerCutVertices,
  cornerCutsMatchVertices,
} from '@/shared/utils/cornerCutOutline';
import { padOutline } from '@/shared/utils/padOutline';
import { translateOutline } from '@/shared/utils/drawerOutline';
import { outlineFrameOffset } from '@/shared/utils/drawerOutlineGeometry';

/** Keeps regenerated cuts off degenerate geometry (mirrors the generator's
 * own geometric radius clamp). */
const CUT_GEOMETRY_MARGIN_MM = 0.1;

/** Below this the outline is treated as already centred on the extent (no
 * re-base) — well under the 0.01mm outline-hash quantum, so it only absorbs
 * float noise, never a real pen auto-grow drift. */
const RECENTER_EPS_MM = 1e-6;

/**
 * Largest corner radius the plain rounding path may cut: the arc can enter
 * the outer corner cell but never past its center, so pockets survive intact.
 * Radii beyond this are converted to an outline so the generator's cell
 * classification drops/clips the sockets the arc consumes.
 */
export function plainRoundingLimit(gridUnitMm: number, minPaddingMm: number): number {
  return gridUnitMm / 2 + minPaddingMm;
}

/** Geometric ceiling for any corner radius on a totalW × totalD plate. */
export function maxCornerRadiusMm(totalW: number, totalD: number): number {
  return Math.min(totalW, totalD) / 2 - CUT_GEOMETRY_MARGIN_MM;
}

/**
 * The inputs the outline resolution depends on, derived once.
 *
 * Both `buildFullParams` and {@link hasEffectivePerimeter} read these, so the
 * rules for which dimensions apply and whether the drawer shape is in play exist
 * in one place. Restating them per caller is what let the panel and the
 * regeneration trigger disagree about radius-cut plates once already.
 *
 * A custom drawer shape now applies under stacking too (#3113): the shaped tiles
 * split and dedupe by fingerprint like any others, so identical tiles stack.
 * Only the radius→outline conversion stays stacking-gated (see `resolveOutlineRaw`).
 */
function outlineInputs(
  stored: StoredBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  gridUnitMmY: number,
  drawerOutline: DrawerOutline | undefined
): { stackingOn: boolean; outlineOn: boolean; widthMm: number; depthMm: number; synced: boolean } {
  const synced = stored.syncWithLayout !== false;
  const width = synced ? drawerWidth : (stored.baseplateWidth ?? drawerWidth);
  const depth = synced ? drawerDepth : (stored.baseplateDepth ?? drawerDepth);
  const stackingOn = stored.stackPrint?.enabled === true;
  return {
    synced,
    stackingOn,
    outlineOn: drawerOutline !== undefined && synced,
    widthMm: width * gridUnitMm,
    depthMm: depth * gridUnitMmY,
  };
}

/**
 * Whether the plate ends up with a non-rectangular perimeter at generation
 * time — a drawer shape, or a corner radius large enough that the resolver
 * converts it to a radius-cut outline.
 *
 * Runs the resolver rather than restating its rules, so the panel and the
 * regeneration trigger cannot drift from what generation actually produces.
 * They did drift once, keyed on the raw drawer outline while the resolver also
 * made outlines from large radii, which showed the whole-cell control on plates
 * the trigger considered rectangular.
 *
 * A drawer shape is a perimeter under stacking too (#3113); only the
 * radius→outline conversion stays stacking-gated. `stackingOverride` still
 * flips that gate for the one caller that needs it: the panel keeps rounding
 * controls live for a STEP export, which clears `stackPrint` before this
 * resolver ever runs, so its plate really is radius-shaped.
 */
export function hasEffectivePerimeter(
  stored: StoredBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  drawerOutline: DrawerOutline | undefined,
  gridUnitMmY: number = gridUnitMm,
  stackingOverride?: boolean
): boolean {
  const inputs = outlineInputs(
    stored,
    drawerWidth,
    drawerDepth,
    gridUnitMm,
    gridUnitMmY,
    drawerOutline
  );
  const stacking = stackingOverride ?? inputs.stackingOn;
  return (
    resolveOutline(
      drawerOutline,
      inputs.outlineOn,
      stored,
      inputs.widthMm,
      inputs.depthMm,
      gridUnitMm,
      stacking
    ).outline !== undefined
  );
}

/**
 * The resolved outline (plate-local mm, spanning the padded extent) plus the
 * paddings it permits. Corner-cut drawer shapes re-inscribe their cuts on the
 * padded rectangle; every other shape offsets its edges outward (`padOutline`).
 * Either way padding composes, unless it would fold the loop (then it's zeroed).
 *
 * A final step re-bases the outline onto its own bbox centre (see below) so the
 * plate's socket/seam grid ends up centred on the perimeter rather than the
 * extent (#3108/#3109).
 */
function resolveOutline(
  drawerOutline: DrawerOutline | undefined,
  outlineOn: boolean,
  stored: StoredBaseplateParams,
  widthMm: number,
  depthMm: number,
  gridUnitMm: number,
  stacking: boolean
): { outline: DrawerOutline | undefined; paddingOn: boolean } {
  const resolved = resolveOutlineRaw(
    drawerOutline,
    outlineOn,
    stored,
    widthMm,
    depthMm,
    gridUnitMm,
    stacking
  );
  if (resolved.outline === undefined) return resolved;

  // Re-base the plate's grid onto the perimeter. Since the pen editor auto-grows
  // the drawer to the max extent only (#3092), a custom outline usually sits in a
  // corner-offset sub-rectangle of `[0,totalW]×[0,totalD]`; anchoring the socket/
  // seam grid to that extent leaves it off-centre (#3108) and misclassifies
  // boundary seams (#3109). Centring the outline on the extent here — once, on the
  // one derived outline the generator, the split planner, and every piece all
  // consume — makes those two frames identical by construction. Zero-drift
  // outlines (corner-cut / radius / already-centred) translate by 0 and keep their
  // exact vertices, so square and full-extent plates stay cache-stable.
  const padL = resolved.paddingOn ? stored.paddingLeft : 0;
  const padR = resolved.paddingOn ? stored.paddingRight : 0;
  const padF = resolved.paddingOn ? stored.paddingFront : 0;
  const padB = resolved.paddingOn ? stored.paddingBack : 0;
  const offset = outlineFrameOffset(resolved.outline, widthMm + padL + padR, depthMm + padF + padB);
  // Corner-cut / radius outlines fill the extent and give an exact 0; the eps
  // only guards float noise on an already-centred freeform shape.
  if (Math.abs(offset.x) < RECENTER_EPS_MM && Math.abs(offset.y) < RECENTER_EPS_MM) return resolved;
  return {
    outline: translateOutline(resolved.outline, -offset.x, -offset.y),
    paddingOn: resolved.paddingOn,
  };
}

function resolveOutlineRaw(
  drawerOutline: DrawerOutline | undefined,
  outlineOn: boolean,
  stored: StoredBaseplateParams,
  widthMm: number,
  depthMm: number,
  gridUnitMm: number,
  stacking: boolean
): { outline: DrawerOutline | undefined; paddingOn: boolean } {
  if (outlineOn && drawerOutline !== undefined) {
    // The authoring echo is a round-trip hint, never trusted blindly: only
    // regenerate from it when it provably reproduces the stored vertices.
    const cuts =
      drawerOutline.authoring?.kind === 'corners' ? drawerOutline.authoring.corners : undefined;
    const cornerShaped =
      cuts !== undefined && cornerCutsMatchVertices(drawerOutline.vertices, widthMm, depthMm, cuts);
    if (!cornerShaped) {
      // Freeform shapes (painted cells, traced footprints, pen shapes with
      // arcs/diagonals) have no parametric resize, so padding is composed
      // edge-by-edge: every boundary edge — including a concave notch's walls —
      // offsets outward onto the padded plate extent. Only paddings that would
      // fold the loop (a collapsed notch/slot) yield null, leaving the shape to
      // subsume padding (stored values untouched, functionally zeroed).
      const padded = padOutline(drawerOutline, {
        left: stored.paddingLeft,
        right: stored.paddingRight,
        front: stored.paddingFront,
        back: stored.paddingBack,
      });
      return padded !== null
        ? { outline: padded, paddingOn: true }
        : { outline: drawerOutline, paddingOn: false };
    }

    const totalW = widthMm + stored.paddingLeft + stored.paddingRight;
    const totalD = depthMm + stored.paddingFront + stored.paddingBack;
    if (totalW === widthMm && totalD === depthMm) {
      // Zero padding: the stored outline IS the padded outline — reuse it so
      // the cache identity stays byte-stable.
      return { outline: drawerOutline, paddingOn: true };
    }
    return {
      outline: {
        vertices: cornerCutVertices(
          totalW,
          totalD,
          clampCornerCuts(cuts, totalW, totalD, CUT_GEOMETRY_MARGIN_MM)
        ),
        authoring: drawerOutline.authoring,
      },
      paddingOn: true,
    };
  }

  // No active drawer shape. Under stacking, corner rounding is stripped rather
  // than converted to a radius-cut outline — a flipped rounded corner tile would
  // differ from the interior tiles it should stack with — so no perimeter is
  // derived from a large radius here. A user-authored drawer shape above is still
  // honoured while stacking (#3113); only this rounding conversion stays gated.
  if (stacking) return { outline: undefined, paddingOn: true };

  // Corner radii beyond the plain rounding limit become a radius-cut outline, so
  // the generator's cell classification handles the sockets the arc consumes (the
  // plain path must never orphan a pocket, which is why it clamps at the limit).
  const radii = stored.cornerRadii ?? {
    tl: stored.cornerRadius ?? 0,
    tr: stored.cornerRadius ?? 0,
    bl: stored.cornerRadius ?? 0,
    br: stored.cornerRadius ?? 0,
  };
  const maxRadius = Math.max(radii.tl, radii.tr, radii.bl, radii.br);
  const minPadding = Math.min(
    Math.min(stored.paddingLeft, stored.paddingRight),
    Math.min(stored.paddingFront, stored.paddingBack)
  );
  if (maxRadius <= plainRoundingLimit(gridUnitMm, minPadding)) {
    return { outline: undefined, paddingOn: true };
  }
  const totalW = widthMm + stored.paddingLeft + stored.paddingRight;
  const totalD = depthMm + stored.paddingFront + stored.paddingBack;
  const radiusCut = (r: number): CornerCutParams['tl'] =>
    r > 0 ? { kind: 'radius', r } : { kind: 'none' };
  const cuts = clampCornerCuts(
    {
      tl: radiusCut(radii.tl),
      tr: radiusCut(radii.tr),
      bl: radiusCut(radii.bl),
      br: radiusCut(radii.br),
    },
    totalW,
    totalD,
    CUT_GEOMETRY_MARGIN_MM
  );
  return {
    outline: { vertices: cornerCutVertices(totalW, totalD, cuts) },
    paddingOn: true,
  };
}

/**
 * Build full generation params from the stored per-layout config.
 *
 * @param drawerOutline - The drawer's non-rectangular boundary, if any.
 * Applied only when the baseplate syncs with the layout (a custom-size plate
 * has no defined relationship to the drawer shape). Under stacking the shape is
 * kept too (#3113): the shaped tiles split, dedupe by fingerprint, and stack —
 * identical tiles into towers, unique perimeter tiles printed singly. Padding
 * composes with every shape — corner-cut shapes re-inscribe their cuts on the
 * padded rectangle, all others offset their edges outward (`padOutline`) — so
 * the resolved outline is plate-local over the padded extent. Corner rounding
 * and detached margins are outline-unaware, so while a shape is active they are
 * functionally zeroed, stored values untouched (the stack-print stripping
 * precedent).
 */
export function buildFullParams(
  stored: StoredBaseplateParams,
  drawerWidth: number,
  drawerDepth: number,
  gridUnitMm: number,
  fractionalEdgeX: 'start' | 'end',
  fractionalEdgeY: 'start' | 'end',
  nozzleSizeMm?: number,
  drawerOutline?: DrawerOutline,
  magnetAnchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR,
  // Depth-axis pitch for a non-square grid; defaults to the X pitch (square).
  gridUnitMmY: number = gridUnitMm
): ResolvedBaseplateParams {
  const {
    synced,
    stackingOn,
    outlineOn,
    widthMm: outlineWidthMm,
    depthMm: outlineDepthMm,
  } = outlineInputs(stored, drawerWidth, drawerDepth, gridUnitMm, gridUnitMmY, drawerOutline);
  const width = synced ? drawerWidth : (stored.baseplateWidth ?? drawerWidth);
  const depth = synced ? drawerDepth : (stored.baseplateDepth ?? drawerDepth);

  // Stack printing flips every plate above the bottom upside down. Magnet
  // pockets become downward bridges when flipped (audited ~10% bridge area, vs
  // 0% for a magnet-free plate), and corner rounding makes corner tiles differ
  // from the rest, so both are stripped. A custom drawer perimeter is NOT
  // stripped (#3113): its tiles split and dedupe by fingerprint, so identical
  // ones still stack into towers while the unique perimeter tiles print singly.
  // Dovetail connectors survive: tongues, grooves, and the dovetail key are
  // full-height vertical prisms that flip cleanly. Only snap clip is
  // incompatible — its blind top pocket (sealed floor + undercut ledge) inverts
  // into a downward bridge/overhang — so it alone is stripped. Done here rather
  // than by mutating stored params, so the user's settings return intact when
  // stacking is turned off.
  const stripConnectors = stackingOn && stored.connectorStyle === 'snapClip';

  const { outline, paddingOn } = resolveOutline(
    drawerOutline,
    outlineOn,
    stored,
    outlineWidthMm,
    outlineDepthMm,
    gridUnitMm,
    stackingOn
  );
  // An outline carries its own corner geometry as arcs and shares the same
  // post-cache intersect slot, so rounding is zeroed whenever one is active —
  // whether it came from the drawer shape or from the radius conversion above.
  const roundingOn = !stackingOn && outline === undefined;
  // Detach is mutually exclusive with any active outline (rails have no outline
  // awareness — margins would need arc-clipped rail geometry). It COMPOSES with
  // stacking (#2641): rails never enter the flipped towers — they export as
  // separate flat pieces — and zeroing edge-piece padding makes more tiles share
  // a fingerprint, so plates dedupe into taller identical stacks. Padding stays
  // at its stored values here — `emitMargins` and the camera/dimension overlay
  // need the true outer extent; the body mesh zeroes detached sides downstream.
  const detachMargins = stored.detachMargins === true && outline === undefined;
  // The connector is only meaningful when margins actually detach. When
  // stacking strips a snapClip style to undefined, the seam gate downstream
  // would read undefined as the dovetail default and emit seams the unstacked
  // plate never had — so the strip turns the seam off too.
  const detachMarginConnector =
    detachMargins && stored.detachMarginConnector === true && !stripConnectors;
  // All-edge slots (#2866) only exist for the both-female styles with split
  // connectors on. Normalize an orphaned flag away (rather than letting it ride
  // along) so it can't fragment the mesh cache or the piece fingerprints; the
  // stored value returns as soon as a key/clip style is selected again.
  const connectorSlotsAllEdges =
    !stripConnectors &&
    stored.connectorSlotsAllEdges === true &&
    stored.connectorNubs === true &&
    isSeatedConnectorStyle(stored.connectorStyle)
      ? true
      : undefined;

  return {
    width,
    depth,
    gridUnitMm,
    gridUnitMmY,
    nozzleSizeMm,
    outline,
    magnetHoles: stackingOn ? false : stored.magnetHoles,
    magnetDiameter: stored.magnetDiameter,
    magnetDepth: stored.magnetDepth,
    magnetAnchor,
    paddingLeft: paddingOn ? stored.paddingLeft : 0,
    paddingRight: paddingOn ? stored.paddingRight : 0,
    paddingFront: paddingOn ? stored.paddingFront : 0,
    paddingBack: paddingOn ? stored.paddingBack : 0,
    fractionalEdgeX: synced ? fractionalEdgeX : (stored.fractionalEdgeX ?? 'end'),
    fractionalEdgeY: synced ? fractionalEdgeY : (stored.fractionalEdgeY ?? 'end'),
    overTile: stored.overTile,
    // Half-grid is meaningless without over-tile; normalize so an orphaned flag
    // can't fragment caches or trigger needless regeneration.
    overTileHalfGrid: stored.overTile === true ? stored.overTileHalfGrid : undefined,
    // Solid-leftover only applies under half-grid; drop it otherwise for the
    // same cache-stability reason.
    overTileHalfGridSolidLeftover:
      stored.overTile === true && stored.overTileHalfGrid === true
        ? stored.overTileHalfGridSolidLeftover
        : undefined,
    // Whole-cell fitting only has meaning against a perimeter — a rectangle has
    // no crossed cell to drop. Same normalization contract as the flags above,
    // so an orphaned flag can't fragment caches or force a regeneration.
    // `=== true` here as well as in the generator and the cache key: the key is
    // allowlisted server-side without a type check, and resolved params are what
    // split pieces inherit, so a malformed value must not travel that far.
    wholeCellsOnly: outline !== undefined && stored.wholeCellsOnly === true ? true : undefined,
    connectorNubs: stripConnectors ? false : stored.connectorNubs,
    invertDovetails: stored.invertDovetails,
    preferIdenticalPieces: stored.preferIdenticalPieces,
    connectorStyle: stripConnectors ? undefined : stored.connectorStyle,
    connectorSlotsAllEdges,
    connectorFitOffset: stored.connectorFitOffset,
    lightweight: stored.lightweight,
    // Stack printing nests flipped plates into each other, which needs the
    // pockets through-cut — a solid floor would block the nesting — so strip it
    // while stacking (restored when stacking is off, like magnets above).
    solidFloor: stackingOn ? false : stored.solidFloor,
    solidFloorThickness: stored.solidFloorThickness,
    cornerRadius: roundingOn ? stored.cornerRadius : 0,
    cornerRadii: roundingOn ? stored.cornerRadii : undefined,
    detachMargins,
    detachMarginConnector,
  };
}

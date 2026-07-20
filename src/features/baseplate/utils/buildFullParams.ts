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
import {
  clampCornerCuts,
  cornerCutVertices,
  cornerCutsMatchVertices,
} from '@/shared/utils/cornerCutOutline';

/** Keeps regenerated cuts off degenerate geometry (mirrors the generator's
 * own geometric radius clamp). */
const CUT_GEOMETRY_MARGIN_MM = 0.1;

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
 * The resolved outline (plate-local mm, spanning the padded extent) plus the
 * paddings it permits. Corner-cut drawer shapes re-inscribe their cuts on the
 * padded rectangle so padding composes; every other authoring surface
 * (cells/trace/pen) has no parametric resize, so the shape subsumes padding.
 */
function resolveOutline(
  drawerOutline: DrawerOutline | undefined,
  outlineOn: boolean,
  stored: StoredBaseplateParams,
  widthMm: number,
  depthMm: number,
  gridUnitMm: number
): { outline: DrawerOutline | undefined; paddingOn: boolean } {
  if (outlineOn && drawerOutline !== undefined) {
    // The authoring echo is a round-trip hint, never trusted blindly: only
    // regenerate from it when it provably reproduces the stored vertices.
    const cuts =
      drawerOutline.authoring?.kind === 'corners' ? drawerOutline.authoring.corners : undefined;
    const cornerShaped =
      cuts !== undefined && cornerCutsMatchVertices(drawerOutline.vertices, widthMm, depthMm, cuts);
    if (!cornerShaped) return { outline: drawerOutline, paddingOn: false };

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

  // No active drawer shape: corner radii beyond the plain rounding limit
  // become a radius-cut outline, so the generator's cell classification
  // handles the sockets the arc consumes (the plain path must never orphan a
  // pocket, which is why it clamps at the limit).
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
 * has no defined relationship to the drawer shape) and stack printing is off
 * (stacking needs uniform rectangular tiles). Corner-cut shapes compose with
 * padding — the cuts are re-inscribed on the padded rectangle, so the
 * resolved outline is plate-local over the padded extent. Painted/pen/trace
 * shapes have no parametric resize, so while active they subsume padding,
 * corner rounding, and detached margins — those params are functionally
 * zeroed, stored values untouched (the stack-print stripping precedent).
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
  magnetAnchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR
): ResolvedBaseplateParams {
  const synced = stored.syncWithLayout !== false;
  const width = synced ? drawerWidth : (stored.baseplateWidth ?? drawerWidth);
  const depth = synced ? drawerDepth : (stored.baseplateDepth ?? drawerDepth);

  // Stack printing flips every plate above the bottom upside down. Magnet
  // pockets become downward bridges when flipped (audited ~10% bridge area, vs
  // 0% for a magnet-free plate), and corner rounding makes corner tiles differ
  // from the rest, so both are stripped. Dovetail connectors survive: tongues,
  // grooves, and the dovetail key are full-height vertical prisms that flip
  // cleanly. Only snap clip is incompatible — its blind top pocket (sealed
  // floor + undercut ledge) inverts into a downward bridge/overhang — so it
  // alone is stripped. Done here rather than by mutating stored params, so the
  // user's settings return intact when stacking is turned off.
  const stackingOn = stored.stackPrint?.enabled === true;
  const stripConnectors = stackingOn && stored.connectorStyle === 'snapClip';
  const outlineOn = drawerOutline !== undefined && synced && !stackingOn;

  const { outline, paddingOn } = stackingOn
    ? { outline: undefined, paddingOn: true }
    : resolveOutline(
        drawerOutline,
        outlineOn,
        stored,
        width * gridUnitMm,
        depth * gridUnitMm,
        gridUnitMm
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

  return {
    width,
    depth,
    gridUnitMm,
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
    connectorNubs: stripConnectors ? false : stored.connectorNubs,
    invertDovetails: stored.invertDovetails,
    preferIdenticalPieces: stored.preferIdenticalPieces,
    connectorStyle: stripConnectors ? undefined : stored.connectorStyle,
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

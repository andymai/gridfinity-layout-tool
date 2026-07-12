/**
 * Converts stored baseplate params into fully resolved generation params.
 *
 * With direct per-side padding, the conversion is a straightforward pass-through.
 */

import type { DrawerOutline, MagnetAnchor, StoredBaseplateParams } from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';

/**
 * Build full generation params from the stored per-layout config.
 *
 * @param drawerOutline - The drawer's non-rectangular boundary, if any.
 * Applied only when the baseplate syncs with the layout (a custom-size plate
 * has no defined relationship to the drawer shape) and stack printing is off
 * (stacking needs uniform rectangular tiles). While active it subsumes
 * padding, corner rounding, and detached margins — margins are emergent from
 * outline ∩ grid — so those params are functionally zeroed, stored values
 * untouched (the stack-print stripping precedent).
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
  // Detach is mutually exclusive with stacking (stacking wins). Padding stays at
  // its stored values here — `emitMargins` and the camera/dimension overlay need
  // the true outer extent; the body mesh zeroes detached sides downstream.
  const outlineOn = drawerOutline !== undefined && synced && !stackingOn;
  const detachMargins = stored.detachMargins === true && !stackingOn && !outlineOn;
  // The connector is only meaningful when margins actually detach.
  const detachMarginConnector = detachMargins && stored.detachMarginConnector === true;

  return {
    width,
    depth,
    gridUnitMm,
    nozzleSizeMm,
    outline: outlineOn ? drawerOutline : undefined,
    magnetHoles: stackingOn ? false : stored.magnetHoles,
    magnetDiameter: stored.magnetDiameter,
    magnetDepth: stored.magnetDepth,
    magnetAnchor,
    paddingLeft: outlineOn ? 0 : stored.paddingLeft,
    paddingRight: outlineOn ? 0 : stored.paddingRight,
    paddingFront: outlineOn ? 0 : stored.paddingFront,
    paddingBack: outlineOn ? 0 : stored.paddingBack,
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
    // Corner rounding only applies to the assembled drawer's outer corners, so
    // it makes the corner tiles differ from the rest. Stacking wants uniform,
    // interchangeable tiles, so square them off (also restored when off).
    // An outline carries its own corner geometry as arcs and shares the same
    // post-cache intersect slot, so rounding is zeroed for shaped plates too.
    cornerRadius: stackingOn || outlineOn ? 0 : stored.cornerRadius,
    cornerRadii: stackingOn || outlineOn ? undefined : stored.cornerRadii,
    detachMargins,
    detachMarginConnector,
  };
}

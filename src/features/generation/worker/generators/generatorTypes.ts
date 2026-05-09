/**
 * Barrel re-export for generator types, constants, and utilities.
 *
 * This file previously contained all shared types, constants, and utilities
 * for the bin generator modules. It has been decomposed into focused modules:
 *
 * - generatorConstants.ts — Gridfinity spec constants (socket, lip, baseplate, dovetail)
 * - cellDecomposition.ts — Grid cell decomposition and iteration utilities
 * - meshUtils.ts — Progress callbacks, sketch helpers, cancellation, mesh conversion
 * - connectorUtils.ts — Legacy connector position computation (direct mesh generator)
 *
 * All exports are re-exported here so existing imports continue to work unchanged.
 */
export {
  SIZE,
  CLEARANCE,
  CORNER_RADIUS,
  BOX_CORNER_RADIUS,
  SOCKET_HEIGHT,
  SOCKET_SMALL_TAPER,
  SOCKET_BIG_TAPER,
  SOCKET_VERTICAL_PART,
  SOCKET_TAPER_WIDTH,
  TOP_FILLET,
  LIP_SMALL_TAPER,
  LIP_VERTICAL_PART,
  LIP_BIG_TAPER,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  LIP_OVERLAP,
  PLATE_CORNER_RADIUS,
  MAGNET_FLOOR,
  COPLANAR_MARGIN,
  COPLANAR_OVERLAP,
  HOLE_OFFSET,
  INSET_BOT,
  MAGNET_OFFSETS,
  pocketCornerRadius,
  resolveCornerRadii,
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  TONGUE_CLEARANCE,
  NUB_DIAMETER,
  NUB_DEPTH,
  HOLE_DIAMETER,
  HOLE_DEPTH,
  NUB_CIRCLE_SEGMENTS,
  SNAP_PEG_DIAMETER,
  SNAP_PEG_INSET,
  SNAP_PEG_LENGTH,
  SNAP_SADDLE_LENGTH_MARGIN,
  SNAP_SADDLE_WIDTH,
  SNAP_SADDLE_BASE_HEIGHT,
  SNAP_SADDLE_ARCH_RISE,
  SNAP_HOLE_CLEARANCE,
  SNAP_HOLE_DIAMETER,
  SNAP_HOLE_DEPTH,
  SNAP_CIRCLE_SEGMENTS,
  SNAP_RECESS_CLEARANCE,
  SNAP_RECESS_DEPTH,
} from './generatorConstants';
export {
  decomposeCells,
  decomposeHalfCells,
  forEachCell,
  cellCentersAlong,
} from './cellDecomposition';
export type { CellInfo, ForEachCellOptions } from './cellDecomposition';
export { sketch, checkCancelled, toIndexedMeshData } from './meshUtils';
export type { ProgressFn, BooleanOpts } from './meshUtils';
export { computeConnectorPositions } from './connectorUtils';
export type { ConnectorPos } from './connectorUtils';

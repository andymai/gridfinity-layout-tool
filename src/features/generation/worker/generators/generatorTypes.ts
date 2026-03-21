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
  PLATE_CORNER_RADIUS,
  MAGNET_FLOOR,
  HOLE_OFFSET,
  INSET_BOT,
  MAGNET_OFFSETS,
  pocketCornerRadius,
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  TONGUE_CLEARANCE,
  NUB_DIAMETER,
  NUB_DEPTH,
  HOLE_DIAMETER,
  HOLE_DEPTH,
  NUB_CIRCLE_SEGMENTS,
} from './generatorConstants';
export { decomposeCells, decomposeHalfCells, forEachCell } from './cellDecomposition';
export type { CellInfo, ForEachCellOptions } from './cellDecomposition';
export { sketch, checkCancelled, toIndexedMeshData } from './meshUtils';
export type { ProgressFn, BooleanOpts } from './meshUtils';
export { computeConnectorPositions } from './connectorUtils';
export type { ConnectorPos } from './connectorUtils';

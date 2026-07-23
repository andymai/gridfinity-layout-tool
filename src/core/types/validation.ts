import type { GridUnits, BinId, LayerId } from '@gridfinity/branded-types';
/** Reasons why bin placement may fail */
export type ValidationReason =
  | 'out_of_bounds'
  | 'exceeds_width'
  | 'exceeds_depth'
  | 'exceeds_height'
  | 'invalid_layer'
  | 'collision'
  | 'blocked_zone'
  | 'outside_drawer';

/** Info about what's blocking a placement (for user feedback) */
export interface BlockingInfo {
  /** ID of the bin causing the block */
  binId: BinId;
  /** ID of the layer containing the blocking bin */
  layerId: LayerId;
  /** Name of the layer (for display) */
  layerName: string;
}

export type ValidationResult =
  { valid: true } | { valid: false; reason: ValidationReason; blockingInfo?: BlockingInfo };

export interface BlockedZone {
  x: GridUnits;
  y: GridUnits;
  width: GridUnits;
  depth: GridUnits;
  sourceBinId: BinId;
  sourceLayerId: LayerId;
}

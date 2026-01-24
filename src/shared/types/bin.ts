/**
 * Re-exports bin parameter types for cross-feature consumption.
 *
 * The canonical type definitions live in features/bin-designer/types.
 * This barrel export allows other features (e.g., generation) to
 * depend on these types without a cross-feature import violation.
 */
export type {
  BinParams,
  BaseConfig,
  BaseStyle,
  BinStyle,
  CompartmentConfig,
  ScoopConfig,
  LabelConfig,
  WallCutout,
  WallConfig,
  Insert,
  InsertShape,
} from '@/features/bin-designer/types';

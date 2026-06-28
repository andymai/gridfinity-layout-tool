/**
 * Re-exports bin-related constants for cross-feature consumption.
 *
 * The canonical definitions live in features/bin-designer/constants.
 * This barrel allows other features to depend on these values
 * without a cross-feature import violation.
 */
export {
  DEFAULT_BIN_PARAMS,
  DEFAULT_HANDLE_SIDE,
  DISABLED_WALL_CUTOUT,
} from '@/features/bin-designer/constants/defaults';
export { GRIDFINITY, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';

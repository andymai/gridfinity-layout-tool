/**
 * Re-exports bin-related constants for cross-feature consumption.
 *
 * The canonical definitions live in features/bin-designer/constants.
 * This barrel allows other features to depend on these values
 * without a cross-feature import violation.
 */
export { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
export { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

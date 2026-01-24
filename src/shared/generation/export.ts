/**
 * Re-exports generation export utilities for cross-feature consumption.
 *
 * The canonical implementations live in features/generation/export.
 * This barrel allows other features (e.g., bin-designer) to use
 * file size estimation functions without a cross-feature import violation.
 */
export { getSTLFileSize } from '@/features/generation/export/stlExporter';
export { estimate3MFFileSize } from '@/features/generation/export/threemfExporter';

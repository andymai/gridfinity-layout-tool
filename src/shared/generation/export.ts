/**
 * Re-exports generation export utilities for cross-feature consumption.
 *
 * The canonical implementations live in features/generation/export.
 * This barrel allows other features (e.g., bin-designer) to use
 * export and file size estimation functions without a cross-feature import violation.
 */
export {
  buildSTLBuffer,
  buildSTLBufferFromIndexed,
  getSTLFileSize,
} from '@/features/generation/export/stlExporter';
export {
  export3MF,
  export3MFMultiObject,
  estimate3MFFileSize,
} from '@/features/generation/export/threemfExporter';
export type {
  ThreeMFColorConfig,
  ThreeMFObject,
  ThreeMFPrintSettings,
} from '@/features/generation/export/threemfExporter';

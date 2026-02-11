/**
 * Barrel file for bin generator modules.
 *
 * Re-exports the public API that external consumers depend on.
 * Internal modules (socketBuilder, boxBuilder, featureBuilder, shapeCache,
 * generatorTypes) are implementation details not re-exported here.
 */

// Main generation API
export { generateBin, exportBin, exportSplitBin, getLastSolid } from './binGenerator';

// Types
export type { ProgressFn } from './generatorTypes';
export type { ExportResult, SplitExportResult } from './binGenerator';

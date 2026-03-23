/**
 * Gridfinity bin generator — public API facade.
 *
 * Delegates to focused modules:
 * - binOrchestrator: pipeline setup + generateBin()
 * - binExporter: STL/STEP export
 * - splitBinBuilder: split piece operations
 */

export { generateBin } from './binOrchestrator';
export type { ProgressFn } from './generatorTypes';
export { exportBin } from './binExporter';
export type { ExportResult } from './binExporter';
export {
  exportSplitBin,
  exportSplitBinRange,
  generateSplitPreview,
  generateSplitPreviewRange,
} from './splitBinBuilder';
export type { SplitExportResult, SplitPreviewResult } from './splitBinBuilder';
export { getLastSolid } from './shapeCache';

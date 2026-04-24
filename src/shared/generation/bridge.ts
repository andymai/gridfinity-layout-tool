/**
 * Re-exports generation bridge API for cross-feature consumption.
 *
 * The canonical implementation lives in features/generation/bridge.
 * This barrel allows other features (e.g., bin-designer) to use
 * the bridge without a cross-feature import violation.
 */
export { GenerationBridge } from '@/features/generation/bridge';
export { getActiveBridge, bridgeManager } from '@/features/generation/bridge';
export { WorkerPool, workerPoolManager } from '@/features/generation/bridge';
export type { WorkerResponse, MeshData } from '@/features/generation/bridge/types';
export type {
  SplitExportResult,
  GenerationResult,
  BaseplateExportResult,
  ExportFormat,
} from '@/features/generation/bridge';

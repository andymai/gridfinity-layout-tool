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
export {
  FAST_EXACT_SKIP_MS,
  EDIT_BURST_WINDOW_MS,
  BURST_EXACT_SKIP_MS,
} from '@/features/generation/bridge/types';
export { createDraftSkipGate } from '@/features/generation/bridge/draftPolicy';
export type {
  WorkerResponse,
  MeshData,
  PerfSnapshot,
  PerfStageEntry,
  PerfSubstepEntry,
} from '@/features/generation/bridge/types';
export type {
  SplitExportResult,
  GenerationResult,
  BaseplateExportResult,
  CombinedExportResult,
  ExportFormat,
  ExportErrorCode,
} from '@/features/generation/bridge';

/**
 * Re-exports generation types for cross-feature consumption.
 *
 * The canonical type definitions live in features/generation/bridge/types.
 * This barrel export allows other features (e.g., bin-designer) to
 * depend on these types without a cross-feature import violation.
 */
export type {
  MeshData,
  FaceGroupData,
  CoarseLODData,
  LidMeshData,
  StackPlateMeshData,
  WorkerCacheStats,
  PerfSnapshot,
  PerfStageEntry,
  PerfSubstepEntry,
} from '@/features/generation/bridge/types';
export { FeatureTag } from '@/features/generation/worker/generators/featureTags';

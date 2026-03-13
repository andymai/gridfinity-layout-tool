/**
 * Pipeline types for composable bin generation.
 *
 * The pipeline threads an immutable PipelineContext through a sequence of
 * PipelineStage functions. Each stage reads from the context, performs work,
 * and returns a new context with updated fields.
 *
 * originToTag is intentionally mutable — stages write face provenance data
 * to it by reference, and it flows through unchanged.
 */

import type { Shape3D } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '../../../bridge/types';
import type { ProgressFn } from '../meshUtils';

/** Pre-computed dimensions derived from BinParams. Avoids re-deriving in each stage. */
export interface BinDimensions {
  readonly outerW: number;
  readonly outerD: number;
  readonly innerW: number;
  readonly innerD: number;
  readonly wallHeight: number;
  readonly totalHeight: number;
  readonly isFlat: boolean;
  readonly halfSockets: boolean;
  readonly solid: boolean;
  readonly isSlotted: boolean;
  readonly hasLip: boolean;
  readonly interiorHeight: number;
  readonly useHighQuality: boolean;
  readonly maxDimension: number;
  readonly shellKey: string;
  readonly withMagnet: boolean;
  readonly withScrew: boolean;
}

/** Immutable context threaded through pipeline stages. */
export interface PipelineContext {
  readonly params: BinParams;
  readonly dimensions: BinDimensions;
  readonly forExport: boolean;
  readonly signal?: AbortSignal;
  readonly onProgress?: ProgressFn;
  /** Current bin solid — updated by each stage */
  readonly solid: Shape3D | null;
  /** Face provenance tracking — intentionally mutable (passed by reference) */
  readonly originToTag: Map<number, number>;
  /** Additive feature shapes to fuse into the bin */
  readonly fuseTargets: readonly Shape3D[];
  /** Subtractive feature shapes to cut from the bin */
  readonly cutTargets: readonly Shape3D[];
  /** Final mesh output (set by tessellate stage) */
  readonly mesh: MeshData | null;
}

/** A single composable pipeline stage. */
export interface PipelineStage {
  readonly name: string;
  readonly progressValue: number;
  shouldRun(ctx: PipelineContext): boolean;
  execute(ctx: PipelineContext): PipelineContext;
}

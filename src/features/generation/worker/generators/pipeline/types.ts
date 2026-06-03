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
import type { PerfCollector } from './perfCollector';
import type { ResolvedOverhang } from '../overhang';

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
  readonly maxDimension: number;
  readonly shellKey: string;
  readonly withMagnet: boolean;
  readonly withScrew: boolean;
  /**
   * True when the shell is built with compartment cavities subtracted
   * directly (per-compartment cavity cut). In that path the divider
   * walls are residue from the cut, not separately-fused solids, so
   * `compartmentWallsFeature` is skipped to avoid double-walling.
   * See `compartmentBuilder.buildCompartmentCavityDrawings` and
   * `boxBuilder.buildBinBox` for the cut path.
   */
  readonly compartmentsBakedIntoShell: boolean;
  /**
   * Resolved per-side outward body expansion (mm), clamped to >= 0. All-zero
   * when the bin has no overhang. The box body + stacking lip + floor grow by
   * these amounts; the base sockets stay at the nominal footprint.
   */
  readonly overhang: ResolvedOverhang;
  /**
   * X shift of the inner cavity centre relative to the bin origin, in mm.
   * Equal to `(overhang.right - overhang.left) / 2`. Zero for symmetric or
   * absent overhang. All interior feature builders translate their geometry
   * by `(innerOffsetX, innerOffsetY)` so features stay centred in the cavity.
   */
  readonly innerOffsetX: number;
  /** Y shift of the inner cavity centre — `(overhang.back - overhang.front) / 2`. */
  readonly innerOffsetY: number;
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
  /** Pattern cut targets — applied in a separate boolean pass after cutTargets */
  readonly patternCutTargets: readonly Shape3D[];
  /** Final mesh output (set by tessellate stage) */
  readonly mesh: MeshData | null;
  /** Coarse LOD mesh for distance-based rendering (preview only) */
  readonly coarseMesh: MeshData | null;
  /**
   * Optional perf collector. Pipeline runner records per-stage timings
   * into it; wall-pattern builder records per-wall substep timings.
   * Tests and benchmarks omit it (zero overhead).
   */
  readonly perfCollector?: PerfCollector;
}

/** A single composable pipeline stage. */
export interface PipelineStage {
  readonly name: string;
  readonly progressValue: number;
  shouldRun(ctx: PipelineContext): boolean;
  execute(ctx: PipelineContext): PipelineContext;
}

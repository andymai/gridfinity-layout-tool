/**
 * Types for baseplate split tiling.
 *
 * When a baseplate exceeds print bed size, it's split into a grid of pieces.
 * Each piece carries its own padding (edge pieces only) and edge classification
 * for future connector support.
 */

// MarginPiece lives in shared so the generation worker can build a rail without
// a cross-feature import; imported here for `BaseplateTiling` and re-exported
// for baseplate-local consumers.
import type { MarginCorner, MarginPiece } from '@/shared/types/bin';

export type { MarginCorner, MarginPiece };

/** Whether an edge is exterior (outside of baseplate) or a join between pieces. */
export type EdgeKind = 'join' | 'exterior';

export interface PieceEdges {
  readonly left: EdgeKind;
  readonly right: EdgeKind;
  readonly front: EdgeKind;
  readonly back: EdgeKind;
}

/** A single piece in a split baseplate tiling. */
export interface BaseplatePiece {
  /** Grid label, e.g. "A1", "B2" (col letter + row number) */
  readonly label: string;
  readonly col: number;
  readonly row: number;
  readonly widthUnits: number;
  readonly depthUnits: number;
  /** Cumulative grid offset from left edge (units) */
  readonly gridOffsetX: number;
  /** Cumulative grid offset from front edge (units) */
  readonly gridOffsetY: number;
  /** Padding in mm (0 on join edges) */
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  readonly fractionalEdgeX: 'start' | 'end' | 'none';
  readonly fractionalEdgeY: 'start' | 'end' | 'none';
  readonly edges: PieceEdges;
  /**
   * Rotation in degrees (0 or 180) to apply to the generated mesh when placing
   * this piece. Non-zero only under `preferIdenticalPieces`: opposite-corner
   * pieces share a canonical mesh and one of them is rendered 180°-rotated so
   * its dovetails end up on the correct world-space sides.
   */
  readonly placementRotationDeg: 0 | 180;
}

/** Hint suggesting a padding reduction that would eliminate a split. */
export interface PaddingReductionHint {
  /** Which axis benefits from reduction ('x' = left+right, 'y' = front+back, 'both'). */
  readonly axis: 'x' | 'y' | 'both';
  /** How many mm to reduce (applied equally to both sides of the axis). */
  readonly reductionMm: number;
  /** How many fewer pieces the reduced padding would produce. */
  readonly piecesSaved: number;
}

export interface BaseplateTiling {
  readonly isSplit: boolean;
  readonly pieces: readonly BaseplatePiece[];
  /**
   * Detached drawer-fit padding rails (empty unless `detachMargins`). Populated
   * independently of `isSplit` — a bed-fitting plate still detaches its margins.
   */
  readonly margins: readonly MarginPiece[];
  readonly cols: number;
  readonly rows: number;
  readonly totalWidthUnits: number;
  readonly totalDepthUnits: number;
  /**
   * Estimated build-plate loads (print jobs) to make every piece, packing as
   * many as fit per bed. 1 for an unsplit plate. The planner minimizes this
   * (capped against over-fragmentation) so users print in the fewest bed swaps.
   */
  readonly bedLoads: number;
  /** Future: number of vertical stacks (default 1) */
  readonly stackCount: number;
  /** Future: separator thickness between stacks in mm (default 0) */
  readonly stackSeparatorThickness: number;
  /** Hint: reducing padding by this amount would save pieces. null if no benefit. */
  readonly paddingReductionHint: PaddingReductionHint | null;
}

/** Statistics about deduplication in a split baseplate generation/export. */
export interface DedupStats {
  /** Number of unique shapes generated */
  readonly uniqueCount: number;
  /** Total number of pieces (unique + duplicates) */
  readonly totalCount: number;
  /** Number of duplicates that were cloned instead of generated */
  readonly duplicatesSkipped: number;
}

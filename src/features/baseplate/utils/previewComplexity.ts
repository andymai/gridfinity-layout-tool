/**
 * Predicts whether the high-fidelity BREP preview is worth running for a given
 * baseplate, or whether the live preview should stay on the instant procedural
 * direct-mesh and defer exact geometry to export.
 *
 * Why this exists: the BREP magnet-hole boolean pipeline scales with cell count
 * and, on slower hardware, large magnet plates exceed the per-piece generation
 * budget — the user waits out the whole timeout only to fall back to the
 * direct-mesh anyway (production telemetry: ~150 users/30d hit baseplate preview
 * timeouts, mostly warm desktop, brep times 10-40x the success median). The
 * direct-mesh is already faithful (renders pockets, magnet holes, rounded
 * corners), so for plates predicted too expensive we skip the gamble and keep
 * it on screen. Export always rebuilds at full BREP fidelity (separate path,
 * larger budget, deliberate user action).
 *
 * Split pieces are bed-bounded (≤ ~6 units/axis on a 256 mm bed), so the
 * dangerous cases are large single plates on big custom beds and many-piece
 * tilings whose total work is large — both captured below.
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { groupPiecesByFingerprint } from './pieceFingerprint';
import type { BaseplateTiling } from '../types/tiling';

/**
 * Largest single unique piece (in whole grid cells) at or above which the live
 * BREP preview is deferred (the check is `>=`). The per-piece boolean cost
 * scales with cell count, and a single piece this large risks tripping its own
 * generation budget on slower hardware. 64 = an 8×8 plate. Below this,
 * draft-quality BREP previews land in a couple of seconds on reference hardware
 * (see baseplateGenerator bench).
 */
export const DEFER_MAX_PIECE_CELLS = 64;

/**
 * Total unique work (summed whole grid cells across deduped pieces) at or above
 * which the preview is deferred (the check is `>=`). Catches many-piece tilings
 * that are individually small but collectively long — especially when the
 * worker pool is unavailable and pieces generate sequentially. 200 ≈ six 6×6
 * pieces.
 */
export const DEFER_TOTAL_CELLS = 200;

/**
 * Last successful BREP wall-clock (ms) at or above which the preview is deferred
 * for the next magnet plate, regardless of its complexity (the check is `>=`).
 * Adapts to the user's hardware: once a real generation on this machine has run
 * this long, stop gambling the preview on the next one. 25 s is well inside the
 * per-piece budget but past the point where a live preview is a pleasant wait.
 */
export const DEFER_LAST_BREP_MS = 25_000;

/** Whole-cell footprint of a piece (fractional edges round up — they still carry edge work). */
function pieceCells(widthUnits: number, depthUnits: number): number {
  return Math.ceil(widthUnits) * Math.ceil(depthUnits);
}

/**
 * Per-plate BREP-preview cost proxy, in whole grid cells. Returns the largest
 * unique piece and the summed unique work — both keyed off the deduped piece
 * set so duplicates (cloned, not regenerated) don't inflate the estimate.
 */
export function estimatePreviewComplexity(
  tiling: BaseplateTiling,
  parentParams: ResolvedBaseplateParams
): { maxPieceCells: number; totalCells: number } {
  const groups = groupPiecesByFingerprint(tiling.pieces, parentParams);
  let maxPieceCells = 0;
  let totalCells = 0;
  for (const group of groups.values()) {
    const cells = pieceCells(group.params.width, group.params.depth);
    if (cells > maxPieceCells) maxPieceCells = cells;
    totalCells += cells;
  }
  return { maxPieceCells, totalCells };
}

/**
 * True when the live BREP preview should be skipped in favor of keeping the
 * instant procedural direct-mesh on screen.
 *
 * Only magnet plates qualify — without magnets the BREP build is fast (through-
 * cut pockets, no per-cell hole booleans) and never the source of timeouts.
 */
export function shouldDeferBrepPreview(
  tiling: BaseplateTiling,
  parentParams: ResolvedBaseplateParams,
  lastBrepMs: number | null
): boolean {
  // Deferral keeps the procedural direct-mesh on screen — but that mesh is
  // rectangles-only, so a shaped plate would finalize with a wrong (or no)
  // preview. Shaped plates always run BREP.
  if (parentParams.outline !== undefined) return false;
  if (!parentParams.magnetHoles) return false;

  if (lastBrepMs !== null && lastBrepMs >= DEFER_LAST_BREP_MS) return true;

  const { maxPieceCells, totalCells } = estimatePreviewComplexity(tiling, parentParams);
  return maxPieceCells >= DEFER_MAX_PIECE_CELLS || totalCells >= DEFER_TOTAL_CELLS;
}

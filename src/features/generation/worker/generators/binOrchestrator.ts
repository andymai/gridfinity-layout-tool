/**
 * Bin generation orchestrator — assembles and runs the pipeline.
 *
 * Composes the default pipeline from focused stage modules and exposes
 * `generateBin()` as the single entry point for producing a meshed bin.
 */

import type { BinParams } from '@/shared/types/bin';
import { MASK_CELLS_PER_UNIT, validateMask } from '@/shared/utils/cellMask';
import type { MeshData } from '../../bridge/types';

import type { ProgressFn } from './generatorTypes';
import { createInitialContext, runPipeline } from './pipeline';
import type { PipelineStage } from './pipeline';
import { shellStage } from './pipeline/stages/shellStage';
import { featuresStage } from './pipeline/stages/featuresStage';
import { booleanStage } from './pipeline/stages/booleanStage';
import { translateStage } from './pipeline/stages/translateStage';
import { trayBottomStage } from './pipeline/stages/trayBottomStage';
import { lidInteriorReliefStage } from './pipeline/stages/lidInteriorReliefStage';
import { lidRetentionStage } from './pipeline/stages/lidRetentionStage';
import { lidHingeStage } from './pipeline/stages/lidHingeStage';
import { slideLidChannelStage } from './pipeline/stages/slideLidChannelStage';
import { lidGripDipStage } from './pipeline/stages/lidGripDipStage';
import { tessellateStage } from './pipeline/stages/tessellateStage';
import { meshImprintStage } from './pipeline/stages/meshImprintStage';
import type { PerfCollector } from './pipeline/perfCollector';

/**
 * Throws if `params.cellMask` is present but malformed. Checks dimensions
 * match the bin's `width × depth` at half-bin resolution, then delegates
 * structural checks (empty / disconnected / holes / bounds) to `validateMask`.
 */
function assertValidMask(params: BinParams): void {
  const { cellMask } = params;
  if (!cellMask) return;
  const expectedCols = Math.round(params.width * MASK_CELLS_PER_UNIT);
  const expectedRows = Math.round(params.depth * MASK_CELLS_PER_UNIT);
  if (cellMask.cols !== expectedCols || cellMask.rows !== expectedRows) {
    throw new Error(
      `cellMask dimensions (${cellMask.cols}×${cellMask.rows}) do not match bin ` +
        `${params.width}×${params.depth} at half-bin resolution ` +
        `(expected ${expectedCols}×${expectedRows})`
    );
  }
  const err = validateMask(cellMask);
  if (err) throw new Error(`cellMask is invalid: ${err.message}`);
}

/** Default generation pipeline: shell -> features -> boolean -> translate -> lid-interior-relief -> tray-bottom -> lid-retention -> slide-lid-channel -> lid-grip-dip -> lid-hinge -> tessellate -> mesh imprint */
const DEFAULT_PIPELINE: readonly PipelineStage[] = [
  shellStage,
  featuresStage,
  booleanStage,
  translateStage,
  lidInteriorReliefStage,
  trayBottomStage,
  lidRetentionStage,
  slideLidChannelStage,
  lidGripDipStage,
  // Last of the solid stages on purpose — see the stage's own note. Anything
  // above is free to reshape the rim without knowing a hinge exists, and the
  // knuckles weld onto whatever survives.
  lidHingeStage,
  tessellateStage,
  meshImprintStage,
];

/**
 * Generate a complete Gridfinity bin from parameters.
 *
 * Runs the composable pipeline: shell assembly, feature building, boolean
 * operations, Z-translation, and tessellation. Each stage is independently
 * testable and cacheable.
 *
 * @param params Bin configuration parameters
 * @param onProgress Optional progress callback
 * @param forExport If true, generates full-fidelity geometry for 3D printing.
 *                  Preview mode uses simplified geometry for faster rendering.
 * @param omitLipSolid Build the shell without its stacking lip while every
 *                  other dimension still describes a bin that has one. For
 *                  `splitSolidIntoPieces`, which fuses a separately-built lip
 *                  onto each piece — see {@link BinDimensions.omitLipSolid}.
 */
export function generateBin(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal,
  perfCollector?: PerfCollector,
  omitLipSolid = false
): MeshData {
  assertValidMask(params);
  const ctx = createInitialContext(
    params,
    onProgress,
    forExport,
    signal,
    perfCollector,
    omitLipSolid
  );
  const result = runPipeline(DEFAULT_PIPELINE, ctx);

  if (!result.mesh) {
    throw new Error('Pipeline did not produce mesh output');
  }

  // Fold coarse LOD mesh into MeshData when available (preview mode)
  if (result.coarseMesh) {
    return {
      ...result.mesh,
      coarseLOD: {
        vertices: result.coarseMesh.vertices,
        indices: result.coarseMesh.indices,
        triangleCount: result.coarseMesh.triangleCount,
      },
    };
  }

  return result.mesh;
}

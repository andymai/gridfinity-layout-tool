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
import { tessellateStage } from './pipeline/stages/tessellateStage';

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

/** Default generation pipeline: shell -> features -> boolean -> translate -> tessellate */
const DEFAULT_PIPELINE: readonly PipelineStage[] = [
  shellStage,
  featuresStage,
  booleanStage,
  translateStage,
  tessellateStage,
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
 */
export function generateBin(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal
): MeshData {
  assertValidMask(params);
  const ctx = createInitialContext(params, onProgress, forExport, signal);
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

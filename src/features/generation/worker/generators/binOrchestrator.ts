/**
 * Bin generation orchestrator — assembles and runs the pipeline.
 *
 * Composes the default pipeline from focused stage modules and exposes
 * `generateBin()` as the single entry point for producing a meshed bin.
 */

import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '../../bridge/types';

import type { ProgressFn } from './generatorTypes';
import { createInitialContext, runPipeline } from './pipeline';
import type { PipelineStage } from './pipeline';
import { shellStage } from './pipeline/stages/shellStage';
import { featuresStage } from './pipeline/stages/featuresStage';
import { booleanStage } from './pipeline/stages/booleanStage';
import { translateStage } from './pipeline/stages/translateStage';
import { tessellateStage } from './pipeline/stages/tessellateStage';

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
  const ctx = createInitialContext(params, onProgress, forExport, signal);
  const result = runPipeline(DEFAULT_PIPELINE, ctx);

  if (!result.mesh) {
    throw new Error('Pipeline did not produce mesh output');
  }

  return result.mesh;
}

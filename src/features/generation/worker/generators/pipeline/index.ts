/**
 * Barrel exports for the composable bin generation pipeline.
 */

export type { PipelineContext, PipelineStage, BinDimensions } from './types';
export { createInitialContext } from './context';
export { runPipeline } from './runner';
export { collectOrigins } from './collectOrigins';
export { shellStage } from './stages/shellStage';
export { featuresStage } from './stages/featuresStage';
export { booleanStage } from './stages/booleanStage';
export { translateStage } from './stages/translateStage';
export { tessellateStage } from './stages/tessellateStage';

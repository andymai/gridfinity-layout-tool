/**
 * Barrel exports for the composable bin generation pipeline.
 */

export type { PipelineContext, PipelineStage, BinDimensions } from './types';
export type { FeatureBuilder, FeatureTarget, BuildResult } from './featureBuilder';
export { createInitialContext } from './context';
export { runPipeline } from './runner';
export { collectOrigins } from './collectOrigins';
export { runFeatureBuilders } from './featureRunner';
export type { FeatureTargets } from './featureRunner';
export { BIN_FEATURE_BUILDERS } from './featureComposition';
export { shellStage } from './stages/shellStage';
export { featuresStage } from './stages/featuresStage';
export { booleanStage } from './stages/booleanStage';
export { translateStage } from './stages/translateStage';
export { tessellateStage } from './stages/tessellateStage';

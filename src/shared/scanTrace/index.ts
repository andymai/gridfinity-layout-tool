export { traceImage, traceToPoints, pointsToSvgPath, polygonArea } from './traceImage';
export {
  traceScene,
  traceSceneSegmented,
  detectCard,
  buildToolTrace,
  computeAutoSeed,
} from './traceScene';
export type { SceneTrace, SceneCard, SceneTraceOptions } from './traceScene';
export type { SoftMask } from './softContour';
export { cardPerspectiveSkew, STEEP_CARD_SKEW } from './cardDetect';
export { decodeImageToCanvas, imageDataFromCanvas } from './decodeImage';
export { segmentAt, preloadSegmenter } from './interactiveSegment';
export type {
  ImageDataLike,
  Mask,
  Point,
  TraceOptions,
  TraceError,
  TraceErrorCode,
  TraceResult,
} from './types';

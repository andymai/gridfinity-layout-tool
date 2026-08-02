export { traceImage, traceToPoints, pointsToSvgPath, polygonArea } from './traceImage';
export {
  traceScene,
  traceSceneSegmented,
  detectCard,
  computeAutoSeed,
  withCardSize,
} from './traceScene';
export type { SceneTrace, SceneCard, SceneTraceOptions } from './traceScene';
export type { SoftMask } from './softContour';
export { cardPerspectiveSkew, STEEP_CARD_SKEW, CARD_WIDTH_MM, CARD_HEIGHT_MM } from './cardDetect';
export { decodeImageToCanvas, imageDataFromCanvas } from './decodeImage';
export { segmentAt, preloadSegmenter } from './interactiveSegment';
export type {
  ImageDataLike,
  Mask,
  Point,
  TraceOptions,
  TraceError,
  TraceResult,
} from './types';

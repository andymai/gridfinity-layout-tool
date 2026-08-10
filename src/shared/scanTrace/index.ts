export { traceImage, traceToPoints, pointsToSvgPath, polygonArea } from './traceImage';
export {
  traceScene,
  traceSceneSegmented,
  detectCard,
  detectReference,
  computeAutoSeed,
  withCardSize,
} from './traceScene';
export type {
  SceneTrace,
  SceneCard,
  SceneGrid,
  SceneReference,
  SceneTraceOptions,
} from './traceScene';
export type { SoftMask } from './softContour';
export { cardPerspectiveSkew, STEEP_CARD_SKEW, CARD_WIDTH_MM, CARD_HEIGHT_MM } from './cardDetect';
export { detectCalibrationGrid } from './gridDetect';
export type { GridDetection, GridMarker, MarkerQuad } from './gridDetect';
export {
  CALIBRATION_PITCH_MM,
  CALIBRATION_MARKER_MM,
  CALIBRATION_COLS,
  CALIBRATION_ROWS,
  calibrationNodes,
  calibrationSpanMm,
} from './calibrationGrid';
export type { GridNode } from './calibrationGrid';
export { decodeImageToCanvas, imageDataFromCanvas } from './decodeImage';
export { segmentAt, preloadSegmenter } from './interactiveSegment';
export type { ImageDataLike, Mask, Point, TraceOptions, TraceError, TraceResult } from './types';

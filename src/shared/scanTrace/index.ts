export { traceImage, traceToPoints, pointsToSvgPath, polygonArea } from './traceImage';
export {
  traceScene,
  traceSceneSegmented,
  detectCard,
  detectReference,
  sameReference,
  withCardSize,
  withReference,
  wideHoles,
  referenceToImage,
} from './traceScene';
export { nestShapes, withRefinedShape, type Refinement } from './refineScene';
export { interiorSeed, pointInPolygon } from './toolBlobs';
export type {
  SceneShape,
  SceneRing,
  SceneTrace,
  SceneCard,
  SceneGrid,
  SceneReference,
  SceneRuler,
  ScenePaper,
  SceneTraceOptions,
} from './traceScene';
export {
  rulerReference,
  paperReference,
  PAPER_SIZES,
  MIN_RULER_PX,
  type PaperSize,
  type PaperError,
} from './manualReference';
export type { SoftMask } from './softContour';
export { cardPerspectiveSkew, STEEP_CARD_SKEW, CARD_WIDTH_MM, CARD_HEIGHT_MM } from './cardDetect';
export { detectCalibrationGrid } from './gridDetect';
export {
  detectMarkerStrip,
  stripSizeMm,
  STRIP_MARKER_COUNTS,
  STRIP_MARGIN_MM,
  type SceneStrip,
} from './measuringStrip';
export { detectBaseplateGrid, BASEPLATE_PITCH_MM } from './baseplateDetect';
export type { LatticeFit, FittedCell, GridNode } from './latticeFit';
export type { CellQuad } from './latticeBlobs';
export {
  CALIBRATION_PITCH_MM,
  CALIBRATION_MARKER_MM,
  CALIBRATION_COLS,
  CALIBRATION_ROWS,
  calibrationNodes,
  calibrationSpanMm,
} from './calibrationGrid';
export { decodeImageToCanvas, imageDataFromCanvas } from './decodeImage';
export { segmentAt, preloadSegmenter } from './interactiveSegment';
export type { ImageDataLike, Mask, Point, TraceOptions, TraceError, TraceResult } from './types';

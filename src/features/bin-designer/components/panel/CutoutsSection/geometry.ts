/**
 * Public facade for cutout geometry utilities.
 *
 * The implementation is split across focused modules:
 *   - `geometryCore`       — dependency-free primitives (bounds, rotation, snap)
 *   - `geometryResize`     — resize-handle math + cursor lookup
 *   - `geometryAlignment`  — alignment guides + distribute/center
 *   - `geometryFlips`      — horizontal/vertical flip helpers
 *
 * The siblings import only from `geometryCore` so the facade stays free
 * of circular dependencies — call sites can safely import any symbol
 * from `./geometry` without ESM initialization-order surprises.
 */

export {
  type Bounds,
  SNAP_GRID_SIZE,
  snapToGrid,
  rotatePoint,
  getRotatedBounds,
  clampRotationToBounds,
  getEffectiveBounds,
  computeBounds,
  clampPosition,
  getEffectiveWidth,
  getEffectiveDepth,
} from './geometryCore';
export {
  MIN_CUTOUT_SIZE,
  calculateCutoutResize,
  constrainGroupDrag,
  clampCornerRadius,
  getResizeCursor,
  type StartRect,
} from './geometryResize';
export {
  GUIDE_SNAP_THRESHOLD,
  findAlignmentGuides,
  distributeHorizontally,
  distributeVertically,
  centerInBin,
  type AlignmentGuide,
} from './geometryAlignment';
export {
  flipCutoutHorizontal,
  flipCutoutVertical,
  flipSelectionHorizontal,
  flipSelectionVertical,
} from './geometryFlips';

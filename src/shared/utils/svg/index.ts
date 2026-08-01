/**
 * SVG parsing primitives shared by every importer — the cutout editor and the
 * drawer perimeter both read user-supplied SVG and must agree on units,
 * transforms and where the origin sits.
 *
 * Geometry conversion stays with each importer: a cutout is a bezier path, a
 * drawer outline is a line/arc loop, and the two are not interchangeable.
 */

export type { ViewBox } from './types';
export { parseSvgLengthMm } from './svgLength';
export { parseViewBox, resolveUserUnitToMm } from './svgViewBox';
export {
  applyMatrix,
  isIdentityOrTranslate,
  multiplyMatrices,
  resolveTransformChain,
  transformPoint,
  IDENTITY,
  type Matrix,
} from './svgMatrix';

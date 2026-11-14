import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { TONGUE_PROTRUSION } from '@/shared/constants/connectors';
import type { PlateFlipAxis } from './stackPrint';

interface FootprintRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface Footprint extends FootprintRect {
  /** Solid first-layer margin regions that can support another margin. */
  readonly padding: readonly FootprintRect[];
}

/** Shaped outlines and fractional cells need a separate geometric support check. */
export function canMixPiece(params: ResolvedBaseplateParams): boolean {
  return (
    Number.isInteger(params.width) &&
    Number.isInteger(params.depth) &&
    params.width > 0 &&
    params.depth > 0 &&
    !params.outline &&
    !params.outlineOverhang &&
    Number.isFinite(params.paddingLeft) &&
    Number.isFinite(params.paddingRight) &&
    Number.isFinite(params.paddingFront) &&
    Number.isFinite(params.paddingBack)
  );
}

/** Conservative outer bounds around the grid, margins and any seam tongue. */
export function pieceFootprint(params: ResolvedBaseplateParams): Footprint {
  const x = (params.width * params.gridUnitMm) / 2;
  const y = (params.depth * (params.gridUnitMmY ?? params.gridUnitMm)) / 2;
  const integralTongue =
    params.connectorNubs &&
    (params.connectorStyle === undefined ||
      params.connectorStyle === 'dovetail' ||
      params.connectorStyle === 'puzzle');
  const seam = (edge: keyof NonNullable<ResolvedBaseplateParams['edges']>): number => {
    if (!integralTongue || params.edges?.[edge] !== 'join') return 0;
    const startSide = edge === 'left' || edge === 'front';
    return params.preferIdenticalPieces || startSide !== !!params.invertDovetails
      ? TONGUE_PROTRUSION
      : 0;
  };
  const minX = -x - params.paddingLeft - seam('left');
  const maxX = x + params.paddingRight + seam('right');
  const minY = -y - params.paddingFront - seam('front');
  const maxY = y + params.paddingBack + seam('back');
  const padding: FootprintRect[] = [];
  // Over-tile margins carry pocket geometry rather than a broad solid first
  // layer, so they do not need the margin-on-margin support rule below.
  if (params.overTile !== true) {
    const paddedMinY = -y - params.paddingFront;
    const paddedMaxY = y + params.paddingBack;
    if (params.paddingLeft > 0) {
      padding.push({
        minX: -x - params.paddingLeft,
        maxX: -x,
        minY: paddedMinY,
        maxY: paddedMaxY,
      });
    }
    if (params.paddingRight > 0) {
      padding.push({
        minX: x,
        maxX: x + params.paddingRight,
        minY: paddedMinY,
        maxY: paddedMaxY,
      });
    }
    if (params.paddingFront > 0) {
      padding.push({ minX: -x, maxX: x, minY: paddedMinY, maxY: -y });
    }
    if (params.paddingBack > 0) {
      padding.push({ minX: -x, maxX: x, minY: y, maxY: paddedMaxY });
    }
  }
  return { minX, maxX, minY, maxY, padding };
}

function transformedRect(
  rect: FootprintRect,
  rotationDeg: 0 | 90 | 180 | 270,
  flipAxis?: PlateFlipAxis
): FootprintRect {
  let result = rect;
  for (let angle = 0; angle < rotationDeg; angle += 90) {
    result = {
      minX: -result.maxY,
      maxX: -result.minY,
      minY: result.minX,
      maxY: result.maxX,
    };
  }
  if (flipAxis === 'x') {
    result = { ...result, minY: -result.maxY, maxY: -result.minY };
  }
  if (flipAxis === 'y') {
    result = { ...result, minX: -result.maxX, maxX: -result.minX };
  }
  return result;
}

export function printedFootprint(
  footprint: Footprint,
  rotationDeg: 0 | 90 | 180 | 270,
  flipAxis?: PlateFlipAxis
): Footprint {
  return {
    ...transformedRect(footprint, rotationDeg, flipAxis),
    padding: footprint.padding.map((rect) => transformedRect(rect, rotationDeg, flipAxis)),
  };
}

export function translateFootprint(footprint: Footprint, dx: number, dy: number): Footprint {
  const translate = (rect: FootprintRect): FootprintRect => ({
    minX: rect.minX + dx,
    maxX: rect.maxX + dx,
    minY: rect.minY + dy,
    maxY: rect.maxY + dy,
  });
  return { ...translate(footprint), padding: footprint.padding.map(translate) };
}

const SUPPORT_EPSILON = 1e-6;

/** Whether a rectangle is covered by the union of axis-aligned support rectangles. */
function rectIsCovered(rect: FootprintRect, supports: readonly FootprintRect[]): boolean {
  const clipped = supports
    .map((support) => ({
      minX: Math.max(rect.minX, support.minX),
      maxX: Math.min(rect.maxX, support.maxX),
      minY: Math.max(rect.minY, support.minY),
      maxY: Math.min(rect.maxY, support.maxY),
    }))
    .filter(
      (support) =>
        support.maxX - support.minX > SUPPORT_EPSILON &&
        support.maxY - support.minY > SUPPORT_EPSILON
    );
  const xBreaks = [
    ...new Set([rect.minX, rect.maxX, ...clipped.flatMap((r) => [r.minX, r.maxX])]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < xBreaks.length; i++) {
    if (xBreaks[i] - xBreaks[i - 1] <= SUPPORT_EPSILON) continue;
    const x = (xBreaks[i] + xBreaks[i - 1]) / 2;
    const intervals = clipped
      .filter((support) => support.minX <= x && support.maxX >= x)
      .map((support) => [support.minY, support.maxY] as const)
      .sort((a, b) => a[0] - b[0]);
    let coveredTo = rect.minY;
    for (const [start, end] of intervals) {
      if (start > coveredTo + SUPPORT_EPSILON) return false;
      coveredTo = Math.max(coveredTo, end);
      if (coveredTo >= rect.maxY - SUPPORT_EPSILON) break;
    }
    if (coveredTo < rect.maxY - SUPPORT_EPSILON) return false;
  }
  return true;
}

export function footprintFits(upper: Footprint, lower: Footprint, dx: number, dy: number): boolean {
  // A 1.5mm integral tongue may extend past a female seam beneath it. This
  // short overhang is printable; larger padding or slab overhangs still split.
  const tolerance = TONGUE_PROTRUSION + 1e-6;
  const outerFits =
    upper.minX + dx >= lower.minX - tolerance &&
    upper.maxX + dx <= lower.maxX + tolerance &&
    upper.minY + dy >= lower.minY - tolerance &&
    upper.maxY + dy <= lower.maxY + tolerance;
  if (!outerFits) return false;
  return upper.padding.every((margin) =>
    rectIsCovered(
      {
        minX: margin.minX + dx,
        maxX: margin.maxX + dx,
        minY: margin.minY + dy,
        maxY: margin.maxY + dy,
      },
      lower.padding
    )
  );
}

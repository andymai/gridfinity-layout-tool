/**
 * Pure SVG → ParsedCutoutSpec[] parser.
 *
 * Parses an SVG string and extracts geometric elements (rect, circle, ellipse,
 * polygon, polyline, path) as intermediate cutout specs. Non-geometric elements
 * (text, image, defs) are ignored.
 *
 * No React, no store, no side effects. Testable with jsdom's DOMParser.
 *
 * Implementation lives in sibling files:
 *   - `svgTransform.ts`     — matrix ops + transform-attribute parsing
 *   - `svgConvertShapes.ts` — rect/circle/ellipse/polygon/polyline converters
 *   - `svgConvertPath.ts`   — path-element + sub-contour conversion
 *   - `svgArcToBezier.ts`   — arc segment → cubic bezier
 */

import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { ParsedCutoutSpec, SvgImportError, ViewBox } from './types';
import { MAX_SVG_SHAPES } from './types';
import { resolveTransformChain, type Matrix } from './svgTransform';
import {
  convertRect,
  convertCircle,
  convertEllipse,
  convertPointsElement,
  wrapSingle,
} from './svgConvertShapes';
import { convertPath } from './svgConvertPath';

export type { ViewBox } from './types';

/**
 * Geometric SVG elements, excluding those inside non-rendered containers.
 * The :not() selectors filter out shapes inside defs, clipPath, mask, symbol, and pattern.
 */
const GEOMETRIC_SELECTOR = ['rect', 'circle', 'ellipse', 'polygon', 'polyline', 'path']
  .map((tag) => `${tag}:not(defs *, clipPath *, mask *, symbol *, pattern *)`)
  .join(', ');

/**
 * Parse an SVG string into intermediate cutout specs.
 *
 * @param svgString - Raw SVG file content
 * @returns Result with specs on success, SvgImportError on failure
 */
export function parseSvgString(svgString: string): Result<ParsedCutoutSpec[], SvgImportError> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent is `string | null`; err detail accepts `string | undefined`, so coalesce null → undefined
    return err({ code: 'SVG_PARSE_FAILED', detail: parseError.textContent ?? undefined });
  }

  const svgRoot = doc.querySelector('svg');
  if (!svgRoot) {
    return err({ code: 'SVG_UNSUPPORTED', detail: 'No <svg> root element found' });
  }

  const elements = svgRoot.querySelectorAll(GEOMETRIC_SELECTOR);

  if (elements.length === 0) {
    return err({ code: 'SVG_NO_SHAPES', detail: 'No geometric elements found' });
  }

  if (elements.length > MAX_SVG_SHAPES) {
    return err({
      code: 'SVG_SHAPE_LIMIT',
      detail: `Found ${elements.length} shapes, max is ${MAX_SVG_SHAPES}`,
    });
  }

  const viewBox = parseViewBox(svgRoot);

  const specs: ParsedCutoutSpec[] = [];

  for (const el of elements) {
    try {
      const matrix = resolveTransformChain(el, svgRoot);
      const converted = convertElement(el, matrix, viewBox);
      if (converted) {
        specs.push(...converted);
      }
    } catch {
      // Skip individual elements that fail conversion
    }
  }

  if (specs.length === 0) {
    return err({ code: 'SVG_NO_SHAPES', detail: 'All shapes failed conversion' });
  }

  // Guard against multi-contour paths expanding beyond the element-count limit
  if (specs.length > MAX_SVG_SHAPES) {
    return err({
      code: 'SVG_SHAPE_LIMIT',
      detail: `Produced ${specs.length} cutouts, max is ${MAX_SVG_SHAPES}`,
    });
  }

  return ok(specs);
}

function parseViewBox(svg: SVGSVGElement): ViewBox {
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      parts.length === 4 &&
      parts.every((n) => Number.isFinite(n)) &&
      parts[2] > 0 &&
      parts[3] > 0
    ) {
      return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
    }
  }

  // Fallback to width/height attributes
  const w = parseFloat(svg.getAttribute('width') ?? '0');
  const h = parseFloat(svg.getAttribute('height') ?? '0');
  return { minX: 0, minY: 0, width: w || 100, height: h || 100 };
}

function convertElement(el: Element, matrix: Matrix, viewBox: ViewBox): ParsedCutoutSpec[] | null {
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'rect':
      return wrapSingle(convertRect(el, matrix, viewBox));
    case 'circle':
      return wrapSingle(convertCircle(el, matrix, viewBox));
    case 'ellipse':
      return wrapSingle(convertEllipse(el, matrix, viewBox));
    case 'polygon':
    case 'polyline':
      return wrapSingle(convertPointsElement(el, matrix, viewBox));
    case 'path':
      return convertPath(el, matrix, viewBox);
    default:
      return null;
  }
}

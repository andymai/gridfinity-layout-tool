/**
 * SVG Import module for the cutout editor.
 *
 * Provides SVG file import capability: parse SVG → extract shapes → add as cutouts.
 */

export { parseSvgString } from './svgParser';
export { specToCutout, DEFAULT_CUT_DEPTH } from './specToCutout';
export type { HydrationOptions } from './specToCutout';
export { useSvgImport } from './useSvgImport';
export type { UseSvgImportReturn } from './useSvgImport';
export type { ParsedCutoutSpec, SvgImportError, SvgImportErrorCode } from './types';
export { MAX_SVG_SHAPES } from './types';

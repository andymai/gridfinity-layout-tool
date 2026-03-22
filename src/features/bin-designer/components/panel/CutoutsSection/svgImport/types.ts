/**
 * Types for the SVG import pipeline.
 *
 * ParsedCutoutSpec is the intermediate representation between SVG parsing
 * and Cutout hydration. It carries geometry without store-specific fields
 * (id, cutDepth, groupId, etc.).
 */

import type { CutoutShape, PathPoint } from '@/features/bin-designer/types';

/** Intermediate representation of a parsed SVG shape before hydration to Cutout. */
export interface ParsedCutoutSpec {
  readonly shape: CutoutShape;
  /** X position of left edge in mm */
  readonly x: number;
  /** Y position of bottom edge in mm */
  readonly y: number;
  /** Width in mm */
  readonly width: number;
  /** Depth (height in 2D) in mm */
  readonly depth: number;
  /** Corner radius for rectangle shapes (mm) */
  readonly cornerRadius: number;
  /** Rotation in degrees (0-359) */
  readonly rotation: number;
  /** Path vertices for path shapes */
  readonly path?: PathPoint[];
}

/** Error codes for SVG import failures. */
export type SvgImportErrorCode =
  | 'SVG_PARSE_FAILED'
  | 'SVG_NO_SHAPES'
  | 'SVG_SHAPE_LIMIT'
  | 'SVG_UNSUPPORTED';

/** Structured error from SVG import. */
export interface SvgImportError {
  readonly code: SvgImportErrorCode;
  readonly detail?: string;
}

/** Maximum number of SVG shapes to import (guard against huge files). */
export const MAX_SVG_SHAPES = 500;

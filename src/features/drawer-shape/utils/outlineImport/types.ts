/**
 * Shared vocabulary for importing a drawer perimeter from a file.
 *
 * Both parsers land on the same shape — closed loops of `OutlineVertex` in mm,
 * Y-up — so loop selection, fitting and simplification are written once and do
 * not care which format the geometry came from.
 */

import type { OutlineVertex } from '@/core/types';

export type OutlineImportErrorCode =
  | 'PARSE_FAILED'
  | 'NO_CLOSED_LOOP'
  | 'TOO_MANY_VERTICES'
  | 'TOO_SMALL'
  | 'FILE_TOO_LARGE'
  | 'BINARY_DXF'
  | 'UNSUPPORTED';

export interface OutlineImportError {
  readonly code: OutlineImportErrorCode;
  readonly detail?: string;
}

/** A closed loop in millimetres, Y-up. Winding is not yet normalized. */
export interface ImportedLoop {
  readonly vertices: OutlineVertex[];
}

/** Largest SVG or DXF accepted (5 MB), matching the cutout importer's cap. */
export const MAX_OUTLINE_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Endpoint gap (mm) still treated as a join when chaining loose segments into
 * a loop. CAD writers round coordinates, so a profile drawn as separate lines
 * and arcs rarely has bit-identical shared endpoints.
 */
export const JOIN_TOLERANCE_MM = 0.05;

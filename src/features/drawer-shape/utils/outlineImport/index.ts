/**
 * Import a drawer perimeter from an SVG or DXF measured in CAD (issue #3054).
 *
 * The pipeline is format-agnostic after parsing: pick the largest closed loop,
 * wind it CCW, place it in the drawer at true scale, and thin it only if it
 * exceeds the outline model's vertex ceiling.
 */

import type { Result } from '@/core/result';
import { ok, err, isErr } from '@/core/result';
import { parseDxfString } from './dxfParser';
import { parseSvgOutline } from './svgOutlineParser';
import { fitLoop, largestLoop, type FittedLoop } from './fitLoop';
import { simplifyLoop } from './simplifyLoop';
import type { ImportedLoop, OutlineImportError } from './types';

export type { OutlineImportError, OutlineImportErrorCode, ImportedLoop } from './types';
export { MAX_OUTLINE_FILE_SIZE } from './types';
export type { FittedLoop } from './fitLoop';
export { parseDxfString } from './dxfParser';
export { parseSvgOutline } from './svgOutlineParser';
export { fitLoop, largestLoop, loopBounds } from './fitLoop';
export { simplifyLoop } from './simplifyLoop';

export interface ImportOptions {
  readonly drawerWidthMm: number;
  readonly drawerDepthMm: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  /** Scale the loop down to the drawer instead of keeping its measured size. */
  readonly scaleToFit: boolean;
}

export interface ImportedOutline extends FittedLoop {
  /** Closed loops found but discarded; only the largest becomes the perimeter. */
  readonly droppedLoops: number;
  /** Vertices dropped to reach the model ceiling; 0 when nothing was thinned. */
  readonly simplifiedAway: number;
  /** Whether the loop fits the drawer at its measured size. */
  readonly fitsAtTrueScale: boolean;
}

/** Route by extension, falling back to sniffing the content. */
function parseByType(text: string, fileName: string): Result<ImportedLoop[], OutlineImportError> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.dxf')) return parseDxfString(text);
  if (lower.endsWith('.svg')) return parseSvgOutline(text);
  return text.trimStart().startsWith('<') ? parseSvgOutline(text) : parseDxfString(text);
}

/**
 * Parse a file into a perimeter placed in the drawer.
 *
 * `TOO_SMALL` covers a loop with no usable area — a stray marker or a
 * degenerate path — which would otherwise reach the outline validator as an
 * error the user cannot act on.
 */
export function importOutline(
  text: string,
  fileName: string,
  options: ImportOptions
): Result<ImportedOutline, OutlineImportError> {
  const parsed = parseByType(text, fileName);
  if (isErr(parsed)) return parsed;

  const loops = parsed.value;
  const loop = largestLoop(loops);
  if (loop === null) return err({ code: 'NO_CLOSED_LOOP' });

  const fitted = fitLoop(
    loop,
    options.drawerWidthMm,
    options.drawerDepthMm,
    options.gridUnitMm,
    options.gridUnitMmY,
    options.scaleToFit
  );
  if (fitted.sourceWidthMm <= 0 || fitted.sourceDepthMm <= 0) {
    return err({ code: 'TOO_SMALL' });
  }

  const simplified = simplifyLoop(fitted.vertices);
  if (simplified.vertices.length < 3) return err({ code: 'TOO_SMALL' });

  return ok({
    ...fitted,
    vertices: simplified.vertices,
    droppedLoops: loops.length - 1,
    simplifiedAway: simplified.removed,
    fitsAtTrueScale:
      fitted.sourceWidthMm <= options.drawerWidthMm + 1e-6 &&
      fitted.sourceDepthMm <= options.drawerDepthMm + 1e-6,
  });
}

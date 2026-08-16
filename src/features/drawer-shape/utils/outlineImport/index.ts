/**
 * Import a drawer perimeter from an SVG or DXF measured in CAD.
 *
 * The pipeline is format-agnostic after parsing: pick the largest closed loop,
 * wind it CCW, place it in the drawer at true scale, and thin it only if it
 * exceeds the outline model's vertex ceiling.
 */

import type { Result } from '@/core/result';
import { ok, err, isErr } from '@/core/result';
import { OUTLINE_MAX_VERTICES } from '@/shared/utils/drawerOutline';
import { parseDxfString } from './dxfParser';
import { parseSvgOutline } from './svgOutlineParser';
import { fitLoop, largestLoop, type FittedLoop } from './fitLoop';
import { ensureMinVertices, simplifyLoop } from './simplifyLoop';
import type { ImportedLoop, OutlineImportError } from './types';

export type { OutlineImportError, OutlineImportErrorCode, ImportedLoop } from './types';
export { MAX_OUTLINE_FILE_SIZE } from './types';
export type { FittedLoop } from './fitLoop';
export { parseDxfString } from './dxfParser';
export { parseSvgOutline } from './svgOutlineParser';
export { fitLoop, largestLoop, loopBounds, unitsFor } from './fitLoop';
export { ensureMinVertices, simplifyLoop } from './simplifyLoop';

export interface ImportOptions {
  readonly drawerWidthMm: number;
  readonly drawerDepthMm: number;
  readonly gridUnitMm: number;
  readonly gridUnitMmY: number;
  /** Scale the loop down to the drawer instead of keeping its measured size. */
  readonly scaleToFit: boolean;
}

/** Which parser actually read the file, whatever it was named. */
export type OutlineFormat = 'svg' | 'dxf';

export interface ImportedOutline extends FittedLoop {
  /** The format detected from the content — the truthful thing to report. */
  readonly format: OutlineFormat;
  /** Closed loops found but discarded; only the largest becomes the perimeter. */
  readonly droppedLoops: number;
  /** Vertices dropped to reach the model ceiling; 0 when nothing was thinned. */
  readonly simplifiedAway: number;
  /** Whether the loop fits the drawer at its measured size. */
  readonly fitsAtTrueScale: boolean;
}

/**
 * Route by content, not by extension.
 *
 * The two formats are trivially distinguishable — SVG is XML and opens with
 * `<`, a DXF group-code stream never does — and a drawing that was renamed, or
 * saved with no extension at all, is still the format it is. Routing on the
 * name instead would fail such a file with "could not be read", which tells the
 * user nothing they can act on.
 */
function parseByContent(text: string): {
  format: OutlineFormat;
  result: Result<ImportedLoop[], OutlineImportError>;
} {
  return text.trimStart().startsWith('<')
    ? { format: 'svg', result: parseSvgOutline(text) }
    : { format: 'dxf', result: parseDxfString(text) };
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
  options: ImportOptions
): Result<ImportedOutline, OutlineImportError> {
  const { format, result: parsed } = parseByContent(text);
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

  // Curves can leave a loop below the model's three-vertex floor (a circle is
  // two half-arcs), so raise it before thinning rather than after.
  const simplified = simplifyLoop(ensureMinVertices(fitted.vertices));
  if (simplified.vertices.length < 3) return err({ code: 'TOO_SMALL' });
  // Simplification pins arc endpoints, so a perimeter that is mostly arcs can
  // stay above the ceiling however far the tolerance escalates. Say so here:
  // otherwise the import "succeeds" and Apply is blocked later by a validator
  // message that does not explain which file caused it.
  if (simplified.vertices.length > OUTLINE_MAX_VERTICES) {
    return err({ code: 'TOO_MANY_VERTICES', detail: `${simplified.vertices.length} points` });
  }

  return ok({
    ...fitted,
    format,
    vertices: simplified.vertices,
    droppedLoops: loops.length - 1,
    simplifiedAway: simplified.removed,
    fitsAtTrueScale:
      fitted.sourceWidthMm <= options.drawerWidthMm + 1e-6 &&
      fitted.sourceDepthMm <= options.drawerDepthMm + 1e-6,
  });
}

import type { BinParams } from '@/shared/types/bin';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The store migrates params on read, so this only has to tell a bin's params
 * from the absent params of other item kinds and from a corrupt record.
 */
export function isBinParams(value: unknown): value is BinParams {
  return (
    isRecord(value) &&
    typeof value.width === 'number' &&
    typeof value.depth === 'number' &&
    typeof value.height === 'number' &&
    isRecord(value.compartments) &&
    Array.isArray(value.compartments.cells) &&
    Array.isArray(value.cutouts)
  );
}

/** Merged cells share an id, so a compartment is a distinct id in `cells`. */
export function compartmentCount(params: BinParams): number {
  const { cells, rows, cols } = params.compartments;
  return cells.length > 0 ? new Set(cells).size : Math.max(1, rows * cols);
}

function isFilled(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.trim().length > 0;
}

/**
 * Only text the generator engraves. Label tabs carry row text when they span
 * rows, else compartment text; socket mode decides spanning from a fit only
 * the worker knows, so it takes the row text whenever a row has some.
 */
function labelTexts(params: BinParams): readonly (string | undefined)[] {
  if (!params.label.enabled) return [];
  const rows = params.label.rowTexts ?? [];
  const compartments = params.compartments.compartmentTexts ?? [];
  if (params.label.span === true) return rows;
  if ((params.label.mode ?? 'text') === 'socket' && rows.some(isFilled)) return rows;
  return compartments;
}

function textCount(params: BinParams): number {
  const surface = params.surfaceText;
  const texts: (string | null | undefined)[] = [
    ...labelTexts(params),
    params.lid.enabled ? surface?.lidText : undefined,
    surface?.floorText,
    ...Object.values(surface?.walls ?? {}),
  ];
  return texts.filter(isFilled).length;
}

export function hasLabelText(params: BinParams): boolean {
  return textCount(params) > 0;
}

/**
 * A cheap guess at which designs have the biggest meshes, used to pick the few
 * worth generating. Patterns and engraved text add the most triangles.
 */
export function featureScore(params: BinParams): number {
  return (
    compartmentCount(params) +
    params.cutouts.length * 2 +
    params.inserts.length * 2 +
    textCount(params) * 3 +
    (params.wallPattern.enabled ? 6 : 0) +
    (params.floorPattern?.enabled === true ? 6 : 0) +
    (params.lid.enabled ? 3 : 0) +
    (params.scoop.enabled ? 2 : 0) +
    (params.label.enabled ? 1 : 0) +
    (params.handles.enabled ? 1 : 0) +
    (params.slant ? 1 : 0)
  );
}

import type { BinParams } from '@/shared/types/bin';
import { engravedCaptions } from '@/shared/utils/placedCaption';

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

function isFilled(text: unknown): boolean {
  return typeof text === 'string' && text.trim().length > 0;
}

/** Migration keeps a malformed nested value, so a text list may not be a list. */
function texts(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function textCount(params: BinParams, nozzleSizeMm: number | undefined): number {
  const surface = params.surfaceText;
  return [
    ...texts(engravedCaptions(params, nozzleSizeMm)),
    params.lid.enabled ? surface?.lidText : undefined,
    surface?.floorText,
    ...Object.values(surface?.walls ?? {}),
  ].filter(isFilled).length;
}

export function hasLabelText(params: BinParams, nozzleSizeMm?: number): boolean {
  return textCount(params, nozzleSizeMm) > 0;
}

/**
 * A cheap guess at which designs have the biggest meshes, used to pick the few
 * worth generating. Patterns and engraved text add the most triangles.
 */
export function featureScore(params: BinParams, nozzleSizeMm?: number): number {
  return (
    compartmentCount(params) +
    params.cutouts.length * 2 +
    params.inserts.length * 2 +
    textCount(params, nozzleSizeMm) * 3 +
    (params.wallPattern.enabled ? 6 : 0) +
    (params.floorPattern?.enabled === true ? 6 : 0) +
    (params.lid.enabled ? 3 : 0) +
    (params.scoop.enabled ? 2 : 0) +
    (params.label.enabled ? 1 : 0) +
    (params.handles.enabled ? 1 : 0) +
    (params.slant ? 1 : 0)
  );
}

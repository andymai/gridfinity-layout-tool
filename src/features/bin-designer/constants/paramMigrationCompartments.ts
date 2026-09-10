/** Migration of persisted bento compartment fields. */

import type { CompartmentConfig, StashedCompartment } from '../types';
import { TEXT_MAX_LENGTH } from '../types/text';
import { isUsableFootprintMask } from '../utils/compartments';
import { DESIGNER_CONSTRAINTS } from './gridfinity';

/**
 * A stash entry's footprint mask, or undefined for a plain rectangle. Anything
 * the server would reject — wrong length, non-boolean, empty, all-filled, or
 * split into two islands — is dropped rather than repaired, landing the entry on
 * the rectangle the field's absence already means. Dropping beats leaving the
 * mask in place: `drawFootprint` refuses a disconnected footprint, so a kept one
 * would show a shelf chip that silently declines to place.
 */
function cleanFootprintMask(mask: unknown, w: number, h: number): boolean[] | undefined {
  if (!Array.isArray(mask)) return undefined;
  const cells: unknown[] = mask;
  if (cells.some((cell) => typeof cell !== 'boolean')) return undefined;
  const booleans = cells as boolean[];
  return isUsableFootprintMask(booleans, w, h) ? booleans : undefined;
}

/**
 * Sanitize the Bento workspace fields on load, mirroring the server bounds:
 * stash entries need integer cell footprints within the grid ceiling and a
 * clamped label; `drawnUnitCells` may only mark IDs that are 1×1 in `cells`,
 * and `backgroundIds` only IDs that exist, and only in merged-leftover mode. All collapse to absent when empty —
 * an always-present default would shift `communityParamsFingerprint` for every
 * existing design (see `base.tile`).
 */
export function migrateBentoCompartmentFields(config: CompartmentConfig): CompartmentConfig {
  const { stash, drawnUnitCells, backgroundIds, mergeBackground, ...rest } = config;

  // Persisted payloads are untrusted — validate as unknown despite the type.
  const rawStash: readonly unknown[] = Array.isArray(stash) ? stash : [];
  const cleanStash = rawStash
    .filter((entry): entry is StashedCompartment => {
      if (typeof entry !== 'object' || entry === null) return false;
      const e = entry as Record<string, unknown>;
      return (
        typeof e.w === 'number' &&
        Number.isInteger(e.w) &&
        typeof e.h === 'number' &&
        Number.isInteger(e.h) &&
        e.w >= 1 &&
        e.h >= 1 &&
        e.w <= DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID &&
        e.h <= DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
      );
    })
    .slice(0, DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES)
    .map(({ w, h, cells, label }) => {
      const clamped = typeof label === 'string' ? label.slice(0, TEXT_MAX_LENGTH) : '';
      const mask = cleanFootprintMask(cells, w, h);
      return {
        w,
        h,
        ...(mask ? { cells: mask } : {}),
        ...(clamped.length > 0 ? { label: clamped } : {}),
      };
    });

  const counts = new Map<number, number>();
  for (const id of config.cells) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const cleanDrawn = [
    ...new Set(
      (Array.isArray(drawnUnitCells) ? drawnUnitCells : []).filter(
        (id): id is number => Number.isInteger(id) && counts.get(id) === 1
      )
    ),
  ].sort((a, b) => a - b);

  // Markers outlive their mode only as a way to demote a drawn compartment to
  // background behind the user's back, so they go with it.
  const cleanBackground =
    mergeBackground === true
      ? [
          ...new Set(
            (Array.isArray(backgroundIds) ? backgroundIds : []).filter(
              (id): id is number => Number.isInteger(id) && counts.has(id)
            )
          ),
        ].sort((a, b) => a - b)
      : [];

  return {
    ...rest,
    ...(mergeBackground === true ? { mergeBackground: true } : {}),
    ...(cleanStash.length > 0 ? { stash: cleanStash } : {}),
    ...(cleanDrawn.length > 0 ? { drawnUnitCells: cleanDrawn } : {}),
    ...(cleanBackground.length > 0 ? { backgroundIds: cleanBackground } : {}),
  };
}

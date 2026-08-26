/**
 * Compartment ID remapping.
 *
 * Every mutation that renumbers `cells` finishes with `normalizeIdsWithRemap`,
 * and the `oldId → newId` map it returns must be threaded through EVERY parallel
 * array keyed by compartment id: texts, plate widths, icons, colours, colour
 * scopes, drawn-unit markers, background markers, divider overrides. Skip one
 * and its entries stay indexed by ids that now mean a different compartment, so
 * labels, colours and tilts land silently on the wrong pockets. A new
 * compartment-keyed array needs its remap here AND a call from every mutation,
 * not just the one that motivated it.
 */

import type { CompartmentColorScope, CompartmentConfig, DividerOverride } from '../types';
import { getCompartmentBounds, getCompartmentIds } from './compartments';

/**
 * Normalize compartment IDs to be contiguous starting from 0.
 * Preserves spatial ordering (top-left to bottom-right first occurrence).
 */
export function normalizeIds(cells: number[]): number[] {
  return normalizeIdsWithRemap(cells).cells;
}

/**
 * Variant of `normalizeIds` that also returns the `oldId → newId` remap so
 * callers can keep parallel per-compartment arrays (e.g. `compartmentTexts`)
 * in lockstep with `cells`. Use this for any mutation that may renumber IDs.
 */
export function normalizeIdsWithRemap(cells: number[]): {
  cells: number[];
  remap: Map<number, number>;
} {
  const remap = new Map<number, number>();
  let nextId = 0;

  const normalized = cells.map((id) => {
    let normalizedId = remap.get(id);
    if (normalizedId === undefined) {
      normalizedId = nextId++;
      remap.set(id, normalizedId);
    }
    return normalizedId;
  });

  return { cells: normalized, remap };
}

/**
 * Reindex a parallel per-compartment texts array through an `oldId → newId`
 * map (from `normalizeIdsWithRemap`).
 *
 * The remap is always one-to-one — IDs that disappeared from `cells` before
 * normalize ran (e.g. a merge stomped `1,2 → 0`) are absent from the remap
 * and their text drops. New IDs not in `oldTexts` (e.g. from a split) get
 * an empty string in the output slot.
 */
export function remapCompartmentTexts(
  oldTexts: readonly string[] | undefined,
  remap: ReadonlyMap<number, number>
): string[] {
  if (!oldTexts || oldTexts.length === 0) return [];
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: string[] = new Array<string>(maxNewId + 1).fill('');
  for (const [oldId, newId] of remap) {
    const t = oldTexts[oldId];
    if (typeof t === 'string') out[newId] = t;
  }
  return out;
}

/**
 * Reindex the parallel per-compartment swappable-label plate width overrides
 * through an `oldId → newId` map, mirroring `remapCompartmentTexts`. IDs
 * absent from the remap drop their override; new IDs (splits) get `null`
 * (auto width). Returns `undefined` when no numeric override survives —
 * the "no overrides set" state, matching the field's compact-storage
 * convention (`setCompartmentPlateWidth` does the same).
 */
export function remapLabelPlateWidths(
  oldWidths: readonly (number | null)[] | undefined,
  remap: ReadonlyMap<number, number>
): (number | null)[] | undefined {
  if (!oldWidths || oldWidths.length === 0) return undefined;
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: (number | null)[] = new Array<number | null>(maxNewId + 1).fill(null);
  let anySet = false;
  for (const [oldId, newId] of remap) {
    const w = oldWidths[oldId];
    if (typeof w === 'number') {
      out[newId] = w;
      anySet = true;
    }
  }
  return anySet ? out : undefined;
}

/**
 * Remap per-compartment plate icons across a `normalizeIdsWithRemap`
 * renumbering, exactly like `remapLabelPlateWidths` — icons whose
 * compartment vanished drop; new IDs get no icon.
 */
export function remapLabelIcons(
  oldIcons: readonly (string | null)[] | undefined,
  remap: ReadonlyMap<number, number>
): (string | null)[] | undefined {
  if (!oldIcons || oldIcons.length === 0) return undefined;
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: (string | null)[] = new Array<string | null>(maxNewId + 1).fill(null);
  let anySet = false;
  for (const [oldId, newId] of remap) {
    const icon = oldIcons[oldId];
    if (typeof icon === 'string') {
      out[newId] = icon;
      anySet = true;
    }
  }
  return anySet ? out : undefined;
}

/**
 * Remap per-compartment shadow-box colours across a `normalizeIdsWithRemap`
 * renumbering, exactly like `remapLabelIcons` — a colour whose compartment
 * vanished drops, and a new ID (a split) starts uncoloured. Without this the
 * colours stay indexed by ids that no longer mean the same compartment, and a
 * merge silently repaints unrelated cells (CLAUDE.md gotcha #6).
 */
export function remapCompartmentColors(
  oldColors: readonly (string | null)[] | undefined,
  remap: ReadonlyMap<number, number>
): (string | null)[] | undefined {
  if (!oldColors || oldColors.length === 0) return undefined;
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: (string | null)[] = new Array<string | null>(maxNewId + 1).fill(null);
  let anySet = false;
  for (const [oldId, newId] of remap) {
    const color = oldColors[oldId];
    if (typeof color === 'string' && color !== '') {
      out[newId] = color;
      anySet = true;
    }
  }
  return anySet ? out : undefined;
}

/**
 * Remap the per-compartment paint scopes in lockstep with
 * {@link remapCompartmentColors}. Kept separate rather than folded into one
 * object array so an existing design's `communityParamsFingerprint` only shifts
 * for the field it actually gained.
 */
export function remapCompartmentColorScopes(
  oldScopes: readonly (CompartmentColorScope | null)[] | undefined,
  remap: ReadonlyMap<number, number>
): (CompartmentColorScope | null)[] | undefined {
  if (!oldScopes || oldScopes.length === 0) return undefined;
  let maxNewId = -1;
  for (const newId of remap.values()) {
    if (newId > maxNewId) maxNewId = newId;
  }
  const out: (CompartmentColorScope | null)[] = new Array<CompartmentColorScope | null>(
    maxNewId + 1
  ).fill(null);
  let anySet = false;
  for (const [oldId, newId] of remap) {
    const scope = oldScopes[oldId];
    if (scope === 'floor' || scope === 'floorAndWalls') {
      out[newId] = scope;
      anySet = true;
    }
  }
  return anySet ? out : undefined;
}

/**
 * Best-effort carry of per-compartment label text across a grid-DIMENSION
 * change. `setCompartmentGrid` regenerates a fresh uniform grid, so the new
 * IDs can't be remapped from the old ones (CLAUDE.md gotcha #6 — there is no
 * `oldId → newId` correspondence). Instead we anchor each old compartment at its
 * lowest cell in data coordinates (`minCol`, `minRow`) and carry its label to
 * the new uniform cell at that same position — the one spatial mapping that's
 * unambiguous. Row 0 is the visual BOTTOM (the grid renders `flex-col-reverse`),
 * so `minRow` is the compartment's visual bottom; for the common single-cell
 * case `minRow === maxRow` so it doesn't matter. (Display numbering instead
 * anchors at the visual TOP — see `getCompartmentReadingOrder`,.)
 *
 * Labels whose anchor falls outside the new (smaller) grid have nowhere to land
 * and are dropped; `droppedCount` reports how many non-empty labels were lost so
 * the caller can warn instead of discarding them silently.
 *
 * Returns `texts` indexed by new compartment ID (`row * newCols + col`).
 */
export function carryCompartmentTextsByPosition(
  oldConfig: CompartmentConfig,
  newCols: number,
  newRows: number
): { texts: string[]; droppedCount: number } {
  const oldTexts = oldConfig.compartmentTexts;
  if (!oldTexts || oldTexts.length === 0) return { texts: [], droppedCount: 0 };

  const texts = new Array<string>(newCols * newRows).fill('');
  let droppedCount = 0;
  for (const id of getCompartmentIds(oldConfig)) {
    const label = oldTexts[id];
    if (typeof label !== 'string' || label.length === 0) continue;
    const bounds = getCompartmentBounds(oldConfig, id);
    if (!bounds) continue;
    if (bounds.minCol < newCols && bounds.minRow < newRows) {
      texts[bounds.minRow * newCols + bounds.minCol] = label;
    } else {
      droppedCount++;
    }
  }
  return { texts, droppedCount };
}

/**
 * Reindex the drawn-unit-cell markers through an `oldId → newId` remap,
 * mirroring `remapCompartmentTexts`. An ID that disappeared drops its marker;
 * an ID whose compartment is no longer 1×1 in `newCells` drops it too (a
 * multi-cell compartment is intrinsically drawn, so keeping the marker would
 * only leave a stale entry to resurface on a later split). Returns
 * `undefined` when nothing survives — the compact-storage convention every
 * optional compartment field follows.
 */
export function remapDrawnUnitCells(
  oldIds: readonly number[] | undefined,
  remap: ReadonlyMap<number, number>,
  newCells: readonly number[]
): number[] | undefined {
  if (!oldIds || oldIds.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const id of newCells) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const out: number[] = [];
  const seen = new Set<number>();
  for (const oldId of oldIds) {
    const newId = remap.get(oldId);
    if (newId === undefined || seen.has(newId)) continue;
    if (counts.get(newId) !== 1) continue;
    seen.add(newId);
    out.push(newId);
  }
  return out.length > 0 ? out.sort((a, b) => a - b) : undefined;
}

/**
 * Reindex the merged-background markers through an `oldId → newId` remap.
 * IDs that no longer exist drop out; `undefined` when nothing survives, per
 * the compact-storage convention the other optional arrays follow.
 */
export function remapBackgroundIds(
  oldIds: readonly number[] | undefined,
  remap: ReadonlyMap<number, number>
): number[] | undefined {
  if (!oldIds || oldIds.length === 0) return undefined;
  const out = new Set<number>();
  for (const oldId of oldIds) {
    const newId = remap.get(oldId);
    if (newId !== undefined) out.add(newId);
  }
  return out.size > 0 ? [...out].sort((a, b) => a - b) : undefined;
}

/**
 * Reindex divider overrides through an `oldId → newId` remap.
 *
 * Drops any override whose endpoint compartment disappeared (cells stomped
 * before normalize ran) OR whose two endpoints collapsed to the same ID
 * (their boundary no longer exists). Surviving overrides keep canonical
 * `compartmentA < compartmentB` ordering.
 */
export function remapDividerOverrides(
  oldOverrides: readonly DividerOverride[] | undefined,
  remap: ReadonlyMap<number, number>
): DividerOverride[] {
  if (!oldOverrides || oldOverrides.length === 0) return [];
  const out: DividerOverride[] = [];
  // Deduplicate by canonical pair: a merge can collapse two old overrides
  // onto the same new (compartmentA, compartmentB) pair. Keep the first
  // occurrence — without this, the worker's lookup map silently last-write-
  // wins, the validator rejects the design on next save, and the schema's
  // "no duplicate pairs" invariant breaks.
  const seenPairs = new Set<string>();
  for (const o of oldOverrides) {
    const newA = remap.get(o.compartmentA);
    const newB = remap.get(o.compartmentB);
    if (newA === undefined || newB === undefined) continue;
    if (newA === newB) continue;
    const [a, b] = newA < newB ? [newA, newB] : [newB, newA];
    const key = `${a}|${b}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    out.push({
      compartmentA: a,
      compartmentB: b,
      offsetStart: o.offsetStart,
      offsetEnd: o.offsetEnd,
      ...(o.rakeDeg ? { rakeDeg: o.rakeDeg } : {}),
    });
  }
  return out;
}

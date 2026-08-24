/**
 * Additive drawing model over the compartment grid, for the Bento workspace.
 *
 * The physical model is unchanged: `cells` always partitions the full grid,
 * so "background" is simply the set of 1×1 compartments nobody drew — they
 * still print as unit pockets. What this module adds is the layout-planner
 * mental model on top: a compartment is DRAWN (a first-class object the user
 * placed, moved, resized, stashed) or it is background grid. Drawn-ness is
 * derived, not stored per se: multi-cell compartments and labeled/decorated
 * ones are intrinsically drawn; bare 1×1 draws are the one case that needs
 * the persisted `drawnUnitCells` marker.
 *
 * Every mutation here rebuilds `cells` and funnels through
 * `normalizeIdsWithRemap`, threading ALL parallel arrays (gotcha #6) and
 * pruning divider overrides whose pair is no longer adjacent — a moved
 * compartment keeps its ID but not its neighbours, and the server validator
 * rejects non-adjacent pairs.
 */

import type { CellRect, CompartmentConfig, StashedCompartment } from '../types';

export type { CellRect };
import { TEXT_MAX_LENGTH } from '../types/text';
import { DESIGNER_CONSTRAINTS } from '../constants/gridfinity';
import {
  cellIndex,
  isContiguousSelection,
  getCellsForCompartment,
  getCompartmentBounds,
  getCompartmentReadingOrder,
  normalizeIdsWithRemap,
  remapCompartmentColors,
  remapCompartmentColorScopes,
  remapCompartmentTexts,
  remapDividerOverrides,
  remapBackgroundIds,
  remapDrawnUnitCells,
  remapLabelIcons,
  remapLabelPlateWidths,
  validateDividerOverride,
} from './compartments';

export interface DrawResult {
  readonly config: CompartmentConfig;
  /** ID of the affected compartment AFTER normalization. */
  readonly id: number;
}

export interface RegridResult {
  readonly config: CompartmentConfig;
  /** Compartments moved to the stash because they no longer fit. */
  readonly stashedCount: number;
  /** Compartments lost because the stash was already at capacity. */
  readonly droppedCount: number;
}

/**
 * IDs of compartments the user drew, as opposed to background grid.
 * Multi-cell size, any per-compartment decoration, or an explicit
 * `drawnUnitCells` marker each make a compartment drawn. This is the ONE
 * derivation point — rendering, hit-testing and validity all read it.
 */
export function getDrawnCompartmentIds(config: CompartmentConfig): ReadonlySet<number> {
  const counts = new Map<number, number>();
  for (const id of config.cells) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const drawn = new Set<number>();
  for (const [id, count] of counts) {
    if (count > 1) drawn.add(id);
  }
  const markDecorated = (id: number): void => {
    if (counts.has(id)) drawn.add(id);
  };
  config.compartmentTexts?.forEach((text, id) => {
    if (text.length > 0) markDecorated(id);
  });
  config.labelPlateWidths?.forEach((w, id) => {
    if (w !== null) markDecorated(id);
  });
  config.labelIcons?.forEach((icon, id) => {
    if (icon !== null) markDecorated(id);
  });
  config.drawnUnitCells?.forEach(markDecorated);
  // Last word: a merged leftover region is multi-cell, which every rule above
  // reads as drawn.
  config.backgroundIds?.forEach((id) => drawn.delete(id));
  return drawn;
}

/** Flat cell indices covered by a rect (caller guarantees bounds). */
export function rectIndices(cols: number, rect: CellRect): number[] {
  const out: number[] = [];
  for (let r = rect.row; r < rect.row + rect.h; r++) {
    for (let c = rect.col; c < rect.col + rect.w; c++) {
      out.push(cellIndex(cols, c, r));
    }
  }
  return out;
}

export function rectInBounds(config: CompartmentConfig, rect: CellRect): boolean {
  return (
    rect.w >= 1 &&
    rect.h >= 1 &&
    rect.col >= 0 &&
    rect.row >= 0 &&
    rect.col + rect.w <= config.cols &&
    rect.row + rect.h <= config.rows
  );
}

/**
 * True when the rect lands entirely on background grid (or on cells of
 * `ignoreId`, for move/resize where a compartment may overlap itself).
 */
export function canPlaceRect(
  config: CompartmentConfig,
  rect: CellRect,
  opts: { readonly ignoreId?: number } = {}
): boolean {
  if (!rectInBounds(config, rect)) return false;
  const drawn = getDrawnCompartmentIds(config);
  for (const idx of rectIndices(config.cols, rect)) {
    const id = config.cells[idx];
    if (id === opts.ignoreId) continue;
    if (drawn.has(id)) return false;
  }
  return true;
}

/** Bounding rect of a compartment, in CellRect form. */
export function getCompartmentRect(config: CompartmentConfig, id: number): CellRect | null {
  const b = getCompartmentBounds(config, id);
  if (!b) return null;
  return {
    col: b.minCol,
    row: b.minRow,
    w: b.maxCol - b.minCol + 1,
    h: b.maxRow - b.minRow + 1,
  };
}

/**
 * Collapse every 4-connected run of leftover cells onto one ID, and report
 * which IDs those are.
 *
 * Runs before normalize, on provisional IDs, so the caller's `remap.get(id)`
 * still finds a compartment it just drew: merging only ever rewrites cells
 * nobody drew.
 */
function mergeBackgroundRuns(
  config: CompartmentConfig,
  cells: number[]
): { cells: number[]; backgroundIds: number[] } {
  const drawn = getDrawnCompartmentIds({ ...config, cells });
  const { cols } = config;
  const out = [...cells];
  const visited = new Array<boolean>(cells.length).fill(false);
  const backgroundIds: number[] = [];
  let fresh = Math.max(...cells) + 1;

  for (let start = 0; start < out.length; start++) {
    if (visited[start] || drawn.has(out[start])) continue;
    const runId = fresh++;
    backgroundIds.push(runId);
    const stack = [start];
    visited[start] = true;
    while (stack.length > 0) {
      const idx = stack.pop() as number;
      out[idx] = runId;
      const col = idx % cols;
      const neighbours = [
        col > 0 ? idx - 1 : -1,
        col + 1 < cols ? idx + 1 : -1,
        idx - cols,
        idx + cols,
      ];
      for (const n of neighbours) {
        if (n < 0 || n >= out.length || visited[n] || drawn.has(out[n])) continue;
        visited[n] = true;
        stack.push(n);
      }
    }
  }
  return { cells: out, backgroundIds };
}

/**
 * Normalize a rebuilt cells array and thread every parallel structure through
 * the remap, then drop divider overrides whose pair stopped being adjacent.
 * All mutations in this module end here.
 */
function rebuild(
  config: CompartmentConfig,
  newCells: number[]
): { config: CompartmentConfig; remap: Map<number, number> } {
  const merged = config.mergeBackground
    ? mergeBackgroundRuns(config, newCells)
    : { cells: newCells, backgroundIds: [] };
  const { cells, remap } = normalizeIdsWithRemap(merged.cells);
  let next: CompartmentConfig = {
    ...config,
    cells,
    ...(config.compartmentTexts && {
      compartmentTexts: remapCompartmentTexts(config.compartmentTexts, remap),
    }),
    ...(config.labelPlateWidths && {
      labelPlateWidths: remapLabelPlateWidths(config.labelPlateWidths, remap),
    }),
    ...(config.labelIcons && {
      labelIcons: remapLabelIcons(config.labelIcons, remap),
    }),
    ...(config.compartmentColors && {
      compartmentColors: remapCompartmentColors(config.compartmentColors, remap),
    }),
    ...(config.compartmentColorScopes && {
      compartmentColorScopes: remapCompartmentColorScopes(config.compartmentColorScopes, remap),
    }),
    ...(config.dividerOverrides && {
      dividerOverrides: remapDividerOverrides(config.dividerOverrides, remap),
    }),
    ...(config.drawnUnitCells && {
      drawnUnitCells: remapDrawnUnitCells(config.drawnUnitCells, remap, cells),
    }),
    ...(merged.backgroundIds.length > 0 && {
      backgroundIds: remapBackgroundIds(merged.backgroundIds, remap),
    }),
  };
  const overrides = next.dividerOverrides;
  if (overrides && overrides.length > 0) {
    const kept = overrides.filter((o) => validateDividerOverride(next, o) === null);
    if (kept.length !== overrides.length) {
      next = { ...next, dividerOverrides: kept.length > 0 ? kept : undefined };
    }
  }
  return { config: next, remap };
}

function addDrawnUnitCell(config: CompartmentConfig, id: number): CompartmentConfig {
  const prev = config.drawnUnitCells ?? [];
  if (prev.includes(id)) return config;
  return { ...config, drawnUnitCells: [...prev, id].sort((a, b) => a - b) };
}

/** Write a compartment's label text, following the store's normalization. */
function writeText(config: CompartmentConfig, id: number, text: string): CompartmentConfig {
  const clamped = text.slice(0, TEXT_MAX_LENGTH);
  const next = (config.compartmentTexts ?? []).slice();
  while (next.length <= id) next.push('');
  next[id] = clamped;
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  return { ...config, compartmentTexts: next.length > 0 ? next : undefined };
}

/** Drop a compartment's label/plate/icon and drawn marker before its cells go. */
function clearCompartmentMetadata(config: CompartmentConfig, id: number): CompartmentConfig {
  let next = config;
  if (next.compartmentTexts?.[id]) next = writeText(next, id, '');
  if (next.labelPlateWidths?.[id] !== null && next.labelPlateWidths?.[id] !== undefined) {
    const widths = next.labelPlateWidths.slice();
    widths[id] = null;
    while (widths.length > 0 && widths[widths.length - 1] === null) widths.pop();
    next = { ...next, labelPlateWidths: widths.length > 0 ? widths : undefined };
  }
  if (next.labelIcons?.[id] !== null && next.labelIcons?.[id] !== undefined) {
    const icons = next.labelIcons.slice();
    icons[id] = null;
    while (icons.length > 0 && icons[icons.length - 1] === null) icons.pop();
    next = { ...next, labelIcons: icons.length > 0 ? icons : undefined };
  }
  if (next.drawnUnitCells?.includes(id)) {
    const marks = next.drawnUnitCells.filter((m) => m !== id);
    next = { ...next, drawnUnitCells: marks.length > 0 ? marks : undefined };
  }
  return next;
}

/**
 * Claim an exact set of cells for one new compartment. `rect` is the footprint's
 * bounding box, which is what the placement check runs against: a merged shape
 * is placed conservatively, matching the drag ghost the user aimed with.
 */
function drawFootprint(
  config: CompartmentConfig,
  rect: CellRect,
  indices: readonly number[]
): (DrawResult & { readonly remap: Map<number, number> }) | null {
  if (indices.length === 0 || !canPlaceRect(config, rect)) return null;
  // The one place a new id is minted from a caller-supplied index set, so the
  // one-connected-region invariant is enforced here rather than at each caller:
  // a stash mask can arrive disconnected from a hand-authored design file, and
  // two islands under one id print as two pockets sharing a label.
  if (!isContiguousSelection(config.cols, indices)) return null;
  const newCells = [...config.cells];
  const fresh = Math.max(...config.cells) + 1;
  for (const idx of indices) {
    newCells[idx] = fresh;
  }
  // Marked before the rebuild, not after: with `mergeBackground` on, an
  // unmarked 1×1 is indistinguishable from leftover and gets swallowed by the
  // run it sits in.
  const marked = indices.length === 1 ? addDrawnUnitCell(config, fresh) : config;
  const { config: rebuilt, remap } = rebuild(marked, newCells);
  const id = remap.get(fresh);
  if (id === undefined) return null;
  return { config: rebuilt, id, remap };
}

/**
 * Translate flat cell indices. Safe without re-deriving columns because callers
 * validate the translated BOUNDING BOX first, which keeps every cell in the grid
 * and stops a `dCol` shift from wrapping onto the next row.
 */
function translateIndices(
  cols: number,
  indices: readonly number[],
  dCol: number,
  dRow: number
): number[] {
  return indices.map((idx) => idx + dRow * cols + dCol);
}

/**
 * Draw a new compartment over background grid. Returns null when the rect
 * overlaps a drawn compartment or leaves the grid — the caller shows the
 * blocked ghost instead.
 */
export function drawCompartment(config: CompartmentConfig, rect: CellRect): DrawResult | null {
  return drawFootprint(config, rect, rectIndices(config.cols, rect));
}

/**
 * Remove a drawn compartment: its cells revert to background grid and its
 * label/decoration goes with it (delete semantics, unlike a split which
 * keeps the label on the first fragment).
 */
export function removeCompartment(config: CompartmentConfig, id: number): CompartmentConfig | null {
  const indices = getCellsForCompartment(config, id);
  if (indices.length === 0) return null;
  const cleared = clearCompartmentMetadata(config, id);
  const newCells = [...cleared.cells];
  let fresh = Math.max(...cleared.cells) + 1;
  for (const idx of indices) {
    newCells[idx] = fresh++;
  }
  return rebuild(cleared, newCells).config;
}

/** Translate a drawn compartment by whole cells. Null when blocked. */
export function moveCompartment(
  config: CompartmentConfig,
  id: number,
  dCol: number,
  dRow: number
): DrawResult | null {
  const rect = getCompartmentRect(config, id);
  if (!rect) return null;
  if (dCol === 0 && dRow === 0) return { config, id };
  const target: CellRect = { ...rect, col: rect.col + dCol, row: rect.row + dRow };
  if (!canPlaceRect(config, target, { ignoreId: id })) return null;
  const source = getCellsForCompartment(config, id);
  const newCells = [...config.cells];
  let fresh = Math.max(...config.cells) + 1;
  // Every source cell is released before any target cell is claimed: a short
  // move overlaps its own footprint, so interleaving the two loops would strand
  // a cell the compartment still occupies.
  for (const idx of source) {
    newCells[idx] = fresh++;
  }
  for (const idx of translateIndices(config.cols, source, dCol, dRow)) {
    newCells[idx] = id;
  }
  const { config: rebuilt, remap } = rebuild(config, newCells);
  const newId = remap.get(id);
  if (newId === undefined) return null;
  return { config: rebuilt, id: newId };
}

/**
 * Give a drawn compartment a new footprint (from a resize-handle drag).
 * Cells gained must be background; cells lost revert to background.
 */
export function resizeCompartment(
  config: CompartmentConfig,
  id: number,
  target: CellRect
): DrawResult | null {
  const rect = getCompartmentRect(config, id);
  if (!rect) return null;
  if (!canPlaceRect(config, target, { ignoreId: id })) return null;
  const newCells = [...config.cells];
  let fresh = Math.max(...config.cells) + 1;
  for (const idx of getCellsForCompartment(config, id)) {
    newCells[idx] = fresh++;
  }
  for (const idx of rectIndices(config.cols, target)) {
    newCells[idx] = id;
  }
  const marked = target.w === 1 && target.h === 1 ? addDrawnUnitCell(config, id) : config;
  const { config: rebuilt, remap } = rebuild(marked, newCells);
  const newId = remap.get(id);
  if (newId === undefined) return null;
  return { config: rebuilt, id: newId };
}

/**
 * Stamp a copy of a drawn compartment (label and plate decoration included)
 * onto background grid at `target`, which must match the source footprint.
 */
export function duplicateCompartment(
  config: CompartmentConfig,
  id: number,
  target: CellRect
): DrawResult | null {
  const rect = getCompartmentRect(config, id);
  if (!rect || rect.w !== target.w || rect.h !== target.h) return null;
  const stamped = drawFootprint(
    config,
    target,
    translateIndices(
      config.cols,
      getCellsForCompartment(config, id),
      target.col - rect.col,
      target.row - rect.row
    )
  );
  if (!stamped) return null;
  const { config: rebuilt, id: newId, remap } = stamped;
  const srcId = remap.get(id);
  if (srcId === undefined) return null;
  let next = rebuilt;
  const label = next.compartmentTexts?.[srcId];
  if (label) next = writeText(next, newId, label);
  const plate = next.labelPlateWidths?.[srcId];
  if (plate !== null && plate !== undefined) {
    const widths = (next.labelPlateWidths ?? []).slice();
    while (widths.length <= newId) widths.push(null);
    widths[newId] = plate;
    next = { ...next, labelPlateWidths: widths };
  }
  const icon = next.labelIcons?.[srcId];
  if (icon !== null && icon !== undefined) {
    const icons = (next.labelIcons ?? []).slice();
    while (icons.length <= newId) icons.push(null);
    icons[newId] = icon;
    next = { ...next, labelIcons: icons };
  }
  // Colour rides along like the other decorations — a duplicate that comes
  // out unpainted makes the user re-pick the swatch per copy.
  const color = next.compartmentColors?.[srcId];
  if (color !== null && color !== undefined) {
    const colors = (next.compartmentColors ?? []).slice();
    while (colors.length <= newId) colors.push(null);
    colors[newId] = color;
    next = { ...next, compartmentColors: colors };
    const scope = next.compartmentColorScopes?.[srcId];
    if (scope !== null && scope !== undefined) {
      const scopes = (next.compartmentColorScopes ?? []).slice();
      while (scopes.length <= newId) scopes.push(null);
      scopes[newId] = scope;
      next = { ...next, compartmentColorScopes: scopes };
    }
  }
  return { config: next, id: newId };
}

/**
 * Turn the merged-leftover mode on or off, re-deriving the grid either way.
 *
 * Turning it off has to hand every merged region back as the field of 1×1
 * pockets it was, or the leftover would keep printing as one pocket with the
 * mode reading as off.
 */
export function setMergeBackground(config: CompartmentConfig, enabled: boolean): CompartmentConfig {
  if ((config.mergeBackground ?? false) === enabled) return config;
  if (enabled) {
    const next: CompartmentConfig = { ...config, mergeBackground: true };
    return rebuild(next, [...next.cells]).config;
  }
  const drawn = getDrawnCompartmentIds(config);
  const cells = [...config.cells];
  let fresh = Math.max(...cells) + 1;
  for (let i = 0; i < cells.length; i++) {
    if (!drawn.has(cells[i])) cells[i] = fresh++;
  }
  const { backgroundIds: _background, mergeBackground: _mode, ...rest } = config;
  return rebuild(rest, cells).config;
}

/**
 * Fuse drawn compartments into one, which is how an interior gets an L, S, T
 * or U outline: the merged cells keep no wall between them.
 *
 * Null unless the union is one 4-connected region — two islands under one ID
 * would print as two pockets sharing a label and a dock entry. The
 * lowest-numbered compartment's label, plate and colour survive; the others'
 * go, as they do on delete.
 */
export function mergeCompartments(
  config: CompartmentConfig,
  ids: readonly number[]
): DrawResult | null {
  const drawn = getDrawnCompartmentIds(config);
  const unique = [...new Set(ids)];
  if (unique.length < 2 || unique.some((id) => !drawn.has(id))) return null;

  const wanted = new Set(unique);
  const indices: number[] = [];
  config.cells.forEach((id, i) => {
    if (wanted.has(id)) indices.push(i);
  });
  if (!isContiguousSelection(config.cols, indices)) return null;

  const target = Math.min(...unique);
  let next = config;
  for (const id of unique) {
    if (id !== target) next = clearCompartmentMetadata(next, id);
  }
  const cells = [...next.cells];
  for (const i of indices) cells[i] = target;

  const { config: rebuilt, remap } = rebuild(next, cells);
  const newId = remap.get(target);
  if (newId === undefined) return null;
  return { config: rebuilt, id: newId };
}

/**
 * Which cells of a compartment's bounding box it fills, row-major, or undefined
 * for a plain rectangle. Omitting the mask there keeps a rectangular stash entry
 * serializing exactly as it did before the field existed.
 */
function footprintMask(
  config: CompartmentConfig,
  id: number,
  rect: CellRect
): boolean[] | undefined {
  const owned = new Set(getCellsForCompartment(config, id));
  if (owned.size === rect.w * rect.h) return undefined;
  return rectIndices(config.cols, rect).map((idx) => owned.has(idx));
}

/**
 * Move a drawn compartment to the stash shelf, carrying its label and, for a
 * merged shape, the footprint its bounding box alone would lose. Null when the
 * stash is at capacity — the caller surfaces the reason.
 */
export function stashCompartment(config: CompartmentConfig, id: number): CompartmentConfig | null {
  const rect = getCompartmentRect(config, id);
  if (!rect) return null;
  if ((config.stash?.length ?? 0) >= DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES) return null;
  const label = config.compartmentTexts?.[id] ?? '';
  const mask = footprintMask(config, id, rect);
  const entry: StashedCompartment = {
    w: rect.w,
    h: rect.h,
    ...(mask ? { cells: mask } : {}),
    ...(label.length > 0 ? { label } : {}),
  };
  const removed = removeCompartment(config, id);
  if (!removed) return null;
  return { ...removed, stash: [...(config.stash ?? []), entry] };
}

/** Place a stash entry onto background grid; the rect must match its size. */
export function placeFromStash(
  config: CompartmentConfig,
  index: number,
  rect: CellRect
): DrawResult | null {
  const entry = config.stash?.[index];
  if (!entry) return null;
  if (rect.w !== entry.w || rect.h !== entry.h) return null;
  const mask = entry.cells;
  const box = rectIndices(config.cols, rect);
  const drawn = drawFootprint(config, rect, mask ? box.filter((_, i) => mask[i]) : box);
  if (!drawn) return null;
  let next = drawn.config;
  if (entry.label) next = writeText(next, drawn.id, entry.label);
  const stash = (config.stash ?? []).filter((_, i) => i !== index);
  next = { ...next, stash: stash.length > 0 ? stash : undefined };
  return { config: next, id: drawn.id };
}

/** Delete a stash entry outright. */
export function removeStashEntry(
  config: CompartmentConfig,
  index: number
): CompartmentConfig | null {
  const stash = config.stash;
  if (!stash || index < 0 || index >= stash.length) return null;
  const next = stash.filter((_, i) => i !== index);
  return { ...config, stash: next.length > 0 ? next : undefined };
}

/**
 * First background spot (scanning back-to-front, left-to-right — reading
 * order) where a w×h rect fits. Used by dock/context-menu Duplicate, which
 * has no drag target.
 */
export function findFreeRect(config: CompartmentConfig, w: number, h: number): CellRect | null {
  for (let row = config.rows - h; row >= 0; row--) {
    for (let col = 0; col + w <= config.cols; col++) {
      const rect: CellRect = { col, row, w, h };
      if (canPlaceRect(config, rect)) return rect;
    }
  }
  return null;
}

/**
 * Change the grid dimensions while PRESERVING drawn compartments, stashing
 * the ones that no longer fit (in reading order, so the shelf fills
 * predictably) and dropping only past the stash cap. Replaces the old
 * reset-to-uniform semantics for header dimension changes; the explicit
 * Reset action keeps its clearing behavior via `clearDrawnCompartments`.
 */
export function resizeGridPreservingCompartments(
  config: CompartmentConfig,
  newCols: number,
  newRows: number
): RegridResult {
  const drawnIds = getDrawnCompartmentIds(config);
  const maxId = Math.max(...config.cells);
  const newCells = new Array<number>(newCols * newRows).fill(-1);
  const stashAdditions: StashedCompartment[] = [];
  let droppedCount = 0;

  for (const id of getCompartmentReadingOrder(config)) {
    if (!drawnIds.has(id)) continue;
    const rect = getCompartmentRect(config, id);
    if (!rect) continue;
    if (rect.col + rect.w <= newCols && rect.row + rect.h <= newRows) {
      for (const idx of getCellsForCompartment(config, id)) {
        newCells[Math.floor(idx / config.cols) * newCols + (idx % config.cols)] = id;
      }
    } else if (
      (config.stash?.length ?? 0) + stashAdditions.length <
      DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES
    ) {
      const label = config.compartmentTexts?.[id] ?? '';
      const mask = footprintMask(config, id, rect);
      stashAdditions.push({
        w: rect.w,
        h: rect.h,
        ...(mask ? { cells: mask } : {}),
        ...(label.length > 0 ? { label } : {}),
      });
    } else {
      droppedCount++;
    }
  }

  let fresh = maxId + 1;
  for (let i = 0; i < newCells.length; i++) {
    if (newCells[i] === -1) newCells[i] = fresh++;
  }

  const base: CompartmentConfig = { ...config, cols: newCols, rows: newRows };
  let { config: rebuilt } = rebuild(base, newCells);
  if (stashAdditions.length > 0) {
    rebuilt = { ...rebuilt, stash: [...(config.stash ?? []), ...stashAdditions] };
  }
  return { config: rebuilt, stashedCount: stashAdditions.length, droppedCount };
}

/**
 * Clear every drawn compartment back to background grid. Labels, plate
 * decoration, colours and divider overrides go with them; the stash is
 * untouched. Every per-compartment array must be dropped here (gotcha 6's
 * grid-reset half): the rebuilt grid regenerates ids from scratch, so a kept
 * entry paints or captions an unrelated cell.
 */
export function clearDrawnCompartments(config: CompartmentConfig): CompartmentConfig {
  const cells: number[] = [];
  for (let i = 0; i < config.cols * config.rows; i++) {
    cells.push(i);
  }
  const {
    compartmentTexts: _texts,
    labelPlateWidths: _widths,
    labelIcons: _icons,
    dividerOverrides: _overrides,
    drawnUnitCells: _drawn,
    compartmentColors: _colors,
    compartmentColorScopes: _scopes,
    backgroundIds: _background,
    ...keep
  } = config;
  // Through the funnel so an empty grid in `mergeBackground` mode comes out as
  // the one pocket it should be, not the field of cells it was built as.
  return rebuild({ ...keep, cells }, cells).config;
}

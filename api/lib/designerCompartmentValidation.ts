/**
 * Server-side validation for the compartment family of designer params:
 * legacy `dividers`, the `cellMask`, and the current `compartments` object
 * (including per-compartment text and divider overrides).
 *
 * Split out of `designerValidation.ts` to keep that module under the
 * line-count budget. Pure functions — each returns an error string or `null`.
 */

import { isNumber, inRange, isObject } from './validationUtils.js';

import {
  CONSTRAINTS,
  VALID_LABEL_PLATE_ICONS,
  VALID_LABEL_PLATE_WIDTHS,
} from './designerValidationConstants.js';

/**
 * Whether a stash footprint mask is one 4-connected region. Mirrors
 * `isContiguousSelection` on the client: two islands under one id would print
 * as two pockets sharing a label.
 */
function isMaskContiguous(mask: readonly boolean[], w: number): boolean {
  const start = mask.indexOf(true);
  if (start < 0) return false;
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const idx = queue.pop() as number;
    const col = idx % w;
    // Row bounds fall out of the index range check below; only the column
    // steps need guarding, or a step off the left edge wraps onto the row above.
    const neighbours = [col > 0 ? idx - 1 : -1, col < w - 1 ? idx + 1 : -1, idx - w, idx + w];
    for (const n of neighbours) {
      if (n < 0 || n >= mask.length || seen.has(n) || !mask[n]) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen.size === mask.filter(Boolean).length;
}

/** Mirrors `HEX_COLOR_REGEX` in `designerValidation.ts`. */
const COMPARTMENT_HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Mirrors the client `CompartmentColorScope` union. */
const VALID_COMPARTMENT_COLOR_SCOPES: readonly string[] = ['floor', 'floorAndWalls'];

/**
 * Validates a dividers object (legacy format) ensuring x and y counts and thickness fall within allowed ranges.
 *
 * @param dividers - The value to validate as a dividers object (expected to have `x`, `y`, and `thickness`).
 * @returns A `string` with a human-readable error message for the first failed check, or `null` if `dividers` is valid.
 */
export function validateDividers(dividers: unknown): string | null {
  if (!isObject(dividers)) return 'dividers must be an object';
  if (!isNumber(dividers.x) || !inRange(dividers.x, 0, CONSTRAINTS.MAX_DIVIDERS)) {
    return `dividers.x must be 0-${CONSTRAINTS.MAX_DIVIDERS}`;
  }
  if (!isNumber(dividers.y) || !inRange(dividers.y, 0, CONSTRAINTS.MAX_DIVIDERS)) {
    return `dividers.y must be 0-${CONSTRAINTS.MAX_DIVIDERS}`;
  }
  if (
    !isNumber(dividers.thickness) ||
    !inRange(
      dividers.thickness,
      CONSTRAINTS.MIN_DIVIDER_THICKNESS,
      CONSTRAINTS.MAX_DIVIDER_THICKNESS
    )
  ) {
    return `dividers.thickness must be ${CONSTRAINTS.MIN_DIVIDER_THICKNESS}-${CONSTRAINTS.MAX_DIVIDER_THICKNESS}`;
  }
  return null;
}

/**
 * Validates a cellMask object for share payloads.
 *
 * Mirrors the client-side `validateMask` in `src/shared/utils/cellMask.ts`
 * minus the expensive flood-fill checks — server-side we only need to
 * guard dimensions + cell-array size so a crafted share can't allocate
 * unbounded memory when a viewer loads it. The full structural check
 * runs client-side once the generator touches the mask.
 *
 * @param mask - The value to validate as a cellMask (expected `{ cols, rows, cells }`).
 * @returns An error string, or `null` if the mask is structurally sound.
 */
export function validateCellMask(mask: unknown): string | null {
  if (!isObject(mask)) return 'cellMask must be an object';
  if (
    !isNumber(mask.cols) ||
    !inRange(mask.cols, 1, CONSTRAINTS.MAX_MASK_DIMENSION) ||
    !Number.isInteger(mask.cols)
  ) {
    return `cellMask.cols must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`;
  }
  if (
    !isNumber(mask.rows) ||
    !inRange(mask.rows, 1, CONSTRAINTS.MAX_MASK_DIMENSION) ||
    !Number.isInteger(mask.rows)
  ) {
    return `cellMask.rows must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`;
  }
  if (!Array.isArray(mask.cells)) return 'cellMask.cells must be an array';
  const cells = mask.cells as unknown[];
  const expected = mask.cols * mask.rows;
  if (cells.length !== expected) {
    return `cellMask.cells length must be cols × rows (${expected})`;
  }
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (v !== 0 && v !== 1) return `cellMask.cells[${i}] must be 0 or 1`;
  }
  return null;
}

/**
 * Validates a compartments object (new format) ensuring cols, rows, thickness, and cells array are valid.
 *
 * @param compartments - The value to validate as a compartments object (expected to have `cols`, `rows`, `thickness`, and `cells`).
 * @returns A `string` with a human-readable error message for the first failed check, or `null` if `compartments` is valid.
 */
export function validateCompartments(compartments: unknown): string | null {
  if (!isObject(compartments)) return 'compartments must be an object';
  if (
    !isNumber(compartments.cols) ||
    !inRange(
      compartments.cols,
      CONSTRAINTS.MIN_COMPARTMENT_GRID,
      CONSTRAINTS.MAX_COMPARTMENT_GRID
    ) ||
    !Number.isInteger(compartments.cols)
  ) {
    return `compartments.cols must be integer ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
  }
  if (
    !isNumber(compartments.rows) ||
    !inRange(
      compartments.rows,
      CONSTRAINTS.MIN_COMPARTMENT_GRID,
      CONSTRAINTS.MAX_COMPARTMENT_GRID
    ) ||
    !Number.isInteger(compartments.rows)
  ) {
    return `compartments.rows must be integer ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
  }
  if (
    !isNumber(compartments.thickness) ||
    !inRange(
      compartments.thickness,
      CONSTRAINTS.MIN_COMPARTMENT_THICKNESS,
      CONSTRAINTS.MAX_COMPARTMENT_THICKNESS
    )
  ) {
    return `compartments.thickness must be ${CONSTRAINTS.MIN_COMPARTMENT_THICKNESS}-${CONSTRAINTS.MAX_COMPARTMENT_THICKNESS}`;
  }
  if (!Array.isArray(compartments.cells)) return 'compartments.cells must be an array';
  const expectedLength = compartments.cols * compartments.rows;
  if (compartments.cells.length !== expectedLength) {
    return `compartments.cells length must be cols × rows (${expectedLength})`;
  }
  // Each cell must be a non-negative integer compartment ID. The
  // dividerOverrides validator below derives its knownIds set from cells
  // and runs an adjacency check that assumes integer IDs — a crafted
  // payload could otherwise smuggle in floats/strings and break both
  // checks silently.
  for (let i = 0; i < compartments.cells.length; i++) {
    const c = compartments.cells[i] as unknown;
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0) {
      return `compartments.cells[${i}] must be a non-negative integer`;
    }
  }
  // Optional per-compartment engraved text. Mirrors the client-side
  // `TEXT_MAX_LENGTH = 50` cap so a direct HTTP POST can't smuggle in
  // unbounded strings that bypass `setCompartmentText`. Array length
  // can't exceed the total cell count (one slot per possible compartment ID).
  if (compartments.compartmentTexts !== undefined) {
    if (!Array.isArray(compartments.compartmentTexts)) {
      return 'compartments.compartmentTexts must be an array';
    }
    if (compartments.compartmentTexts.length > expectedLength) {
      return `compartments.compartmentTexts length must not exceed cols × rows (${expectedLength})`;
    }
    for (let i = 0; i < compartments.compartmentTexts.length; i++) {
      const t = compartments.compartmentTexts[i] as unknown;
      if (typeof t !== 'string') {
        return `compartments.compartmentTexts[${i}] must be a string`;
      }
      if (t.length > 50) {
        return `compartments.compartmentTexts[${i}] must not exceed 50 characters`;
      }
    }
  }
  // Optional per-compartment swappable-label plate width overrides.
  // Entries are null (auto) or a standard plate width; length bounded like
  // compartmentTexts so a direct HTTP POST can't smuggle an unbounded array.
  if (compartments.labelPlateWidths !== undefined) {
    if (!Array.isArray(compartments.labelPlateWidths)) {
      return 'compartments.labelPlateWidths must be an array';
    }
    if (compartments.labelPlateWidths.length > expectedLength) {
      return `compartments.labelPlateWidths length must not exceed cols × rows (${expectedLength})`;
    }
    for (let i = 0; i < compartments.labelPlateWidths.length; i++) {
      const w = compartments.labelPlateWidths[i] as unknown;
      if (w !== null && !VALID_LABEL_PLATE_WIDTHS.includes(w as number)) {
        return `compartments.labelPlateWidths[${i}] must be null or one of: ${VALID_LABEL_PLATE_WIDTHS.join(', ')}`;
      }
    }
  }
  // Optional per-compartment plate hardware icons. Entries
  // are null (no icon) or an allowlisted icon id; bounded like the widths.
  if (compartments.labelIcons !== undefined) {
    if (!Array.isArray(compartments.labelIcons)) {
      return 'compartments.labelIcons must be an array';
    }
    if (compartments.labelIcons.length > expectedLength) {
      return `compartments.labelIcons length must not exceed cols × rows (${expectedLength})`;
    }
    for (let i = 0; i < compartments.labelIcons.length; i++) {
      const icon = compartments.labelIcons[i] as unknown;
      if (icon !== null && !VALID_LABEL_PLATE_ICONS.includes(icon as string)) {
        return `compartments.labelIcons[${i}] must be null or one of: ${VALID_LABEL_PLATE_ICONS.join(', ')}`;
      }
    }
  }
  // Optional per-compartment shadow-box colours. Entries are null (uncoloured)
  // or a hex string; the pattern mirrors `HEX_COLOR_REGEX` in
  // `designerValidation.ts` and the length is bounded like the arrays above so a
  // direct HTTP POST can't smuggle an unbounded array past the store action.
  if (compartments.compartmentColors !== undefined) {
    if (!Array.isArray(compartments.compartmentColors)) {
      return 'compartments.compartmentColors must be an array';
    }
    if (compartments.compartmentColors.length > expectedLength) {
      return `compartments.compartmentColors length must not exceed cols × rows (${expectedLength})`;
    }
    for (let i = 0; i < compartments.compartmentColors.length; i++) {
      const c = compartments.compartmentColors[i] as unknown;
      if (c !== null && !(typeof c === 'string' && COMPARTMENT_HEX_COLOR_REGEX.test(c))) {
        return `compartments.compartmentColors[${i}] must be null or a hex color`;
      }
    }
  }
  // Optional per-compartment paint scope, parallel to the colours above.
  if (compartments.compartmentColorScopes !== undefined) {
    if (!Array.isArray(compartments.compartmentColorScopes)) {
      return 'compartments.compartmentColorScopes must be an array';
    }
    if (compartments.compartmentColorScopes.length > expectedLength) {
      return `compartments.compartmentColorScopes length must not exceed cols × rows (${expectedLength})`;
    }
    for (let i = 0; i < compartments.compartmentColorScopes.length; i++) {
      const s = compartments.compartmentColorScopes[i] as unknown;
      if (s !== null && !VALID_COMPARTMENT_COLOR_SCOPES.includes(s as string)) {
        return `compartments.compartmentColorScopes[${i}] must be null or one of: ${VALID_COMPARTMENT_COLOR_SCOPES.join(', ')}`;
      }
    }
  }
  // Optional global divider height. Either the literal 'auto' or a finite
  // millimeter value within the bin's possible interior height range. A direct
  // HTTP POST could otherwise smuggle in NaN/absurd values; the generator
  // clamps, but reject early to keep payloads honest. Read off the label-tab
  // cap rather than restated, so raising MAX_HEIGHT cannot leave a bin whose
  // dividers are rejected at a height its own walls reach.
  if (compartments.dividerHeight !== undefined) {
    const h = compartments.dividerHeight;
    if (h !== 'auto' && (!isNumber(h) || !inRange(h, 0, CONSTRAINTS.MAX_LABEL_TAB_HEIGHT))) {
      return `compartments.dividerHeight must be 'auto' or a number 0-${CONSTRAINTS.MAX_LABEL_TAB_HEIGHT}`;
    }
  }
  // Optional per-divider tilt overrides. Mirrors the client-side
  // `DIVIDER_OFFSET_MAX_MM = 200` cap and the canonical pair ordering rule
  // (compartmentA < compartmentB) so a direct HTTP POST can't smuggle in
  // unordered or absurd overrides that bypass the store action. Also
  // verifies (1) both compartment IDs actually exist in cells and (2) the
  // pair is adjacent — same checks the client validator does.
  if (compartments.dividerOverrides !== undefined) {
    if (!Array.isArray(compartments.dividerOverrides)) {
      return 'compartments.dividerOverrides must be an array';
    }
    if (compartments.dividerOverrides.length > expectedLength * 2) {
      return `compartments.dividerOverrides length is unreasonably large`;
    }
    const knownIds = new Set<number>();
    for (const cell of compartments.cells as unknown[]) {
      if (typeof cell === 'number' && Number.isInteger(cell)) knownIds.add(cell);
    }
    const seenPairs = new Set<string>();
    for (let i = 0; i < compartments.dividerOverrides.length; i++) {
      const o = compartments.dividerOverrides[i] as Record<string, unknown>;
      if (!isObject(o)) {
        return `compartments.dividerOverrides[${i}] must be an object`;
      }
      if (!isNumber(o.compartmentA) || !Number.isInteger(o.compartmentA) || o.compartmentA < 0) {
        return `compartments.dividerOverrides[${i}].compartmentA must be a non-negative integer`;
      }
      if (!isNumber(o.compartmentB) || !Number.isInteger(o.compartmentB) || o.compartmentB < 0) {
        return `compartments.dividerOverrides[${i}].compartmentB must be a non-negative integer`;
      }
      if (o.compartmentA >= o.compartmentB) {
        return `compartments.dividerOverrides[${i}] must have compartmentA < compartmentB`;
      }
      if (!knownIds.has(o.compartmentA) || !knownIds.has(o.compartmentB)) {
        return `compartments.dividerOverrides[${i}] references unknown compartment ID`;
      }
      if (!compartmentsAreAdjacent(compartments, o.compartmentA, o.compartmentB)) {
        return `compartments.dividerOverrides[${i}] compartments are not adjacent`;
      }
      if (!isNumber(o.offsetStart) || !inRange(o.offsetStart, -200, 200)) {
        return `compartments.dividerOverrides[${i}].offsetStart must be -200..200`;
      }
      if (!isNumber(o.offsetEnd) || !inRange(o.offsetEnd, -200, 200)) {
        return `compartments.dividerOverrides[${i}].offsetEnd must be -200..200`;
      }
      // Absolute bound only; the client clamps to the bin's own envelope. Past
      // +-80 the tangent runs away fast enough that a rounded value swings the
      // foot metres, clipping the divider to nothing at generation.
      if (o.rakeDeg !== undefined && (!isNumber(o.rakeDeg) || !inRange(o.rakeDeg, -80, 80))) {
        return `compartments.dividerOverrides[${i}].rakeDeg must be -80..80`;
      }
      const key = `${o.compartmentA}|${o.compartmentB}`;
      if (seenPairs.has(key)) {
        return `compartments.dividerOverrides has duplicate pair ${key}`;
      }
      seenPairs.add(key);
    }
  }
  // Optional drawn-unit-cell markers (Bento workspace). Each entry must be a
  // compartment ID that exists in cells AND occupies exactly one cell — a
  // marker on a multi-cell compartment is redundant client-side and a marker
  // on an unknown ID would resurface on a later split. Bounded by the cell
  // count and deduplicated so a crafted payload can't inflate the array.
  if (compartments.drawnUnitCells !== undefined) {
    if (!Array.isArray(compartments.drawnUnitCells)) {
      return 'compartments.drawnUnitCells must be an array';
    }
    if (compartments.drawnUnitCells.length > expectedLength) {
      return `compartments.drawnUnitCells length must not exceed cols × rows (${expectedLength})`;
    }
    const cellCounts = new Map<number, number>();
    for (const cell of compartments.cells as unknown[]) {
      if (typeof cell === 'number') cellCounts.set(cell, (cellCounts.get(cell) ?? 0) + 1);
    }
    const seenMarks = new Set<number>();
    for (let i = 0; i < compartments.drawnUnitCells.length; i++) {
      const id = compartments.drawnUnitCells[i] as unknown;
      if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) {
        return `compartments.drawnUnitCells[${i}] must be a non-negative integer`;
      }
      if (cellCounts.get(id) !== 1) {
        return `compartments.drawnUnitCells[${i}] must reference a 1×1 compartment`;
      }
      if (seenMarks.has(id)) {
        return `compartments.drawnUnitCells has duplicate ID ${id}`;
      }
      seenMarks.add(id);
    }
  }
  // Bento's merged-leftover mode and the markers that name the merged regions.
  // Marker IDs must exist in `cells`; a marker on a compartment the user drew
  // would demote it to background on the next edit.
  if (
    compartments.mergeBackground !== undefined &&
    typeof compartments.mergeBackground !== 'boolean'
  ) {
    return 'compartments.mergeBackground must be a boolean';
  }
  if (compartments.backgroundIds !== undefined) {
    if (!Array.isArray(compartments.backgroundIds)) {
      return 'compartments.backgroundIds must be an array';
    }
    // The markers only mean anything in merged-leftover mode. Without the mode
    // the client would still demote those compartments to background, so a
    // payload carrying one without the other is inconsistent, not just odd.
    if (compartments.mergeBackground !== true) {
      return 'compartments.backgroundIds requires compartments.mergeBackground';
    }
    if (compartments.backgroundIds.length > expectedLength) {
      return `compartments.backgroundIds length must not exceed cols × rows (${expectedLength})`;
    }
    const known = new Set<number>();
    for (const cell of compartments.cells as unknown[]) {
      if (typeof cell === 'number') known.add(cell);
    }
    const seenBackground = new Set<number>();
    for (let i = 0; i < compartments.backgroundIds.length; i++) {
      const id = compartments.backgroundIds[i] as unknown;
      if (typeof id !== 'number' || !Number.isInteger(id) || id < 0) {
        return `compartments.backgroundIds[${i}] must be a non-negative integer`;
      }
      if (!known.has(id)) {
        return `compartments.backgroundIds[${i}] must reference an existing compartment`;
      }
      if (seenBackground.has(id)) {
        return `compartments.backgroundIds has duplicate ID ${id}`;
      }
      seenBackground.add(id);
    }
  }
  // Optional off-grid stash (Bento workspace). Entries are free-floating
  // footprints with an optional label. MAX_STASH_ENTRIES is the server half
  // of the cap contract — the client refuses to stash past it, so an honest
  // payload is never rejected here (gotcha 13b). The label field name must
  // stay `label`: `collectDesignText` moderates object properties by their
  // own key and 'label' is already in TEXT_BEARING_KEYS (gotcha 13c).
  if (compartments.stash !== undefined) {
    if (!Array.isArray(compartments.stash)) {
      return 'compartments.stash must be an array';
    }
    if (compartments.stash.length > CONSTRAINTS.MAX_STASH_ENTRIES) {
      return `compartments.stash must not exceed ${CONSTRAINTS.MAX_STASH_ENTRIES} entries`;
    }
    for (let i = 0; i < compartments.stash.length; i++) {
      const entry = compartments.stash[i] as Record<string, unknown>;
      if (!isObject(entry)) {
        return `compartments.stash[${i}] must be an object`;
      }
      if (
        !isNumber(entry.w) ||
        !Number.isInteger(entry.w) ||
        !inRange(entry.w, 1, CONSTRAINTS.MAX_COMPARTMENT_GRID)
      ) {
        return `compartments.stash[${i}].w must be integer 1-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
      }
      if (
        !isNumber(entry.h) ||
        !Number.isInteger(entry.h) ||
        !inRange(entry.h, 1, CONSTRAINTS.MAX_COMPARTMENT_GRID)
      ) {
        return `compartments.stash[${i}].h must be integer 1-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
      }
      // Footprint mask for a merged (non-rectangular) shape. An all-true mask
      // is rejected rather than tolerated: absent IS the rectangle, and two
      // encodings of one shape would give the same design two fingerprints.
      if (entry.cells !== undefined) {
        if (!Array.isArray(entry.cells)) {
          return `compartments.stash[${i}].cells must be an array`;
        }
        const mask = entry.cells as unknown[];
        if (mask.length !== entry.w * entry.h) {
          return `compartments.stash[${i}].cells length must equal w × h (${entry.w * entry.h})`;
        }
        let filled = 0;
        for (let c = 0; c < mask.length; c++) {
          if (typeof mask[c] !== 'boolean') {
            return `compartments.stash[${i}].cells[${c}] must be a boolean`;
          }
          if (mask[c] === true) filled++;
        }
        if (filled === 0) {
          return `compartments.stash[${i}].cells must fill at least one cell`;
        }
        if (filled === mask.length) {
          return `compartments.stash[${i}].cells must be omitted when every cell is filled`;
        }
        if (!isMaskContiguous(mask as boolean[], entry.w)) {
          return `compartments.stash[${i}].cells must form one connected region`;
        }
      }
      if (entry.label !== undefined) {
        if (typeof entry.label !== 'string') {
          return `compartments.stash[${i}].label must be a string`;
        }
        if (entry.label.length > 50) {
          return `compartments.stash[${i}].label must not exceed 50 characters`;
        }
      }
    }
  }
  return null;
}

/**
 * Server-side adjacency check mirroring the client helper. Two compartments
 * are adjacent if any pair of orthogonally-neighboring cells holds them.
 */
function compartmentsAreAdjacent(
  compartments: Record<string, unknown>,
  a: number,
  b: number
): boolean {
  const cols = compartments.cols as number;
  const rows = compartments.rows as number;
  const cells = compartments.cells as readonly number[];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = cells[row * cols + col];
      if (id !== a && id !== b) continue;
      if (col + 1 < cols) {
        const r = cells[row * cols + (col + 1)];
        if ((id === a && r === b) || (id === b && r === a)) return true;
      }
      if (row + 1 < rows) {
        const d = cells[(row + 1) * cols + col];
        if ((id === a && d === b) || (id === b && d === a)) return true;
      }
    }
  }
  return false;
}

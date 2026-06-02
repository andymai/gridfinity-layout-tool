/**
 * Server-side validation for the compartment family of designer params:
 * legacy `dividers`, the `cellMask`, and the current `compartments` object
 * (including per-compartment text and divider overrides).
 *
 * Split out of `designerValidation.ts` to keep that module under the
 * line-count budget. Pure functions — each returns an error string or `null`.
 */

import { isNumber, inRange, isObject } from './validationUtils.js';
import { CONSTRAINTS } from './designerValidationConstants.js';

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
    !inRange(compartments.cols, CONSTRAINTS.MIN_COMPARTMENT_GRID, CONSTRAINTS.MAX_COMPARTMENT_GRID)
  ) {
    return `compartments.cols must be ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
  }
  if (
    !isNumber(compartments.rows) ||
    !inRange(compartments.rows, CONSTRAINTS.MIN_COMPARTMENT_GRID, CONSTRAINTS.MAX_COMPARTMENT_GRID)
  ) {
    return `compartments.rows must be ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
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
      const key = `${o.compartmentA}|${o.compartmentB}`;
      if (seenPairs.has(key)) {
        return `compartments.dividerOverrides has duplicate pair ${key}`;
      }
      seenPairs.add(key);
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

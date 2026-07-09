/**
 * Server-side numeric constraints for designer share payloads.
 *
 * These mirror the client `DESIGNER_CONSTRAINTS` in
 * `src/features/bin-designer/constants/gridfinity.ts` — keep in sync.
 * Extracted so both `designerValidation.ts` and the compartment validators
 * can share them without a circular import.
 */
export const CONSTRAINTS = {
  MIN_DIMENSION: 0.5,
  MAX_DIMENSION: 16,
  MIN_HEIGHT: 2,
  MAX_HEIGHT: 20,
  MAX_DIVIDERS: 10,
  MIN_DIVIDER_THICKNESS: 0.8,
  MAX_DIVIDER_THICKNESS: 2.4,
  MIN_COMPARTMENT_GRID: 1,
  MAX_COMPARTMENT_GRID: 12,
  MIN_COMPARTMENT_THICKNESS: 0.4,
  MAX_COMPARTMENT_THICKNESS: 2.4,
  MIN_LABEL_TAB_DEPTH: 8,
  // Raised from 20 → 50 in #1898 to enable tuck-under ledges for wire bins.
  MAX_LABEL_TAB_DEPTH: 50,
  MIN_LABEL_TAB_WIDTH: 10, // %
  MAX_LABEL_TAB_WIDTH: 100, // %
  // Label tab height is the Z of the shelf top above the cavity floor (mm).
  // Static bounds for API payloads — the client's UI uses a dynamic max
  // tied to the current bin's interior height. Floor (9) = MIN_LABEL_TAB_DEPTH + 1;
  // ceiling (140) = MAX_HEIGHT * 7mm (heightUnitMm).
  MIN_LABEL_TAB_HEIGHT: 9,
  MAX_LABEL_TAB_HEIGHT: 140,
  // Inset moves the tab inward from its anchor wall (#1898).
  MIN_LABEL_TAB_INSET: 0,
  MAX_LABEL_TAB_INSET: 100,
  MAGNET_MIN_DEPTH: 2.0,
  MAGNET_MAX_DEPTH: 4.0,
  // Exterior-wall collar (issue #2500) — mirrors client
  // MIN/MAX_EXTRA_WALL_HEIGHT so a crafted share can't smuggle a runaway
  // wall height into the BREP worker.
  MIN_EXTRA_WALL_HEIGHT: 0,
  MAX_EXTRA_WALL_HEIGHT: 100,
  MAX_INSERTS: 20,
  MAX_INSERT_DIMENSION: 200,
  MAX_INSERT_DEPTH: 50,
  MAX_PAYLOAD_BYTES: 100_000, // 100KB max for designer shares
  // Mask cells are half-bin resolution: 10 grid units × 2 = 20 cells per
  // side. Mirrors MAX_MASK_DIMENSION in `src/shared/utils/cellMask.ts`.
  MAX_MASK_DIMENSION: 20,
} as const;

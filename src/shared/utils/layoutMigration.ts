import { CONSTRAINTS } from '@/core/constants';
import { withSanitizedItems } from './binItems';
import { migrateSlant } from './slantPlan';

export function migrateLayoutFields(data: Record<string, unknown>): unknown {
  const { maxPrintSize, ...migrated } = data;
  const gridUnitMm =
    typeof data.gridUnitMm === 'number' ? data.gridUnitMm : CONSTRAINTS.GRID_UNIT_MM_DEFAULT;
  migrated.gridUnitMm = gridUnitMm;
  if (typeof data.heightUnitMm !== 'number') {
    migrated.heightUnitMm = CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT;
  }

  const unitScale = gridUnitMm || CONSTRAINTS.GRID_UNIT_MM_DEFAULT;
  let printBedSize: number = CONSTRAINTS.PRINT_BED_MM_DEFAULT;
  if (typeof data.printBedSize === 'number') {
    printBedSize = data.printBedSize;
  } else if (typeof maxPrintSize === 'number') {
    printBedSize = maxPrintSize * unitScale;
  }
  // No real bed is under the mm minimum, so a smaller value was saved in grid units.
  if (printBedSize < CONSTRAINTS.PRINT_BED_MM_MIN) {
    printBedSize *= unitScale;
  }
  migrated.printBedSize = printBedSize;
  if (Array.isArray(data.bins)) {
    migrated.bins = data.bins.map((bin: unknown) => withSanitizedSlant(withSanitizedItems(bin)));
  }
  return migrated;
}

/** A malformed or upright slant leaves no key, like a design's. */
function withSanitizedSlant(bin: unknown): unknown {
  if (typeof bin !== 'object' || bin === null || !('slant' in bin)) return bin;
  const { slant, ...rest } = bin as Record<string, unknown>;
  const clean = migrateSlant(slant);
  return clean ? { ...rest, slant: clean } : rest;
}

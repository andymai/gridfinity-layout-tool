import type { ToolFamilyId, ToolUnits } from '@/shared/types/toolSet';
import combinationWrenchTable from './tables/combinationWrench.json';

/** One wrench size from a family's table, in mm. */
export interface WrenchSizeEntry {
  readonly key: string;
  /** Jaw opening, which orders the sizes. */
  readonly jawMm: number;
  readonly lengthMm: number;
  readonly openWidthMm: number;
  readonly boxWidthMm: number;
  readonly openThicknessMm: number;
  /** The box end's height lying flat, its 15° crank included. */
  readonly boxHeightMm: number;
  readonly shankWidthMm: number;
}

export interface WrenchTable {
  readonly jawAngleDeg: number;
  readonly metric: readonly WrenchSizeEntry[];
  readonly sae: readonly WrenchSizeEntry[];
}

export interface ToolFamily {
  readonly id: ToolFamilyId;
  readonly table: WrenchTable;
  /** Common store sets, as size keys, offered as one-click picks. */
  readonly presets: Readonly<Record<ToolUnits, readonly (readonly string[])[]>>;
}

const wrenchTable = combinationWrenchTable as WrenchTable;

export const TOOL_FAMILIES: Readonly<Record<ToolFamilyId, ToolFamily>> = {
  combinationWrench: {
    id: 'combinationWrench',
    table: wrenchTable,
    presets: {
      metric: [
        ['8', '10', '12', '13', '14', '17', '19'],
        ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'],
        [
          '6',
          '7',
          '8',
          '9',
          '10',
          '11',
          '12',
          '13',
          '14',
          '15',
          '16',
          '17',
          '18',
          '19',
          '21',
          '22',
          '24',
        ],
      ],
      sae: [
        ['3/8', '7/16', '1/2', '9/16', '5/8', '11/16', '3/4'],
        ['1/4', '5/16', '3/8', '7/16', '1/2', '9/16', '5/8', '11/16', '3/4', '13/16', '7/8'],
      ],
    },
  },
};

export function sizeEntries(
  family: ToolFamily,
  units: ToolUnits,
  keys: readonly string[]
): WrenchSizeEntry[] {
  const wanted = new Set(keys);
  return family.table[units]
    .filter((entry) => wanted.has(entry.key))
    .sort((a, b) => a.jawMm - b.jawMm);
}

/**
 * How much narrower than the print bed a set must be: the bin's walls and
 * tolerance plus the margin kept around the set.
 */
const BED_ALLOWANCE_MM = 10;

export function setLimitOnBed(bedMm: number): number {
  return bedMm - BED_ALLOWANCE_MM;
}

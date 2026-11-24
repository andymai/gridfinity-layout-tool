export type ToolFamilyId = 'combinationWrench';
export type ToolUnits = 'metric' | 'sae';
export type ToolSetStyle = 'flat';

export const TOOL_FAMILY_IDS: readonly ToolFamilyId[] = ['combinationWrench'];
export const TOOL_UNITS: readonly ToolUnits[] = ['metric', 'sae'];
export const TOOL_SET_STYLES: readonly ToolSetStyle[] = ['flat'];

/**
 * What a tool set group was generated from, kept on the bin so "Edit set" can
 * rebuild the group. The tool list doubles as the record of what the bin holds.
 */
export interface ToolSetSpec {
  readonly family: ToolFamilyId;
  readonly units: ToolUnits;
  /** Size keys from the family's table, e.g. `13` or `1/2`. */
  readonly sizes: string[];
  readonly style: ToolSetStyle;
  readonly clearanceMm: number;
  /** Cap height of the engraved sizes; 0 leaves them off. */
  readonly labelSizeMm: number;
  readonly fingerChannel: boolean;
}

export const TOOL_SET_LIMITS = {
  maxSizes: 30,
  maxSizeKeyLength: 12,
  clearanceMm: { min: 0, max: 2 },
  labelSizeMm: { min: 0, max: 12 },
} as const;

export const DEFAULT_TOOL_SET_CLEARANCE_MM = 0.4;
export const DEFAULT_TOOL_SET_LABEL_MM = 5;
